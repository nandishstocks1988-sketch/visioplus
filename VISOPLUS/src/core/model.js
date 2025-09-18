/**
 * model.js
 * Extended with history integration.
 */
import { emit } from './events.js';
import { history } from './history.js';

export const model = {
    shapes: new Map(),
    connectors: new Map(),
    groups: new Map(),
    meta: {
        gridSize: 10,
        zoom: 1,
        pan: { x: 0, y: 0 },
        version: 0
    }
};

function touch(reason = 'unknown', changed = {}) {
    model.meta.version++;
    emit('model:changed', { reason, changed, version: model.meta.version });
}

function expandHex(hex) {
    if (typeof hex !== 'string') return hex;
    const m = /^#([0-9a-fA-F]{3})$/.exec(hex);
    return m ? '#' + m[1].split('').map(c => c + c).join('') : hex;
}

function normalizeStyle(style = {}) {
    if (style.fill) style.fill = expandHex(style.fill);
    if (style.stroke) style.stroke = expandHex(style.stroke);
    if (style.textColor) style.textColor = expandHex(style.textColor);
    return style;
}

/* ---------------- Shapes ---------------- */

export function createShape(props = {}) {
    const id = props.id || crypto.randomUUID();
    const style = normalizeStyle({
        fill: '#ffffff',
        stroke: '#333333',
        strokeWidth: 1.5,
        radius: 8,
        textColor: '#222222',
        ...props.style
    });

    const shape = {
        id,
        type: props.type || 'rect',
        x: props.x ?? 100,
        y: props.y ?? 100,
        w: props.w ?? 140,
        h: props.h ?? 70,
        text: props.text ?? 'Shape',
        style,
        data: props.data || {}
    };
    model.shapes.set(id, shape);

    history.recordOp({
        type: 'shape:create',
        id,
        after: structuredClone(shape)
    });
    touch('createShape', { shapes: [id] });
    return shape;
}

export function updateShape(id, patch) {
    const s = model.shapes.get(id);
    if (!s) return;
    const before = {};
    for (const k of Object.keys(patch)) before[k] = structuredClone(s[k]);

    if (patch.style) patch.style = normalizeStyle({ ...s.style, ...patch.style });
    Object.assign(s, patch);

    const after = {};
    for (const k of Object.keys(patch)) after[k] = structuredClone(s[k]);

    history.recordOp({
        type: 'shape:update',
        id,
        before,
        after
    });
    touch('updateShape', { shapes: [id] });
    return s;
}

export function moveShapes(ids, dx, dy, { snap = false, batchLabel = 'Move Shapes' } = {}) {
    if (!ids?.length) return;
    history.beginBatch(batchLabel);
    const changed = [];
    for (const id of ids) {
        const s = model.shapes.get(id);
        if (!s) continue;
        const before = { x: s.x, y: s.y };
        s.x += dx;
        s.y += dy;
        if (snap) {
            const g = model.meta.gridSize;
            s.x = Math.round(s.x / g) * g;
            s.y = Math.round(s.y / g) * g;
        }
        history.recordOp({
            type: 'shape:update',
            id,
            before,
            after: { x: s.x, y: s.y }
        });
        changed.push(id);
    }
    history.commitBatch();
    if (changed.length) touch('moveShapes', { shapes: changed });
}

export function resizeShape(id, { w, h }) {
    const s = model.shapes.get(id);
    if (!s) return;
    const before = { w: s.w, h: s.h };
    s.w = Math.max(10, w);
    s.h = Math.max(10, h);
    history.recordOp({
        type: 'shape:update',
        id,
        before,
        after: { w: s.w, h: s.h }
    });
    touch('resizeShape', { shapes: [id] });
}

export function deleteShapes(ids) {
    const removedShapes = [];
    const removedConnectors = [];
    history.beginBatch('Delete Shapes');
    for (const id of ids) {
        const shape = model.shapes.get(id);
        if (!shape) continue;
        history.recordOp({
            type: 'shape:delete',
            id,
            before: structuredClone(shape)
        });
        model.shapes.delete(id);
        removedShapes.push(id);

        for (const [cid, c] of [...model.connectors.entries()]) {
            if (c.from === id || c.to === id) {
                history.recordOp({
                    type: 'connector:delete',
                    id: cid,
                    before: structuredClone(c)
                });
                model.connectors.delete(cid);
                removedConnectors.push(cid);
            }
        }
        for (const set of model.groups.values()) set.delete(id);
    }
    history.commitBatch();
    if (removedShapes.length || removedConnectors.length) {
        touch('deleteShapes', { shapes: removedShapes, connectors: removedConnectors });
    }
}

/* ---------------- Connectors ---------------- */

export function createConnector({
    from,
    to,
    type = 'straight',
    points = null,
    style = {}
}) {
    if (!model.shapes.has(from) || !model.shapes.has(to)) return null;
    const id = crypto.randomUUID();
    const conn = {
        id,
        from,
        to,
        type,
        points,
        style: {
            stroke: '#444444',
            strokeWidth: 2,
            arrowEnd: 'triangle',
            arrowStart: 'none',
            arrowSize: 12,
            padStart: 4,
            padEnd: 4,
            ...style
        }
    };
    model.connectors.set(id, conn);
    history.recordOp({
        type: 'connector:create',
        id,
        after: structuredClone(conn)
    });
    touch('createConnector', { connectors: [id] });
    return conn;
}

