/**
 * selection.js
 * Unified selection manager for shapes AND connectors.
 *
 * Features:
 * - Separate sets: selection.shapes, selection.connectors
 * - Snapshot diff to avoid redundant selection:changed events
 * - Helper APIs for shape and connector selection/toggling
 * - Marquee (shapes only for now)
 * - Prunes removed items after model changes
 *
 * Event Payload:
 *   emit('selection:changed', {
 *      reason,
 *      shapes: [...shapeIds],
 *      connectors: [...connectorIds]
 *   })
 */

import { emit, on } from './events.js';
import { model } from './model.js';

export const selection = {
    shapes: new Set(),
    connectors: new Set()
};

// ----- Snapshot / Commit -----
function snapshot() {
    return {
        s: [...selection.shapes].sort(),
        c: [...selection.connectors].sort()
    };
}

let lastSnap = snapshot();

function commit(reason = 'select') {
    const now = snapshot();
    if (now.s.length !== lastSnap.s.length ||
        now.c.length !== lastSnap.c.length ||
        JSON.stringify(now.s) !== JSON.stringify(lastSnap.s) ||
        JSON.stringify(now.c) !== JSON.stringify(lastSnap.c)) {
        lastSnap = now;
        emit('selection:changed', { reason, shapes: now.s, connectors: now.c });
    }
}

// ----- General Utilities -----
export function clearSelection() {
    if (!selection.shapes.size && !selection.connectors.size) return;
    selection.shapes.clear();
    selection.connectors.clear();
    commit('clear');
}

export function isSelected(id) {
    return selection.shapes.has(id) || selection.connectors.has(id);
}

// ----- Shape Selection APIs -----
export function selectShape(id, { append = false } = {}) {
    if (!model.shapes.has(id)) return;
    if (!append) {
        selection.shapes.clear();
        selection.connectors.clear();
    }
    selection.shapes.add(id);
    commit('shape');
}

export function toggleShape(id) {
    if (!model.shapes.has(id)) return;
    if (selection.shapes.has(id)) {
        selection.shapes.delete(id);
    } else {
        // If you want multi-group mixing with connectors, clear connectors
        selection.connectors.clear();
        selection.shapes.add(id);
    }
    commit('toggle-shape');
}

export function setSelection(ids) {
    selection.shapes.clear();
    selection.connectors.clear();
    for (const id of ids) {
        if (model.shapes.has(id)) selection.shapes.add(id);
    }
    commit('set-shapes');
}

// ----- Connector Selection APIs -----
export function selectConnector(id, { append = false } = {}) {
    if (!model.connectors.has(id)) return;
    if (!append) {
        selection.shapes.clear();
        selection.connectors.clear();
    }
    selection.connectors.add(id);
    commit('connector');
}

export function toggleConnector(id) {
    if (!model.connectors.has(id)) return;
    if (selection.connectors.has(id)) {
        selection.connectors.delete(id);
    } else {
        selection.shapes.clear(); // exclusive with shapes
        selection.connectors.add(id);
    }
    commit('toggle-connector');
}

export function setConnectorSelection(ids) {
    selection.shapes.clear();
    selection.connectors.clear();
    for (const id of ids) {
        if (model.connectors.has(id)) selection.connectors.add(id);
    }
    commit('set-connectors');
}

// ----- Marquee (shapes only) -----
export function selectMarquee(rect, { append = false } = {}) {
    if (!append) {
        selection.shapes.clear();
        selection.connectors.clear();
    }
    for (const s of model.shapes.values()) {
        if (
            s.x >= rect.x &&
            s.y >= rect.y &&
            s.x + s.w <= rect.x + rect.w &&
            s.y + s.h <= rect.y + rect.h
        ) {
            selection.shapes.add(s.id);
        }
    }
    commit('marquee');
}
// Debug / console exposure
window.VISOPLUS = window.VISOPLUS || {};
// If you already set selectionAPI previously, keep it. Just also expose `selection` bare for convenience:
window.VISOPLUS.selection = selection;

// ----- Prune Removed Items -----
on('model:changed', ({ changed }) => {
    if (!changed) return;
    let altered = false;

    if (changed.shapes) {
        for (const id of changed.shapes) {
            if (!model.shapes.has(id) && selection.shapes.delete(id)) altered = true;
        }
    }
    if (changed.connectors) {
        for (const id of changed.connectors) {
            if (!model.connectors.has(id) && selection.connectors.delete(id)) altered = true;
        }
    }
    if (altered) commit('prune');
});

// ----- Debug / Exposure -----
window.VISOPLUS = window.VISOPLUS || {};
window.VISOPLUS.selectionAPI = {
    selection,
    clearSelection,
    selectShape,
    toggleShape,
    setSelection,
    selectMarquee,
    selectConnector,
    toggleConnector,
    setConnectorSelection
};

console.log('selection.js loaded (shapes + connectors + advanced commit logic)');