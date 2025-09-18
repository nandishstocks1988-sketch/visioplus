/**
 * exportImportJson.js
 * Export / Import (Replace or Merge) for the diagram.
 *
 * Adds buttons:
 *  #btn-export-json
 *  #btn-import-json
 *
 * Public API on window.VISOPLUS:
 *  - exportJson(filename?)
 *  - importJsonString(jsonString, { replace = true, mergeOptions })
 *  - enableDiagramDragDrop(domElement?)
 *
 * Merge Mode:
 *  importJsonString(str, { replace:false, mergeOptions:{ offset:true } })
 *    - Deduplicates IDs
 *    - Optionally offsets imported shapes so they don't overlap existing
 *    - Wraps entire merge in one history batch "Import Merge"
 */

import {
    serialize,
    deserialize,
    model
} from '../core/model.js';
import { history } from '../core/history.js';
import { emit } from '../core/events.js';
import { selection, setSelection } from '../core/selection.js';

const SCHEMA_VERSION = 1;

function initExportImportJson() {
    const exportBtn = document.getElementById('btn-export-json');
    const importBtn = document.getElementById('btn-import-json');

    exportBtn?.addEventListener('click', () => {
        try {
            exportJson();
        } catch (err) {
            console.error('[ExportJSON] Failed:', err);
            alert('Export failed: ' + err.message);
        }
    });

    importBtn?.addEventListener('click', () => {
        openImportDialog();
    });

    console.log('exportImportJson.js initialized (JSON Export/Import + Merge)');
}

/* ---------------- Export ---------------- */

