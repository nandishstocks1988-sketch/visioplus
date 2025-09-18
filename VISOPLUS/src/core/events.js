/**
 * Event Bus (Advanced)
 * Features:
 *  - on/off/once
 *  - namespaced events with dot notation (e.g. selection.changed)
 *  - wildcard listeners:   on('selection.*', handler)
 *  - pipe / forward
 *  - profiling (enable via setEventDebug(true))
 *  - waitFor(predicate, timeout)
 */

const listeners = new Map();          // eventName -> Set<fn>
const wildcard = new Map();           // prefix(with trailing dot) -> Set<fn>
let DEBUG = false;

export function setEventDebug(v = true) { DEBUG = v; }

export function on(type, fn) {
    if (type.endsWith('.*')) {
        const prefix = type.slice(0, -1); // keep the trailing dot
        let set = wildcard.get(prefix);
        if (!set) { set = new Set(); wildcard.set(prefix, set); }
        set.add(fn);
        return () => off(type, fn);
    }
    let set = listeners.get(type);
    if (!set) { set = new Set(); listeners.set(type, set); }
    set.add(fn);
    return () => off(type, fn);
}

export function off(type, fn) {
    if (type.endsWith('.*')) {
        const prefix = type.slice(0, -1);
        const set = wildcard.get(prefix);
        if (set) {
            set.delete(fn);
            if (!set.size) wildcard.delete(prefix);
        }
        return;
    }
    const set = listeners.get(type);
    if (!set) return;
    set.delete(fn);
    if (!set.size) listeners.delete(type);
}

export function once(type, fn) {
    const dispose = on(type, (payload) => {
        dispose();
        fn(payload);
    });
    return dispose;
}

export function emit(type, detail) {
    const start = DEBUG ? performance.now() : 0;
    // Exact listeners
    const set = listeners.get(type);
    if (set) {
        for (const fn of [...set]) safeInvoke(fn, type, detail);
    }
    // Wildcards
    const dotIndex = type.lastIndexOf('.');
    if (dotIndex !== -1) {
        const prefixChain = [];
        const parts = type.split('.');
        for (let i = 0; i < parts.length; i++) {
            prefixChain.push(parts.slice(0, i + 1).join('.') + '.');
        }
        for (const prefix of prefixChain) {
            const wSet = wildcard.get(prefix);
            if (wSet) {
                for (const fn of [...wSet]) safeInvoke(fn, type, detail);
            }
        }
    }
    if (DEBUG) {
        const dur = (performance.now() - start).toFixed(2);
        console.debug(`[events] ${type} (${dur}ms)`, detail);
    }
}

function safeInvoke(fn, type, detail) {
    try {
        fn(detail);
    } catch (err) {
        console.error(`Event handler error for "${type}"`, err);
    }
}

export function waitFor(eventName, predicate = () => true, timeout = 0) {
    return new Promise((resolve, reject) => {
        const dispose = on(eventName, (payload) => {
            if (predicate(payload)) {
                dispose();
                resolve(payload);
            }
        });
        if (timeout > 0) {
            setTimeout(() => {
                dispose();
                reject(new Error(`waitFor(${eventName}) timed out`));
            }, timeout);
        }
    });
}

export function pipe(sourceEvent, targetEvent, transform = (x) => x) {
    return on(sourceEvent, (payload) => emit(targetEvent, transform(payload)));
}

console.log('events.js (advanced) loaded');