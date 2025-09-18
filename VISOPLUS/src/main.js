/**
 * main.js
 * Core application bootstrap.
 *
 * Set 3 updates:
 *  - Added Help toggle stubs (Alt+H / F1) expecting helpPanel.js in Set 5.
 *  - Clarified seed() logic and kept routeAllBasic() to ensure initial connectors are straight.
 *  - Ensured no implicit grid routing occurs on creation (straight-by-default policy preserved).
 *  - Minor organization & safety comments.
 */

import './ui/waypointEditing.js';
import './core/events.js';
import { on, emit } from './core/events.js';
import './ui/connectorEndpointEdit.js';
import { history } from './core/history.js';
import './ui/exportImportJson.js';
import './ui/helpPanel.js';


import {
    model,
    createShape,
    createConnector
} from './core/model.js';
import './core/selection.js';
import {
    toggleShape,
    setSelection,
    selection,
    toggleConnector,
    setConnectorSelection,
    clearSelection
} from './core/selection.js';

import {
    initRenderer,
    requestRender,
    applyBaseTransform
} from './core/render.js';
import { clientPointToWorld } from './core/pointer.js';

import { initZoomPan } from './features/zoomPan.js';
import './features/alignment.js';
import './features/export.js';
import './features/grouping.js';
import './features/eyeDropper.js';
import './features/styleClipboard.js';
import { initStylePanel } from './features/stylePanel.js';
import './features/import.js';
import { ensureLegend } from './features/legend.js';
import './features/ports.js';
import './features/snapshots.js';
import './ui/inlineTextEdit.js';
import './core/autosave.js';
import {
    loadSession,
    enableAutosave
} from './core/autosave.js';

import { initShortcuts } from './ui/shortcuts.js';
import { initPanels } from './ui/panels.js';
import { initContextMenu } from './ui/contextMenu.js';
import './ui/resizeHandles.js';
import './ui/portDrag.js';
import './ui/statsOverlay.js';

import { routeAllBasic } from './core/routing-basic.js';
import { routeAllGrid } from './core/routing-grid.js';
import { hitTestConnector } from './features/connectorHitTest.js';

// Additional modules
import './ui/shortcuts-history.js';
import './ui/exportButton.js';
import './core/routingObstacle.js';
import './ui/routeObstacleButton.js';

let marquee = null;
let marqueeOrigin = null;

let dragActive = false;
let dragOriginWorld = null;
let dragOffsets = null;
let dragSnapshot = null; // for undo snapshots

let externalResizeActive = false;
on('resizeHandles:active', v => { externalResizeActive = !!(v && v.active); });
let externalPortDragActive = false;
on('portDrag:active', v => { externalPortDragActive = !!(v && v.active); });

/**
 * seed()
 * Creates an initial demo diagram only if model is empty.
 * Ensures connectors are straight by invoking routeAllBasic() once.
 */
function seed() {
    if (model.shapes.size) return;
    const a = createShape({ type: 'pill', x: 160, y: 140, text: 'Start', style: { fill: '#eef8ff' } });
    const b = createShape({ type: 'diamond', x: 420, y: 260, text: 'Decision' });
    const c = createShape({ type: 'note', x: 720, y: 160, text: 'Finish', style: { fill: '#ffeede' } });
    createConnector({ from: a.id, to: b.id });
    createConnector({ from: b.id, to: c.id });
    // Force initial style to 'straight'
    routeAllBasic();
    requestRender();
}

function initCanvasSelection() {
    const canvas = document.getElementById('diagram-canvas');
    if (!canvas) return;

    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (externalResizeActive || externalPortDragActive || e.altKey) return;
        if (e.target.id === 'shape-text-editor') return;

        const pt = clientPointToWorld(e.clientX, e.clientY);

        // Shape hit
        const shapeHit = hitTestShape(pt.x, pt.y);
        if (shapeHit) {
            if (selection.connectors.size && !e.shiftKey) {
                clearSelection();
            }
            if (selection.shapes.has(shapeHit.id)) {
                beginDrag(pt);
                return;
            }
            if (e.shiftKey) {
                toggleShape(shapeHit.id);
            } else {
                setSelection([shapeHit.id]);
            }
            requestRender();
            beginDrag(pt);
            return;
        }

        // Connector hit
        const connectorId = hitTestConnector(pt.x, pt.y, 6 / model.meta.zoom);
        if (connectorId) {
            if (selection.shapes.size && !e.shiftKey) {
                clearSelection();
            }
            if (selection.connectors.has(connectorId)) {
                if (e.shiftKey) {
                    toggleConnector(connectorId);
                } else {
                    setConnectorSelection([connectorId]);
                }
            } else {
                if (e.shiftKey) {
                    toggleConnector(connectorId);
                } else {
                    setConnectorSelection([connectorId]);
                }
            }
            requestRender();
            return;
        }

        // Start marquee
        marqueeOrigin = pt;
        marquee = { x: pt.x, y: pt.y, w: 0, h: 0, append: e.shiftKey };
    });

    window.addEventListener('mousemove', (e) => {
        if (dragActive) {
            performDrag(clientPointToWorld(e.clientX, e.clientY), e.shiftKey);
            return;
        }
        if (marqueeOrigin) {
            const pt = clientPointToWorld(e.clientX, e.clientY);
            marquee.x = Math.min(pt.x, marqueeOrigin.x);
            marquee.y = Math.min(pt.y, marqueeOrigin.y);
            marquee.w = Math.abs(pt.x - marqueeOrigin.x);
            marquee.h = Math.abs(pt.y - marqueeOrigin.y);
            emit('ui:needsRender');
        }
    });

    window.addEventListener('mouseup', () => {
        if (dragActive) {
            endDrag();
            emit('ui:needsRender');
        } else if (marqueeOrigin && marquee) {
            emit('selection:changed');
            marquee = null;
            marqueeOrigin = null;
            emit('ui:needsRender');
        }
    });

    on('render:after', drawMarqueeOverlay);
}

