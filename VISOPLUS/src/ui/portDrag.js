/**
 * portDrag.js
 * Port-based connector creation.
 *
 * Revision changes:
 *  - New connectors default to straight/basic (no interior waypoint bend) to satisfy
 *    requirement that initial creation is "basic".
 *  - Optional orth preview only when user holds Shift during the drag (or if ALLOW_ORTH_PREVIEW is set true).
 *  - If orth preview active AND final path is L-shaped AND user used Shift, we store the interior bend.
 *  - Otherwise: connector.points = null (straight).
 */

import { model, createConnector, updateConnector } from '../core/model.js';
import { on, emit } from '../core/events.js';
import { applyBaseTransform } from '../core/render.js';
import { clientPointToWorld } from '../core/pointer.js';

let canvas;
let hoveredShapeId = null;

let dragging = false;
let dragSourceShapeId = null;
let dragSourcePort = null;
let dragCurrentWorld = null;
let dragTargetShapeId = null;
let shiftPreviewActive = false;

const PORT_SIZE_SCREEN = 10;
const PORT_COLOR = '#ff7f2a';
const TARGET_HIGHLIGHT = '#ffb067';
const PORT_POSITIONS = ['n', 'e', 's', 'w'];

// Global toggle if you want orth preview without Shift
const ALLOW_ORTH_PREVIEW = false;

function init() {
    canvas = document.getElementById('diagram-canvas');
    if (!canvas) {
        window.addEventListener('load', init, { once: true });
        return;
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', () => {
        if (!dragging && hoveredShapeId !== null) {
            hoveredShapeId = null;
            emit('ui:needsRender');
        }
    });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseDragMove);
    window.addEventListener('keydown', onKeyChange);
    window.addEventListener('keyup', onKeyChange);

    on('render:after', drawOverlay);
    on('model:changed', () => {
        if (hoveredShapeId && !model.shapes.has(hoveredShapeId)) {
            hoveredShapeId = null;
            emit('ui:needsRender');
        }
    });

    console.log('portDrag.js loaded (straight-by-default connectors)');
}

function onKeyChange(e) {
    if (!dragging) return;
    // Recompute shift state for preview toggling
    shiftPreviewActive = e.shiftKey;
    emit('ui:needsRender');
}

function onMouseMove(e) {
    if (dragging) return;
    updateHover(e.clientX, e.clientY);
}

function onMouseDown(e) {
    if (e.button !== 0) return;
    if (e.altKey) return;
    if (!hoveredShapeId) return;

    const world = clientPointToWorld(e.clientX, e.clientY);
    const shape = model.shapes.get(hoveredShapeId);
    if (!shape) return;
    const port = hitTestPort(shape, world);
    if (!port) return;

    startDrag(shape.id, port, world, e.shiftKey);
    e.preventDefault();
    e.stopPropagation();
}

function onMouseDragMove(e) {
    if (!dragging) return;
    dragCurrentWorld = clientPointToWorld(e.clientX, e.clientY);
    const hit = hitTestShape(dragCurrentWorld.x, dragCurrentWorld.y, dragSourceShapeId);
    dragTargetShapeId = hit ? hit.id : null;
    shiftPreviewActive = e.shiftKey; // dynamic
    emit('ui:needsRender');
}

function onMouseUp(e) {
    if (!dragging) return;
    finishDrag(e.shiftKey);
}

function startDrag(shapeId, port, worldPt, shiftHeld) {
    dragging = true;
    dragSourceShapeId = shapeId;
    dragSourcePort = port;
    dragCurrentWorld = worldPt;
    dragTargetShapeId = null;
    shiftPreviewActive = shiftHeld;
    emit('portDrag:active', { active: true });
    emit('ui:needsRender');
}

function cancelDrag() {
    dragging = false;
    dragSourceShapeId = null;
    dragSourcePort = null;
    dragCurrentWorld = null;
    dragTargetShapeId = null;
    shiftPreviewActive = false;
    emit('portDrag:active', { active: false });
    emit('ui:needsRender');
}

function finishDrag(shiftHeld) {
    if (dragTargetShapeId && dragTargetShapeId !== dragSourceShapeId) {
        const srcShape = model.shapes.get(dragSourceShapeId);
        const tgtShape = model.shapes.get(dragTargetShapeId);
        if (srcShape && tgtShape) {
            const start = getPortWorldPoint(srcShape, dragSourcePort);
            const end = estimateTargetCenter(tgtShape);

            let path = [];
            let storeOrth = false;

            if ((ALLOW_ORTH_PREVIEW || shiftHeld) && shouldOrthPreview(start, end)) {
                path = buildOrthPath(start, end);
                storeOrth = path.length === 3; // typical L shape
            }

            const conn = createConnector({
                from: dragSourceShapeId,
                to: dragTargetShapeId,
                style: { arrowEnd: 'triangle' }
            });

            // Only keep interior bend if we explicitly used orth preview
            if (conn && storeOrth) {
                updateConnector(conn.id, { points: path.slice(1, -1), type: 'orth' });
            } else if (conn) {
                // explicit straight
                updateConnector(conn.id, { points: null, type: 'straight' });
            }
            emit('model:changed', {
                reason: 'portConnectorCreated',
                changed: { connectors: conn ? [conn.id] : [] }
            });
        }
    }
    cancelDrag();
}

