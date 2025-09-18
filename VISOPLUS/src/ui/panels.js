/**
 * panels.js
 * Side Panels — legacy panel kept (index.html now also has its own UI).
 *
 * Set 3 updates:
 *  - Added comments & minimal safeguards.
 *  - Retained existing functionality; no automatic grid routing applied.
 */

import {
    createShape,
    createConnector,
    model,
    resetModel
} from '../core/model.js';
import { selection } from '../core/selection.js';
import { emit, on } from '../core/events.js';
import { routeAllBasic } from '../core/routing-basic.js';
import { routeAllGrid } from '../core/routing-grid.js';
import {
    saveNow,
    clearSession,
    getLastSaveTime,
    resetAutosaveState
} from '../core/autosave.js';

export function initPanels() {
    const panel = document.getElementById('side-panel');
    if (!panel) return; // In index.html layout this may not exist; safe skip.

    panel.innerHTML = `
    <div class="panel-group">
      <h3>Diagram</h3>
      <button id="btn-add-rect">Add Rect</button>
      <button id="btn-route-basic">Route Basic</button>
      <button id="btn-route-grid">Route Grid</button>
      <hr/>
      <button id="btn-export-json">Export JSON</button>
      <button id="btn-export-svg">Export SVG</button>
      <button id="btn-export-png">Export PNG</button>
    </div>
    <div class="panel-group">
      <h3>Selection</h3>
      <div id="sel-count">0 selected</div>
    </div>
    <div class="panel-group">
      <h3>Style</h3>
      <label>Fill <input id="style-fill" type="color" value="#ffffff"/></label>
      <label>Stroke <input id="style-stroke" type="color" value="#333333"/></label>
    </div>
    <div class="panel-group">
      <h3>Session</h3>
      <div style="font-size:11px;opacity:.75;margin-bottom:4px;">
        Autosave stores only in your browser (localStorage).<br/>
        It does not create a file.
      </div>
      <button id="btn-session-save">Save Now</button>
      <button id="btn-session-clear" title="Remove stored autosave (keeps current diagram)">Clear Session</button>
      <button id="btn-session-new" title="Start a blank in-memory document">New Blank Diagram</button>
      <button id="btn-session-new-clear" title="Clear storage + blank diagram">New Blank + Forget Session</button>
      <div id="session-status" style="margin-top:6px;font-size:11px;opacity:0.8;">No save yet</div>
    </div>
  `;

    // Diagram
    panel.querySelector('#btn-add-rect')?.addEventListener('click', addRect);
    panel.querySelector('#btn-route-basic')?.addEventListener('click', () => {
        routeAllBasic();
        emit('model:changed', { reason: 'route-basic' });
    });
    panel.querySelector('#btn-route-grid')?.addEventListener('click', () => {
        routeAllGrid();
        emit('model:changed', { reason: 'route-grid' });
    });

    panel.querySelector('#btn-export-json')?.addEventListener('click', async () => {
        const { exportJSON } = await import('../features/export.js');
        exportJSON();
    });
    panel.querySelector('#btn-export-svg')?.addEventListener('click', async () => {
        const { exportSVG } = await import('../features/export.js');
        exportSVG();
    });
    panel.querySelector('#btn-export-png')?.addEventListener('click', async () => {
        const { exportPNG } = await import('../features/export.js');
        exportPNG();
    });

    // Session
    panel.querySelector('#btn-session-save')?.addEventListener('click', () => {
        saveNow();
        updateSessionStatus();
    });

    panel.querySelector('#btn-session-clear')?.addEventListener('click', () => {
        if (!confirm('Clear stored session? Current diagram stays in memory.')) return;
        clearSession();
        resetAutosaveState();
        updateSessionStatus();
    });

    panel.querySelector('#btn-session-new')?.addEventListener('click', () => {
        if (!confirm('Start a new blank diagram (does NOT clear stored session)?')) return;
        resetModel();
        updateSessionStatus();
    });

    panel.querySelector('#btn-session-new-clear')?.addEventListener('click', () => {
        if (!confirm('Clear stored session AND start a blank diagram?')) return;
        clearSession();
        resetAutosaveState();
        resetModel();
        updateSessionStatus();
    });

    on('selection:changed', updateSel);
    on('model:changed', () => updateSessionStatus());

    updateSel();
    updateSessionStatus();
}

function addRect() {
    const s = createShape({
        x: 80 + Math.random() * 300,
        y: 80 + Math.random() * 220,
        text: 'Node'
    });
    if (model.shapes.size > 1) {
        const first = [...model.shapes.values()][0];
        createConnector({ from: first.id, to: s.id });
        // Straight-by-default rule: no grid route invoked automatically
    }
    emit('model:changed', { reason: 'panel-add' });
}

export function createConnectorOnly(fromId, toId) {
    const conn = createConnector({ from: fromId, to: toId });
    emit('model:changed', { reason: 'panel-createConnector', changed: { connectors: [conn.id] } });
    return conn;
}

function updateSel() {
    const el = document.getElementById('sel-count');
    if (el) el.textContent = selection.shapes.size + ' selected';
}

function updateSessionStatus() {
    const el = document.getElementById('session-status');
    if (!el) return;
    const ts = getLastSaveTime();
    if (!ts) {
        el.textContent = 'No save yet';
    } else {
        const diff = Date.now() - ts;
        el.textContent = 'Last save: ' + humanizeElapsed(diff) + ' ago';
    }
}

function humanizeElapsed(ms) {
    if (ms < 2000) return (ms / 1000).toFixed(1) + 's';
    if (ms < 60000) return Math.round(ms / 1000) + 's';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m + 'm ' + s + 's';
}

console.log('panels.js (Set 3) loaded');