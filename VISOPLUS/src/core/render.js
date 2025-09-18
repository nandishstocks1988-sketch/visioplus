/**
 * render.js
 * Updated for:
 *  - Background fill color (model.meta.backgroundColor || default)
 *  - Works inside scrollable workspace (#workspace-scroll > #workspace)
 *  - Legend & notes unaffected (overlays separate)
 *  - Orth crisp corners (from earlier set)
 */

import { model } from './model.js';
import { on, emit } from './events.js';
import { getDockPoint } from './docking.js';
import {
    getEndpointDragState,
    getEndpointHandlePositionsForRender
} from '../ui/connectorEndpointEdit.js';

let canvas, ctx;
let needsFrame = false;
let portPreview = null;

export function initRenderer() {
    canvas = document.getElementById('diagram-canvas');
    if (!canvas) {
        window.addEventListener('load', initRenderer, { once: true });
        return;
    }
    ctx = canvas.getContext('2d');

    on('ui:needsRender', requestRender);
    on('model:changed', requestRender);
    on('selection:changed', requestRender);
    on('portDrag:preview', payload => { portPreview = payload; requestRender(); });

    window.addEventListener('resize', handleResize);
    handleResize();
    requestRender();
    console.log('renderer initialized (background + scroll workspace)');
}

export function requestRender() {
    if (needsFrame) return;
    needsFrame = true;
    requestAnimationFrame(frame);
}

export function flushRender() {
    if (needsFrame) needsFrame = false;
    draw();
    emit('render:after');
    window.dispatchEvent(new CustomEvent('render:after'));
}

export function renderAll() {
    requestRender();
    flushRender();
}

export function forceRenderNow() { flushRender(); }

export function applyBaseTransform(ctx2) {
    const dpr = window.devicePixelRatio || 1;
    ctx2.scale(dpr, dpr);
    ctx2.translate(model.meta.pan.x, model.meta.pan.y);
    ctx2.scale(model.meta.zoom, model.meta.zoom);
}

export function getPanZoom() {
    return { pan: model.meta.pan, zoom: model.meta.zoom };
}

/* ---------------- Internal Loop ---------------- */

function handleResize() {
    if (!canvas) return;
    // Canvas explicit size comes from workspace size controls.
    const dpr = window.devicePixelRatio || 1;
    const workspace = document.getElementById('workspace');
    const targetW = (workspace?.dataset.w ? parseInt(workspace.dataset.w, 10) : 2400);
    const targetH = (workspace?.dataset.h ? parseInt(workspace.dataset.h, 10) : 1600);
    canvas.width = Math.round(targetW * dpr);
    canvas.height = Math.round(targetH * dpr);
    canvas.style.width = targetW + 'px';
    canvas.style.height = targetH + 'px';
    requestRender();
}

function frame() {
    if (!needsFrame) return;
    needsFrame = false;
    draw();
    emit('render:after');
    window.dispatchEvent(new CustomEvent('render:after'));
}

function draw() {
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.resetTransform();

    // Background fill
    ctx.fillStyle = model.meta.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    applyBaseTransform(ctx);

    drawGrid(ctx);
    drawShapes(ctx);
    drawShapeSelectionOutline(ctx);
    drawConnectors(ctx);
    drawPortPreview(ctx);
    drawWaypointHandles(ctx);
    drawEndpointHandles(ctx);
    drawEndpointDragOverlay(ctx);

    ctx.restore();
}

/* ---------------- Grid ---------------- */
function drawGrid(ctx) {
    const step = model.meta.gridSize;
    if (!step) return;
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    ctx.save();
    ctx.lineWidth = 1 / model.meta.zoom;
    ctx.strokeStyle = '#f1f1f1';

    const g = step;
    const startX = Math.floor((-model.meta.pan.x / model.meta.zoom) / g) * g;
    const startY = Math.floor((-model.meta.pan.y / model.meta.zoom) / g) * g;
    const endX = (startX + (w / model.meta.zoom) + g);
    const endY = (startY + (h / model.meta.zoom) + g);

    ctx.beginPath();
    for (let x = startX; x <= endX; x += g) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += g) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
    }
    ctx.stroke();
    ctx.restore();
}

