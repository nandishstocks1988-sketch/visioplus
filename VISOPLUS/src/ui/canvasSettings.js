/**
 * canvasSettings.js
 * Canvas / Workspace configuration:
 *  - Background color
 *  - Workspace width / height (scrollable area)
 *  - Notes (explanation) area with alignment tools
 * Persists minimal state in localStorage + model.meta.*
 */

import { model } from '../core/model.js';
import { emit } from '../core/events.js';
import { requestRender } from '../core/render.js';

const LS_BG = 'diagram.backgroundColor.v1';
const LS_WS = 'diagram.workspaceSize.v1';
const LS_NOTES = 'diagram.notesText.v1';
const LS_NOTES_ALIGN = 'diagram.notesAlign.v1';

function initCanvasSettings() {
    injectPanel();
    restoreSettings();
    setupNotes();
    applyWorkspace();
    applyBackground();
    console.log('canvasSettings.js initialized');
}

function injectPanel() {
    const existing = document.getElementById('panel-canvas-settings');
    if (existing) return;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const panel = document.createElement('div');
    panel.className = 'panel-section';
    panel.id = 'panel-canvas-settings';
    panel.innerHTML = `
    <h3>Canvas</h3>
    <div style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
      <label style="display:flex; align-items:center; gap:8px;">
        <span style="flex:1;">Background</span>
        <input type="color" id="canvas-bg-color" value="#ffffff" style="width:54px; height:30px;"/>
      </label>
      <div style="display:flex; gap:8px;">
        <label style="flex:1; display:flex; flex-direction:column; gap:4px;">
          <span style="font-size:11px;">Width</span>
          <input type="number" id="workspace-width" min="400" max="20000" step="100" value="2400" style="width:100%;"/>
        </label>
        <label style="flex:1; display:flex; flex-direction:column; gap:4px;">
          <span style="font-size:11px;">Height</span>
          <input type="number" id="workspace-height" min="400" max="20000" step="100" value="1600" style="width:100%;"/>
        </label>
      </div>
      <button id="workspace-apply" style="margin-top:2px;">Apply Size</button>
      <button id="legend-editor-toggle" style="margin-top:4px;">Legend Editor</button>
    </div>
  `;
    sidebar.insertBefore(panel, sidebar.firstChild);

    panel.querySelector('#canvas-bg-color').addEventListener('input', (e) => {
        model.meta.backgroundColor = e.target.value;
        try { localStorage.setItem(LS_BG, model.meta.backgroundColor); } catch { }
        emit('model:changed', { reason: 'background-change' });
        requestRender();
    });

    panel.querySelector('#workspace-apply').addEventListener('click', () => {
        const w = parseInt(panel.querySelector('#workspace-width').value, 10);
        const h = parseInt(panel.querySelector('#workspace-height').value, 10);
        model.meta.workspace = { width: w, height: h };
        persistWorkspace();
        applyWorkspace();
        emit('ui:needsRender');
    });

    panel.querySelector('#legend-editor-toggle').addEventListener('click', () => {
        if (window.VISOPLUS?.legendAdvanced?.toggleEditor) {
            window.VISOPLUS.legendAdvanced.toggleEditor();
        }
    });
}

function restoreSettings() {
    // Background
    let bg = '#ffffff';
    try {
        const stored = localStorage.getItem(LS_BG);
        if (stored) bg = stored;
    } catch { }
    model.meta.backgroundColor = model.meta.backgroundColor || bg;
    const bgInput = document.getElementById('canvas-bg-color');
    if (bgInput) bgInput.value = model.meta.backgroundColor;

    // Workspace size
    let ws = { width: 2400, height: 1600 };
    try {
        const stored = JSON.parse(localStorage.getItem(LS_WS) || 'null');
        if (stored && stored.width && stored.height) ws = stored;
    } catch { }
    model.meta.workspace = model.meta.workspace || ws;
    const wInput = document.getElementById('workspace-width');
    const hInput = document.getElementById('workspace-height');
    if (wInput) wInput.value = model.meta.workspace.width;
    if (hInput) hInput.value = model.meta.workspace.height;
}

function persistWorkspace() {
    try {
        localStorage.setItem(LS_WS, JSON.stringify(model.meta.workspace || {}));
    } catch { }
}

function applyWorkspace() {
    const workspace = document.getElementById('workspace');
    if (!workspace) return;
    const { width, height } = model.meta.workspace;
    workspace.dataset.w = width;
    workspace.dataset.h = height;
    // Trigger renderer to resize canvas
    window.dispatchEvent(new Event('resize'));
}

function applyBackground() {
    requestRender();
}

/* ---------------- Notes (Explanation) ---------------- */

function setupNotes() {
    let notesWrap = document.getElementById('diagram-notes-panel');
    if (!notesWrap) {
        notesWrap = document.createElement('div');
        notesWrap.id = 'diagram-notes-panel';
        notesWrap.innerHTML = `
      <div id="notes-toolbar">
        <span style="font-weight:600; letter-spacing:.5px;">Diagram Notes</span>
        <div class="note-align-group">
          <button data-align="left" title="Align Left">L</button>
          <button data-align="center" title="Align Center">C</button>
          <button data-align="right" title="Align Right">R</button>
          <button data-align="justify" title="Justify">J</button>
        </div>
        <button id="notes-collapse" title="Collapse / Expand">–</button>
      </div>
      <div id="notes-body">
        <textarea id="diagram-notes" placeholder="Explain the diagram, list shape meanings, assumptions, or references..."></textarea>
      </div>
    `;
        document.body.appendChild(notesWrap);
    }

    // Restore text & alignment
    let txt = '';
    try { txt = localStorage.getItem(LS_NOTES) || ''; } catch { }
    const ta = document.getElementById('diagram-notes');
    if (ta) {
        ta.value = txt;
        ta.addEventListener('input', () => {
            try { localStorage.setItem(LS_NOTES, ta.value); } catch { }
            model.meta.notes = ta.value;
        });
    }
    model.meta.notes = txt;

    let align = 'left';
    try { align = localStorage.getItem(LS_NOTES_ALIGN) || 'left'; } catch { }
    applyNotesAlign(align);

    document.querySelectorAll('#notes-toolbar .note-align-group button').forEach(btn => {
        btn.addEventListener('click', () => {
            const a = btn.getAttribute('data-align');
            applyNotesAlign(a);
            try { localStorage.setItem(LS_NOTES_ALIGN, a); } catch { }
        });
    });

    document.getElementById('notes-collapse')?.addEventListener('click', () => {
        const body = document.getElementById('notes-body');
        if (!body) return;
        const collapsed = body.classList.toggle('collapsed');
        document.getElementById('notes-collapse').textContent = collapsed ? '+' : '–';
    });
}

function applyNotesAlign(a) {
    const ta = document.getElementById('diagram-notes');
    if (!ta) return;
    ta.style.textAlign = a;
}

/* Export API if needed */
window.VISOPLUS = window.VISOPLUS || {};
window.VISOPLUS.canvasSettings = {
    applyWorkspace,
    applyBackground
};

window.addEventListener('load', initCanvasSettings);
