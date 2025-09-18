/**
 * legendAdvanced.js
 * Advanced legend manager:
 *  - Maintains model.meta.legend = [{color, label, id}]
 *  - Editable via a floating panel (toggle button added in index.html or add programmatically).
 *  - Draggable legend box overlay with items.
 *  - Persists to localStorage ('diagram.legendItems' & position) for fallback if meta not serialized.
 */

import { model } from '../core/model.js';
import { emit, on } from '../core/events.js';
import { requestRender } from '../core/render.js';

const LS_KEY_ITEMS = 'diagram.legendItems.v1';
const LS_KEY_POS = 'diagram.legendPos.v1';

let legendContainer;
let legendPanel;
let dragState = null;

function initAdvancedLegend() {
    ensureLegendData();
    createLegendOverlay();
    createLegendManagerPanel();
    renderLegendOverlay();
    console.log('legendAdvanced.js initialized');
}

function ensureLegendData() {
    if (!model.meta.legend) {
        // Try localStorage fallback
        let stored;
        try { stored = JSON.parse(localStorage.getItem(LS_KEY_ITEMS) || '[]'); } catch { stored = []; }
        model.meta.legend = Array.isArray(stored) ? stored : [];
    }
}

function createLegendOverlay() {
    legendContainer = document.createElement('div');
    legendContainer.id = 'legend-advanced-overlay';
    Object.assign(legendContainer.style, {
        position: 'absolute',
        top: '16px',
        left: '16px',
        zIndex: 1200,
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid #d5dbe1',
        borderRadius: '10px',
        padding: '10px 12px 8px',
        font: '12px system-ui, sans-serif',
        lineHeight: '1.35',
        color: '#2c3540',
        boxShadow: '0 4px 14px -4px rgba(0,0,0,0.18)',
        cursor: 'move',
        backdropFilter: 'blur(4px)',
        minWidth: '160px'
    });

    // Restore position
    try {
        const pos = JSON.parse(localStorage.getItem(LS_KEY_POS) || 'null');
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
            legendContainer.style.left = pos.x + 'px';
            legendContainer.style.top = pos.y + 'px';
        }
    } catch { }

    legendContainer.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        dragState = {
            ox: e.clientX - legendContainer.offsetLeft,
            oy: e.clientY - legendContainer.offsetTop
        };
        e.preventDefault();
    });
    window.addEventListener('mouseup', () => dragState = null);
    window.addEventListener('mousemove', (e) => {
        if (!dragState) return;
        legendContainer.style.left = (e.clientX - dragState.ox) + 'px';
        legendContainer.style.top = (e.clientY - dragState.oy) + 'px';
    });
    window.addEventListener('mouseup', () => {
        if (!dragState) return;
        saveLegendPosition();
    });

    document.getElementById('main')?.appendChild(legendContainer);
    on('model:changed', renderLegendOverlay);
}

function renderLegendOverlay() {
    if (!legendContainer) return;
    const items = (model.meta.legend || []).filter(it => it && it.label);
    if (!items.length) {
        legendContainer.innerHTML = `<div style="opacity:.55;font-size:11px;">Legend: Add items</div>`;
        return;
    }
    legendContainer.innerHTML = `
    <div style="font-weight:600; font-size:12px; margin-bottom:6px; letter-spacing:.4px;">Legend</div>
    <div style="display:flex; flex-direction:column; gap:4px;">
      ${items.map(it => `
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="flex:0 0 auto; width:14px; height:14px; border-radius:4px; background:${it.color || '#ccc'}; border:1px solid #888;"></span>
          <span style="font-size:12px;">${escapeHTML(it.label)}</span>
        </div>`).join('')}
    </div>`;
}

