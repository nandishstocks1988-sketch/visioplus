/**
 * pointer.js (unchanged from prior "css" mode version)
 */
import { model } from './model.js';

let mode = 'css';

export function clientPointToWorld(clientX, clientY) {
    const canvas = document.getElementById('diagram-canvas');
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const { pan, zoom } = model.meta;
    const cssX = clientX - rect.left;
    const cssY = clientY - rect.top;
    return {
        x: (cssX - pan.x) / zoom,
        y: (cssY - pan.y) / zoom
    };
}

window.__setPointerMode = function (m) {
    if (m !== 'css') {
        console.warn('[pointer] Only "css" mode supported.');
        return;
    }
    mode = m;
    window.__PTR_MODE = mode;
};

window.__PTR_MODE = mode;
console.log('pointer.js loaded (mode =', mode, ')');