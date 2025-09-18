/**
 * Manual snapshots archive (distinct from undo).
 */
import { serialize } from '../core/model.js';

const SNAP_LIMIT = 100;
const archive = [];

export function takeSnapshot(label = 'manual') {
    archive.push({ label, time: Date.now(), data: serialize() });
    if (archive.length > SNAP_LIMIT) archive.shift();
}

export function listSnapshots() {
    return archive.map((s, i) => ({ index: i, label: s.label, time: s.time }));
}

export function getSnapshot(index) {
    return archive[index];
}

console.log('snapshots.js loaded');