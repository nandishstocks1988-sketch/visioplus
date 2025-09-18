# VISOPLUS (Advanced Scaffold)

An advanced, modular diagram editor scaffold featuring:

- Event bus with wildcard support
- Shape & connector model with versioning
- High DPI canvas renderer
- Selection (single, toggle, marquee)
- Undo/redo (coalesced snapshot style)
- Alignment & distribution utilities
- Grid & basic dogleg routing
- Export: JSON, SVG (with padding), PNG
- Grouping API
- Style clipboard / eyedropper
- Zoom & pan with ctrl+wheel + Alt/Middle drag
- Side panel / context menu
- Manual snapshots archive (distinct from undo)
- Theming & responsive layout

## Getting Started

```bash
# Serve root (ensure index.html at project root)
python -m http.server 8080
# Navigate to
http://localhost:8080/
```

## Project Structure

```
src/
  core/            # foundational systems (events, model, selection, render orchestrator)
  features/        # optional behavior modules (export, grouping, style, etc.)
  render/          # low-level draw functions
  ui/              # user interface bits (panels, menu, shortcuts)
  utils/           # helpers
styles/            # CSS
index.html         # entry HTML
```

## Key Events

| Event                | Payload Example                                      |
|----------------------|------------------------------------------------------|
| model:changed        | { reason, changed:{shapes, connectors}, version }    |
| selection:changed    | { reason, shapes:[...], connectors:[...] }           |
| ui:needsRender       | (none) schedule a new frame                          |
| render:before/after  | (timing info)                                       |
| zoom:changed         | { zoom }                                             |
| viewport:changed     | (pan or zoom modifications)                          |

## Extension Ideas

- Add shape resize handles
- Connector editing (drag midpoints)
- Persistent storage (localStorage)
- Minimap overlay
- Plugin loader system

## Conventions

- Never import `main.js` from other modules.
- Shared functionality belongs under `core/` or `features/`.
- Keep rendering stateless aside from reading `model`.

## Troubleshooting

1. Canvas blank  
   - Ensure `<canvas id="diagram-canvas">` exists and no JS errors.

2. 404 for a module  
   - Check import path matches folder and filename (case-sensitive).

3. Selection not highlighting  
   - Confirm `selection.shapes.has(shape.id)` is used in your shape renderer.

4. Undo not stacking  
   - Model changes must emit `model:changed` (see model helpers).

## License

Use freely for learning, prototyping, and internal tools. Attribution appreciated.

Happy diagramming!