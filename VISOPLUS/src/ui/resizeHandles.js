/**
 * Resize Handles Overlay (single transform usage)
 */
import { selection } from '../core/selection.js';
import { model } from '../core/model.js';
import { on, emit } from '../core/events.js';
import { applyBaseTransform } from '../core/render.js';
import { clientPointToWorld } from '../core/pointer.js';

let resizing = false;
let activeHandle = null;
let startWorld = null;
let originalBBox = null;
let originalShapes = null;
let aspectRatio = 1;
let originalSelectionIds = null;

const HANDLE_NAMES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const MIN_SIZE = 10;

function currentSelectionShapes() {
    return [...selection.shapes].map(id => model.shapes.get(id)).filter(Boolean);
}

function computeBBox(shapes) {
    if (!shapes.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const s of shapes) {
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + s.w);
        maxY = Math.max(maxY, s.y + s.h);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function handleCenters(bbox) {
    const { x, y, w, h } = bbox;
    return {
        nw: { x, y },
        n: { x: x + w / 2, y },
        ne: { x: x + w, y },
        e: { x: x + w, y: y + h / 2 },
        se: { x: x + w, y: y + h },
        s: { x: x + w / 2, y: y + h },
        sw: { x, y: y + h },
        w: { x, y: y + h / 2 }
    };
}

function drawOverlay() {
    const canvas = document.getElementById('diagram-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const shapes = currentSelectionShapes();
    if (!shapes.length) return;

    const bbox = computeBBox(shapes);
    if (!bbox) return;

    ctx.save();
    applyBaseTransform(ctx);

    ctx.setLineDash([5, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ff7f2a';
    ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);
    ctx.setLineDash([]);

    const zoom = model.meta.zoom;
    const handleSize = 12 / zoom;
    const half = handleSize / 2;
    const centers = handleCenters(bbox);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff7f2a';
    ctx.lineWidth = 1;
    for (const h of HANDLE_NAMES) {
        const p = centers[h];
        ctx.beginPath();
        ctx.rect(p.x - half, p.y - half, handleSize, handleSize);
        ctx.fill();
        ctx.stroke();
    }

    ctx.restore();
}

function hitHandle(worldPt, bbox) {
    const size = 12 / model.meta.zoom;
    const half = size / 2;
    const centers = handleCenters(bbox);
    for (const name of HANDLE_NAMES) {
        const p = centers[name];
        if (
            worldPt.x >= p.x - half &&
            worldPt.x <= p.x + half &&
            worldPt.y >= p.y - half &&
            worldPt.y <= p.y + half
        ) return name;
    }
    return null;
}

function startResize(handle, startPt, bbox, shapes) {
    resizing = true;
    activeHandle = handle;
    startWorld = startPt;
    originalBBox = bbox;
    originalShapes = shapes.map(s => ({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h }));
    originalSelectionIds = [...selection.shapes].sort();
    aspectRatio = bbox.w / (bbox.h || 1);
    emit('resizeHandles:active', { active: true });
}

function abortResize(silent = false) {
    if (!resizing) return;
    resizing = false;
    activeHandle = null;
    startWorld = null;
    originalBBox = null;
    originalShapes = null;
    originalSelectionIds = null;
    if (!silent) emit('resizeHandles:active', { active: false });
}

function finishResize() {
    if (!resizing) return;
    const changed = originalShapes.map(s => s.id);
    abortResize(true);
    emit('resizeHandles:active', { active: false });
    emit('model:changed', { reason: 'resize', changed: { shapes: changed } });
}

function onMouseDown(e) {
    if (e.button !== 0) return;
    if (!selection.shapes.size) return;
    const shapes = currentSelectionShapes();
    if (!shapes.length) return;
    const bbox = computeBBox(shapes);
    if (!bbox) return;

    const worldPt = clientPointToWorld(e.clientX, e.clientY);
    const handle = hitHandle(worldPt, bbox);
    if (!handle) return;

    startResize(handle, worldPt, bbox, shapes);
    e.preventDefault();
}

function onMouseMove(e) {
    if (!resizing) return;
    const currentIds = [...selection.shapes].sort();
    if (!arraysEqual(currentIds, originalSelectionIds)) {
        abortResize();
        emit('ui:needsRender');
        return;
    }
    const worldPt = clientPointToWorld(e.clientX, e.clientY);
    applyResize(worldPt, e.shiftKey, e.altKey);
    emit('ui:needsRender');
}

function onMouseUp() {
    if (resizing) {
        finishResize();
        emit('ui:needsRender');
    }
}

function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

function applyResize(worldPt, keepAspect, nonProportional) {
    if (!originalBBox) return;

    let { x: bx, y: by, w: bw, h: bh } = originalBBox;
    const dx = worldPt.x - startWorld.x;
    const dy = worldPt.y - startWorld.y;

    switch (activeHandle) {
        case 'nw': bx += dx; by += dy; bw -= dx; bh -= dy; break;
        case 'n': by += dy; bh -= dy; break;
        case 'ne': by += dy; bw += dx; bh -= dy; break;
        case 'e': bw += dx; break;
        case 'se': bw += dx; bh += dy; break;
        case 's': bh += dy; break;
        case 'sw': bx += dx; bw -= dx; bh += dy; break;
        case 'w': bx += dx; bw -= dx; break;
    }

    if (keepAspect && !nonProportional) {
        const desired = aspectRatio;
        if (Math.abs(dx) > Math.abs(dy)) {
            bh = bw / desired;
            if (activeHandle.includes('n')) {
                by = originalBBox.y + (originalBBox.h - bh);
            }
        } else {
            bw = bh * desired;
            if (activeHandle.includes('w')) {
                bx = originalBBox.x + (originalBBox.w - bw);
            }
        }
    }

    bw = Math.max(MIN_SIZE, bw);
    bh = Math.max(MIN_SIZE, bh);

    const sx = bw / originalBBox.w;
    const sy = bh / originalBBox.h;
    const multi = originalShapes.length > 1;

    for (const o of originalShapes) {
        const s = model.shapes.get(o.id);
        if (!s) continue;
        const relX = (o.x - originalBBox.x) / originalBBox.w;
        const relY = (o.y - originalBBox.y) / originalBBox.h;

        if (nonProportional && multi) {
            s.x = bx + relX * bw;
            s.y = by + relY * bh;
            s.w = Math.max(MIN_SIZE, o.w);
            s.h = Math.max(MIN_SIZE, o.h);
        } else {
            s.x = bx + relX * bw;
            s.y = by + relY * bh;
            s.w = Math.max(MIN_SIZE, o.w * sx);
            s.h = Math.max(MIN_SIZE, o.h * sy);
        }
    }
}

function onRenderAfter() {
    if (!selection.shapes.size) return;
    if (!currentSelectionShapes().length) return;
    drawOverlay();
}

function onSelectionChanged() {
    if (resizing) abortResize();
    emit('ui:needsRender');
}

function init() {
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    on('render:after', onRenderAfter);
    on('selection:changed', onSelectionChanged);
    on('model:changed', () => emit('ui:needsRender'));
}

init();
console.log('resizeHandles.js loaded');