/* ---------- Hover & Ports ---------- */

function updateHover(clientX, clientY) {
    const world = clientPointToWorld(clientX, clientY);
    const hit = hitTestShape(world.x, world.y);
    const newId = hit ? hit.id : null;
    if (newId !== hoveredShapeId) {
        hoveredShapeId = newId;
        emit('ui:needsRender');
    }
}

function getPortWorldPoint(shape, name) {
    switch (name) {
        case 'n': return { x: shape.x + shape.w / 2, y: shape.y };
        case 's': return { x: shape.x + shape.w / 2, y: shape.y + shape.h };
        case 'e': return { x: shape.x + shape.w, y: shape.y + shape.h / 2 };
        case 'w': return { x: shape.x, y: shape.y + shape.h / 2 };
        default: return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
    }
}

function estimateTargetCenter(shape) {
    return { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 };
}

function hitTestPort(shape, worldPt) {
    const zoom = model.meta.zoom;
    const radius = (PORT_SIZE_SCREEN / zoom) * 0.6;
    for (const p of PORT_POSITIONS) {
        const pt = getPortWorldPoint(shape, p);
        const dx = worldPt.x - pt.x;
        const dy = worldPt.y - pt.y;
        if (dx * dx + dy * dy <= radius * radius) return p;
    }
    return null;
}

function hitTestShape(x, y, excludeId = null) {
    const arr = [...model.shapes.values()];
    for (let i = arr.length - 1; i >= 0; i--) {
        const s = arr[i];
        if (excludeId && s.id === excludeId) continue;
        if (x >= s.x && y >= s.y && x <= s.x + s.w && y <= s.y + s.h) return s;
    }
    return null;
}

/* ---------- Path Logic ---------- */

function shouldOrthPreview(start, end) {
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    return dx >= 6 && dy >= 6; // enough distance to warrant L
}

function buildOrthPath(start, end) {
    // Basic L: horizontal then vertical
    return [start, { x: end.x, y: start.y }, end];
}

/* ---------- Overlay Drawing ---------- */

function drawOverlay() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    applyBaseTransform(ctx);

    // Ports on hovered or source shape
    if (hoveredShapeId || dragging) {
        const baseId = dragging ? dragSourceShapeId : hoveredShapeId;
        const shape = model.shapes.get(baseId);
        if (shape) {
            drawPorts(ctx, shape, dragging ? dragSourcePort : null);
        }
    }

    // Target shape highlight
    if (dragging && dragTargetShapeId) {
        const t = model.shapes.get(dragTargetShapeId);
        if (t) {
            ctx.save();
            ctx.lineWidth = 2;
            ctx.strokeStyle = TARGET_HIGHLIGHT;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(t.x, t.y, t.w, t.h);
            ctx.restore();
        }
    }

    // Live preview
    if (dragging && dragCurrentWorld) {
        const srcShape = model.shapes.get(dragSourceShapeId);
        if (srcShape) {
            const start = getPortWorldPoint(srcShape, dragSourcePort);
            const endShape = dragTargetShapeId ? model.shapes.get(dragTargetShapeId) : null;
            const end = endShape ? estimateTargetCenter(endShape) : dragCurrentWorld;

            const useOrth = (ALLOW_ORTH_PREVIEW || shiftPreviewActive) && shouldOrthPreview(start, end);
            let pts;
            if (useOrth) {
                pts = buildOrthPath(start, end);
            } else {
                pts = [start, end];
            }
            drawPreviewPath(ctx, pts);
        }
    }

    ctx.restore();
}

function drawPorts(ctx, shape, activePort) {
    const zoom = model.meta.zoom;
    const radius = (PORT_SIZE_SCREEN / zoom) / 2;
    ctx.save();
    ctx.lineWidth = 1 / zoom;
    for (const p of PORT_POSITIONS) {
        const pt = getPortWorldPoint(shape, p);
        ctx.beginPath();
        ctx.fillStyle = p === activePort ? PORT_COLOR : '#ffffff';
        ctx.strokeStyle = PORT_COLOR;
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
}

function drawPreviewPath(ctx, pts) {
    if (pts.length < 2) return;
    const zoom = model.meta.zoom;
    ctx.save();
    ctx.lineWidth = 2 / zoom;
    ctx.strokeStyle = PORT_COLOR;
    ctx.setLineDash([8 / zoom, 6 / zoom]);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // Arrowhead
    const p2 = pts[pts.length - 1];
    const p1 = pts[pts.length - 2];
    drawSmallPreviewArrow(ctx, p1, p2);
    ctx.restore();
}

function drawSmallPreviewArrow(ctx, fromPt, toPt) {
    const zoom = model.meta.zoom;
    const size = 10 / zoom;
    const angle = Math.atan2(toPt.y - fromPt.y, toPt.x - fromPt.x);
    ctx.save();
    ctx.translate(toPt.x, toPt.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.fillStyle = PORT_COLOR;
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, size * 0.5);
    ctx.lineTo(-size, -size * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

init();