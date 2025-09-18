/**
 * export.js
 * Provides exportJSON, exportSVG, exportPNG (PNG via offscreen canvas), now with background color support.
 *
 * NEW:
 *  - SVG now includes a background rect using:
 *        model.meta.backgroundColor || opts.background || '#ffffff'
 *  - Respects workspace size (model.meta.workspace) if set; otherwise computes bounding box from shapes & connectors.
 *
 * NOTE:
 *  - Merge any custom marker / styling logic you had previously if this is replacing an existing file.
 */

import { model } from '../core/model.js';

/* ---------------- JSON ---------------- */

export function exportJSON() {
    const payload = {
        meta: {
            ...model.meta,
            // Ensure backgroundColor & workspace & legend & notes are persisted
            backgroundColor: model.meta.backgroundColor || '#ffffff',
            workspace: model.meta.workspace || { width: 2400, height: 1600 },
            legend: model.meta.legend || [],
            notes: model.meta.notes || ''
        },
        shapes: [...model.shapes.values()].map(s => structuredClone(s)),
        connectors: [...model.connectors.values()].map(c => structuredClone(c))
    };
    downloadFile(
        JSON.stringify(payload, null, 2),
        'diagram-export.json',
        'application/json'
    );
}

/* ---------------- SVG ---------------- */

export function exportSVG(opts = {}) {
    const {
        padding = 40,
        background // optional override color
    } = opts;

    // Determine drawing bounds
    const bounds = model.meta.workspace
        ? {
            x: 0,
            y: 0,
            w: model.meta.workspace.width,
            h: model.meta.workspace.height
        }
        : computeContentBounds(padding);

    const bgColor =
        background ||
        model.meta.backgroundColor ||
        '#ffffff';

    // Prepare markers (basic set)
    const markerDefs = buildArrowMarkerDefs();

    // Build shapes SVG
    const shapeFragments = [];
    for (const s of model.shapes.values()) {
        shapeFragments.push(shapeToSVG(s));
    }

    // Build connectors SVG
    const connectorFragments = [];
    for (const c of model.connectors.values()) {
        connectorFragments.push(connectorToSVG(c));
    }

    const svg =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<svg xmlns="http://www.w3.org/2000/svg"\n` +
        `     xmlns:xlink="http://www.w3.org/1999/xlink"\n` +
        `     viewBox="${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}"\n` +
        `     width="${bounds.w}" height="${bounds.h}">\n` +
        `  <defs>\n` +
        markerDefs +
        `  </defs>\n` +
        // NEW BACKGROUND RECT (behind everything)
        `  <rect x="${bounds.x}" y="${bounds.y}" width="${bounds.w}" height="${bounds.h}" fill="${escapeXML(bgColor)}" />\n` +
        `  <g id="shapes">\n` +
        shapeFragments.join('\n') +
        `\n  </g>\n` +
        `  <g id="connectors" stroke-linecap="round" stroke-linejoin="round">\n` +
        connectorFragments.join('\n') +
        `\n  </g>\n` +
        `</svg>`;

    downloadFile(svg, 'diagram-export.svg', 'image/svg+xml');
}

/* ---------------- PNG (optional simple) ---------------- */

export async function exportPNG(opts = {}) {
    // Quick approach: re-render current canvas at 1x and save as PNG
    const canvas = document.getElementById('diagram-canvas');
    if (!canvas) return;
    canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        triggerDownloadURL(url, 'diagram-export.png');
        setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
}

/* ---------------- Helpers: Bounds ---------------- */

function computeContentBounds(padding) {
    if (model.shapes.size === 0) {
        return { x: 0, y: 0, w: 800, h: 600 };
    }
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

    // Extend bounds with connector waypoints if any
    for (const c of model.connectors.values()) {
        const points = gatherConnectorPoints(c);
        for (const p of points) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
    }

    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/* ---------------- Shapes to SVG ---------------- */

function shapeToSVG(s) {
    const stroke = s.style.stroke || '#333';
    const fill = s.style.fill || '#fff';
    const strokeWidth = s.style.strokeWidth || 1.5;
    let shapePath = '';

    switch (s.type) {
        case 'ellipse':
            shapePath =
                `<ellipse cx="${s.x + s.w / 2}" cy="${s.y + s.h / 2}" rx="${s.w / 2}" ry="${s.h / 2}" ` +
                `fill="${escapeXML(fill)}" stroke="${escapeXML(stroke)}" stroke-width="${strokeWidth}"/>`;
            break;
        case 'diamond':
            shapePath =
                `<path d="M${s.x + s.w / 2} ${s.y} L${s.x + s.w} ${s.y + s.h / 2} ` +
                `L${s.x + s.w / 2} ${s.y + s.h} L${s.x} ${s.y + s.h / 2} Z" ` +
                `fill="${escapeXML(fill)}" stroke="${escapeXML(stroke)}" stroke-width="${strokeWidth}"/>`;
            break;
        case 'pill': {
            const r = Math.min(s.w / 2, s.h / 2);
            shapePath =
                `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${r}" ` +
                `fill="${escapeXML(fill)}" stroke="${escapeXML(stroke)}" stroke-width="${strokeWidth}"/>`;
            break;
        }
        case 'note': {
            const dog = Math.min(24, Math.min(s.w, s.h) * 0.4);
            const p =
                `M${s.x} ${s.y} H${s.x + s.w - dog} L${s.x + s.w} ${s.y + dog} V${s.y + s.h} H${s.x} Z`;
            shapePath =
                `<path d="${p}" fill="${escapeXML(fill)}" stroke="${escapeXML(stroke)}" stroke-width="${strokeWidth}"/>`;
            break;
        }
        case 'rect':
        default: {
            const r = s.style.radius || 0;
            shapePath =
                `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${r}" ` +
                `fill="${escapeXML(fill)}" stroke="${escapeXML(stroke)}" stroke-width="${strokeWidth}"/>`;
        }
    }

    let textFrag = '';
    if (s.text) {
        // Basic centered text (no wrapping → approximate)
        const textColor = s.style.textColor || '#222';
        const lines = wrapTextSimple(s.text, 20); // simple wrap for export fallback
        const lineHeight = 16;
        const total = lines.length * lineHeight;
        const startY = s.y + s.h / 2 - total / 2 + lineHeight / 2;

        textFrag =
            `<g font-family="system-ui, sans-serif" font-size="14" fill="${escapeXML(textColor)}" ` +
            `text-anchor="middle" dominant-baseline="middle">` +
            lines
                .map(
                    (line, i) =>
                        `<text x="${s.x + s.w / 2}" y="${startY + i * lineHeight}">${escapeXML(line)}</text>`
                )
                .join('') +
            `</g>`;
    }

    return `<g data-shape="${escapeXML(s.id)}">${shapePath}${textFrag}</g>`;
}

