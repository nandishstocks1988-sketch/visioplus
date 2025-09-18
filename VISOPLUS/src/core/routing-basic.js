/**
 * routing-basic.js
 * Straight-line routing: clears c.points and sets type='straight'
 */
import { model } from './model.js';
import { emit } from './events.js';

export function routeAllBasic() {
    for (const c of model.connectors.values()) {
        c.type = 'straight';
        c.points = null;
    }
    emit('model:changed', { reason: 'route-basic' });
    emit('ui:needsRender');
}

console.log('routing-basic.js loaded');