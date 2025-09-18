/**
 * Zoom & Pan with wheel (ctrl+wheel zoom, middle/Alt+drag pan), pinch support
 */
import { model, setZoom, setPan } from '../core/model.js';
import { emit } from '../core/events.js';

let canvas;
let isPanning = false;
let last = { x: 0, y: 0 };

export function initZoomPan() {
    canvas = document.getElementById('diagram-canvas');
    if (!canvas) return;

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    canvas.addEventListener('gesturestart', e => e.preventDefault());
    canvas.addEventListener('gesturechange', e => {
        e.preventDefault();
        setZoom(model.meta.zoom * e.scale);
        emit('zoom:changed');
    });
}

function onWheel(e) {
    if (e.ctrlKey) {
        e.preventDefault();
        const { zoom } = model.meta;
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        setZoom(zoom * factor);
        emit('zoom:changed');
    }
}

function onMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
        isPanning = true;
        last.x = e.clientX;
        last.y = e.clientY;
        e.preventDefault();
    }
}

function onMouseMove(e) {
    if (!isPanning) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    last.x = e.clientX;
    last.y = e.clientY;
    model.meta.pan.x += dx;
    model.meta.pan.y += dy;
    emit('viewport:changed');
}

function onMouseUp() {
    if (isPanning) isPanning = false;
}

console.log('zoomPan.js loaded');