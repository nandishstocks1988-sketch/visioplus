/**
 * ID generation
 */
export function genId(prefix = 'id') {
    return `${prefix}-${crypto.randomUUID()}`;
}

console.log('idGen.js loaded');