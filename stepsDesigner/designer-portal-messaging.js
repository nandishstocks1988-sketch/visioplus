/* Include this in System Flow Designer (index.html)
   It exposes:
   - portal:getDesignerState -> replies with portal:designerState (full JSON)
   - portal:applyHarnessState -> converts harness state -> Designer model (systems/nodes) and rebuilds UI
*/
(function () {
    const safe = (v, d) => (v === undefined || v === null ? d : v);

    function buildDesignerJSON() {
        const systems = safe(window.systems, {});
        const systemsOrder = Array.isArray(window.systemsOrder) ? window.systemsOrder : [];
        const systemsArrangement = safe(window.systemsArrangement, 'vertical');
        const diagramLegend = safe(window.diagramLegend, '');
        const systemPlacement = safe(window.systemPlacement, {});
        const nodes = Array.isArray(window.nodes) ? window.nodes : [];

        return {
            systems,
            systemsOrder,
            systemsArrangement,
            diagramLegend,
            systemPlacement,
            nodes: nodes.map(n => ({
                id: n.id,
                label: n.label,
                shape: n.shape,
                textColor: n.textColor,
                bgColor: n.bgColor,
                outlineColor: n.outlineColor,
                system: n.system,
                subgroup: n.subgroup,
                desc: n.desc,
                connections: Array.isArray(n.connections) ? n.connections.map(c => ({ ...c })) : []
            }))
        };
    }

    function applyHarnessToDesigner(harnessState, replyToWindow) {
        // replyToWindow is the portal window we should notify (e.g., e.source or window.parent)
        const h = harnessState || {};

        const newSystems = safe(h.systems, {});
        const newOrder = Array.isArray(h.systemsOrder) ? h.systemsOrder.slice() : Object.keys(newSystems);

        // Convert harness nodes (id, label) -> designer nodes
        const newNodes = Array.isArray(h.nodes) ? h.nodes.map(n => ({
            id: n.id,
            label: n.label || n.id || '',
            shape: 'rect',
            textColor: '#000000',
            bgColor: '#ffffff',
            outlineColor: '#333333',
            system: '',      // user assigns after import
            subgroup: '',
            desc: '',
            connections: []  // harness prototype has no connections
        })) : [];

        const currentArrangement = safe(window.systemsArrangement, 'vertical');
        const currentLegend = safe(window.diagramLegend, '');

        if (typeof window.applyImportedState === 'function' && typeof window.rebuildUI_AfterImport === 'function') {
            const state = {
                systems: newSystems,
                systemsOrder: newOrder,
                systemsArrangement: currentArrangement,
                diagramLegend: currentLegend,
                systemPlacement: {}, // recompute placement
                nodes: newNodes
            };

            window.applyImportedState(state);
            window.rebuildUI_AfterImport();
            if (typeof window.postImportPipeline === 'function') window.postImportPipeline();

            // Notify the portal (prefer the window we received the message from)
            const target = replyToWindow || window.parent;
            try {
                target?.postMessage({ type: 'portal:designerAppliedHarnessState' }, '*');
            } catch (e) {
                console.warn('[Designer Portal Messaging] Failed to post to portal:', e);
            }
        } else {
            console.warn('[Designer Portal Messaging] Import hooks not found (applyImportedState/rebuildUI_AfterImport).');
        }
    }

    window.addEventListener('message', (e) => {
        const msg = e.data || {};
        if (msg.type === 'portal:getDesignerState') {
            const payload = buildDesignerJSON();
            // Reply to the sender (portal)
            e.source?.postMessage({ type: 'portal:designerState', payload }, '*');
        }
        if (msg.type === 'portal:applyHarnessState') {
            applyHarnessToDesigner(msg.payload, e.source || window.parent);
        }
    });

    console.log('[Designer Portal Messaging] Ready');
})();
