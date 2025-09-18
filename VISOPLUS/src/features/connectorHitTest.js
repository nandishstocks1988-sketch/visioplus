/**
 * connectorHitTest.js
 * Utility to hit-test connectors (polyline or straight).
 */
import { model } from '../core/model.js';

export function hitTestConnector(worldX, worldY, threshold = 6) {
    let hitId = null;
    for (const c of model.connectors.values()) {
        const from = model.shapes.get(c.from);
        const to = model.shapes.get(c.to);
        if (!from || !to) continue;
        const start = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
        const end = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
        let pts;
        if (Array.isArray(c.points) && c.points.length) {
            pts = [start, ...c.points, end];
        } else {
            pts = [start, end];
        }
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const dist = pointSegmentDistance(worldX, worldY, a.x, a.y, b.x, b.y);
            if (dist <= threshold) {
                hitId = c.id;
                break;
            }
        }
        if (hitId) break;
    }
    return hitId;
}

function pointSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
    const t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    const clamped = Math.max(0, Math.min(1, t));
    const cx = x1 + clamped * dx;
    const cy = y1 + clamped * dy;
    return Math.hypot(px - cx, py - cy);
}

console.log('connectorHitTest.js loaded');