import { downloadCurrentSVG } from '../export/exportSvg.js';

export function initExportButton() {
    const btn = document.getElementById('btn-export-svg');
    if (!btn) return;
    btn.addEventListener('click', () => downloadCurrentSVG());
}

window.addEventListener('load', initExportButton);
console.log('exportButton.js loaded');