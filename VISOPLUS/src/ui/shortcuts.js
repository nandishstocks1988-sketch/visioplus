/**
 * shortcuts.js
 *
 * Set 3 updates:
 *  - Added Help toggle hotkeys (Alt+H or F1) — safe if helpPanel not loaded yet.
 *  - Added Ctrl+Shift+R to force straight routing (debug convenience).
 *  - Left Alt+F2 handling to statsOverlay (no duplication).
 *  - Preserved existing copy/paste/duplicate/delete logic.
 */

import { selection, clearSelection, setSelection } from '../core/selection.js';
import {
    moveShapes,
    deleteShapes,
    createShape,
    createConnector,
    deleteConnectors
} from '../core/model.js';
import { emit } from '../core/events.js';
import { duplicateSelection } from '../features/duplicate.js';
import { routeAllBasic } from '../core/routing-basic.js';

let initialized = false;
let clipboard = null; // { shapes:[], connectors:[] }

export function initShortcuts() {
    if (initialized) return;
    initialized = true;

    window.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
            return;
        }

        const meta = e.metaKey || e.ctrlKey;

        // Help toggle (Alt+H or F1) — only if help panel present (future)
        if ((e.key === 'F1') || (e.altKey && e.key.toLowerCase() === 'h')) {
            if (window.VISOPLUS?.helpPanel?.toggle) {
                e.preventDefault();
                window.VISOPLUS.helpPanel.toggle();
            }
        }

        // Force basic routing (debug) Ctrl+Shift+R
        if (meta && e.shiftKey && e.key.toLowerCase() === 'r') {
            e.preventDefault();
            routeAllBasic();
            emit('model:changed', { reason: 'shortcut-route-basic' });
            return;
        }

        // Delete shapes/connectors
        if ((e.key === 'Delete' || e.key === 'Backspace') &&
            (selection.shapes.size || selection.connectors.size)) {
            e.preventDefault();
            if (selection.shapes.size) {
                const ids = [...selection.shapes];
                deleteShapes(ids);
            }
            if (selection.connectors.size) {
                const cids = [...selection.connectors];
                deleteConnectors(cids);
            }
            clearSelection();
            emit('ui:needsRender');
            return;
        }

        // Arrow Nudge (shapes only)
        if (selection.shapes.size && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            const d = e.shiftKey ? 10 : 1;
            let dx = 0, dy = 0;
            switch (e.key) {
                case 'ArrowUp': dy = -d; break;
                case 'ArrowDown': dy = d; break;
                case 'ArrowLeft': dx = -d; break;
                case 'ArrowRight': dx = d; break;
            }
            moveShapes([...selection.shapes], dx, dy);
            emit('ui:needsRender');
            return;
        }

        // Duplicate (Ctrl/Cmd + D) - shapes only
        if (meta && e.key.toLowerCase() === 'd' && selection.shapes.size) {
            e.preventDefault();
            duplicateSelection();
            return;
        }

        // Copy (Ctrl/Cmd + C) shapes only
        if (meta && e.key.toLowerCase() === 'c' && selection.shapes.size) {
            e.preventDefault();
            const shapes = [...selection.shapes].map(id => {
                const s = window.VISOPLUS.model.shapes.get(id);
                return JSON.parse(JSON.stringify(s));
            });
            const shapeIdSet = new Set(shapes.map(s => s.id));
            const connectors = [...window.VISOPLUS.model.connectors.values()]
                .filter(c => shapeIdSet.has(c.from) && shapeIdSet.has(c.to))
                .map(c => JSON.parse(JSON.stringify(c)));
            clipboard = { shapes, connectors };
            return;
        }

        // Paste (Ctrl/Cmd + V)
        if (meta && e.key.toLowerCase() === 'v') {
            if (!clipboard || !clipboard.shapes.length) return;
            e.preventDefault();
            const idMap = new Map();
            const newShapeIds = [];
            const OFFSET = 30;

            clipboard.shapes.forEach(orig => {
                const clone = createShape({
                    type: orig.type,
                    x: orig.x + OFFSET,
                    y: orig.y + OFFSET,
                    w: orig.w,
                    h: orig.h,
                    text: orig.text,
                    style: { ...orig.style },
                    data: JSON.parse(JSON.stringify(orig.data || {}))
                });
                idMap.set(orig.id, clone.id);
                newShapeIds.push(clone.id);
            });

            const newConnectorIds = [];
            clipboard.connectors.forEach(c => {
                if (idMap.has(c.from) && idMap.has(c.to)) {
                    const newConn = createConnector({
                        from: idMap.get(c.from),
                        to: idMap.get(c.to),
                        type: c.type,
                        style: { ...c.style },
                        points: c.points
                            ? c.points.map(p => ({ x: p.x + OFFSET, y: p.y + OFFSET }))
                            : null
                    });
                    newConnectorIds.push(newConn.id);
                }
            });

            setSelection(newShapeIds);
            emit('model:changed', {
                reason: 'paste',
                changed: { shapes: newShapeIds, connectors: newConnectorIds }
            });
            emit('ui:needsRender');
            return;
        }
    });

    console.log('shortcuts.js loaded (Set 3 enhancements)');
}