/* ---------------- Shapes ---------------- */
function drawShapes(ctx) {
    for (const s of model.shapes.values()) {
        ctx.save();
        ctx.lineWidth = s.style.strokeWidth || 1.5;
        ctx.strokeStyle = s.style.stroke || '#333';
        ctx.fillStyle = s.style.fill || '#fff';
        pathShape(ctx, s);
        ctx.fill();
        ctx.stroke();
        if (s.text) {
            ctx.fillStyle = s.style.textColor || '#222';
            ctx.font = '14px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            wrapText(ctx, s.text, s.x + s.w / 2, s.y + s.h / 2, s.w - 12, 16);
        }
        ctx.restore();
    }
}

function pathShape(ctx, s) {
    switch (s.type) {
        case 'ellipse':
            ctx.beginPath();
            ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
            break;
        case 'diamond':
            ctx.beginPath();
            ctx.moveTo(s.x + s.w / 2, s.y);
            ctx.lineTo(s.x + s.w, s.y + s.h / 2);
            ctx.lineTo(s.x + s.w / 2, s.y + s.h);
            ctx.lineTo(s.x, s.y + s.h / 2);
            ctx.closePath();
            break;
        case 'pill': {
            const r = Math.min(s.w / 2, s.h / 2);
            roundedRect(ctx, s.x, s.y, s.w, s.h, r);
            break;
        }
        case 'note':
            notePath(ctx, s.x, s.y, s.w, s.h);
            break;
        case 'rect':
        default:
            roundedRect(ctx, s.x, s.y, s.w, s.h, s.style.radius || 0);
    }
}

function roundedRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (!rr) {
        ctx.rect(x, y, w, h);
        return;
    }
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
}

function notePath(ctx, x, y, w, h) {
    const dog = Math.min(24, Math.min(w, h) * 0.4);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w - dog, y);
    ctx.lineTo(x + w, y + dog);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
}

function wrapText(ctx, text, cx, cy, maxWidth, lineHeight) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let current = '';
    for (const w of words) {
        const test = current ? current + ' ' + w : w;
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = w;
        } else current = test;
    }
    if (current) lines.push(current);
    const total = lines.length * lineHeight;
    let y = cy - total / 2 + lineHeight / 2;
    for (const line of lines) {
        ctx.fillText(line, cx, y);
        y += lineHeight;
    }
}

/* ---------------- Selection Outline ---------------- */
function drawShapeSelectionOutline(ctx) {
    const sel = getSelection();
    if (!sel || !sel.shapes.size) return;
    ctx.save();
    ctx.lineWidth = 1 / model.meta.zoom;
    ctx.strokeStyle = '#ff7f2a';
    ctx.setLineDash([4, 2]);
    for (const id of sel.shapes) {
        const s = model.shapes.get(id);
        if (!s) continue;
        pathShape(ctx, s);
        ctx.stroke();
    }
    ctx.restore();
}

function getSelection() {
    return (window.VISOPLUS &&
        (window.VISOPLUS.selectionAPI?.selection || window.VISOPLUS.selection)) || null;
}

