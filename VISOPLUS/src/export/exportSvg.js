/**
 * exportSvg.js
 * Generate & download SVG (shapes + connectors + waypoints + arrowheads + trimming + TEXT).
 */
import { model } from '../core/model.js';
import { getDockPoint } from '../core/docking.js';

const ARROW_KINDS = new Set(['triangle', 'open', 'diamond', 'circle', 'bar']);
const FONT_FAMILY = 'system-ui, sans-serif';
const FONT_SIZE = 14;
const LINE_HEIGHT = 16;

/* ---------------- Public API ---------------- */

export function generateSVG({ padding = 40 } = {}) {
    const bounds = computeBounds();
    const w = bounds.w + padding * 2;
    const h = bounds.h + padding * 2;

    const markers = collectMarkers();
    const out = [];
    out.push(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${bounds.x - padding} ${bounds.y - padding} ${w} ${h}" font-family="${escAttr(
            FONT_FAMILY
        )}">`
    );
    if (markers.size) {
        out.push('<defs>');
        for (const k of markers) out.push(markerDef(k));
        out.push('</defs>');
    }

    // Shapes (with text)
    for (const s of model.shapes.values()) {
        out.push(shapeGroup(s));
    }

    // Connectors
    for (const c of model.connectors.values()) {
        const from = model.shapes.get(c.from);
        const to = model.shapes.get(c.to);
        if (!from || !to) continue;
        const cf = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
        const ct = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
        const startDock = getDockPoint(from, ct);
        const endDock = getDockPoint(to, cf);
        let pts =
            Array.isArray(c.points) && c.points.length
                ? [startDock, ...c.points, endDock]
                : [startDock, endDock];
        pts = trimForExport(pts, c.style || {});
        out.push(connectorElement(c, pts));
    }

    out.push('</svg>');
    return out.join('\n');
}

export function downloadCurrentSVG(filename = 'diagram.svg') {
    const svg = generateSVG();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/* ---------------- Shapes + Text ---------------- */

function shapeGroup(s) {
    const shapeMarkup = shapeGeometry(s);
    const textMarkup = s.text ? shapeTextMarkup(s) : '';
    return `<g data-shape="${escAttr(s.id)}">${shapeMarkup}${textMarkup}</g>`;
}

function shapeGeometry(s) {
    const stroke = escAttr(s.style.stroke || '#333');
    const fill = escAttr(s.style.fill || '#fff');
    const sw = s.style.strokeWidth || 1.5;
    switch (s.type) {
        case 'ellipse':
            return `<ellipse cx="${num(s.x + s.w / 2)}" cy="${num(
                s.y + s.h / 2
            )}" rx="${num(s.w / 2)}" ry="${num(
                s.h / 2
            )}" fill="${fill}" stroke="${stroke}" stroke-width="${num(sw)}"/>`;
        case 'diamond':
            return `<path d="M${num(s.x + s.w / 2)},${num(s.y)} L${num(
                s.x + s.w
            )},${num(s.y + s.h / 2)} L${num(s.x + s.w / 2)},${num(
                s.y + s.h
            )} L${num(s.x)},${num(s.y + s.h / 2)} Z" fill="${fill}" stroke="${stroke}" stroke-width="${num(
                sw
            )}"/>`;
        case 'pill': {
            const r = Math.min(s.w / 2, s.h / 2);
            return `<rect x="${num(s.x)}" y="${num(s.y)}" width="${num(
                s.w
            )}" height="${num(s.h)}" rx="${num(r)}" ry="${num(
                r
            )}" fill="${fill}" stroke="${stroke}" stroke-width="${num(sw)}"/>`;
        }
        case 'note': {
            const dog = Math.min(24, Math.min(s.w, s.h) * 0.4);
            return `<path d="M${num(s.x)},${num(s.y)} L${num(
                s.x + s.w - dog
            )},${num(s.y)} L${num(s.x + s.w)},${num(
                s.y + dog
            )} L${num(s.x + s.w)},${num(s.y + s.h)} L${num(s.x)},${num(
                s.y + s.h
            )} Z" fill="${fill}" stroke="${stroke}" stroke-width="${num(sw)}"/>`;
        }
        default:
            return `<rect x="${num(s.x)}" y="${num(s.y)}" width="${num(
                s.w
            )}" height="${num(s.h)}" fill="${fill}" stroke="${stroke}" stroke-width="${num(
                sw
            )}" rx="${num(s.style.radius || 0)}" ry="${num(
                s.style.radius || 0
            )}"/>`;
    }
}

function shapeTextMarkup(s) {
    const color = escAttr(s.style.textColor || '#222');
    const maxWidth = s.w - 12; // match canvas wrapper margin
    const lines = wrapTextForSvg(String(s.text), maxWidth, FONT_SIZE);

    if (!lines.length) return '';
    // Vertical centering: place lines so their visual middle aligns with shape center
    const totalHeight = lines.length * LINE_HEIGHT;
    const startY = s.y + s.h / 2 - totalHeight / 2 + LINE_HEIGHT / 2;

    const cx = s.x + s.w / 2;
    const attrs =
        `text-anchor="middle" font-size="${FONT_SIZE}" fill="${color}" font-family="${escAttr(FONT_FAMILY)}" dominant-baseline="middle"`;
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const y = startY + i * LINE_HEIGHT;
        out.push(
            `<text x="${num(cx)}" y="${num(y)}" ${attrs}>${escText(lines[i])}</text>`
        );
    }
    return out.join('');
}

