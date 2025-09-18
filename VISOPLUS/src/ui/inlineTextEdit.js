/**
 * Inline Text Editing (updated pointer scaling)
 */
import { model, updateShape } from '../core/model.js';
import { on, emit } from '../core/events.js';
import { getPanZoom } from '../core/render.js';
import { selection, setSelection } from '../core/selection.js';
import { clientPointToWorld } from '../core/pointer.js';

let editorEl = null;
let editingId = null;
let originalText = '';
let canvasEl = null;

function ensureEditor() {
    if (editorEl) return;
    editorEl = document.createElement('input');
    editorEl.type = 'text';
    editorEl.id = 'shape-text-editor';
    Object.assign(editorEl.style, {
        position: 'absolute',
        zIndex: 1200,
        padding: '2px 6px',
        font: '14px system-ui, sans-serif',
        border: '1px solid #ff7f2a',
        borderRadius: '4px',
        outline: 'none',
        background: '#fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        color: '#222',
        transformOrigin: 'top left',
    });
    editorEl.addEventListener('keydown', onKeyDown);
    editorEl.addEventListener('blur', () => commitEdit(true));
    document.body.appendChild(editorEl);
}

function openEditor(shape) {
    ensureEditor();
    editingId = shape.id;
    originalText = shape.text || '';
    editorEl.value = originalText;
    positionEditor(shape);
    editorEl.style.display = 'block';
    editorEl.focus();
    editorEl.select();
    if (!selection.shapes.has(shape.id) || selection.shapes.size > 1) {
        setSelection([shape.id]);
    }
}

function positionEditor(shape) {
    if (!editorEl || !editingId) return;
    const { pan, zoom } = getPanZoom();
    if (!canvasEl) canvasEl = document.getElementById('diagram-canvas');
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const scaleX = canvasEl.width / rect.width;
    const scaleY = canvasEl.height / rect.height;

    const left = rect.left + (pan.x + shape.x * zoom) / scaleX;
    const top = rect.top + (pan.y + shape.y * zoom) / scaleY;
    const width = (shape.w * zoom) / scaleX;
    const height = (shape.h * zoom) / scaleY;

    editorEl.style.left = left + 'px';
    editorEl.style.top = top + 'px';
    editorEl.style.width = Math.max(40, width - 4) + 'px';
    editorEl.style.height = Math.max(24, Math.min(60, height - 4)) + 'px';
    editorEl.style.fontSize = Math.max(10, 14 * zoom * 0.85) + 'px';
    editorEl.style.lineHeight = '1.2';
}

function closeEditor() {
    if (!editorEl) return;
    editorEl.style.display = 'none';
    editingId = null;
    originalText = '';
}

function onKeyDown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit(true);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        commitEdit(false);
    }
}

function commitEdit(apply) {
    if (!editingId) return;
    const shape = model.shapes.get(editingId);
    if (shape && apply) {
        const newText = editorEl.value.trim();
        if (newText !== shape.text) {
            updateShape(editingId, { text: newText });
            emit('ui:needsRender');
        }
    }
    closeEditor();
}

function handleDblClick(e) {
    if (e.altKey) return;
    if (!canvasEl) canvasEl = document.getElementById('diagram-canvas');
    if (!canvasEl) return;
    if (e.target !== canvasEl) return;
    const { x, y } = clientPointToWorld(e.clientX, e.clientY);
    const shape = hitTest(x, y);
    if (shape) openEditor(shape);
}

function hitTest(x, y) {
    const arr = [...model.shapes.values()];
    for (let i = arr.length - 1; i >= 0; i--) {
        const s = arr[i];
        if (x >= s.x && y >= s.y && x <= s.x + s.w && y <= s.y + s.h) return s;
    }
    return null;
}

on('render:after', () => {
    if (!editingId) return;
    const s = model.shapes.get(editingId);
    if (!s) {
        closeEditor();
        return;
    }
    positionEditor(s);
});

on('selection:changed', () => {
    if (editingId) {
        const s = model.shapes.get(editingId);
        if (!s || !selection.shapes.has(editingId)) closeEditor();
    }
});

function initInlineEditor() {
    canvasEl = document.getElementById('diagram-canvas');
    if (!canvasEl) {
        window.addEventListener('load', initInlineEditor, { once: true });
        return;
    }
    canvasEl.addEventListener('dblclick', handleDblClick);
}

initInlineEditor();
console.log('inlineTextEdit.js loaded (pointer scaling fix)');