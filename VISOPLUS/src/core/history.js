/**
 * history.js
 * Generic undo/redo with batching.
 *
 * Ops supported:
 *  - shape:update   (partial fields)
 *  - connector:update (partial fields)
 *  - shape:create / shape:delete (full snapshot)
 *  - connector:create / connector:delete (full snapshot)
 *
 * Batching:
 *   history.beginBatch("Label")
 *   ... multiple mutations ...
 *   history.commitBatch()
 *
 * Undo/redo emits model:changed with reasons 'history:undo' / 'history:redo'
 * (Rendering listens to model:changed already.)
 */

import { model } from './model.js';
import { emit } from './events.js';

const MAX_STACK = 500;

class History {
    constructor() {
        this.past = [];
        this.future = [];
        this.currentBatch = null;
        this.enabled = true;
    }

    beginBatch(label = 'Batch') {
        if (this.currentBatch) return;
        this.currentBatch = { label, ops: [], t: Date.now() };
    }

    recordOp(op) {
        if (!this.enabled) return;
        if (this.currentBatch) {
            this.currentBatch.ops.push(op);
        } else {
            this.past.push({ label: op.type, ops: [op], t: Date.now() });
            if (this.past.length > MAX_STACK) this.past.shift();
            this.future = [];
        }
    }

    commitBatch() {
        if (!this.currentBatch) return;
        if (this.currentBatch.ops.length) {
            this.past.push(this.currentBatch);
            if (this.past.length > MAX_STACK) this.past.shift();
            this.future = [];
        }
        this.currentBatch = null;
    }

    cancelBatch() {
        this.currentBatch = null;
    }

    canUndo() { return this.past.length > 0; }
    canRedo() { return this.future.length > 0; }

    undo() {
        if (!this.canUndo()) return;
        const batch = this.past.pop();
        this.applyBatch(batch, true);
        this.future.push(batch);
        emit('model:changed', { reason: 'history:undo', batchLabel: batch.label });
    }

    redo() {
        if (!this.canRedo()) return;
        const batch = this.future.pop();
        this.applyBatch(batch, false);
        this.past.push(batch);
        emit('model:changed', { reason: 'history:redo', batchLabel: batch.label });
    }

    applyBatch(batch, reverse) {
        this.enabled = false;
        const ops = reverse ? [...batch.ops].reverse() : batch.ops;
        for (const op of ops) {
            switch (op.type) {
                case 'shape:update':
                    applyPartial(model.shapes.get(op.id), reverse ? op.before : op.after);
                    break;
                case 'connector:update':
                    applyPartial(model.connectors.get(op.id), reverse ? op.before : op.after);
                    break;
                case 'shape:create':
                    if (reverse) model.shapes.delete(op.id);
                    else model.shapes.set(op.after.id, structuredClone(op.after));
                    break;
                case 'shape:delete':
                    if (reverse) model.shapes.set(op.before.id, structuredClone(op.before));
                    else model.shapes.delete(op.id);
                    break;
                case 'connector:create':
                    if (reverse) model.connectors.delete(op.id);
                    else model.connectors.set(op.after.id, structuredClone(op.after));
                    break;
                case 'connector:delete':
                    if (reverse) model.connectors.set(op.before.id, structuredClone(op.before));
                    else model.connectors.delete(op.id);
                    break;
                default:
                    break;
            }
        }
        this.enabled = true;
    }
}

function applyPartial(target, patch) {
    if (!target || !patch) return;
    for (const k of Object.keys(patch)) {
        target[k] = structuredClone(patch[k]);
    }
}

export const history = new History();

// Debug
window.VISOPLUS = window.VISOPLUS || {};
window.VISOPLUS.history = history;
console.log('history.js loaded (undo/redo)');