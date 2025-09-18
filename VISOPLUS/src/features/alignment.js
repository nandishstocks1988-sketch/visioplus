/**
 * Alignment & Distribution
 */
import { selection } from '../core/selection.js';
import { model } from '../core/model.js';
import { emit } from '../core/events.js';

function selectedShapes() {
    return [...selection.shapes].map(id => model.shapes.get(id)).filter(Boolean);
}

function apply(label, fn) {
    const shapes = selectedShapes();
    if (shapes.length < 2) return;
    fn(shapes);
    emit('model:changed', { reason: label, changed: { shapes: shapes.map(s => s.id) } });
}

export function alignLeft() {
    apply('alignLeft', shapes => {
        const x = Math.min(...shapes.map(s => s.x));
        shapes.forEach(s => s.x = x);
    });
}

export function alignRight() {
    apply('alignRight', shapes => {
        const r = Math.max(...shapes.map(s => s.x + s.w));
        shapes.forEach(s => s.x = r - s.w);
    });
}

export function alignHCenter() {
    apply('alignHCenter', shapes => {
        const mid = (Math.min(...shapes.map(s => s.x)) + Math.max(...shapes.map(s => s.x + s.w))) / 2;
        shapes.forEach(s => s.x = mid - s.w / 2);
    });
}

export function alignTop() {
    apply('alignTop', shapes => {
        const y = Math.min(...shapes.map(s => s.y));
        shapes.forEach(s => s.y = y);
    });
}

export function alignBottom() {
    apply('alignBottom', shapes => {
        const b = Math.max(...shapes.map(s => s.y + s.h));
        shapes.forEach(s => s.y = b - s.h);
    });
}

export function alignVCenter() {
    apply('alignVCenter', shapes => {
        const mid = (Math.min(...shapes.map(s => s.y)) + Math.max(...shapes.map(s => s.y + s.h))) / 2;
        shapes.forEach(s => s.y = mid - s.h / 2);
    });
}

export function distributeHorizontal() {
    apply('distributeH', shapes => {
        const sorted = [...shapes].sort((a, b) => a.x - b.x);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const totalWidth = sorted.reduce((acc, s) => acc + s.w, 0);
        const span = (last.x + last.w) - first.x;
        const space = (span - totalWidth) / (sorted.length - 1);
        let cursor = first.x + first.w;
        for (let i = 1; i < sorted.length - 1; i++) {
            const s = sorted[i];
            s.x = cursor + space;
            cursor = s.x + s.w;
        }
    });
}

export function distributeVertical() {
    apply('distributeV', shapes => {
        const sorted = [...shapes].sort((a, b) => a.y - b.y);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const totalHeight = sorted.reduce((acc, s) => acc + s.h, 0);
        const span = (last.y + last.h) - first.y;
        const space = (span - totalHeight) / (sorted.length - 1);
        let cursor = first.y + first.h;
        for (let i = 1; i < sorted.length - 1; i++) {
            const s = sorted[i];
            s.y = cursor + space;
            cursor = s.y + s.h;
        }
    });
}

console.log('alignment.js loaded');
