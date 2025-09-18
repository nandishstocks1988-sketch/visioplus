/**
 * Grouping (basic): create / remove groups.
 */
import { model } from '../core/model.js';
import { selection, selectShape, setSelection } from '../core/selection.js';
import { emit } from '../core/events.js';

export function groupSelection() {
    const ids = [...selection.shapes];
    if (ids.length < 2) return;
    const gid = 'group-' + crypto.randomUUID();
    model.groups.set(gid, new Set(ids));
    emit('model:changed', { reason: 'group', changed: { shapes: ids } });
    // Keep selection
}

export function ungroupAll() {
    if (!model.groups.size) return;
    model.groups.clear();
    emit('model:changed', { reason: 'ungroup', changed: {} });
}

export function selectGroup(gid) {
    const g = model.groups.get(gid);
    if (!g) return;
    setSelection([...g]);
}

export function listGroups() {
    return [...model.groups.entries()].map(([gid, set]) => ({ id: gid, size: set.size }));
}

console.log('grouping.js loaded');