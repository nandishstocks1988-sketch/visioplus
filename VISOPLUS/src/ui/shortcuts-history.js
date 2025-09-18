/**
 * shortcuts-history.js
 * Keyboard shortcuts:
 *  - Ctrl/Cmd+Z        : undo
 *  - Shift+Ctrl/Cmd+Z  : redo
 *  - Ctrl/Cmd+Y        : redo
 */
import { history } from '../core/history.js';

function initHistoryShortcuts() {
    window.addEventListener('keydown', (e) => {
        const meta = e.metaKey || e.ctrlKey;
        if (!meta) return;
        if (e.key === 'z' || e.key === 'Z') {
            if (e.shiftKey) {
                history.redo();
            } else {
                history.undo();
            }
            e.preventDefault();
        } else if (e.key === 'y' || e.key === 'Y') {
            history.redo();
            e.preventDefault();
        }
    });
}

window.addEventListener('load', initHistoryShortcuts);
console.log('shortcuts-history.js loaded');