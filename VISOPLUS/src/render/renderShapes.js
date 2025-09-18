/**
 * Shape rendering (rect + future shapes)
 */
import { selection } from '../core/selection.js';

export function renderShapes(ctx, model) {
    for (const s of model.shapes.values()) {
        drawShape(ctx, s, selection.shapes.has(s.id));
    }
}

function drawShape(ctx, s, selected) {
    ctx.save();
    const r = s.style.radius || 0;
    roundRect(ctx, s.x, s.y, s.w, s.h, r);
    ctx.fillStyle = s.style.fill;
    ctx.fill();
    ctx.lineWidth = selected ? (s.style.strokeWidth + 1.5) : s.style.strokeWidth;
    ctx.strokeStyle = selected ? '#ff7f2a' : s.style.stroke;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#222';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.text, s.x + s.w / 2, s.y + s.h / 2, s.w - 8);

    ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (!r) {
        ctx.rect(x, y, w, h);
        return;
    }
    const rr = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
}

console.log('renderShapes.js loaded');