/**
 * Ports (stub)
 */
import { model } from '../core/model.js';

export function getPorts(shape) {
    return [
        { id: shape.id + ':n', x: shape.x + shape.w / 2, y: shape.y },
        { id: shape.id + ':s', x: shape.x + shape.w / 2, y: shape.y + shape.h },
        { id: shape.id + ':w', x: shape.x, y: shape.y + shape.h / 2 },
        { id: shape.id + ':e', x: shape.x + shape.w, y: shape.y + shape.h / 2 }
    ];
}

export function shapeById(id) {
    return model.shapes.get(id);
}

console.log('ports.js loaded');