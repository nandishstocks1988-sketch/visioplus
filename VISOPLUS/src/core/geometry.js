/**
 * Geometry / math helpers.
 */

export function rectContainsPoint(r, x, y) {
    return x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
}

export function centerOf(r) {
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function rectsIntersect(a, b) {
    return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export function boundingRectRects(rects) {
    if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rects) {
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.w);
        maxY = Math.max(maxY, r.y + r.h);
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function snap(value, grid) {
    return Math.round(value / grid) * grid;
}

export function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a, b, t) { return a + (b - a) * t; }

export function inflateRect(r, amount) {
    return {
        x: r.x - amount,
        y: r.y - amount,
        w: r.w + amount * 2,
        h: r.h + amount * 2
    };
}

export function pointOnRectEdge(rect, side, ratio) {
    switch (side) {
        case 'top': return { x: rect.x + rect.w * ratio, y: rect.y };
        case 'bottom': return { x: rect.x + rect.w * ratio, y: rect.y + rect.h };
        case 'left': return { x: rect.x, y: rect.y + rect.h * ratio };
        case 'right': return { x: rect.x + rect.w, y: rect.y + rect.h * ratio };
        default: return centerOf(rect);
    }
}

console.log('geometry.js loaded');