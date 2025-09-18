/**
 * Style clipboard
 */
import { selection } from '../core/selection.js';
import { model } from '../core/model.js';
import { emit } from '../core/events.js';

let styleCache = null;

export function copyStyle() {
    const id = [...selection.shapes][0];
    if (!id) return;
    const s = model.shapes.get(id);
    if (!s) return;
    styleCache = { ...s.style };
}

export function pasteStyle() {
    if (!styleCache) return;
    const changed = [];
    for (const id of selection.shapes) {
        const s = model.shapes.get(id);
        if (!s) continue;
        s.style = { ...s.style, ...styleCache };
        changed.push(id);
    }
    if (changed.length) {
        emit('model:changed', { reason: 'stylePaste', changed: { shapes: changed } });
    }
}

console.log('styleClipboard.js loaded');