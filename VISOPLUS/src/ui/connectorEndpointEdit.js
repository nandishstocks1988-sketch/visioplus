/**
 * connectorEndpointEdit.js
 * Endpoint reattachment with outward handles + waypoint PRESERVATION (translation) + undo batching.
 *
 * Enhancements in this revision:
 *  - Port snapping priority while dragging endpoints (attempts to lock onto the nearest port
 *    on a candidate target shape before falling back to perimeter docking).
 *  - Visual highlight ring for the snapped port.
 *  - Configurable screen-distance threshold for port snap.
 */

import { model, updateConnector } from '../core/model.js';
import { selection } from '../core/selection.js';
import { emit } from '../core/events.js';
import { clientPointToWorld } from '../core/pointer.js';
import { getDockPoint } from '../core/docking.js';
import { history } from '../core/history.js';
import { getPorts } from '../features/ports.js';

const HANDLE_SCREEN_RADIUS = 10;      // hit radius (screen px)
const HANDLE_OFFSET_SCREEN = 12;      // outward offset (screen px)
const ALLOW_SELF_LOOP = false;
const SNAP_PORT_DIST_SCREEN = 18;     // max screen px to consider a port snapped
const PORT_HILITE_COLOR = '#ffb067';

let dragging = null; // { cid, end:'start'|'end', currentWorld:{x,y}, targetShapeId, snappedPortId }
let canvas;

function init() {
    canvas = document.getElementById('diagram-canvas');
    if (!canvas) {
        window.addEventListener('load', init, { once: true });
        return;
    }
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    onRenderOverlay();
    console.log('connectorEndpointEdit.js loaded (ports + snapping)');
}

function onMouseDown(e) {
    if (e.button !== 0) return;
    if (selection.connectors.size !== 1) return;

    const cid = [...selection.connectors][0];
    const conn = model.connectors.get(cid);
    if (!conn) return;

    const zoom = model.meta.zoom;
    const world = clientPointToWorld(e.clientX, e.clientY);
    const handles = computeEndpointHandlePositions(conn);
    const hitR = HANDLE_SCREEN_RADIUS / zoom;

    if (distance(world, handles.start.handle) <= hitR) {
        dragging = {
            cid,
            end: 'start',
            originalOppositeShape: conn.to,
            currentWorld: world,
            targetShapeId: null,
            snappedPortId: null
        };
        e.preventDefault();
        emit('ui:needsRender');
        return;
    }
    if (distance(world, handles.end.handle) <= hitR) {
        dragging = {
            cid,
            end: 'end',
            originalOppositeShape: conn.from,
            currentWorld: world,
            targetShapeId: null,
            snappedPortId: null
        };
        e.preventDefault();
        emit('ui:needsRender');
        return;
    }
}

function onMouseMove(e) {
    if (!dragging) return;
    const world = clientPointToWorld(e.clientX, e.clientY);
    dragging.currentWorld = world;

    const target = hitTestShape(world.x, world.y);
    if (target) {
        if (!ALLOW_SELF_LOOP) {
            const conn = model.connectors.get(dragging.cid);
            if (conn) {
                if (dragging.end === 'start' && target.id === conn.to) {
                    dragging.targetShapeId = null;
                } else if (dragging.end === 'end' && target.id === conn.from) {
                    dragging.targetShapeId = null;
                } else {
                    dragging.targetShapeId = target.id;
                }
            } else {
                dragging.targetShapeId = null;
            }
        } else {
            dragging.targetShapeId = target.id;
        }
    } else {
        dragging.targetShapeId = null;
    }

    // Port snapping attempt
    dragging.snappedPortId = null;
    if (dragging.targetShapeId) {
        const shape = model.shapes.get(dragging.targetShapeId);
        if (shape) {
            const ports = getPorts(shape);
            const zoom = model.meta.zoom;
            const maxWorld = SNAP_PORT_DIST_SCREEN / zoom;
            let best = null;
            for (const p of ports) {
                const d = distance(world, p);
                if (d <= maxWorld) {
                    if (!best || d < best.d) best = { id: p.id, d, x: p.x, y: p.y };
                }
            }
            if (best) {
                dragging.snappedPortId = best.id;
                dragging.currentWorld = { x: best.x, y: best.y };
            }
        }
    }

    emit('ui:needsRender');
}

