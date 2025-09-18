/**
 * helpContent.js
 * Pure data (no DOM). Imported by helpPanel.js
 *
 * Exported:
 *  - quickGuide: array of { title, steps[] }
 *  - faqs: array of { q, a }
 *  - sections: array of { id, title, html } (html is preformatted safe markup)
 *  - shortcuts: array of { keys, desc, group }
 */

export const quickGuide = [
    {
        title: 'Create Your First Diagram',
        steps: [
            'Click a shape in the left palette (or toolbar) to insert it.',
            'Drag shape to reposition (hold Shift to snap to grid).',
            'Hover a shape edge — use port circles to start a connector (hold Shift while dragging to preview orth L).',
            'Select a connector and press the Waypoint Edit button to add/drag interior waypoints (Alt+Click to insert, Double‑click waypoint to remove).',
            'Export JSON to save, then later Import JSON (Replace or Merge) to continue work.'
        ]
    },
    {
        title: 'Styling',
        steps: [
            'Select one or more shapes: change Fill, Stroke, Text color in Shape Style panel.',
            'Select a connector: Connector Style panel appears — adjust width, arrows, padding, arrow size.',
            'Use eye‑dropper / style copy (if loaded) to replicate styles quickly.'
        ]
    },
    {
        title: 'Routing Modes',
        steps: [
            'Basic: Straight segments (default).',
            'Grid: Produces simple Manhattan (orth) bends.',
            'Obstacle: Prototype pathfinding avoiding blockers (coarse grid).',
            'Manual: Add / drag waypoints for full custom shape.'
        ]
    },
    {
        title: 'Reattaching Connectors',
        steps: [
            'Select a connector — endpoint circular handles appear.',
            'Drag a handle to another shape; interior waypoints shift preserving shape.',
            'Snaps to a shape port if cursor is near one (port priority docking).'
        ]
    }
];

export const faqs = [
    {
        q: '1. How do I save my work?',
        a: 'Use Export JSON to download a .diagram.json file. Later Import JSON (Replace to overwrite or Merge to append). Autosave (if enabled) stores a copy locally in your browser.'
    },
    {
        q: '2. What is Merge Import?',
        a: 'Merge appends shapes/connectors from the file, remapping IDs and offsetting to avoid overlap. It is a single undo step.'
    },
    {
        q: '3. How do I edit connector paths?',
        a: 'Select the connector, click Edit Waypoints. Alt+Click on a segment to insert a waypoint, drag squares, double‑click a waypoint to remove.'
    },
    {
        q: '4. Why are some connectors L-shaped and others straight?',
        a: 'Straight (Basic) is default. Holding Shift while creating via ports produces an L preview you can keep. Grid / Obstacle routing or manual waypoints yield multi‑segment paths.'
    },
    {
        q: '5. What is Obstacle routing?',
        a: 'A prototype A* orthogonal path that detours around shape bounding boxes. It inserts intermediate bends; can be undone in one step.'
    },
    {
        q: '6. Can I snap connector endpoints to specific points?',
        a: 'Yes. Endpoint drag and creation via ports prioritize ports (N,E,S,W). Docking fallback chooses perimeter intersection if no close port.'
    },
    {
        q: '7. How do I reorder shapes?',
        a: 'Use Arrange: Front / Back (absolute) or Forward / Backward (one layer). Connectors always render above shapes.'
    },
    {
        q: '8. Why do undo steps sometimes group multiple drags?',
        a: 'Shape drags & waypoint drags are batch‑captured per gesture for predictable undo.'
    },
    {
        q: '9. How do I remove a connector?',
        a: 'Select it (click near line if needed) and press Delete / Backspace.'
    },
    {
        q: '10. How can I duplicate shapes?',
        a: 'Select one or more shapes, press Ctrl+D. Copy/Paste (Ctrl+C / Ctrl+V) also supported, including internal connectors.'
    },
    {
        q: '11. Why do L connectors have sharp corners now?',
        a: 'We switched orth connectors to miter joins for crisper right angles (no balloon rounding).'
    },
    {
        q: '12. How does Import Merge handle ID collisions?',
        a: 'Conflicting shape/connector IDs are assigned new UUIDs. Connectors update endpoints through a mapping table.'
    },
    {
        q: '13. Can I disable the performance overlay?',
        a: 'It is off by default now. Toggle with Alt+F2.'
    },
    {
        q: '14. How do I reset zoom?',
        a: 'Use the 100% button or manually set zoom via toolbar. Pan resets on full diagram reset.'
    },
    {
        q: '15. Do exported SVGs include text and styles?',
        a: 'Yes—shapes, multi‑line wrapped text, trimmed connectors with arrowheads, single marker defs. Waypoint squares and debug overlays are not exported.'
    }
];

