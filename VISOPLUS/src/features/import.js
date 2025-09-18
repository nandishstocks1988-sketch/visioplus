/**
 * Import JSON (replace).
 */
import { deserialize } from '../core/model.js';

export function importJSON(text) {
    deserialize(text, { replace: true });
}

console.log('import.js loaded');