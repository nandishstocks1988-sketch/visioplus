/**
 * routingObstacle.js
 * Prototype orthogonal obstacle avoidance routing using coarse A*.
 * Applies only to selected connectors (or all if you adapt).
 */
import { model, updateConnector } from './model.js';
import { emit } from './events.js';
import { selection } from './selection.js';

export function routeSelectedObstacle() {
    if (!selection.connectors.size) return;
    const changed = [];
    for (const cid of selection.connectors) {
        const c = model.connectors.get(cid);
        if (!c) continue;
        if (routeConnector(c)) changed.push(cid);
    }
    if (changed.length) {
        emit('model:changed', { reason: 'route:obstacle', changed: { connectors: changed } });
    }
}

function routeConnector(conn) {
    const from = model.shapes.get(conn.from);
    const to = model.shapes.get(conn.to);
    if (!from || !to) return false;

    const start = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const goal = { x: to.x + to.w / 2, y: to.y + to.h / 2 };

    const cell = 40;
    const margin = 8;
    const obstacles = collectObstacles(margin);

    const path = aStar(start, goal, obstacles, cell, 7000);
    if (!path || path.length < 2) return false;

    const interior = path.slice(1, path.length - 1);
    const simplified = compressColinear(interior);
    updateConnector(conn.id, { points: simplified });
    return true;
}

function collectObstacles(pad) {
    const list = [];
    for (const s of model.shapes.values()) {
        list.push({ x: s.x - pad, y: s.y - pad, w: s.w + pad * 2, h: s.h + pad * 2 });
    }
    return list;
}

function blocked(x, y, obs) {
    for (const o of obs) {
        if (x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h) return true;
    }
    return false;
}

function aStar(start, goal, obstacles, cell, limit) {
    const snap = p => ({ x: Math.round(p.x / cell) * cell, y: Math.round(p.y / cell) * cell });
    const S = snap(start);
    const G = snap(goal);
    const key = p => p.x + ',' + p.y;
    const open = new Map();
    const gScore = new Map();
    const came = new Map();
    const pq = [];
    function push(node, f) { pq.push({ node, f }); pq.sort((a, b) => a.f - b.f); }
    function pop() { return pq.shift(); }
    gScore.set(key(S), 0);
    push(S, heur(S, G));
    open.set(key(S), S);
    let steps = 0;
    while (pq.length && steps < limit) {
        steps++;
        const current = pop().node;
        if (current.x === G.x && current.y === G.y) return reconstruct(current);
        open.delete(key(current));
        for (const dir of [[cell, 0], [-cell, 0], [0, cell], [0, -cell]]) {
            const nx = current.x + dir[0];
            const ny = current.y + dir[1];
            if (blocked(nx, ny, obstacles)) continue;
            const nk = nx + ',' + ny;
            const tentative = (gScore.get(key(current)) ?? Infinity) + 1;
            if (tentative < (gScore.get(nk) ?? Infinity)) {
                came.set(nk, current);
                gScore.set(nk, tentative);
                const f = tentative + heur({ x: nx, y: ny }, G);
                if (!open.has(nk)) {
                    push({ x: nx, y: ny }, f);
                    open.set(nk, { x: nx, y: ny });
                }
            }
        }
    }
    return null;

    function reconstruct(end) {
        const out = [end];
        let cur = end;
        while (true) {
            const k = key(cur);
            if (!came.has(k)) break;
            cur = came.get(k);
            out.push(cur);
        }
        out.reverse();
        out[0] = start;
        out[out.length - 1] = goal;
        return out;
    }
}

function heur(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

function compressColinear(pts) {
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
        const A = out[out.length - 1], B = pts[i], C = pts[i + 1];
        if ((A.x === B.x && B.x === C.x) || (A.y === B.y && B.y === C.y)) continue;
        out.push(B);
    }
    out.push(pts[pts.length - 1]);
    return out;
}

window.VISOPLUS = window.VISOPLUS || {};
window.VISOPLUS.routeObstacle = routeSelectedObstacle;
console.log('routingObstacle.js loaded');