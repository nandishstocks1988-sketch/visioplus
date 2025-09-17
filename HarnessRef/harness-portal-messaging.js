/* Include this in diag-harness_Version83.html AFTER its inline <script>
   It exposes:
   - portal:getHarnessState -> replies with portal:harnessState (minimal JSON)
   - portal:applyDesignerState -> accepts Designer JSON and seeds harness (systems/nodes)
*/

(function () {
    function buildHarnessJSON() {
        // Minimal snapshot from harness
        return {
            systems: window.systems || {},
            systemsOrder: window.systemsOrder || [],
            nodes: Array.isArray(window.nodes) ? window.nodes.map(n => ({ id: n.id, label: n.label || "" })) : []
        };
    }

    function applyDesignerToHarness(designerState) {
        // Accept systems (and order) from Designer; reduce nodes to minimal (id/label).
        const d = designerState || {};
        const systems = d.systems || {};
        const systemsOrder = Array.isArray(d.systemsOrder) ? d.systemsOrder.slice() : Object.keys(systems);
        const nodes = Array.isArray(d.nodes) ? d.nodes.map(n => ({ id: n.id, label: n.label || n.id || "" })) : [];

        // Replace harness state
        window.systems = JSON.parse(JSON.stringify(systems));
        window.systemsOrder = systemsOrder.slice();
        window.nodes = nodes.slice();

        // Re-render simple harness lists
        try {
            if (typeof renderSystemList === "function") renderSystemList();
            const el = document.getElementById('nodes-container');
            if (el) el.innerHTML = window.nodes.map(n => '<div>' + n.id + ' ' + (n.label || '') + '</div>').join('') || '(none)';
        } catch (e) { console.warn(e); }

        // Notify portal
        window.postMessage({ type: "portal:harnessAppliedDesignerState" }, "*");
    }

    window.addEventListener("message", (e) => {
        const msg = e.data || {};
        if (msg.type === "portal:getHarnessState") {
            e.source?.postMessage({ type: "portal:harnessState", payload: buildHarnessJSON() }, "*");
        }
        if (msg.type === "portal:applyDesignerState") {
            applyDesignerToHarness(msg.payload);
        }
    });

    console.log("[Harness Portal Messaging] Ready");
})();