export function updateConnector(id, patch) {
    const c = model.connectors.get(id);
    if (!c) return;
    const before = {};
    // record only changed keys
    for (const k of Object.keys(patch)) before[k] = structuredClone(c[k]);

    if (patch.style) {
        c.style = { ...c.style, ...patch.style };
        delete patch.style;
    }
    if (patch.points !== undefined) c.points = patch.points;
    if (patch.type) c.type = patch.type;
    Object.assign(c, patch);

    const after = {};
    for (const k of Object.keys(patch)) after[k] = structuredClone(c[k]);

    history.recordOp({
        type: 'connector:update',
        id,
        before,
        after
    });
    touch('updateConnector', { connectors: [id] });
    return c;
}

export function deleteConnectors(ids) {
    if (!ids?.length) return;
    history.beginBatch('Delete Connectors');
    const removed = [];
    for (const id of ids) {
        const c = model.connectors.get(id);
        if (!c) continue;
        history.recordOp({
            type: 'connector:delete',
            id,
            before: structuredClone(c)
        });
        model.connectors.delete(id);
        removed.push(id);
    }
    history.commitBatch();
    if (removed.length) touch('deleteConnectors', { connectors: removed });
}

/* ---------------- Layer Ordering (no full undo for order yet) ---------------- */

export function bringShapesToFront(ids) {
    if (!ids?.length) return;
    const set = new Set(ids);
    const newMap = new Map();
    for (const [id, s] of model.shapes.entries()) if (!set.has(id)) newMap.set(id, s);
    for (const [id, s] of model.shapes.entries()) if (set.has(id)) newMap.set(id, s);
    model.shapes = newMap;
    touch('zOrderFront', { shapes: ids });
}

export function sendShapesToBack(ids) {
    if (!ids?.length) return;
    const set = new Set(ids);
    const newMap = new Map();
    for (const [id, s] of model.shapes.entries()) if (set.has(id)) newMap.set(id, s);
    for (const [id, s] of model.shapes.entries()) if (!set.has(id)) newMap.set(id, s);
    model.shapes = new Map(newMap);
    touch('zOrderBack', { shapes: ids });
}

export function bringShapesForward(ids) {
    if (!ids?.length) return;
    const order = [...model.shapes.keys()];
    const set = new Set(ids);
    for (let i = order.length - 2; i >= 0; i--) {
        const id = order[i];
        const nextId = order[i + 1];
        if (set.has(id) && !set.has(nextId)) {
            order[i] = nextId;
            order[i + 1] = id;
        }
    }
    const newMap = new Map();
    for (const id of order) newMap.set(id, model.shapes.get(id));
    model.shapes = newMap;
    touch('zOrderForward', { shapes: ids });
}

export function sendShapesBackward(ids) {
    if (!ids?.length) return;
    const order = [...model.shapes.keys()];
    const set = new Set(ids);
    for (let i = 1; i < order.length; i++) {
        const id = order[i];
        const prev = order[i - 1];
        if (set.has(id) && !set.has(prev)) {
            order[i] = prev;
            order[i - 1] = id;
        }
    }
    const newMap = new Map();
    for (const id of order) newMap.set(id, model.shapes.get(id));
    model.shapes = newMap;
    touch('zOrderBackward', { shapes: ids });
}

/* ---------------- Serialization ---------------- */

export function serialize() {
    return JSON.stringify({
        schemaVersion: 1,
        shapes: [...model.shapes.values()],
        connectors: [...model.connectors.values()],
        groups: [...model.groups.entries()].map(([gid, set]) => [gid, [...set]]),
        meta: model.meta
    }, null, 2);
}

export function deserialize(json, { replace = true } = {}) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (replace) {
        model.shapes.clear();
        model.connectors.clear();
        model.groups.clear();
    }
    for (const s of data.shapes || []) {
        if (s.style) normalizeStyle(s.style);
        model.shapes.set(s.id, s);
    }
    for (const c of data.connectors || []) {
        c.style = {
            stroke: '#444444',
            strokeWidth: 2,
            arrowEnd: 'triangle',
            arrowStart: 'none',
            arrowSize: 12,
            padStart: 4,
            padEnd: 4,
            ...(c.style || {})
        };
        model.connectors.set(c.id, c);
    }
    for (const [gid, arr] of data.groups || []) {
        model.groups.set(gid, new Set(arr));
    }
    Object.assign(model.meta, data.meta || {});
    touch('deserialize', { all: true });
}

/* ---------------- Meta Helpers ---------------- */

export function setZoom(z) {
    model.meta.zoom = Math.min(6, Math.max(0.1, z));
    touch('setZoom', {});
}
export function setPan(x, y) {
    model.meta.pan.x = x;
    model.meta.pan.y = y;
    touch('setPan', {});
}
export function setGridSize(size) {
    model.meta.gridSize = Math.max(1, size);
    touch('setGrid', {});
}
export function resetModel() {
    model.shapes.clear();
    model.connectors.clear();
    model.groups.clear();
    model.meta.pan = { x: 0, y: 0 };
    model.meta.zoom = 1;
    touch('resetModel', { all: true });
}

console.log('model.js loaded (history integrated)');