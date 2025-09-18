/**
 * stylePanel.js (patched)
 * - Ensures waypoint mode toggle is exposed
 * - Optional auto-create a waypoint if entering waypoint mode with none present
 */
import { model, updateConnector } from '../core/model.js';
import { selection } from '../core/selection.js';
import { on, emit } from '../core/events.js';

let shapePanel, connectorPanel;
let fillInput, strokeInput, textColorInput;
let connStrokeInput, connWidthInput, connArrowStart, connArrowEnd, connArrowSize;
let connPadStartInput, connPadEndInput;
let waypointButton;

let waypointMode = false;
export function isWaypointMode() { return waypointMode; }

function setWaypointMode(v) {
    waypointMode = v;
    if (waypointButton) waypointButton.textContent = waypointMode ? 'Waypoints: On' : 'Edit Waypoints';
    maybeEnsureWaypoint();
    emit('ui:needsRender');
}

function maybeEnsureWaypoint() {
    // If entering waypoint mode, single connector selected, but no interior points, insert one midpoint
    if (!waypointMode) return;
    if (selection.connectors.size !== 1) return;
    const cid = [...selection.connectors][0];
    const c = model.connectors.get(cid);
    if (!c) return;
    if (Array.isArray(c.points) && c.points.length) return;

    // Compute a simple midpoint (will be trimmed in render) between centers
    const from = model.shapes.get(c.from);
    const to = model.shapes.get(c.to);
    if (!from || !to) return;
    const a = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const b = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    updateConnector(cid, { points: [mid] });
}

function expandHex(hex) {
    if (typeof hex !== 'string') return hex;
    const m = hex.match(/^#([0-9a-fA-F]{3})$/);
    return m ? '#' + m[1].split('').map(c => c + c).join('') : hex;
}

export function initStylePanel() {
    shapePanel = document.getElementById('panel-shape-style');
    connectorPanel = document.getElementById('panel-connector-style');

    fillInput = document.getElementById('style-fill');
    strokeInput = document.getElementById('style-stroke');
    textColorInput = document.getElementById('style-textcolor');

    connStrokeInput = document.getElementById('conn-stroke');
    connWidthInput = document.getElementById('conn-width');
    connArrowStart = document.getElementById('conn-arrow-start');
    connArrowEnd = document.getElementById('conn-arrow-end');
    connArrowSize = document.getElementById('conn-arrow-size');
    connPadStartInput = document.getElementById('conn-pad-start');
    connPadEndInput = document.getElementById('conn-pad-end');
    waypointButton = document.getElementById('btn-edit-waypoints');

    fillInput?.addEventListener('input', () => applyShapeStyle('fill', fillInput.value));
    strokeInput?.addEventListener('input', () => applyShapeStyle('stroke', strokeInput.value));
    textColorInput?.addEventListener('input', () => applyShapeStyle('textColor', textColorInput.value));

    connStrokeInput?.addEventListener('input', () => applyConnectorStyle({ stroke: connStrokeInput.value }));
    connWidthInput?.addEventListener('input', () => {
        const w = parseFloat(connWidthInput.value) || 2;
        applyConnectorStyle({ strokeWidth: w });
    });
    connArrowSize?.addEventListener('input', () => {
        let sz = parseFloat(connArrowSize.value);
        if (isNaN(sz)) sz = 12;
        sz = Math.max(4, Math.min(300, sz));
        applyConnectorStyle({ arrowSize: sz });
    });
    connArrowStart?.addEventListener('change', () => applyConnectorStyle({ arrowStart: connArrowStart.value }));
    connArrowEnd?.addEventListener('change', () => applyConnectorStyle({ arrowEnd: connArrowEnd.value }));
    connPadStartInput?.addEventListener('input', () => {
        let v = parseFloat(connPadStartInput.value); if (isNaN(v)) v = 0;
        applyConnectorStyle({ padStart: Math.max(0, v) });
    });
    connPadEndInput?.addEventListener('input', () => {
        let v = parseFloat(connPadEndInput.value); if (isNaN(v)) v = 0;
        applyConnectorStyle({ padEnd: Math.max(0, v) });
    });

    waypointButton?.addEventListener('click', () => setWaypointMode(!waypointMode));

    on('selection:changed', () => {
        // If selection changes away from single connector, turn off mode automatically
        if (waypointMode && selection.connectors.size !== 1) setWaypointMode(false);
        updateUI();
    });
    on('model:changed', updateUI);
    updateUI();
}

function applyShapeStyle(prop, value) {
    const ids = [...selection.shapes];
    if (!ids.length) return;
    for (const id of ids) {
        const s = model.shapes.get(id);
        if (s) s.style[prop] = value;
    }
    emit('model:changed', { reason: 'style-shape-' + prop, changed: { shapes: ids } });
}

function applyConnectorStyle(stylePatch) {
    const ids = [...selection.connectors];
    if (!ids.length) return;
    for (const id of ids) updateConnector(id, { style: stylePatch });
}

function updateUI() {
    const sCount = selection.shapes.size;
    const cCount = selection.connectors.size;
    shapePanel?.classList.toggle('hidden', cCount > 0);
    connectorPanel?.classList.toggle('hidden', cCount === 0);

    if (cCount > 0 && sCount === 0) {
        const cid = [...selection.connectors][0];
        const c = model.connectors.get(cid);
        if (c) {
            syncConnectorField(connStrokeInput, expandHex(c.style.stroke || '#444444'));
            syncNum(connWidthInput, c.style.strokeWidth || 2);
            syncNum(connArrowSize, c.style.arrowSize || 12);
            syncConnectorField(connArrowStart, c.style.arrowStart);
            syncConnectorField(connArrowEnd, c.style.arrowEnd);
            syncNum(connPadStartInput, c.style.padStart ?? 4);
            syncNum(connPadEndInput, c.style.padEnd ?? 4);
        }
    } else if (sCount > 0 && cCount === 0) {
        const sid = [...selection.shapes][0];
        const s = model.shapes.get(sid);
        if (s) {
            syncConnectorField(fillInput, expandHex(s.style.fill || '#ffffff'));
            syncConnectorField(strokeInput, expandHex(s.style.stroke || '#333333'));
            syncConnectorField(textColorInput, expandHex(s.style.textColor || '#222222'));
        }
    }
}

function syncConnectorField(el, val) {
    if (el && val !== undefined && el.value !== String(val)) el.value = String(val);
}
function syncNum(el, num) {
    if (el && num !== undefined && parseFloat(el.value) !== num) el.value = num;
}

window.VISOPLUS = window.VISOPLUS || {};
window.VISOPLUS.isWaypointMode = isWaypointMode;

console.log('stylePanel.js patched (waypoint auto-add if empty)');