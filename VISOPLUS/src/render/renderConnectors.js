/**
 * Connector rendering
 */
import { selection } from '../core/selection.js';

export function renderConnectors(ctx, model) {
    ctx.save();
    for (const c of model.connectors.values()) {
        drawConnector(ctx, model, c);
    }
    ctx.restore();
}

function drawConnector(ctx, model, c) {
    const from = model.shapes.get(c.from);
    const to = model.shapes.get(c.to);
    if (!from || !to) return;

    const x1 = from.x + from.w / 2;
    const y1 = from.y + from.h / 2;
    const x2 = to.x + to.w / 2;
    const y2 = to.y + to.h / 2;

    const sel = selection.connectors.has(c.id);

    ctx.lineWidth = sel ? 2.2 : 1.4;
    ctx.strokeStyle = sel ? '#f39c12' : '#555';
    ctx.fillStyle = ctx.strokeStyle;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    if (c.points && c.points.length === 2) {
        ctx.lineTo(c.points[0].x, c.points[0].y);
        ctx.lineTo(c.points[1].x, c.points[1].y);
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();

    drawArrowhead(ctx, x1, y1, x2, y2);
}

function drawArrowhead(ctx, x1, y1, x2, y2) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const len = 12;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - len * Math.cos(ang - 0.35), y2 - len * Math.sin(ang - 0.35));
    ctx.lineTo(x2 - len * Math.cos(ang + 0.35), y2 - len * Math.sin(ang + 0.35));
    ctx.closePath();
    ctx.fill();
}

console.log('renderconnectors.js loaded');
