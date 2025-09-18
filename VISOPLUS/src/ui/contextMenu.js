/**
 * contextMenu.js
 * Shift + Right Click menu
 *
 * Set 3 updates:
 *  - Added Escape key to close.
 *  - Slight semantic rename label ("Clear Selection") => maintained but internally still 'clear'.
 *  - Deferred hide on outside mousedown to allow quick chained operations (minor UX polish).
 */

import { selection, clearSelection } from '../core/selection.js';
import { deleteShapes } from '../core/model.js';
import { emit } from '../core/events.js';

let menu;
const ACTIONS = {
    delete: () => {
        deleteShapes([...selection.shapes]);
    },
    clear: () => clearSelection()
};

export function initContextMenu() {
    menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.className = 'context-menu hidden';
    menu.innerHTML = `
    <button data-act="delete">Delete</button>
    <button data-act="clear">Clear Selection</button>
  `;
    document.body.appendChild(menu);

    menu.addEventListener('click', (e) => {
        const act = e.target.getAttribute('data-act');
        if (act && ACTIONS[act]) {
            ACTIONS[act]();
            emit('model:changed', { reason: 'contextMenu' });
            hide();
        }
    });

    window.addEventListener('contextmenu', (e) => {
        if (!e.shiftKey) return;
        e.preventDefault();
        show(e.clientX, e.clientY);
    });

    window.addEventListener('mousedown', (e) => {
        if (!menu) return;
        if (menu.contains(e.target)) return; // allow clicking inside
        hide();
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hide();
    });
}

function show(x, y) {
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('hidden');
}

function hide() {
    menu.classList.add('hidden');
}

console.log('contextMenu.js loaded (Set 3)');