/* ---------------- Connectors ---------------- */
function drawConnectors(ctx) {
    const sel = getSelection();
    ctx.save();
    for (const c of model.connectors.values()) {
        const from = model.shapes.get(c.from);
        const to = model.shapes.get(c.to);
        if (!from || !to) continue;

        const centerFrom = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
        const centerTo = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
        const startDock = getDockPoint(from, centerTo);
        const endDock = getDockPoint(to, centerFrom);

        let pts = Array.isArray(c.points) && c.points.length
            ? [startDock, ...c.points, endDock]
            : [startDock, endDock];

        const style = c.style || {};
        const stroke = style.stroke || '#444';
        const width = style.strokeWidth || 2;
        const arrowSize = style.arrowSize || 12;
        const selected = sel ? sel.connectors.has(c.id) : false;

        pts = trimPolylineEndpoints(pts, style, arrowSize);

        if (selected) {
            ctx.save();
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(255,127,42,0.35)';
            ctx.lineWidth = width + 8;
            ctx.beginPath();
            pathPoints(ctx, pts);
            ctx.stroke();
            ctx.restore();
        }

        ctx.strokeStyle = stroke;
        ctx.lineWidth = width;
        if (isOrthConnector(c, pts)) {
            ctx.lineJoin = 'miter';
            ctx.miterLimit = 4;
            ctx.lineCap = 'butt';
        } else {
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
        }

        ctx.beginPath();
        pathPoints(ctx, pts);
        ctx.stroke();

        if (style.arrowEnd && style.arrowEnd !== 'none') {
            const p2 = pts[pts.length - 1];
            const p1 = pts[pts.length - 2] || pts[0];
            drawArrowHead(ctx, p1, p2, style.arrowEnd, style);
        }
        if (style.arrowStart && style.arrowStart !== 'none') {
            const p1 = pts[0];
            const p2 = pts[1] || pts[pts.length - 1];
            drawArrowHead(ctx, p2, p1, style.arrowStart, style);
        }
    }
    ctx.restore();
}

function isOrthConnector(conn, pts) {
    if (conn.type === 'orth') return true;
    for (let i = 1; i < pts.length; i++) {
        if (!(pts[i].x === pts[i - 1].x || pts[i].y === pts[i - 1].y)) return false;
    }
    return true;
}

function pathPoints(ctx, pts) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
}

function trimPolylineEndpoints(pts, style, arrowSize) {
    if (pts.length < 2) return pts;
    const padStart = style.padStart ?? 0;
    const padEnd = style.padEnd ?? 0;
    const arrowFactor = 0.55;
    const needStart = padStart + (style.arrowStart && style.arrowStart !== 'none' ? arrowSize * arrowFactor : 0);
    const needEnd = padEnd + (style.arrowEnd && style.arrowEnd !== 'none' ? arrowSize * arrowFactor : 0);

    const out = [...pts];

    if (needStart > 0) {
        const p0 = out[0], p1 = out[1];
        const d = dist(p0, p1);
        if (d > needStart + 0.1) {
            const t = needStart / d;
            out[0] = { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
        }
    }
    if (needEnd > 0) {
        const L = out.length;
        const pLast = out[L - 1], pPrev = out[L - 2];
        const d = dist(pPrev, pLast);
        if (d > needEnd + 0.1) {
            const t = needEnd / d;
            out[L - 1] = { x: pLast.x + (pPrev.x - pLast.x) * t, y: pLast.y + (pPrev.y - pLast.y) * t };
        }
    }
    return out;
}

function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y); }

function drawArrowHead(ctx, fromPt, toPt, kind, style) {
    const zoom = model.meta.zoom;
    const size = (style.arrowSize || 12) / zoom;
    const angle = Math.atan2(toPt.y - fromPt.y, toPt.x - fromPt.x);
    ctx.save();
    ctx.translate(toPt.x, toPt.y);
    ctx.rotate(angle);

    switch (kind) {
        case 'triangle':
            ctx.beginPath();
            ctx.fillStyle = style.stroke || '#444';
            ctx.moveTo(0, 0);
            ctx.lineTo(-size, size * 0.5);
            ctx.lineTo(-size, -size * 0.5);
            ctx.closePath();
            ctx.fill();
            break;
        case 'open':
            ctx.strokeStyle = style.stroke || '#444';
            ctx.lineWidth = (style.strokeWidth || 2) / zoom;
            ctx.beginPath();
            ctx.moveTo(-size, size * 0.6);
            ctx.lineTo(0, 0);
            ctx.lineTo(-size, -size * 0.6);
            ctx.stroke();
            break;
        case 'diamond':
            ctx.beginPath();
            ctx.fillStyle = style.stroke || '#444';
            const w = size, h = size * 0.7;
            ctx.moveTo(0, 0);
            ctx.lineTo(-w * 0.55, h * 0.5);
            ctx.lineTo(-w, 0);
            ctx.lineTo(-w * 0.55, -h * 0.5);
            ctx.closePath();
            ctx.fill();
            break;
        case 'circle':
            ctx.beginPath();
            ctx.fillStyle = style.stroke || '#444';
            ctx.arc(-size * 0.6, 0, size * 0.4, 0, Math.PI * 2);
            ctx.fill();
            break;
        case 'bar':
            ctx.strokeStyle = style.stroke || '#444';
            ctx.lineWidth = (style.strokeWidth || 2) / zoom;
            ctx.beginPath();
            ctx.moveTo(-size * 0.6, size * 0.6);
            ctx.lineTo(-size * 0.6, -size * 0.6);
            ctx.stroke();
            break;
        default:
            break;
    }
    ctx.restore();
}

