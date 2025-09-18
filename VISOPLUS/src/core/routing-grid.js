/**
 * routing-grid.js
 * Simple Manhattan (orth) routing producing waypoint arrays in connector.points.
 * Can be enhanced later (avoid overlaps, obstacle avoidance).
 */
import { model } from './model.js';
import { emit } from './events.js';

export function routeAllGrid({ prefer = 'hthenv' } = {}) {
    for (const c of model.connectors.values()) {
        const from = model.shapes.get(c.from);
        const to = model.shapes.get(c.to);
        if (!from || !to) continue;

        const start = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
        const end = { x: to.x + to.w / 2, y: to.y + to.h / 2 };

        // Basic Manhattan path: start -> mid1 -> mid2 -> end
        let pts = [];

        if (prefer === 'vthenh') {
            // Vertical then horizontal
            pts.push({ x: start.x, y: end.y });
        } else {
            // Horizontal then vertical
            pts.push({ x: end.x, y: start.y });
        }

        // Optional: if start.x == end.x or start.y == end.y, no need for a bend
        if (start.x === end.x || start.y === end.y) {
            pts = []; // Straight line suffices
        }

        // Clean colinear (though trivial in this simple pattern)
        pts = compressColinear([start, ...pts, end]).slice(1, -1); // store only interior points

        c.type = 'orth';
        c.points = pts.length ? pts : null;
    }

    emit('model:changed', { reason: 'route-grid' });
    emit('ui:needsRender');
}

function compressColinear(fullPts) {
    if (fullPts.length <= 2) return fullPts;
    const out = [fullPts[0]];
    for (let i = 1; i < fullPts.length - 1; i++) {
        const a = out[out.length - 1];
        const b = fullPts[i];
        const c = fullPts[i + 1];
        // Check if a->b->c are colinear axis-aligned
        if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) {
            // skip b
            continue;
        }
        out.push(b);
    }
    out.push(fullPts[fullPts.length - 1]);
    return out;
}

console.log('routing-grid.js loaded (simple Manhattan)');