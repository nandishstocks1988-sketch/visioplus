/**
 * Pointer Debug Overlay
 * Shows:
 *  - Mode
 *  - Last pointer world coords
 *  - Shape under pointer
 */

import { clientPointToWorld } from '../core/pointer.js';
import { model } from '../core/model.js';

let box;
function ensure() {
    if (box) return;
    box = document.createElement('div');
    Object.assign(box.style, {
        position: 'fixed',
        bottom: '8px',
        left: '8px',
        background: 'rgba(0,0,0,0.6)',
        color: '#fff',
        font: '11px monospace',
        padding: '4px 6px',
        borderRadius: '4px',
        zIndex: 3000,
        pointerEvents: 'none'
    });
    document.body.appendChild(box);
}
function hitShape(wx, wy) {
    const arr = [...model.shapes.values()];
    for (let i = arr.length - 1; i >= 0; i--) {
        const s = arr[i];
        if (wx >= s.x && wy >= s.y && wx <= s.x + s.w && wy <= s.y + s.h) return s.id;
    }
    return null;
}
function update(clientX, clientY) {
    ensure();
    const w = clientPointToWorld(clientX, clientY);
    const h = hitShape(w.x, w.y);
    box.textContent =
        `PTR_MODE=${window.__PTR_MODE}  w=(${w.x.toFixed(1)},${w.y.toFixed(1)})  hit=${h || '-'}`;
}
window.addEventListener('mousemove', e => update(e.clientX, e.clientY));
console.log('pointerDebug.js active');
