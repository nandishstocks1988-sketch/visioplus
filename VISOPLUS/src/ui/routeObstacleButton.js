import { routeSelectedObstacle } from '../core/routingObstacle.js';

export function initRouteObstacleButton() {
    const btn = document.getElementById('btn-route-obstacle');
    if (!btn) return;
    btn.addEventListener('click', () => routeSelectedObstacle());
}

window.addEventListener('load', initRouteObstacleButton);
console.log('routeObstacleButton.js loaded');