/* Word wrap approximation (no canvas measuring). */
function wrapTextForSvg(text, maxWidth, fontSize) {
    const words = text.trim().split(/\s+/);
    if (!words.length) return [];
    const lines = [];
    let current = '';
    const avgChar = 0.6 * fontSize; // heuristic average character width
    function lineWidth(str) {
        return str.length * avgChar;
    }
    for (const w of words) {
        const test = current ? current + ' ' + w : w;
        if (lineWidth(test) > maxWidth && current) {
            lines.push(current);
            current = w;
        } else {
            current = test;
        }
    }
    if (current) lines.push(current);
    return lines;
}

/* ---------------- Connectors ---------------- */

function connectorElement(c, pts) {
    const style = c.style || {};
    const stroke = escAttr(style.stroke || '#444');
    const sw = style.strokeWidth || 2;
    const ms =
        style.arrowStart && ARROW_KINDS.has(style.arrowStart)
            ? ` marker-start="url(#arrow-${style.arrowStart})"`
            : '';
    const me =
        style.arrowEnd && ARROW_KINDS.has(style.arrowEnd)
            ? ` marker-end="url(#arrow-${style.arrowEnd})"`
            : '';
    return `<polyline points="${pts
        .map((p) => `${num(p.x)},${num(p.y)}`)
        .join(' ')}" fill="none" stroke="${stroke}" stroke-width="${num(sw)}"${ms}${me}/>`;
}

function trimForExport(pts, style) {
    if (pts.length < 2) return pts;
    const padStart = style.padStart ?? 0;
    const padEnd = style.padEnd ?? 0;
    const arrowSize = style.arrowSize || 12;
    const factor = 0.55;
    const st =
        padStart + (style.arrowStart && style.arrowStart !== 'none' ? arrowSize * factor : 0);
    const et =
        padEnd + (style.arrowEnd && style.arrowEnd !== 'none' ? arrowSize * factor : 0);
    const out = [...pts];
    if (st > 0) out[0] = move(out[0], out[1], st);
    if (et > 0) out[out.length - 1] = move(out[out.length - 1], out[out.length - 2], et);
    return out;
}

function move(a, b, d) {
    const dx = b.x - a.x,
        dy = b.y - a.y;
    const L = Math.hypot(dx, dy) || 1;
    const t = d / L;
    return { x: a.x + dx * t, y: a.y + dy * t };
}

/* ---------------- Markers ---------------- */

function collectMarkers() {
    const set = new Set();
    for (const c of model.connectors.values()) {
        const st = c.style || {};
        if (st.arrowStart && ARROW_KINDS.has(st.arrowStart)) set.add(st.arrowStart);
        if (st.arrowEnd && ARROW_KINDS.has(st.arrowEnd)) set.add(st.arrowEnd);
    }
    return set;
}

function markerDef(k) {
    switch (k) {
        case 'triangle':
            return `<marker id="arrow-triangle" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0,0 L10,5 L0,10 Z" fill="currentColor"/></marker>`;
        case 'open':
            return `<marker id="arrow-open" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M10,5 L0,0 M10,5 L0,10" stroke="currentColor" stroke-width="2" fill="none"/></marker>`;
        case 'diamond':
            return `<marker id="arrow-diamond" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="10" markerHeight="10" orient="auto"><path d="M0,5 L5,0 L10,5 L5,10 Z" fill="currentColor"/></marker>`;
        case 'circle':
            return `<marker id="arrow-circle" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><circle cx="5" cy="5" r="4" fill="currentColor"/></marker>`;
        case 'bar':
            return `<marker id="arrow-bar" viewBox="0 0 10 10" refX="2" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M2,0 L2,10" stroke="currentColor" stroke-width="2"/></marker>`;
        default:
            return '';
    }
}

/* ---------------- Bounds ---------------- */

function computeBounds() {
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
    for (const s of model.shapes.values()) {
        minX = Math.min(minX, s.x);
        minY = Math.min(minY, s.y);
        maxX = Math.max(maxX, s.x + s.w);
        maxY = Math.max(maxY, s.y + s.h);
    }
    for (const c of model.connectors.values()) {
        const f = model.shapes.get(c.from),
            t = model.shapes.get(c.to);
        if (!f || !t) continue;
        const a = { x: f.x + f.w / 2, y: f.y + f.h / 2 };
        const b = { x: t.x + t.w / 2, y: t.y + t.h / 2 };
        const pts = Array.isArray(c.points) ? [a, ...c.points, b] : [a, b];
        for (const p of pts) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
    }
    if (!isFinite(minX)) return { x: 0, y: 0, w: 100, h: 100 };
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/* ---------------- Utilities ---------------- */

function escAttr(s) {
    return String(s).replace(/"/g, '&quot;');
}
function escText(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function num(v) {
    return Number.isFinite(v) ? +v.toFixed(2) : 0;
}

console.log('exportSvg.js loaded (with text)');