function onMouseUp() {
    if (!dragging) return;
    const { cid, end, targetShapeId, snappedPortId } = dragging;
    const conn = model.connectors.get(cid);
    dragging = null;

    if (!conn) return;

    if (targetShapeId && targetShapeId !== conn.from && targetShapeId !== conn.to) {
        const movingStart = (end === 'start');
        const oldEndpointShape = movingStart ? model.shapes.get(conn.from) : model.shapes.get(conn.to);
        const fixedShape = movingStart ? model.shapes.get(conn.to) : model.shapes.get(conn.from);
        const newEndpointShape = model.shapes.get(targetShapeId);

        if (oldEndpointShape && fixedShape && newEndpointShape) {
            const fixedCenter = { x: fixedShape.x + fixedShape.w / 2, y: fixedShape.y + fixedShape.h / 2 };

            const oldDock = getDockPoint(oldEndpointShape, fixedCenter);
            const newDock = getDockPoint(newEndpointShape, fixedCenter);

            const dx = newDock.x - oldDock.x;
            const dy = newDock.y - oldDock.y;

            let newPoints = Array.isArray(conn.points) ? structuredClone(conn.points) : [];
            if (newPoints.length) {
                for (const p of newPoints) {
                    p.x += dx;
                    p.y += dy;
                }
            }

            history.beginBatch('Reattach Endpoint');
            const patch = movingStart
                ? { from: targetShapeId, points: newPoints }
                : { to: targetShapeId, points: newPoints };

            // Snapped port info: stored optionally in style metadata for future port-specific logic
            if (snappedPortId) {
                patch.style = { ...(conn.style || {}), [movingStart ? 'fromPort' : 'toPort']: snappedPortId };
            } else if (conn.style) {
                // Clean stale port if user reattached without port snap
                const styleClone = { ...conn.style };
                delete styleClone[movingStart ? 'fromPort' : 'toPort'];
                patch.style = styleClone;
            }

            updateConnector(conn.id, patch);
            history.commitBatch();

            emit('model:changed', {
                reason: 'connectorEndpointReattachPreserve',
                changed: { connectors: [conn.id] },
                endChanged: end,
                target: targetShapeId,
                snappedPort: snappedPortId || null
            });
        }
    }

    emit('ui:needsRender');
}

/**
 * Compute docking + outward handle positions.
 */
function computeEndpointHandlePositions(conn) {
    const from = model.shapes.get(conn.from);
    const to = model.shapes.get(conn.to);
    const zoom = model.meta.zoom;
    const offset = HANDLE_OFFSET_SCREEN / zoom;

    if (!from || !to) {
        return {
            start: { dock: { x: 0, y: 0 }, handle: { x: 0, y: 0 } },
            end: { dock: { x: 0, y: 0 }, handle: { x: 0, y: 0 } }
        };
    }

    const centerFrom = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const centerTo = { x: to.x + to.w / 2, y: to.y + to.h / 2 };

    const startDock = getDockPoint(from, centerTo);
    const endDock = getDockPoint(to, centerFrom);

    let pathPoints = Array.isArray(conn.points) && conn.points.length
        ? [startDock, ...conn.points, endDock]
        : [startDock, endDock];

    // Start direction: use path if available
    let startDir = pathPoints.length > 1
        ? { x: pathPoints[1].x - pathPoints[0].x, y: pathPoints[1].y - pathPoints[0].y }
        : { x: centerTo.x - centerFrom.x, y: centerTo.y - centerFrom.y };
    startDir = normalize(startDir);

    const startHandle = {
        x: startDock.x + startDir.x * offset,
        y: startDock.y + startDir.y * offset
    };

    // End direction
    let endDir = pathPoints.length > 1
        ? {
            x: pathPoints[pathPoints.length - 1].x - pathPoints[pathPoints.length - 2].x,
            y: pathPoints[pathPoints.length - 1].y - pathPoints[pathPoints.length - 2].y
        }
        : { x: centerFrom.x - centerTo.x, y: centerFrom.y - centerTo.y };
    endDir = normalize(endDir);

    const endHandle = {
        x: endDock.x - endDir.x * offset,
        y: endDock.y - endDir.y * offset
    };

    return {
        start: { dock: startDock, handle: startHandle },
        end: { dock: endDock, handle: endHandle }
    };
}

/* ---------------- Utilities ---------------- */

function normalize(v) {
    const len = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / len, y: v.y / len };
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function hitTestShape(x, y) {
    const arr = [...model.shapes.values()];
    for (let i = arr.length - 1; i >= 0; i--) {
        const s = arr[i];
        if (x >= s.x && x <= s.x + s.w &&
            y >= s.y && y <= s.y + s.h) return s;
    }
    return null;
}

/* ---------------- Exports for renderer ---------------- */

export function getEndpointHandlePositionsForRender(conn) {
    return computeEndpointHandlePositions(conn);
}
export function getEndpointDragState() {
    return dragging;
}

/* ---------------- Overlay Rendering (port highlight) ---------------- */

function onRenderOverlay() {
    window.addEventListener('render:after', () => {
        if (!dragging || !dragging.snappedPortId) return;
        const shapeId = dragging.targetShapeId;
        if (!shapeId) return;
        const shape = model.shapes.get(shapeId);
        if (!shape) return;
        const ports = getPorts(shape);
        const port = ports.find(p => p.id === dragging.snappedPortId);
        if (!port) return;
        const canvas = document.getElementById('diagram-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.translate(model.meta.pan.x, model.meta.pan.y);
        ctx.scale(model.meta.zoom, model.meta.zoom);
        const r = 10 / model.meta.zoom;
        ctx.lineWidth = 2 / model.meta.zoom;
        ctx.strokeStyle = PORT_HILITE_COLOR;
        ctx.setLineDash([4 / model.meta.zoom, 3 / model.meta.zoom]);
        ctx.beginPath();
        ctx.arc(port.x, port.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    });
}

window.addEventListener('load', init);

// Debug
window.VISOPLUS = window.VISOPLUS || {};
window.VISOPLUS.endpointDrag = { getState: getEndpointDragState };