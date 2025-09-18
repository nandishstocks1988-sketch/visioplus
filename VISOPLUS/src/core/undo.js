/**
 * Undo (Advanced)
 * Hybrid:
 *  - Command stack with snapshots fallback
 *  - Coalescing throttled by delay
 */

import { serialize, deserialize } from './model.js';
import { on, emit } from './events.js';

const undoStack = [];
const redoStack = [];
let lastSnapshot = serialize();
let coalesceTimer = null;
const COALESCE_MS = 600;

function pushEntry(before, after, label) {
    if (before === after) return;
    undoStack.push({ before, after, label, time: Date.now() });
    redoStack.length = 0;
    emit('undo:stackChanged', stackInfo());
}

function snapshot(label = 'change') {
    const after = serialize();
    pushEntry(lastSnapshot, after, label);
    lastSnapshot = after;
}

export function undo() {
    const entry = undoStack.pop();
    if (!entry) return;
    redoStack.push(entry);
    deserialize(entry.before);
    lastSnapshot = entry.before;
    emit('undo:applied', { direction: 'undo', entry });
    emit('undo:stackChanged', stackInfo());
}

export function redo() {
    const entry = redoStack.pop();
    if (!entry) return;
    undoStack.push(entry);
    deserialize(entry.after);
    lastSnapshot = entry.after;
    emit('undo:applied', { direction: 'redo', entry });
    emit('undo:stackChanged', stackInfo());
}

export function canUndo() { return undoStack.length > 0; }
export function canRedo() { return redoStack.length > 0; }

export function stackInfo() {
    return {
        undo: undoStack.map(e => e.label),
        redo: redoStack.map(e => e.label)
    };
}

on('model:changed', ({ reason }) => {
    clearTimeout(coalesceTimer);
    coalesceTimer = setTimeout(() => snapshot(reason || 'change'), COALESCE_MS);
});

console.log('undo.js (advanced) loaded');