export const sections = [
    {
        id: 'shapes',
        title: 'Shapes & Editing',
        html: `
      <p>Shapes support selection, multi-select drag, duplication, style editing, inline text edit (double‑click or Enter when selected), and z‑ordering. Pill, Note, Diamond, Ellipse, Rectangle each use proper docking geometry.</p>
      <ul>
        <li><strong>Inline Text:</strong> Select shape then press Enter or double‑click. Escape cancels.</li>
        <li><strong>Resize (if enabled):</strong> Drag handles (module dependent).</li>
        <li><strong>Style:</strong> Fill, Stroke, Text color via panels.</li>
      </ul>
    `
    },
    {
        id: 'connectors',
        title: 'Connectors',
        html: `
      <p>Connectors are polylines with optional arrowheads and internal waypoints.</p>
      <ul>
        <li><strong>Creation:</strong> Drag from a shape port to another shape (Shift for orth preview).</li>
        <li><strong>Routing Modes:</strong> Basic (straight), Grid (Manhattan), Obstacle (prototype pathfinding).</li>
        <li><strong>Waypoints:</strong> Alt+Click to add, drag squares, double‑click remove.</li>
        <li><strong>Reattach:</strong> Select connector, drag endpoint handle to new shape—waypoints translate to preserve overall form.</li>
      </ul>
    `
    },
    {
        id: 'ports',
        title: 'Ports & Docking',
        html: `
      <p>Each shape exposes four cardinal ports (N,E,S,W). When creating or reattaching a connector, the system snaps to the nearest aligned port within threshold. If no port matches directional intent, perimeter docking computes an edge intersection for the current target direction vector.</p>
    `
    },
    {
        id: 'routing',
        title: 'Routing & Waypoints',
        html: `
      <p><strong>Basic:</strong> Clears interior points. <strong>Grid:</strong> Adds axis bends (one intermediate L or none if colinear). <strong>Obstacle:</strong> A* search on coarse grid, preserving final interior bends. Manual refinement via waypoint editing always allowed afterward.</p>
      <p>Undo groups whole route operations. Rerouting overwrites prior interior points (except preserved on endpoint reattach).</p>
    `
    },
    {
        id: 'history',
        title: 'Undo / Redo & History Batching',
        html: `
      <p>Complex gestures (dragging multiple shapes, moving a waypoint, end reattach) are batched into single undo steps. History stores labeled operations (e.g., "Move Shapes", "Insert Waypoint", "Reattach Endpoint"). JSON import (Replace) clears history; Merge adds a single batch step.</p>
    `
    },
    {
        id: 'import-export',
        title: 'Import / Export',
        html: `
      <p><strong>JSON Export:</strong> Download a schema-wrapped diagram for later import. <strong>Import Replace:</strong> Clears current model & history. <strong>Import Merge:</strong> Appends objects, remaps IDs, offsets shapes, single undo step.</p>
      <p><strong>SVG Export:</strong> Produces a clean, self-contained SVG with markers, text, shapes, connectors.</p>
    `
    },
    {
        id: 'merge-mode',
        title: 'Merge Mode Details',
        html: `
      <p>During merge, a bounding box offset prevents overlap. Connector endpoints remap via shape ID mapping; connectors with missing endpoints are skipped. Entire merge is a batch for undo. Optionally offset can be disabled via API <code>importJsonString(str,{ replace:false, mergeOptions:{ offset:false } })</code>.</p>
    `
    },
    {
        id: 'performance',
        title: 'Performance Overlay',
        html: `
      <p>The stats overlay (Alt+F2) shows smoothed FPS, last frame ms, counts of shapes/connectors, and selection totals. Hidden by default to reduce distraction.</p>
    `
    },
    {
        id: 'shortcuts',
        title: 'Keyboard Shortcuts',
        html: `
      <ul>
        <li><strong>Duplicate:</strong> Ctrl/Cmd + D</li>
        <li><strong>Copy / Paste:</strong> Ctrl/Cmd + C / V</li>
        <li><strong>Delete:</strong> Delete or Backspace</li>
        <li><strong>Nudge:</strong> Arrows (Shift for ×10)</li>
        <li><strong>Undo / Redo:</strong> Ctrl/Cmd + Z / Shift+Ctrl/Cmd + Z</li>
        <li><strong>Toggle Waypoints Mode:</strong> (Button)</li>
        <li><strong>Help Panel:</strong> Alt+H or F1</li>
        <li><strong>Stats Overlay:</strong> Alt+F2</li>
        <li><strong>Force Straight Route:</strong> Ctrl+Shift+R</li>
      </ul>
    `
    },
    {
        id: 'roadmap',
        title: 'Planned Enhancements',
        html: `
      <p>Potential upcoming features:</p>
      <ul>
        <li>Adaptive obstacle routing resolution</li>
        <li>Multi-waypoint selection & group drag</li>
        <li>Port-level styling & custom named ports</li>
        <li>Auto-reroute connectors on shape move</li>
        <li>Cloud sync / shareable links</li>
        <li>Enhanced merge preview with inclusion toggles</li>
      </ul>
    `
    }
];

export const shortcuts = [
    { keys: 'Ctrl/Cmd + D', desc: 'Duplicate selected shapes', group: 'Editing' },
    { keys: 'Ctrl/Cmd + C / V', desc: 'Copy / Paste shapes (+internal connectors)', group: 'Editing' },
    { keys: 'Delete / Backspace', desc: 'Remove selection', group: 'Editing' },
    { keys: 'Arrows (Shift = ×10)', desc: 'Nudge shapes', group: 'Editing' },
    { keys: 'Ctrl/Cmd + Z / Shift+Ctrl/Cmd+Z', desc: 'Undo / Redo', group: 'History' },
    { keys: 'Alt + H / F1', desc: 'Toggle Help panel', group: 'UI' },
    { keys: 'Alt + F2', desc: 'Toggle Stats overlay', group: 'UI' },
    { keys: 'Ctrl+Shift+R', desc: 'Force Basic routing all connectors', group: 'Routing' },
    { keys: 'Shift (during port drag)', desc: 'Enable orth L preview', group: 'Routing' },
    { keys: 'Alt + Click connector segment', desc: 'Insert waypoint', group: 'Waypoints' },
    { keys: 'Double-click waypoint', desc: 'Remove waypoint', group: 'Waypoints' },
    { keys: 'Drag endpoint handle', desc: 'Reattach connector (ports prioritized)', group: 'Connectors' },
    { keys: 'Enter (shape selected)', desc: 'Start inline text edit', group: 'Shapes' },
    { keys: 'Escape (editing)', desc: 'Cancel inline text edit', group: 'Shapes' },
    { keys: 'Shift + Drag shape', desc: 'Grid snap movement', group: 'Shapes' }
];