function wrapTextSimple(text, maxWordsPerLine = 999) {
    // Minimal placeholder: breaks long text by words if too many words per line (not width-based here)
    const words = String(text).split(/\s+/);
    if (words.length <= maxWordsPerLine) return [text];
    const lines = [];
    for (let i = 0; i < words.length; i += maxWordsPerLine) {
        lines.push(words.slice(i, i + maxWordsPerLine).join(' '));
    }
    return lines;
}

/* ---------------- Connectors to SVG ---------------- */

function connectorToSVG(c) {
    // Build list of points including endpoints (approx start/end = shape centers here).
    const from = model.shapes.get(c.from);
    const to = model.shapes.get(c.to);
    if (!from || !to) return '';

    const centerFrom = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const centerTo = { x: to.x + to.w / 2, y: to.y + to.h / 2 };

    const pts = gatherConnectorPoints(c, centerFrom, centerTo);

    const style = c.style || {};
    const stroke = style.stroke || '#444';
    const width = style.strokeWidth || 2;
    const arrowStart = style.arrowStart && style.arrowStart !== 'none';
    const arrowEnd = style.arrowEnd && style.arrowEnd !== 'none';

    const d = 'M ' + pts.map(p => `${p.x} ${p.y}`).join(' L ');
    const attrs = [
        `fill="none"`,
        `stroke="${escapeXML(stroke)}"`,
        `stroke-width="${width}"`,
        arrowStart ? `marker-start="url(#arrow-${style.arrowStart})"` : '',
        arrowEnd ? `marker-end="url(#arrow-${style.arrowEnd})"` : ''
    ]
        .filter(Boolean)
        .join(' ');

    return `<path data-conn="${escapeXML(c.id)}" d="${d}" ${attrs} />`;
}

function gatherConnectorPoints(c, centerFrom, centerTo) {
    // If we want the exact docking points we would re-run docking logic; for export clarity, using center-based polyline
    // plus interior points. If you wish docking precision, import getDockPoint and recalc.
    if (!centerFrom || !centerTo) {
        const f = model.shapes.get(c.from);
        const t = model.shapes.get(c.to);
        if (!f || !t) return [];
    }
    const arr = [centerFrom];
    if (Array.isArray(c.points) && c.points.length) {
        for (const p of c.points) arr.push({ x: p.x, y: p.y });
    }
    arr.push(centerTo);
    return arr;
}

/* ---------------- Markers ---------------- */

function buildArrowMarkerDefs() {
    // Define basic arrowheads used by earlier render:
    const kinds = ['triangle', 'open', 'diamond', 'circle', 'bar'];
    return kinds
        .map(k => {
            switch (k) {
                case 'triangle':
                    return `<marker id="arrow-triangle" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="10" markerHeight="6" orient="auto"><path d="M0 0 L10 3 L0 6 Z" fill="currentColor"/></marker>`;
                case 'open':
                    return `<marker id="arrow-open" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="10" markerHeight="6" orient="auto"><path d="M10 3 L0 0 M10 3 L0 6" fill="none" stroke="currentColor" stroke-width="1.6"/></marker>`;
                case 'diamond':
                    return `<marker id="arrow-diamond" viewBox="0 0 12 8" refX="11" refY="4" markerWidth="10" markerHeight="8" orient="auto"><path d="M0 4 L6 0 L12 4 L6 8 Z" fill="currentColor"/></marker>`;
                case 'circle':
                    return `<marker id="arrow-circle" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><circle cx="4" cy="4" r="3" fill="currentColor"/></marker>`;
                case 'bar':
                    return `<marker id="arrow-bar" viewBox="0 0 6 8" refX="5" refY="4" markerWidth="6" markerHeight="8" orient="auto"><path d="M5 0 L5 8" stroke="currentColor" stroke-width="1.6"/></marker>`;
                default:
                    return '';
            }
        })
        .join('\n');
}

/* ---------------- Utilities ---------------- */

function escapeXML(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    triggerDownloadURL(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}

function triggerDownloadURL(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}