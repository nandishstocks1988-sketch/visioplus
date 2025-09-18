# VisoPlus Unified Portal

A modern, single-page application that consolidates the Steps Designer and VisoPlus diagram editor into one seamless interface.

## Features

- **No iframes**: Direct JavaScript integration eliminates postMessage coordination and timeouts
- **Real-time sync**: Bidirectional data flow between Steps management and VisoPlus rendering
- **Unified UI**: Steps Designer on the left, live VisoPlus preview on the right
- **Auto-sync**: Automatic synchronization with manual override option
- **Legacy compatibility**: Original portal remains functional with migration notice

## Getting Started

1. Open `unified-portal.html` in your browser or serve via HTTP server
2. Add systems and nodes using the Steps Designer panel on the left
3. See live updates in the VisoPlus canvas on the right
4. Use the toolbar to create shapes, zoom, route connectors, and export

## Architecture

### Left Panel: Steps Designer
- Systems & Subgroups management
- Node creation and editing
- Legend editor
- Canvas positioning controls

### Right Panel: VisoPlus
- Live diagram rendering
- Shape creation tools
- Zoom and pan controls
- Export capabilities (SVG, JSON)

### State Management
- Steps data remains source of truth
- Real-time conversion between formats
- Event-driven synchronization
- Shared JavaScript context

## Migration from Legacy Portal

The original `portal.html` remains functional but shows a deprecation notice. All data formats are preserved for smooth migration.

### Key Improvements
- ✅ No iframe boundaries
- ✅ No postMessage delays
- ✅ Direct object sharing
- ✅ Simplified debugging
- ✅ Better performance

## Technical Details

- **Steps Integration**: Direct embedding of Steps Designer UI
- **VisoPlus Integration**: Core modules imported as ES6 modules
- **Data Conversion**: Automatic mapping between Steps nodes/systems and VisoPlus shapes/connectors
- **Responsive Design**: Mobile-friendly layout with stacked panels

## Browser Support

Modern browsers with ES6 module support required.