function beginDrag(worldPt) {
    if (!selection.shapes.size) return;
    dragActive = true;
    dragOriginWorld = worldPt;
    dragOffsets = [...selection.shapes].map(id => {
        const s = model.shapes.get(id);
        return { id, ox: worldPt.x - s.x, oy: worldPt.y - s.y };
    });
    // Snapshot for undo
    dragSnapshot = [...selection.shapes].map(id => {
        const s = model.shapes.get(id);
        return { id, x: s.x, y: s.y };
    });
    history.beginBatch('Move Shapes');
}

function performDrag(currentWorldPt, snapKey) {
    if (!dragActive || !dragOffsets) return;
    const gridSnap = snapKey;
    for (const off of dragOffsets) {
        const s = model.shapes.get(off.id);
        if (!s) continue;
        let nx = currentWorldPt.x - off.ox;
        let ny = currentWorldPt.y - off.oy;
        if (gridSnap) {
            const g = model.meta.gridSize;
            nx = Math.round(nx / g) * g;
            ny = Math.round(ny / g) * g;
        }
        s.x = nx;
        s.y = ny;
    }
    emit('ui:needsRender');
}

function endDrag() {
    if (!dragActive) return;
    const changed = [...selection.shapes];
    if (changed.length && dragSnapshot) {
        for (const snap of dragSnapshot) {
            const s = model.shapes.get(snap.id);
            if (!s) continue;
            if (s.x !== snap.x || s.y !== snap.y) {
                history.recordOp({
                    type: 'shape:update',
                    id: s.id,
                    before: { x: snap.x, y: snap.y },
                    after: { x: s.x, y: s.y }
                });
            }
        }
    }
    history.commitBatch();
    dragActive = false;
    dragOriginWorld = null;
    dragOffsets = null;
    dragSnapshot = null;
    if (changed.length) {
        emit('model:changed', { reason: 'dragMove', changed: { shapes: changed } });
    }
}

function drawMarqueeOverlay() {
    if (!marquee) return;
    const canvas = document.getElementById('diagram-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    ctx.save();
    applyBaseTransform(ctx);
    ctx.strokeStyle = '#2980b9';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(marquee.x, marquee.y, marquee.w, marquee.h);
    ctx.restore();
}

function hitTestShape(x, y) {
    const arr = [...model.shapes.values()];
    for (let i = arr.length - 1; i >= 0; i--) {
        const s = arr[i];
        if (x >= s.x && y >= s.y && x <= s.x + s.w && y <= s.y + s.h) return s;
    }
    return null;
}

/* Routing event hooks (still available for external triggers) */
on('routing:basic', () => {
    routeAllBasic();
    emit('model:changed', { reason: 'route-basic' });
});
on('routing:grid', () => {
    routeAllGrid();
    emit('model:changed', { reason: 'route-grid' });
});
on('selection:changed', () => emit('ui:needsRender'));

/**
 * Global help toggle stubs — will be implemented in helpPanel.js (Set 5)
 */
function registerHelpHotkeys() {
    window.addEventListener('keydown', (e) => {
        if ((e.key === 'F1') || (e.key.toLowerCase?.() === 'h' && e.altKey)) {
            if (window.VISOPLUS?.helpPanel?.toggle) {
                e.preventDefault();
                window.VISOPLUS.helpPanel.toggle();
            }
        }
    });
}

function init() {
    const restored = loadSession();
    if (!restored || model.shapes.size === 0) {
        seed();
    }
    enableAutosave();

    initRenderer();
    initZoomPan();
    initPanels();
    initShortcuts();
    initStylePanel();
    initContextMenu();
    initCanvasSelection();
    ensureLegend();
    registerHelpHotkeys();
    console.log('App initialized (Set 3 updates loaded)');
}

window.addEventListener('load', init);

window.VISOPLUS = window.VISOPLUS || {};
Object.assign(window.VISOPLUS, {
    model,
    routeAllBasic,
    routeAllGrid
});

console.log('main.js loaded (Set 3)');