/**
 * Legend overlay
 */
let created = false;

export function ensureLegend() {
    if (created) return;
    const div = document.createElement('div');
    div.id = 'legend-overlay';
    div.className = 'legend-overlay';
    div.innerHTML = `
    <h4>Legend</h4>
    <ul>
      <li><span class="swatch sw-fill"></span> Shape Fill</li>
      <li><span class="swatch sw-stroke"></span> Shape Stroke</li>
      <li><span class="swatch sw-select"></span> Selected Border</li>
    </ul>
  `;
    document.body.appendChild(div);
    created = true;
}

console.log('legend.js loaded');