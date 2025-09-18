/**
 * duplicate.js
 * Handles duplication of selected shapes + internal connectors.
 */

import { model, createShape, createConnector } from '../core/model.js';
import { selection, setSelection } from '../core/selection.js';
import { emit } from '../core/events.js';

export function duplicateSelection({ offsetX = 30, offsetY = 30 } = {}) {
    const shapeIds = [...selection.shapes];
    if (!shapeIds.length) return;

    // Map oldId -> newId
    const idMap = new Map();
    const newShapeIds = [];

    // 1. Clone shapes
    for (const id of shapeIds) {
        const orig = model.shapes.get(id);
        if (!orig) continue;
        const clone = createShape({
            type: orig.type,
            x: orig.x + offsetX,
            y: orig.y + offsetY,
            w: orig.w,
            h: orig.h,
            text: orig.text,
            style: { ...orig.style },
            data: JSON.parse(JSON.stringify(orig.data || {}))
        });
        idMap.set(id, clone.id);
        newShapeIds.push(clone.id);
    }

    // 2. Clone connectors whose endpoints are entirely within selection
    const newConnectorIds = [];
    for (const c of model.connectors.values()) {
        if (idMap.has(c.from) && idMap.has(c.to)) {
            const newConn = createConnector({
                from: idMap.get(c.from),
                to: idMap.get(c.to),
                type: c.type,
                style: { ...c.style },
                points: c.points ? c.points.map(p => ({ x: p.x + offsetX, y: p.y + offsetY })) : null
            });
            newConnectorIds.push(newConn.id);
        }
    }

    // 3. Update selection to new shapes
    setSelection(newShapeIds);

    emit('model:changed', {
        reason: 'duplicateSelection',
        changed: { shapes: newShapeIds, connectors: newConnectorIds }
    });
    emit('ui:needsRender');
}