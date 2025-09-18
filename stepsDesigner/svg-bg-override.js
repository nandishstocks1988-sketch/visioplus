/* Optional: include AFTER script.js on Designer page to ensure SVG export includes background color */
(function () {
    if (typeof window.downloadSVG !== "function") return;

    const original = window.downloadSVG;

    window.downloadSVG = function downloadSVG_withBackground() {
        // Re-use existing mermaid render
        if (typeof window.generateMermaid === "function") {
            try { window.generateMermaid(); } catch (_) { }
        }

        const diagram = document.getElementById("diagram");
        const svgEl = diagram?.querySelector("svg");
        if (!svgEl) { alert("Render diagram first."); return; }

        const clone = svgEl.cloneNode(true);

        // Insert background rect based on current Diagram BG color
        const vb = clone.viewBox?.baseVal;
        const width = vb?.width || parseInt(clone.getAttribute("width") || "1200", 10);
        const height = vb?.height || parseInt(clone.getAttribute("height") || "800", 10);
        const bg = document.getElementById("diagramBgColor")?.value || "#ffffff";

        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", String(vb?.x || 0));
        rect.setAttribute("y", String(vb?.y || 0));
        rect.setAttribute("width", String(width));
        rect.setAttribute("height", String(height));
        rect.setAttribute("fill", bg);

        // Insert as the first drawable element
        const first = clone.firstChild;
        clone.insertBefore(rect, first);

        // Preserve legend overlay if any (your original function added foreignObject).
        // Call the original so it can add legend and serialize, but swap the svg in place temporarily:
        const container = document.createElement("div");
        container.style.display = "none";
        container.appendChild(clone);
        document.body.appendChild(container);

        try {
            // Serialize and download ourselves (safer to avoid re-render)
            const serialized = new XMLSerializer().serializeToString(clone);
            const blob = new Blob([serialized], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "diagram.svg"; a.click();
            URL.revokeObjectURL(url);
        } finally {
            container.remove();
        }
    };

    console.log("[SVG BG Override] Active");
})();