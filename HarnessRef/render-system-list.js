/* ============================================================
   render-system-list.js
   Minimal, robust system list + basic Mermaid generator.
   ============================================================ */

/* --------- GLOBAL FALLBACKS (create if not present) --------- */
if (typeof window.systems === "undefined")       window.systems = {};
if (typeof window.systemsOrder === "undefined")  window.systemsOrder = [];
if (typeof window.nodes === "undefined")         window.nodes = [];
if (typeof window.systemPlacement === "undefined") window.systemPlacement = {};

/* ============================================================
   LIGHTWEIGHT UTILS
   ============================================================ */
function sysLog() {
  // Uncomment for debug: console.log.apply(console, ["[SYS]"].concat([].slice.call(arguments)));
}

function ensureSystemOrderConsistency() {
  // Remove stale names not in systems.
  window.systemsOrder = window.systemsOrder.filter(s => !!window.systems[s]);
  // Add any missing system keys that are not yet in order (stable append).
  Object.keys(window.systems).forEach(k => {
    if (!window.systemsOrder.includes(k)) window.systemsOrder.push(k);
  });
}

function ensureSystemPlacement(sysName) {
  if (!window.systemPlacement[sysName]) {
    const baseX = window.systemsOrder.indexOf(sysName);
    window.systemPlacement[sysName] = {
      x: baseX * 220,
      y: 0,
      lane: 0,
      order: baseX
    };
  }
}

/* ============================================================
   SYSTEM CRUD
   ============================================================ */
function addSystem(name, cfg = {}) {
  const sysName = (name || "").trim();
  if (!sysName) return { ok: false, error: "Empty name" };
  if (window.systems[sysName]) return { ok: false, error: "System already exists" };
  window.systems[sysName] = {
    stroke: cfg.stroke || "#333333",
    fill: cfg.fill || "#ffffff",
    layout: (cfg.layout === "horizontal" ? "horizontal" : "vertical"),
    row: 0,
    subgroups: {}
  };
  window.systemsOrder.push(sysName);
  ensureSystemPlacement(sysName);
  return { ok: true };
}

function renameSystem(oldName, newName) {
  const o = (oldName || "").trim();
  const n = (newName || "").trim();
  if (!o || !n) return { ok: false, error: "Names required" };
  if (!window.systems[o]) return { ok: false, error: "Original not found" };
  if (window.systems[n] && o !== n) return { ok: false, error: "New name exists" };

  if (o === n) return { ok: true, unchanged: true };
  window.systems[n] = window.systems[o];
  delete window.systems[o];

  // Update order
  window.systemsOrder = window.systemsOrder.map(s => (s === o ? n : s));
  // Update placement
  if (window.systemPlacement[o]) {
    window.systemPlacement[n] = window.systemPlacement[o];
    delete window.systemPlacement[o];
  }
  // Update nodes referencing old system
  window.nodes.forEach(nd => {
    if (nd.system === o) nd.system = n;
  });
  return { ok: true };
}

function deleteSystem(name) {
  const nm = (name || "").trim();
  if (!window.systems[nm]) return { ok: false, error: "Not found" };
  delete window.systems[nm];
  window.systemsOrder = window.systemsOrder.filter(s => s !== nm);
  if (window.systemPlacement[nm]) delete window.systemPlacement[nm];
  // Clear nodes that referenced this system
  window.nodes.forEach(nd => {
    if (nd.system === nm) {
      nd.system = "";
      nd.subgroup = "";
    }
  });
  return { ok: true };
}

/* ============================================================
   SUBGROUP OPERATIONS
   ============================================================ */
function addSubgroup(systemName, subgroupName, cfg = {}) {
  const sName = (systemName || "").trim();
  const sgName = (subgroupName || "").trim();
  if (!sName || !sgName) return { ok: false, error: "Names required" };
  const sys = window.systems[sName];
  if (!sys) return { ok: false, error: "System not found" };
  if (sys.subgroups[sgName]) return { ok: false, error: "Subgroup exists" };
  sys.subgroups[sgName] = {
    layout: (cfg.layout === "horizontal" ? "horizontal" : "vertical"),
    fill: cfg.fill || "#eef5ff",
    stroke: cfg.stroke || "#9dbce6"
  };
  return { ok: true };
}

