/**
 * DOM Utilities
 */
export const qs = (sel, root = document) => root.querySelector(sel);
export const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];

export function create(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
        if (k === 'style' && typeof v === 'object') {
            Object.assign(el.style, v);
        } else if (k.startsWith('on') && typeof v === 'function') {
            el.addEventListener(k.slice(2), v);
        } else {
            el.setAttribute(k, v);
        }
    }
    for (const c of children) {
        el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
}

console.log('dom.js loaded');