export function exportJson(filename = defaultFileName()) {
    const rawDiagram = JSON.parse(serialize());
    const wrapper = {
        schemaVersion: SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        app: 'VISOPLUS',
        diagram: rawDiagram
    };
    const text = JSON.stringify(wrapper, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function defaultFileName() {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    return `diagram-${ts}.diagram.json`;
}

/* ---------------- Import UI ---------------- */

function openImportDialog() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,.diagram.json,application/json';
    inp.addEventListener('change', () => {
        if (!inp.files || !inp.files.length) return;
        const file = inp.files[0];
        const reader = new FileReader();
        reader.onload = () => {
            // Ask user for mode: Replace vs Merge
            // OK = Replace, Cancel = Merge (simple confirm)
            const replace = window.confirm('Import Mode:\n\nOK = Replace existing diagram\nCancel = Merge into current diagram');
            try {
                importJsonString(reader.result, {
                    replace,
                    mergeOptions: !replace ? { offset: true } : undefined
                });
            } catch (err) {
                console.error('[ImportJSON] Failed:', err);
                alert('Import failed: ' + err.message);
            }
        };
        reader.readAsText(file);
    });
    inp.click();
}

/* ---------------- Public Import Function ---------------- */

export function importJsonString(str, { replace = true, mergeOptions } = {}) {
    let data;
    try {
        data = JSON.parse(str);
    } catch (err) {
        throw new Error('File is not valid JSON');
    }

    let diagram;
    if (data && data.diagram && data.diagram.shapes && data.diagram.connectors) {
        if (data.schemaVersion && data.schemaVersion > SCHEMA_VERSION) {
            console.warn('[ImportJSON] Newer schema version found:', data.schemaVersion);
        }
        diagram = data.diagram;
    } else if (data.shapes && data.connectors) {
        diagram = data;
    } else {
        throw new Error('JSON does not look like a diagram export');
    }

    if (!Array.isArray(diagram.shapes) || !Array.isArray(diagram.connectors)) {
        throw new Error('Diagram missing shapes or connectors arrays');
    }

    if (replace) {
        performReplace(diagram);
    } else {
        performMerge(diagram, mergeOptions || {});
    }
}

/* ---------------- Replace Logic ---------------- */

function performReplace(diagram) {
    clearHistory();
    deserialize(diagram, { replace: true });
    emit('model:changed', { reason: 'importJsonReplace', changed: { all: true } });
    alert('Import (replace) successful: ' +
        diagram.shapes.length + ' shapes, ' +
        diagram.connectors.length + ' connectors.');
}

/* ---------------- Merge Logic ---------------- */
/**
 * performMerge(diagram, { offset = true })
 * Steps:
 *  1. Build set of existing shape IDs to detect collisions.
 *  2. If offset enabled, compute bounding boxes and choose shift dx/dy.
 *  3. For each imported shape:
 *      - Decide new ID (same if no collision; else generate)
 *      - Copy style & data verbatim
 *  4. For each imported connector:
 *      - Remap from/to via idMap
 *      - Skip if resulting from or to are missing (defensive)
 *  5. Wrap in single history batch
 *  6. Select newly imported shapes
 */
function performMerge(diagram, { offset = true } = {}) {
    history.beginBatch('Import Merge');

    const existingShapeIds = new Set(model.shapes.keys());
    const existingConnectorIds = new Set(model.connectors.keys());

    // Compute offset (if requested)
    let dx = 0, dy = 0;
    if (offset && diagram.shapes.length > 0 && model.shapes.size > 0) {
        const currentBB = boundingBox([...model.shapes.values()].map(s => ({
            x: s.x, y: s.y, w: s.w, h: s.h
        })));
        const importBB = boundingBox(diagram.shapes.map(s => ({
            x: s.x, y: s.y, w: s.w, h: s.h
        })));
        // Shift imported so its top-left is to the right & slightly below existing
        const margin = 60;
        dx = (currentBB.x + currentBB.w) - importBB.x + margin;
        dy = (currentBB.y) - importBB.y;
        // If vertical overlap large, nudge downward
        if (rangesOverlap(currentBB.y, currentBB.y + currentBB.h, importBB.y, importBB.y + importBB.h)) {
            dy = (currentBB.y + currentBB.h) - importBB.y + margin;
        }
    }

    // ID mapping
    const idMap = new Map(); // oldId -> newId

    // Create shapes
    const newShapeIds = [];
    for (const s of diagram.shapes) {
        const originalId = s.id;
        let newId = originalId;
        if (existingShapeIds.has(newId) || idMap.has(newId)) {
            newId = crypto.randomUUID();
        }
        const newShape = {
            id: newId,
            type: s.type || 'rect',
            x: s.x + dx,
            y: s.y + dy,
            w: s.w,
            h: s.h,
            text: s.text,
            style: structuredClone(s.style || {}),
            data: structuredClone(s.data || {})
        };
        model.shapes.set(newId, newShape);
        history.recordOp({
            type: 'shape:create',
            id: newId,
            after: structuredClone(newShape)
        });
        idMap.set(originalId, newId);
        newShapeIds.push(newId);
    }

    // Create connectors
    let newConnectorCount = 0;
    for (const c of diagram.connectors) {
        const originalId = c.id;
        let newId = originalId;
        if (existingConnectorIds.has(newId)) {
            newId = crypto.randomUUID();
        }
        const mappedFrom = idMap.get(c.from) || c.from; // If shape not imported but exists, this can intentionally link
        const mappedTo = idMap.get(c.to) || c.to;

        // Validate endpoint existence after mapping
        if (!model.shapes.has(mappedFrom) || !model.shapes.has(mappedTo)) {
            console.warn('[Import Merge] Skipping connector with missing endpoints:', originalId);
            continue;
        }

        const newConnector = {
            id: newId,
            from: mappedFrom,
            to: mappedTo,
            type: c.type || 'straight',
            points: Array.isArray(c.points) ? c.points.map(p => ({ x: p.x + dx, y: p.y + dy })) : null,
            style: structuredClone(c.style || {
                stroke: '#444444',
                strokeWidth: 2,
                arrowEnd: 'triangle',
                arrowStart: 'none',
                arrowSize: 12,
                padStart: 4,
                padEnd: 4
            })
        };
        model.connectors.set(newId, newConnector);
        history.recordOp({
            type: 'connector:create',
            id: newId,
            after: structuredClone(newConnector)
        });
        newConnectorCount++;
    }

    history.commitBatch();

    emit('model:changed', {
        reason: 'importJsonMerge',
        changed: {
            shapes: newShapeIds,
            connectors: [] // connectors not explicitly selected; can add if desired
        }
    });

    // Select newly added shapes
    if (newShapeIds.length) {
        setSelection(newShapeIds);
        emit('selection:changed');
    }

    alert('Merge successful: ' +
        newShapeIds.length + ' new shapes, ' +
        newConnectorCount + ' new connectors.');
}

/* ---------------- Helpers ---------------- */

function clearHistory() {
    if (history) {
        history.past = [];
        history.future = [];
        history.currentBatch = null;
    }
}

function boundingBox(rects) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rects) {
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.w);
        maxY = Math.max(maxY, r.y + r.h);
    }
    if (!isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function rangesOverlap(a1, a2, b1, b2) {
    return Math.max(a1, b1) <= Math.min(a2, b2);
}

/* ---------------- Drag & Drop (Optional) ---------------- */

export function enableDiagramDragDrop(dropArea = document.body) {
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        if (!e.dataTransfer.files?.length) return;
        const file = e.dataTransfer.files[0];
        if (!file.name.toLowerCase().endsWith('.json')) {
            alert('Not a JSON file');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const replace = window.confirm('Drag & Drop Import:\n\nOK = Replace existing diagram\nCancel = Merge into current diagram');
            try {
                importJsonString(reader.result, { replace, mergeOptions: !replace ? { offset: true } : undefined });
            } catch (err) {
                console.error('[ImportJSON] Drag/drop failed:', err);
                alert('Import failed: ' + err.message);
            }
        };
        reader.readAsText(file);
    });
    console.log('Diagram drag/drop enabled for JSON files (replace or merge).');
}

/* ---------------- Expose ---------------- */

window.addEventListener('load', initExportImportJson);

window.VISOPLUS = window.VISOPLUS || {};
Object.assign(window.VISOPLUS, {
    exportJson,
    importJsonString,
    enableDiagramDragDrop
});