function createLegendManagerPanel() {
    legendPanel = document.createElement('div');
    legendPanel.id = 'legend-manager';
    Object.assign(legendPanel.style, {
        position: 'fixed',
        right: '24px',
        bottom: '120px',
        width: '260px',
        maxHeight: '360px',
        overflow: 'hidden',
        background: '#ffffff',
        border: '1px solid #d2d9df',
        borderRadius: '14px',
        padding: '12px 12px 10px',
        font: '12px system-ui,sans-serif',
        color: '#25313c',
        boxShadow: '0 16px 42px -10px rgba(0,0,0,0.28)',
        display: 'none',
        zIndex: 2100
    });

    legendPanel.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
      <div style="font-weight:600; letter-spacing:.5px;">Legend Editor</div>
      <button id="legend-close-btn" style="margin:0; padding:4px 8px; font-size:11px;">×</button>
    </div>
    <div id="legend-items-list" style="overflow:auto; max-height:220px; padding-right:4px;"></div>
    <div style="margin-top:8px; display:flex; gap:6px;">
      <button id="legend-add-btn" style="flex:1;">Add</button>
      <button id="legend-clear-btn" style="flex:1;">Clear</button>
    </div>
  `;
    document.body.appendChild(legendPanel);

    legendPanel.querySelector('#legend-close-btn').addEventListener('click', () => {
        legendPanel.style.display = 'none';
    });
    legendPanel.querySelector('#legend-add-btn').addEventListener('click', addLegendItem);
    legendPanel.querySelector('#legend-clear-btn').addEventListener('click', clearLegend);
    renderLegendList();
}

function renderLegendList() {
    const wrap = legendPanel.querySelector('#legend-items-list');
    const items = model.meta.legend || [];
    if (!items.length) {
        wrap.innerHTML = `<div style="opacity:.6; font-size:11px;">No items yet</div>`;
        return;
    }
    wrap.innerHTML = items.map(it => `
    <div data-id="${it.id}" style="display:flex; align-items:center; gap:6px; margin-bottom:6px;">
      <input type="color" class="legend-color" value="${it.color || '#cccccc'}" style="flex:0 0 36px; height:28px; border:1px solid #c2c8ce; border-radius:6px; background:#fff;">
      <input type="text" class="legend-label" value="${escapeAttr(it.label)}" placeholder="Label" style="flex:1; height:28px; font:12px system-ui; padding:4px 6px; border:1px solid #c2c8ce; border-radius:6px;">
      <button class="legend-del" style="padding:4px 8px; font-size:11px;">×</button>
    </div>
  `).join('');

    wrap.querySelectorAll('.legend-color').forEach(inp => {
        inp.addEventListener('input', () => {
            const parent = inp.closest('[data-id]');
            const id = parent.getAttribute('data-id');
            const item = items.find(x => x.id === id);
            if (item) {
                item.color = inp.value;
                persistLegend();
            }
            renderLegendOverlay();
        });
    });
    wrap.querySelectorAll('.legend-label').forEach(inp => {
        inp.addEventListener('input', () => {
            const parent = inp.closest('[data-id]');
            const id = parent.getAttribute('data-id');
            const item = items.find(x => x.id === id);
            if (item) {
                item.label = inp.value;
                persistLegend();
            }
            renderLegendOverlay();
        });
    });
    wrap.querySelectorAll('.legend-del').forEach(btn => {
        btn.addEventListener('click', () => {
            const parent = btn.closest('[data-id]');
            const id = parent.getAttribute('data-id');
            const idx = items.findIndex(x => x.id === id);
            if (idx >= 0) {
                items.splice(idx, 1);
                persistLegend();
                renderLegendList();
                renderLegendOverlay();
            }
        });
    });
}

function addLegendItem() {
    if (!model.meta.legend) model.meta.legend = [];
    model.meta.legend.push({
        id: crypto.randomUUID(),
        color: '#ff7f2a',
        label: 'Item'
    });
    persistLegend();
    renderLegendList();
    renderLegendOverlay();
}

function clearLegend() {
    if (!confirm('Clear all legend items?')) return;
    model.meta.legend = [];
    persistLegend();
    renderLegendList();
    renderLegendOverlay();
}

function persistLegend() {
    try {
        localStorage.setItem(LS_KEY_ITEMS, JSON.stringify(model.meta.legend || []));
    } catch { }
    emit('model:changed', { reason: 'legend-change' });
}

function saveLegendPosition() {
    try {
        localStorage.setItem(LS_KEY_POS, JSON.stringify({
            x: parseInt(legendContainer.style.left, 10),
            y: parseInt(legendContainer.style.top, 10)
        }));
    } catch { }
}

export function toggleLegendEditor() {
    if (!legendPanel) return;
    legendPanel.style.display = (legendPanel.style.display === 'none' || !legendPanel.style.display) ? 'block' : 'none';
}

function escapeHTML(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
    return escapeHTML(s).replace(/"/g, '&quot;');
}

window.addEventListener('load', initAdvancedLegend);
window.VISOPLUS = window.VISOPLUS || {};
window.VISOPLUS.legendAdvanced = {
    toggleEditor: toggleLegendEditor,
    render: renderLegendOverlay
};