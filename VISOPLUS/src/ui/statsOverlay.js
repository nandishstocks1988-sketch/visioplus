/**
 * statsOverlay.js
 *
 * Changes in this revision:
 *  - Hidden by default.
 *  - Toggle with Alt+F2 (instead of always-on F2).
 *  - Added statsOverlay.show(), hide(), toggle(), isVisible() APIs.
 *  - Exposed resetSmoothing() for future debugging.
 */

import { on } from '../core/events.js';
import { model } from '../core/model.js';
import { selection } from '../core/selection.js';

let panel;
let visible = false;
let lastTs = performance.now();
let smoothFps = 0;

function ensurePanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'stats-overlay';
    Object.assign(panel.style, {
        position: 'absolute',
        top: '8px',
        left: '8px',
        zIndex: 1500,
        background: 'rgba(24,28,32,0.72)',
        color: '#e6e9ec',
        font: '11px system-ui, sans-serif',
        lineHeight: '1.35',
        padding: '6px 8px',
        borderRadius: '6px',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(4px)',
        display: 'none'
    });
    document.body.appendChild(panel);
}

function updatePanel(frameMs) {
    if (!visible || !panel) return;
    const shapes = model.shapes.size;
    const connectors = model.connectors.size;
    const selShapes = selection.shapes.size;
    const selConns = selection.connectors.size || 0;
    panel.innerHTML =
        `FPS: ${smoothFps.toFixed(1)}<br>` +
        `Frame: ${frameMs.toFixed(2)} ms<br>` +
        `Shapes: ${shapes} | Conns: ${connectors}<br>` +
        `Sel: ${selShapes} shapes, ${selConns} conns`;
}

function onFrame() {
    const now = performance.now();
    const dt = now - lastTs;
    lastTs = now;
    const currentFps = dt > 0 ? 1000 / dt : 0;
    if (smoothFps === 0) smoothFps = currentFps;
    else smoothFps = smoothFps * 0.9 + currentFps * 0.1;
    updatePanel(dt);
}

function show() {
    visible = true;
    if (panel) panel.style.display = 'block';
}

function hide() {
    visible = false;
    if (panel) panel.style.display = 'none';
}

function toggle() {
    visible ? hide() : show();
}

function isVisible() {
    return visible;
}

function resetSmoothing() {
    smoothFps = 0;
}

function init() {
    ensurePanel();
    on('render:after', onFrame);
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F2' && e.altKey) {
            toggle();
        }
    });
}

init();

console.log('statsOverlay.js loaded (Alt+F2 toggle, hidden by default)');
export const statsOverlay = { toggle, show, hide, isVisible, resetSmoothing };