function renameSubgroup(systemName, oldSg, newSg) {
  const sName = (systemName || "").trim();
  const o = (oldSg || "").trim();
  const n = (newSg || "").trim();
  const sys = window.systems[sName];
  if (!sys || !sys.subgroups[o]) return { ok: false, error: "Subgroup not found" };
  if (sys.subgroups[n] && o !== n) return { ok: false, error: "New subgroup exists" };
  if (o === n) return { ok: true, unchanged: true };
  sys.subgroups[n] = sys.subgroups[o];
  delete sys.subgroups[o];
  window.nodes.forEach(nd => {
    if (nd.system === sName && nd.subgroup === o) nd.subgroup = n;
  });
  return { ok: true };
}

function deleteSubgroup(systemName, sgName) {
  const sName = (systemName || "").trim();
  const sg = (sgName || "").trim();
  const sys = window.systems[sName];
  if (!sys || !sys.subgroups[sg]) return { ok: false, error: "Not found" };
  delete sys.subgroups[sg];
  window.nodes.forEach(nd => {
    if (nd.system === sName && nd.subgroup === sg) nd.subgroup = "";
  });
  return { ok: true };
}

/* ============================================================
   RENDER SYSTEM LIST (UI)
   ============================================================ */
function renderSystemList() {
  ensureSystemOrderConsistency();

  const listEl = document.getElementById("system-list");
  if (!listEl) {
    sysLog("No #system-list element present.");
    return;
  }
  listEl.innerHTML = "";

  if (!window.systemsOrder.length) {
    const empty = document.createElement("div");
    empty.style.cssText = "font:12px monospace;color:#666;padding:4px;";
    empty.textContent = "(No systems)";
    listEl.appendChild(empty);
    return;
  }

  window.systemsOrder.forEach(sysName => {
    const sys = window.systems[sysName];
    if (!sys) return; // skip if mismatch
    const block = document.createElement("div");
    block.className = "system-block";
    block.style.cssText = "border:1px solid #ccc;margin:6px 0;padding:6px 8px;font:12px/1.3 system-ui,monospace;background:#fafafa;border-radius:6px;";

    block.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:4px;">
        <input data-role="rename" value="${sysName}" style="flex:1 1 140px;font-size:12px;padding:2px 6px;">
        <select data-role="layout" style="font-size:12px;">
          <option value="vertical" ${sys.layout === "vertical" ? "selected" : ""}>vertical</option>
          <option value="horizontal" ${sys.layout === "horizontal" ? "selected" : ""}>horizontal</option>
        </select>
        <input type="color" data-role="stroke" value="${sys.stroke}">
        <input type="color" data-role="fill" value="${sys.fill}">
        <button data-role="save" style="font-size:11px;padding:3px 8px;">Save</button>
        <button data-role="delete" style="font-size:11px;padding:3px 8px;color:#fff;background:#d33;border:none;border-radius:4px;">Del</button>
      </div>
      <div data-role="subgroups" style="margin:4px 0 6px 0;padding:4px 6px;background:#f2f6f9;border:1px solid #d7dfe5;border-radius:4px;">
        ${renderSubgroupRows(sysName, sys.subgroups)}
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">
          <input data-role="new-sg-name" placeholder="Subgroup name" style="font-size:11px;padding:2px 6px;">
          <select data-role="new-sg-layout" style="font-size:11px;">
            <option value="vertical">vertical</option>
            <option value="horizontal">horizontal</option>
          </select>
          <input type="color" data-role="new-sg-fill" value="#eef5ff">
            <input type="color" data-role="new-sg-stroke" value="#9dbce6">
          <button data-role="add-sg" style="font-size:11px;padding:3px 8px;">Add SG</button>
        </div>
      </div>
    `;
    listEl.appendChild(block);

    // Wire events
    const saveBtn = block.querySelector('[data-role="save"]');
    const delBtn = block.querySelector('[data-role="delete"]');
    const renameInput = block.querySelector('[data-role="rename"]');
    const layoutSel = block.querySelector('[data-role="layout"]');
    const strokeInput = block.querySelector('[data-role="stroke"]');
    const fillInput = block.querySelector('[data-role="fill"]');
    const addSgBtn = block.querySelector('[data-role="add-sg"]');
    const newSgName = block.querySelector('[data-role="new-sg-name"]');
    const newSgLayout = block.querySelector('[data-role="new-sg-layout"]');
    const newSgFill = block.querySelector('[data-role="new-sg-fill"]');
    const newSgStroke = block.querySelector('[data-role="new-sg-stroke"]');

    saveBtn.addEventListener("click", () => {
      const newName = renameInput.value.trim();
      const r = renameSystem(sysName, newName);
      if (!r.ok) { alert(r.error); return; }
      const updated = window.systems[newName];
      updated.layout = layoutSel.value;
      updated.stroke = strokeInput.value;
      updated.fill = fillInput.value;
      renderSystemList();
      if (window.scheduleRender) window.scheduleRender();
    });

    delBtn.addEventListener("click", () => {
      if (!confirm(`Delete system "${sysName}"?`)) return;
      const r = deleteSystem(sysName);
      if (!r.ok) { alert(r.error); return; }
      renderSystemList();
      if (window.scheduleRender) window.scheduleRender();
    });

    addSgBtn.addEventListener("click", () => {
      const sgN = newSgName.value.trim();
      if (!sgN) { alert("Subgroup name required"); return; }
      const r = addSubgroup(sysName, sgN, {
        layout: newSgLayout.value,
        fill: newSgFill.value,
        stroke: newSgStroke.value
      });
      if (!r.ok) { alert(r.error); return; }
      renderSystemList();
      if (window.scheduleRender) window.scheduleRender();
    });

    // Subgroup row actions (rename/delete) delegated:
    block.querySelectorAll('[data-sg-row]').forEach(row => {
      const sg = row.getAttribute("data-sg");
      const renameField = row.querySelector('[data-role="sg-rename"]');
      const sgLayout = row.querySelector('[data-role="sg-layout"]');
      const sgFill = row.querySelector('[data-role="sg-fill"]');
      const sgStroke = row.querySelector('[data-role="sg-stroke"]');
      const sgSave = row.querySelector('[data-role="sg-save"]');
      const sgDel = row.querySelector('[data-role="sg-del"]');

      sgSave.addEventListener("click", () => {
        const newSgNameVal = renameField.value.trim();
        const rn = renameSubgroup(sysName, sg, newSgNameVal);
        if (!rn.ok) { alert(rn.error); return; }
        const actual = window.systems[sysName].subgroups[newSgNameVal];
        actual.layout = sgLayout.value;
        actual.fill = sgFill.value;
        actual.stroke = sgStroke.value;
        renderSystemList();
        if (window.scheduleRender) window.scheduleRender();
      });

      sgDel.addEventListener("click", () => {
        if (!confirm(`Delete subgroup "${sg}"?`)) return;
        const rdel = deleteSubgroup(sysName, sg);
        if (!rdel.ok) { alert(rdel.error); return; }
        renderSystemList();
        if (window.scheduleRender) window.scheduleRender();
      });
    });
  });
}

function renderSubgroupRows(sysName, subgroups) {
  const entries = Object.keys(subgroups || {});
  if (!entries.length) {
    return `<div style="font-size:11px;color:#555;">(No subgroups)</div>`;
  }
  return entries.map(sg => {
    const sgCfg = subgroups[sg];
    return `
      <div data-sg-row data-sg="${sg}" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:4px 0;padding:4px 6px;border:1px solid #cfd7dc;background:#fff;border-radius:4px;">
        <input data-role="sg-rename" value="${sg}" style="font-size:11px;padding:2px 6px;">
        <select data-role="sg-layout" style="font-size:11px;">
          <option value="vertical" ${sgCfg.layout === "vertical" ? "selected":""}>vertical</option>
          <option value="horizontal" ${sgCfg.layout === "horizontal" ? "selected":""}>horizontal</option>
        </select>
        <input type="color" data-role="sg-fill" value="${sgCfg.fill}">
        <input type="color" data-role="sg-stroke" value="${sgCfg.stroke}">
        <button data-role="sg-save" style="font-size:11px;padding:3px 8px;">Save</button>
        <button data-role="sg-del" style="font-size:11px;padding:3px 8px;color:#fff;background:#c33;border:none;border-radius:4px;">Del</button>
      </div>
    `;
  }).join("");
}

/* ============================================================
   BASIC MERMAID GENERATOR (subgraphs only, no connections)
   ============================================================ */
function generateMermaidBasic(opts = {}) {
  const arrangement = (opts.arrangement === "vertical") ? "TD" : "LR";
  const honorPerSystemLayout = !!opts.directionPerSystem;

  // Auto include systems referenced by nodes (if missing)
  window.nodes.forEach(n => {
    if (n.system && !window.systems[n.system]) {
      window.systems[n.system] = {
        stroke: "#333333",
        fill: "#ffffff",
        layout: "vertical",
        row: 0,
        subgroups: {}
      };
      if (!window.systemsOrder.includes(n.system)) window.systemsOrder.push(n.system);
    }
  });
  ensureSystemOrderConsistency();

  const lines = [];
  lines.push(`graph ${arrangement}`);
  lines.push("");

  // Group nodes
  const nodesBySystem = {};
  window.nodes.forEach(n => {
    const label = (n.label || n.id || "").replace(/"/g,"'");
    const nodeLine = `${n.id}${shapeWrap(n.shape || "rect", `"${label}"`)}`;
    if (n.system && window.systems[n.system]) {
      (nodesBySystem[n.system] ||= []).push(nodeLine);
    } else {
      lines.push(nodeLine);
    }
  });

  if (lines[lines.length - 1] !== "") lines.push("");

  window.systemsOrder.forEach(sysName => {
    const sys = window.systems[sysName];
    if (!sys) return;
    const groupNodes = nodesBySystem[sysName] || [];
    const sysId = "SYS_" + sysName.replace(/\W+/g,"_");
    lines.push(`subgraph ${sysId}["${sysName}"]`);
    lines.push(honorPerSystemLayout
      ? (sys.layout === "horizontal" ? "direction LR" : "direction TB")
      : "direction TB"
    );

    if (!groupNodes.length) {
      // Keep empty subgraph visible
      lines.push("%% (empty system)");
    } else {
      groupNodes.forEach(gl => lines.push(gl));
    }
    lines.push("end");
    lines.push(`style ${sysId} fill:${sys.fill},stroke:${sys.stroke},stroke-width:2px`);
    lines.push("");
  });

  // Node styling (optional additional)
  window.nodes.forEach(n => {
    const fill = n.bgColor || "#ffffff";
    const stroke = n.outlineColor || "#333333";
    const text = n.textColor || "#000000";
    lines.push(`style ${n.id} fill:${fill},stroke:${stroke},stroke-width:2px,color:${text}`);
  });

  return lines.join("\n");
}

/* ============================================================
   INIT HOOK
   ============================================================ */
const SystemUI = {
  init(config = {}) {
    ensureSystemOrderConsistency();
    // Wire add system form if provided
    const formId = config.formId || "add-system-form";
    const listId = config.systemListId || "system-list";
    const formEl = document.getElementById(formId);
    if (formEl && !formEl.__wired) {
      formEl.addEventListener("submit", e => {
        e.preventDefault();
        const nameInput = formEl.querySelector("#sysNameInput") || formEl.querySelector("[name=sysName]");
        if (!nameInput) return;
        const name = (nameInput.value || "").trim();
        if (!name) return;
        const r = addSystem(name, {
          stroke: (formEl.querySelector("#sysStrokeInput") || {}).value || "#333333",
          fill:   (formEl.querySelector("#sysFillInput")   || {}).value || "#ffffff",
          layout: (formEl.querySelector("#sysLayoutSelect")|| {}).value || "vertical"
        });
        if (!r.ok) { alert(r.error); return; }
        nameInput.value = "";
        renderSystemList();
        if (window.scheduleRender) window.scheduleRender();
      });
      formEl.__wired = true;
    }
    if (!document.getElementById(listId)) {
      // Create if missing
      const div = document.createElement("div");
      div.id = listId;
      document.body.appendChild(div);
    }
    renderSystemList();
  }
};

/* ============================================================
   EXPORTS
   ============================================================ */
window.addSystem = addSystem;
window.renameSystem = renameSystem;
window.deleteSystem = deleteSystem;
window.addSubgroup = addSubgroup;
window.renameSubgroup = renameSubgroup;
window.deleteSubgroup = deleteSubgroup;
window.renderSystemList = renderSystemList;
window.generateMermaidBasic = generateMermaidBasic;
window.SystemUI = SystemUI;

/* ============================================================
   QUICK TEST (OPTIONAL - comment out in production)
   Uncomment the block below once to auto-seed systems
   ============================================================ */
/*
if (!systemsOrder.length) {
  addSystem("System 1");
  addSystem("System 2", { layout:"horizontal", fill:"#f8f8ff", stroke:"#444" });
  nodes.push({ id:"N0", label:"Start", shape:"rect", bgColor:"#fff", outlineColor:"#333", textColor:"#000", system:"System 1", subgroup:"", desc:"" });
  nodes.push({ id:"N1", label:"Process", shape:"stadium", bgColor:"#fff", outlineColor:"#333", textColor:"#000", system:"System 1", subgroup:"", desc:"" });
  nodes.push({ id:"N2", label:"Finish", shape:"rect", bgColor:"#fff", outlineColor:"#333", textColor:"#000", system:"System 2", subgroup:"", desc:"" });
  renderSystemList();
  // Example of using generateMermaidBasic:
  // const src = generateMermaidBasic({ arrangement:"horizontal", directionPerSystem:true });
  // console.log(src);
}
*/