/* ---------------- Port Preview ---------------- */
function drawPortPreview(ctx) {
    if (!portPreview || !portPreview.points || portPreview.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = portPreview.style?.stroke || '#888';
    ctx.lineWidth = portPreview.style?.strokeWidth || 2;
    ctx.setLineDash([8 / model.meta.zoom, 6 / model.meta.zoom]);
    ctx.beginPath();
    pathPoints(ctx, portPreview.points);
    ctx.stroke();
    ctx.restore();
}

/* ---------------- Waypoint Handles ---------------- */
function drawWaypointHandles(ctx) {
    if (!(window.VISOPLUS && typeof window.VISOPLUS.isWaypointMode === 'function')) return;
    if (!window.VISOPLUS.isWaypointMode()) return;
    const sel = getSelection();
    if (!sel || sel.connectors.size !== 1) return;
    const cid = [...sel.connectors][0];
    const c = model.connectors.get(cid);
    if (!c || !Array.isArray(c.points) || !c.points.length) return;

    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ff7f2a';
    ctx.lineWidth = 1 / model.meta.zoom;
    const size = 6 / model.meta.zoom;
    for (const p of c.points) {
        ctx.beginPath();
        ctx.rect(p.x - size / 2, p.y - size / 2, size, size);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
}

/* ---------------- Endpoint Handles ---------------- */
function drawEndpointHandles(ctx) {
    const sel = getSelection();
    if (!sel || sel.connectors.size !== 1) return;
    const cid = [...sel.connectors][0];
    const c = model.connectors.get(cid);
    if (!c) return;

    const pos = getEndpointHandlePositionsForRender(c);
    const zoom = model.meta.zoom;
    const r = 8 / zoom;

    ctx.save();
    ctx.lineWidth = 2 / zoom;
    ctx.strokeStyle = '#1d72ff';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';

    ctx.beginPath();
    ctx.arc(pos.start.handle.x, pos.start.handle.y, r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.beginPath();
    ctx.arc(pos.end.handle.x, pos.end.handle.y, r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.restore();
}

function drawEndpointDragOverlay(ctx) {
    const dragState = getEndpointDragState && getEndpointDragState();
    if (!dragState) return;
    const { currentWorld, end, targetShapeId } = dragState;
    if (!currentWorld) return;

    const zoom = model.meta.zoom;
    const r = 11 / zoom;

    if (targetShapeId) {
        const s = model.shapes.get(targetShapeId);
        if (s) {
            ctx.save();
            ctx.lineWidth = 2 / zoom;
            ctx.strokeStyle = '#ffb067';
            ctx.setLineDash([6 / zoom, 3 / zoom]);
            ctx.strokeRect(s.x, s.y, s.w, s.h);
            ctx.restore();
        }
    }

    ctx.save();
    ctx.lineWidth = 2 / zoom;
    ctx.strokeStyle = end === 'start' ? '#ff2a5a' : '#2a9dff';
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.beginPath();
    ctx.arc(currentWorld.x, currentWorld.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

console.log('render.js loaded (background & workspace scroll enabled)');