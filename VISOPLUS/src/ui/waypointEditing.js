/**
 * waypointEditing.js
 * Drag + Insert (Alt+click) + Delete (double-click) connector waypoints.
 */
import { selection } from '../core/selection.js';
import { model, updateConnector } from '../core/model.js';
import { clientPointToWorld } from '../core/pointer.js';
import { isWaypointMode } from '../features/stylePanel.js';
import { emit } from '../core/events.js';
import { history } from '../core/history.js';

let drag = null; // { cid, index, offsetX, offsetY }
let lastClickTime = 0;
const DOUBLE_MS = 280;

function init() {
    const canvas = document.getElementById('diagram-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUpClickLogic);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

function onMouseDown(e) {
    if (e.button !== 0) return;
    const altInsert = e.altKey;
    if (altInsert) {
        tryInsertWaypoint(e);
        return;
    }
    if (!isWaypointMode()) return;
    if (selection.connectors.size !== 1) return;

    const cid = [...selection.connectors][0];
    const c = model.connectors.get(cid);
    if (!c || !Array.isArray(c.points) || !c.points.length) return;

    const world = clientPointToWorld(e.clientX, e.clientY);
    const hit = hitWaypointHandle(world.x, world.y, c.points, 6 / model.meta.zoom);
    if (hit >= 0) {
        history.beginBatch('Drag Waypoint');
        drag = {
            cid,
            index: hit,
            offsetX: world.x - c.points[hit].x,
            offsetY: world.y - c.points[hit].y
        };
        e.preventDefault();
    }
}

function onMouseMove(e) {
    if (!drag) return;
    const c = model.connectors.get(drag.cid);
    if (!c) { drag = null; history.cancelBatch(); return; }
    const world = clientPointToWorld(e.clientX, e.clientY);
    c.points[drag.index].x = world.x - drag.offsetX;
    c.points[drag.index].y = world.y - drag.offsetY;
    emit('ui:needsRender');
}

function onMouseUp() {
    if (!drag) return;
    const c = model.connectors.get(drag.cid);
    const cid = drag.cid;
    drag = null;
    if (c) {
        const cleaned = compressColinear([...(c.points || [])]);
        updateConnector(cid, { points: cleaned });
    }
    history.commitBatch();
}

function onMouseUpClickLogic(e) {
    if (!isWaypointMode()) return;
    const now = performance.now();
    const delta = now - lastClickTime;
    lastClickTime = now;
    if (delta > DOUBLE_MS) return;

    if (selection.connectors.size !== 1) return;
    const cid = [...selection.connectors][0];
    const c = model.connectors.get(cid);
    if (!c || !c.points || !c.points.length) return;

    const world = clientPointToWorld(e.clientX, e.clientY);
    const hit = hitWaypointHandle(world.x, world.y, c.points, 8 / model.meta.zoom);
    if (hit >= 0) {
        const pts = [...c.points];
        pts.splice(hit, 1);
        history.beginBatch('Delete Waypoint');
        updateConnector(cid, { points: compressColinear(pts) });
        history.commitBatch();
        emit('ui:needsRender');
    }
}

function tryInsertWaypoint(e) {
    if (selection.connectors.size !== 1) return;
    const cid = [...selection.connectors][0];
    const c = model.connectors.get(cid);
    if (!c) return;

    const from = model.shapes.get(c.from);
    const to = model.shapes.get(c.to);
    if (!from || !to) return;

    const a = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const b = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    const full = Array.isArray(c.points) && c.points.length ? [a, ...c.points, b] : [a, b];

    const world = clientPointToWorld(e.clientX, e.clientY);
    const proj = projectOnPolyline(world, full);
    if (!proj) return;

    let pts = Array.isArray(c.points) ? [...c.points] : [];
    let seg = proj.segmentIndex;
    let insertAt = seg - 1;
    if (seg === 0) insertAt = 0;
    if (seg >= full.length - 2) insertAt = pts.length;
    pts.splice(insertAt, 0, { x: proj.x, y: proj.y });

    history.beginBatch('Insert Waypoint');
    updateConnector(cid, { points: pts });
    history.commitBatch();
    emit('ui:needsRender');
}

function hitWaypointHandle(x, y, pts, r) {
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (Math.abs(p.x - x) <= r && Math.abs(p.y - y) <= r) return i;
    }
    return -1;
}

function compressColinear(points) {
    if (points.length < 3) return points;
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const A = out[out.length - 1];
        const B = points[i];
        const C = points[i + 1];
        if ((A.x === B.x && B.x === C.x) || (A.y === B.y && B.y === C.y)) continue;
        out.push(B);
    }
    out.push(points[points.length - 1]);
    return out;
}

function projectOnPolyline(pt, pts) {
    if (pts.length < 2) return null;
    let best = null;
    for (let i = 0; i < pts.length - 1; i++) {
        const A = pts[i], B = pts[i + 1];
        const dx = B.x - A.x, dy = B.y - A.y;
        const len2 = dx * dx + dy * dy;
        if (!len2) continue;
        let t = ((pt.x - A.x) * dx + (pt.y - A.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = A.x + dx * t, py = A.y + dy * t;
        const dist2 = (pt.x - px) ** 2 + (pt.y - py) ** 2;
        if (!best || dist2 < best.dist2) best = { x: px, y: py, segmentIndex: i, t, dist2 };
    }
    return best;
}

window.addEventListener('load', init);
console.log('waypointEditing.js loaded (drag + insert/delete + history)');