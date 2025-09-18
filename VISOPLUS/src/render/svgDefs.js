/**
 * SVG defs injection (future extensions)
 */
export function ensureSvgDefs() {
  if (document.getElementById('visoplus-svg-defs')) return;
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.width = '0';
  container.style.height = '0';
  container.style.overflow = 'hidden';
  container.innerHTML = `
    <svg width="0" height="0" aria-hidden="true">
      <defs id="visoplus-svg-defs">
        <!-- Add patterns / gradients -->
      </defs>
    </svg>
  `;
  document.body.appendChild(container);
}

console.log('svgDefs.js loaded');