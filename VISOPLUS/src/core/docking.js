/**
 * docking.js
 * Enhanced docking with port priority.
 *
 * Behavior:
 *  1. Attempt to find a shape port (from ports.getPorts()) that best matches the
 *     direction toward the target point (highest cosine with direction vector).
 *  2. If a suitable port has cosine >= ANGLE_THRESHOLD (default 0.65), snap to that port.
 *  3. Otherwise, fallback to perimeter docking based on shape type (previous logic).
 */

import { getPorts } from '../features/ports.js';

const ANGLE_THRESHOLD = 0.65; // Cosine threshold for accepting a port alignment

export function getDockPoint(shape, toward) {
    const cx = shape.x + shape.w / 2;
    const cy = shape.y + shape.h / 2;
    let dx = toward.x - cx;
    let dy = toward.y - cy;
    if (dx === 0 && dy === 0) dy = 1e-6;

    // Try port-based docking first
    const portMatch = bestPort(shape, dx, dy, cx, cy);
    if (portMatch) return portMatch;

    // Fallback to geometry docking
    switch (shape.type) {
        case 'ellipse': {
            const rx = shape.w / 2;
            const ry = shape.h / 2;
            const k = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
            const eps = 0.0005;
            return { x: cx + dx * k * (1 - eps), y: cy + dy * k * (1 - eps) };
        }
        case 'diamond': {
            const w2 = shape.w / 2, h2 = shape.h / 2;
            const denom = (Math.abs(dx) / w2) + (Math.abs(dy) / h2);
            let k = denom === 0 ? 0 : 1 / denom;
            k = Math.min(1, k);
            const eps = 0.0005;
            return { x: cx + dx * k * (1 - eps), y: cy + dy * k * (1 - eps) };
        }
        case 'pill':
        case 'note':
        case 'rect':
        default:
            return dockRectLike(shape, dx, dy, cx, cy);
    }
}

/* ------------ Port Priority Logic ------------ */

function bestPort(shape, dx, dy, cx, cy) {
    const ports = getPorts(shape);
    if (!ports || !ports.length) return null;

    const magD = Math.hypot(dx, dy) || 1;
    let best = null;
    for (const p of ports) {
        const vx = p.x - cx;
        const vy = p.y - cy;
        const magV = Math.hypot(vx, vy) || 1;
        const cos = (vx * dx + vy * dy) / (magV * magD);
        if (cos <= 0) continue; // port behind direction
        if (!best || cos > best.cos) {
            best = { x: p.x, y: p.y, cos };
        }
    }
    if (best && best.cos >= ANGLE_THRESHOLD) {
        return { x: best.x, y: best.y };
    }
    return null;
}

/* ------------ Perimeter Docking (Fallback) ------------ */

function dockRectLike(shape, dx, dy, cx, cy) {
    const w2 = shape.w / 2, h2 = shape.h / 2;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    const eps = 0.0005;
    if (absDx * h2 > absDy * w2) {
        const sign = dx > 0 ? 1 : -1;
        const scale = w2 / absDx;
        return { x: cx + sign * w2 * (1 - eps), y: cy + dy * scale * (1 - eps) };
    } else {
        const sign = dy > 0 ? 1 : -1;
        const scale = h2 / absDy;
        return { x: cx + dx * scale * (1 - eps), y: cy + sign * h2 * (1 - eps) };
    }
}

console.log('docking.js loaded (port priority docking)');