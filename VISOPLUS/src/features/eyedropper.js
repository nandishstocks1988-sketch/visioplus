/**
 * Style Eyedropper: copy style from primary selected to others.
 */
import { selection } from '../core/selection.js';
import { model } from '../core/model.js';
import { emit } from '../core/events.js';

export function eyedropperApply() {
    const ids = [...selection.shapes];
    if (ids.length < 2) return;
    const base = model.shapes.get(ids[0]);
    if (!base) return;
    for (let i = 1; i < ids.length; i++) {
        const s = model.shapes.get(ids[i]);
        if (!s) continue;
        s.style = { ...s.style, fill: base.style.fill, stroke: base.style.stroke };
    }
    emit('model:changed', { reason: 'eyedropper', changed: { shapes: ids } });
}

console.log('eyedropper.js loaded');