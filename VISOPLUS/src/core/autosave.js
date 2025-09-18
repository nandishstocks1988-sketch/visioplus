/**
 * Autosave & Session Restore
 * Added resetAutosaveState() helper.
 */

import { serialize, deserialize } from './model.js';
import { on, off } from './events.js';

const STORAGE_KEY = 'visoplus:session:v1';
let saveTimer = null;
let lastSave = 0;
let autosaveEnabled = false;
const SAVE_DEBOUNCE_MS = 700;

function scheduledSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        saveNow();
    }, SAVE_DEBOUNCE_MS);
}

export function loadSession() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.data) return false;
        deserialize(parsed.data, { replace: true });
        lastSave = parsed.ts || Date.now();
        return true;
    } catch (err) {
        console.warn('[autosave] Failed to load session:', err);
        return false;
    }
}

export function enableAutosave() {
    if (autosaveEnabled) return;
    autosaveEnabled = true;
    on('model:changed', scheduledSave);
}

export function disableAutosave() {
    if (!autosaveEnabled) return;
    autosaveEnabled = false;
    off('model:changed', scheduledSave);
    clearTimeout(saveTimer);
}

export function saveNow() {
    try {
        const data = serialize();
        lastSave = Date.now();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: lastSave, data }));
    } catch (err) {
        console.error('[autosave] saveNow error:', err);
    }
}

export function clearSession() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        lastSave = 0;
    } catch (err) {
        console.error('[autosave] clearSession error:', err);
    }
}

export function resetAutosaveState() {
    lastSave = 0;
}

export function getLastSaveTime() {
    return lastSave;
}

console.log('autosave.js updated with resetAutosaveState()');
