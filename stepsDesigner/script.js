(() => {
  'use strict';
  // One-time guard: if this file is ever loaded twice, skip second init
  if (window.__SFD_LOADED__) {
    return;
  }
  window.__SFD_LOADED__ = true;
  // Tolerant state: use existing window state if present
  const nodes = window.nodes || [];
  let nodeCount = window.nodeCount || 0;
  const systems = window.systems || {};
  let systemsOrder = window.systemsOrder || [];
  let systemsArrangement = window.systemsArrangement || 'vertical';
  let diagramLegend = window.diagramLegend || '';
  let legendOverlayVisible = (typeof window.legendOverlayVisible === 'boolean') ? window.legendOverlayVisible : true;
  let isImporting = window.isImporting || false;
  const systemPlacement = window.systemPlacement || {};

  // Constants scoped inside the IIFE (won’t collide globally)
  const LANE_HEIGHT = 140;
  const TILE_WIDTH = 180;
  const TILE_H_MARGIN = 40;
  const TILE_Y_OFFSET = 10;
  const ENABLE_ORDER_LOCK = true;

  // Reflect state back to window so other scripts/adapters can read it
  Object.assign(window, {
    nodes,
    nodeCount,
    systems,
    systemsOrder,
    systemsArrangement,
    diagramLegend,
    legendOverlayVisible,
    isImporting,
    systemPlacement,
  });


  /* ======================= Edge Style Definitions =========================== */
  const EDGE_STYLE_DEFS = {
    solid: { arrowOp: "-->", noArrowOp: "---", pattern: "solid" },
    plain: { arrowOp: "-->", noArrowOp: "---", pattern: "solid", forceNoArrow: true },
    dashed: { arrowOp: "-.->", noArrowOp: "-.-", pattern: "dashed" },
    dashedNo: { arrowOp: "-.->", noArrowOp: "-.-", pattern: "dashed", forceNoArrow: true },
    dotted: { arrowOp: "-->", noArrowOp: "---", pattern: "dotted" },
    dottedNo: { arrowOp: "-->", noArrowOp: "---", pattern: "dotted", forceNoArrow: true },
    thick: { arrowOp: "==>", noArrowOp: "===", pattern: "solid" },
    thickNo: { arrowOp: "==>", noArrowOp: "===", pattern: "solid", forceNoArrow: true },
    double: { arrowOp: "==>", noArrowOp: "===", pattern: "double" },
    none: { arrowOp: "---", noArrowOp: "---", pattern: "solid", forceNoArrow: true }
  };

  /* =========================== Utility Helpers ============================== */
  function $(id) { return document.getElementById(id); }
  function $$(sel) { return Array.from(document.querySelectorAll(sel)); }
  function esc(s) { return (s || "").replace(/"/g, "'").replace(/</g, "&lt;"); }
  function sanitizeId(str) { return String(str || "").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, ""); }
  function asciiStrict(str) {
    return [...String(str || "")].filter(ch => {
      const c = ch.charCodeAt(0);
      return c >= 32 && c <= 126;
    }).join("");
  }
  function sanitizeColor(raw) {
    if (!raw) return "#333333";
    let s = String(raw)
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .replace(/[°·•∙●▪▫○◦￿¶ß]/g, '#')
      .trim();
    if (!s.startsWith('#') && /^[0-9a-fA-F]{6}$/.test(s)) s = '#' + s;
    s = s.replace(/[^#0-9a-fA-F]/g, "");
    if (!s.startsWith('#')) s = '#' + s;
    let core = s.slice(1).match(/[0-9a-fA-F]{1,6}/); core = core ? core[0] : "";
    while (core.length < 6) core += (core.slice(-1) || '3');
    const out = '#' + core.slice(0, 6).toLowerCase();
    return /^#[0-9a-f]{6}$/.test(out) ? out : "#333333";
  }
  function shapeWrap(shape, label) {
    switch (shape) {
      case "circle": return `((${label}))`;
      case "diamond": return `{${label}}`;
      case "subroutine": return `[[${label}]]`;
      case "stadium": return `([${label}])`;
      case "round": return `(${label})`;
      case "cylinder": return `(${label})`;
      default: return `[${label}]`;
    }
  }
  function bindClick(id, fn) { const el = $(id); if (el) el.addEventListener("click", fn); }

  /* =========================== Initialization =============================== */
  document.addEventListener("DOMContentLoaded", () => {
    try {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'loose', flowchart: { htmlLabels: false } });
    } catch (_) { }
    wireHelpDocs();
    wireTopToolbars();
    wireLegendEditor();
    wireSystems();
    wireNodesToolbar();
    wireSectionCollapsers();
    wireLayoutCanvasControls();
    applyInitialSettings();
    syncLegend();
    updateNoSystemsHint();
  });

  /* ====================== Layout (Lane & Order) ============================= */
  function ensurePlacement(sys, mode = "right_end") {
    if (systemPlacement[sys]) return;
    const lane0Count = Object.values(systemPlacement).filter(p => p.lane === 0).length;

    if (mode === "new_top_lane") {
      Object.values(systemPlacement).forEach(p => p.lane += 1);
      systemPlacement[sys] = { lane: 0, order: 0, x: 0, y: 0 };
      recomputeXY(); rebuildSystemsOrder(); return;
    }
    if (mode === "new_lane_below") {
      const maxLane = Math.max(-1, ...Object.values(systemPlacement).map(p => p.lane));
      systemPlacement[sys] = { lane: maxLane + 1, order: 0, x: 0, y: 0 };
      recomputeXY(); rebuildSystemsOrder(); return;
    }
    if (mode === "left_end") {
      Object.values(systemPlacement).forEach(p => {
        if (p.lane === 0) p.order += 1;
      });
      systemPlacement[sys] = { lane: 0, order: 0, x: 0, y: 0 };
      recomputeXY(); rebuildSystemsOrder(); return;
    }
    systemPlacement[sys] = { lane: 0, order: lane0Count, x: 0, y: 0 }; // right_end default
    recomputeXY(); rebuildSystemsOrder();
  }

  function recomputeXY() {
    Object.entries(systemPlacement).forEach(([sys, p]) => {
      p.x = p.order * (TILE_WIDTH + TILE_H_MARGIN);
      p.y = p.lane * LANE_HEIGHT + TILE_Y_OFFSET;
      if (systems[sys]) systems[sys].row = p.lane;
    });
  }

  function rebuildSystemsOrder() {
    systemsOrder = Object.entries(systemPlacement)
      .sort((a, b) => {
        const pa = a[1], pb = b[1];
        return pa.lane - pb.lane || pa.order - pb.order;
      })
      .map(([sys]) => sys);
  }

  function migrateLegacyPlacementIfNeeded() {
    if (Object.keys(systemPlacement).length) return;
    systemsOrder = systemsOrder.length ? systemsOrder : Object.keys(systems);
    systemsOrder.forEach((s, i) => {
      systemPlacement[s] = { lane: 0, order: i, x: 0, y: 0 };
    });
    recomputeXY(); rebuildSystemsOrder();
  }

  function handleTileDrop(sys, rawX, rawY) {
    const p = systemPlacement[sys]; if (!p) return;
    const lane = Math.max(0, Math.round((rawY - TILE_Y_OFFSET) / LANE_HEIGHT));
    const laneMembers = Object.entries(systemPlacement)
      .filter(([s, pl]) => pl.lane === lane && s !== sys)
      .sort((a, b) => a[1].order - b[1].order);
    const tileCenter = rawX + TILE_WIDTH / 2;
    let insertAt = laneMembers.length;
    for (let i = 0; i < laneMembers.length; i++) {
      const mp = laneMembers[i][1];
      const memberCenter = mp.order * (TILE_WIDTH + TILE_H_MARGIN) + TILE_WIDTH / 2;
      if (tileCenter < memberCenter) { insertAt = i; break; }
    }
    p.lane = lane;
    const newList = laneMembers.map(([s]) => s);
    newList.splice(insertAt, 0, sys);
    newList.forEach((s, i) => systemPlacement[s].order = i);
    recomputeXY(); rebuildSystemsOrder();
    renderSystemList();
    renderLayoutCanvas();
    generateMermaid();
  }

  function renderLayoutCanvas() {
    const canvas = $("layoutCanvas");
    if (!canvas) return;
    canvas.innerHTML = '<div id="laneGuide" class="lane-guide"></div>';
    Object.entries(systemPlacement).forEach(([sys, p]) => {
      if (!systems[sys]) return;
      const cfg = systems[sys];
      const tile = document.createElement("div");
      tile.className = "system-tile";
      tile.dataset.system = sys;
      tile.style.left = p.x + "px";
      tile.style.top = p.y + "px";
      tile.innerHTML = `
      <div class="tile-name">${esc(sys)}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;">
        <span style="background:${cfg.fill};border:1px solid ${cfg.stroke};padding:2px 4px;border-radius:6px;">${cfg.layout}</span>
        <span>Lane ${p.lane}</span>
        <span>#${p.order}</span>
      </div>`;
      enableTileDrag(tile);
      canvas.appendChild(tile);
    });
  }

  function enableTileDrag(tile) {
    const sys = tile.dataset.system;
    const guide = $("laneGuide");
    let startX, startY, origX, origY;
    function down(e) {
      e.preventDefault();
      tile.classList.add("dragging");
      startX = e.clientX; startY = e.clientY;
      const p = systemPlacement[sys]; origX = p.x; origY = p.y;
      tile.setPointerCapture(e.pointerId);
      tile.addEventListener("pointermove", move);
      tile.addEventListener("pointerup", up);
      tile.addEventListener("pointercancel", up);
    }
    function move(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const nx = origX + dx;
      const ny = origY + dy;
      tile.style.left = nx + "px";
      tile.style.top = ny + "px";
      if (guide) {
        const lane = Math.max(0, Math.round((ny - TILE_Y_OFFSET) / LANE_HEIGHT));
        guide.style.top = (lane * LANE_HEIGHT) + "px";
        guide.classList.add("visible");
      }
    }
    function up(e) {
      tile.releasePointerCapture(e.pointerId);
      tile.removeEventListener("pointermove", move);
      tile.removeEventListener("pointerup", up);
      tile.removeEventListener("pointercancel", up);
      tile.classList.remove("dragging");
      if (guide) guide.classList.remove("visible");
      const nx = parseInt(tile.style.left, 10);
      const ny = parseInt(tile.style.top, 10);
      handleTileDrop(sys, nx, ny);
    }
    tile.addEventListener("pointerdown", down);
  }

  function resetLayout() {
    systemsOrder.forEach((sys, i) => {
      systemPlacement[sys] = { lane: 0, order: i, x: 0, y: 0 };
    });
    recomputeXY(); rebuildSystemsOrder();
    renderLayoutCanvas();
    renderSystemList();
    generateMermaid();
  }

  function compactLanes() {
    const lanes = [...new Set(Object.values(systemPlacement).map(p => p.lane))].sort((a, b) => a - b);
    const map = {}; lanes.forEach((l, i) => map[l] = i);
    Object.values(systemPlacement).forEach(p => p.lane = map[p.lane]);
    recomputeXY(); rebuildSystemsOrder();
    renderLayoutCanvas();
    renderSystemList();
    generateMermaid();
  }

  function enableSystemListDrag() {
    const container = $("system-list");
    if (!container) return;
    let dragEl = null;
    container.querySelectorAll(".system-block").forEach(block => {
      block.addEventListener("dragstart", e => {
        dragEl = block; block.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      block.addEventListener("dragend", () => {
        block.classList.remove("dragging");
        $$(".system-block.drop-target").forEach(el => el.classList.remove("drop-target"));
        dragEl = null;
        applyListOrderToPlacement();
      });
      block.addEventListener("dragover", e => {
        e.preventDefault();
        const after = getAfter(container, e.clientY);
        container.querySelectorAll(".system-block").forEach(el => el.classList.remove("drop-target"));
        if (after == null) container.appendChild(dragEl);
        else {
          container.insertBefore(dragEl, after);
          after.classList.add("drop-target");
        }
      });
    });
    function getAfter(container, y) {
      const els = [...container.querySelectorAll(".system-block:not(.dragging)")];
      return els.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
      }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
  }

  function applyListOrderToPlacement() {
    const blocks = [...document.querySelectorAll("#system-list .system-block")];
    const ordered = blocks.map(b => b.dataset.system);
    const lanes = [...new Set(Object.values(systemPlacement).map(p => p.lane))];
    if (lanes.length === 1) {
      ordered.forEach((sys, i) => {
        if (systemPlacement[sys]) systemPlacement[sys].order = i;
      });
    } else {
      const grouped = {};
      Object.entries(systemPlacement).forEach(([s, p]) => {
        (grouped[p.lane] ||= []).push(s);
      });
      lanes.forEach(l => {
        const laneMembers = grouped[l];
        const sorted = ordered.filter(n => laneMembers.includes(n));
        sorted.forEach((sys, i) => {
          systemPlacement[sys].order = i;
        });
      });
    }
    recomputeXY(); rebuildSystemsOrder();
    renderLayoutCanvas();
    renderSystemList();
    generateMermaid();
  }

  function wireLayoutCanvasControls() {
    bindClick("toggleLayoutCanvasBtn", () => {
      const c = $("layoutCanvas");
      c.classList.toggle("hidden");
      $("toggleLayoutCanvasBtn").textContent = c.classList.contains("hidden") ? "Show Canvas" : "Hide Canvas";
    });
    bindClick("resetLayoutBtn", resetLayout);
    bindClick("compactLanesBtn", compactLanes);
  }

  /* ============================ Systems UI ================================== */
  function wireSystems() {
    $("add-system-form")?.addEventListener("submit", e => {
      e.preventDefault();
      const name = $("sysNameInput").value.trim();
      if (!name) return;
      if (systems[name]) return alert("System already exists");
      systems[name] = {
        stroke: sanitizeColor($("sysStrokeInput").value || "#333333"),
        fill: sanitizeColor($("sysFillInput").value || "#ffffff"),
        layout: $("sysLayoutSelect").value || "vertical",
        row: parseInt($("sysRowInput").value || "0", 10) || 0,
        subgroups: {}
      };
      systemsOrder.push(name);
      ensurePlacement(name, $("sysPlacementMode")?.value || "right_end");
      $("sysNameInput").value = "";
      $("sysRowInput").value = "";
      renderSystemList();
      renderLayoutCanvas();
      updateSystemDropdowns();
      updateNoSystemsHint();
      generateMermaid();
    });
    bindClick("collapseAllSystemsBtn", () => toggleAllSystems(true));
    bindClick("expandAllSystemsBtn", () => toggleAllSystems(false));
  }

  function toggleAllSystems(c) {
    $$(".system-block").forEach(b => {
      b.classList[c ? "add" : "remove"]("collapsed");
      const btn = b.querySelector(".system-collapse-btn");
      if (btn) btn.textContent = c ? "▸" : "▾";
    });
  }

  function renderSystemList() {
    const list = $("system-list");
    if (!list) return;
    list.innerHTML = "";
    systemsOrder.forEach(name => {
      const cfg = systems[name]; if (!cfg) return;
      const block = document.createElement("div");
      block.className = "system-block";
      block.draggable = true;
      block.dataset.system = name;

      const dragHandle = document.createElement("div");
      dragHandle.className = "system-drag-handle";
      dragHandle.textContent = "⋮⋮";
      block.appendChild(dragHandle);

      const collapseBtn = document.createElement("button");
      collapseBtn.type = "button";
      collapseBtn.className = "system-collapse-btn";
      collapseBtn.textContent = "▾";
      collapseBtn.addEventListener("click", () => {
        block.classList.toggle("collapsed");
        collapseBtn.textContent = block.classList.contains("collapsed") ? "▸" : "▾";
      });
      block.appendChild(collapseBtn);

      const header = document.createElement("div");
      header.className = "system-block-header";
      const inName = document.createElement("input"); inName.value = name;
      const layout = document.createElement("select");
      ["vertical", "horizontal"].forEach(v => {
        const o = document.createElement("option");
        o.value = v; o.textContent = "Nodes " + (v === "vertical" ? "↓" : "→");
        layout.appendChild(o);
      });
      layout.value = cfg.layout;
      const stroke = document.createElement("input"); stroke.type = "color"; stroke.value = cfg.stroke;
      const fill = document.createElement("input"); fill.type = "color"; fill.value = cfg.fill;
      const row = document.createElement("input"); row.type = "number"; row.style.width = "70px"; row.value = cfg.row || 0;

      const save = document.createElement("button");
      save.textContent = "💾 Save"; save.className = "system-btn small-btn";
      save.addEventListener("click", () => {
        const newName = inName.value.trim();
        if (!newName) return alert("Name required");
        if (newName !== name && systems[newName]) return alert("Name exists");
        if (newName !== name) {
          systems[newName] = { ...systems[name] };
          delete systems[name];
          nodes.forEach(n => { if (n.system === name) n.system = newName; });
          systemsOrder = systemsOrder.map(s => s === name ? newName : s);
          if (systemPlacement[name]) {
            systemPlacement[newName] = systemPlacement[name];
            delete systemPlacement[name];
          }
        }
        const ref = systems[newName];
        ref.layout = layout.value;
        ref.stroke = sanitizeColor(stroke.value);
        ref.fill = sanitizeColor(fill.value);
        const newRow = parseInt(row.value, 10) || 0;
        if (systemPlacement[newName]) systemPlacement[newName].lane = newRow;
        recomputeXY(); rebuildSystemsOrder();
        renderSystemList();
        renderLayoutCanvas();
        updateSystemDropdowns();
        generateMermaid();
      });

      const del = document.createElement("button");
      del.textContent = "🗑️ Delete"; del.className = "delete-btn small-btn";
      del.addEventListener("click", () => {
        if (!confirm(`Delete system "${name}"?`)) return;
        delete systems[name];
        systemsOrder = systemsOrder.filter(s => s !== name);
        nodes.forEach(n => {
          if (n.system === name) { n.system = ""; n.subgroup = ""; }
        });
        delete systemPlacement[name];
        recomputeXY(); rebuildSystemsOrder();
        renderSystemList();
        renderLayoutCanvas();
        updateSystemDropdowns();
        updateNoSystemsHint();
        generateMermaid();
      });

      header.append(inName, layout, stroke, fill, row, save, del);
      block.appendChild(header);

      const body = document.createElement("div");
      body.className = "system-body";
      const sgRow = document.createElement("div");
      sgRow.style.cssText = "display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.4rem;";
      const sgName = document.createElement("input"); sgName.placeholder = "Subgroup name";
      const sgLayout = document.createElement("select");
      ["vertical", "horizontal"].forEach(v => {
        const o = document.createElement("option"); o.value = v; o.textContent = v; sgLayout.appendChild(o);
      });
      const sgFill = document.createElement("input"); sgFill.type = "color"; sgFill.value = "#eef5ff";
      const sgStroke = document.createElement("input"); sgStroke.type = "color"; sgStroke.value = "#9dbce6";
      const addSg = document.createElement("button");
      addSg.textContent = "➕ Add Subgroup"; addSg.className = "system-btn small-btn";
      addSg.addEventListener("click", () => {
        const nm = sgName.value.trim(); if (!nm) return alert("Name required");
        if (systems[name].subgroups[nm]) return alert("Exists");
        systems[name].subgroups[nm] = {
          layout: sgLayout.value,
          fill: sanitizeColor(sgFill.value),
          stroke: sanitizeColor(sgStroke.value)
        };
        sgName.value = "";
        renderSystemList(); updateSystemDropdowns(); generateMermaid();
      });
      sgRow.append(sgName, sgLayout, sgFill, sgStroke, addSg);
      body.appendChild(sgRow);

      Object.entries(cfg.subgroups || {}).forEach(([sg, scfg]) => {
        const rowDiv = document.createElement("div");
        rowDiv.className = "subgroup-row";
        const rInput = document.createElement("input"); rInput.value = sg;
        const layE = document.createElement("select");
        ["vertical", "horizontal"].forEach(v => {
          const o = document.createElement("option"); o.value = v; o.textContent = v; layE.appendChild(o);
        });
        layE.value = scfg.layout || "vertical";
        const fillE = document.createElement("input"); fillE.type = "color"; fillE.value = scfg.fill;
        const strokeE = document.createElement("input"); strokeE.type = "color"; strokeE.value = scfg.stroke;
        const saveSg = document.createElement("button");
        saveSg.textContent = "💾"; saveSg.className = "system-btn small-btn";
        saveSg.addEventListener("click", () => {
          const newName = rInput.value.trim();
          if (!newName) return alert("Name required");
          if (newName !== sg && systems[name].subgroups[newName]) return alert("Exists");
          if (newName !== sg) {
            systems[name].subgroups[newName] = { ...systems[name].subgroups[sg] };
            delete systems[name].subgroups[sg];
            nodes.forEach(n => { if (n.system === name && n.subgroup === sg) n.subgroup = newName; });
          }
          const tgt = systems[name].subgroups[newName];
          tgt.layout = layE.value;
          tgt.fill = sanitizeColor(fillE.value);
          tgt.stroke = sanitizeColor(strokeE.value);
          renderSystemList(); updateSystemDropdowns(); generateMermaid();
        });
        const delSg = document.createElement("button");
        delSg.textContent = "🗑️"; delSg.className = "delete-btn small-btn";
        delSg.addEventListener("click", () => {
          if (!confirm(`Delete subgroup "${sg}"?`)) return;
          delete systems[name].subgroups[sg];
          nodes.forEach(n => {
            if (n.system === name && n.subgroup === sg) n.subgroup = "";
          });
          renderSystemList(); updateSystemDropdowns(); generateMermaid();
        });
        rowDiv.append(rInput, layE, fillE, strokeE, saveSg, delSg);
        body.appendChild(rowDiv);
      });

      block.appendChild(body);
      list.appendChild(block);
    });

    enableSystemListDrag();
    renderLayoutCanvas();
  }

  /* ============================= Nodes UI =================================== */
  function wireNodesToolbar() {
    bindClick("collapseAllNodesBtn", () => toggleAllNodes(true));
    bindClick("expandAllNodesBtn", () => toggleAllNodes(false));
  }

  function toggleAllNodes(c) {
    $$(".node").forEach(n => {
      n.classList[c ? "add" : "remove"]("collapsed");
      const btn = n.querySelector(".node-collapse-btn");
      if (btn) btn.textContent = c ? "▸" : "▾";
    });
  }

  function addNode() {
    const id = `N${nodeCount++}`;
    const newNode = {
      id, label: "",
      shape: "rect",
      textColor: "#000000",
      bgColor: "#ffffff",
      outlineColor: "#333333",
      system: "",
      subgroup: "",
      desc: "",
      connections: []
    };
    nodes.push(newNode);
    $("nodes-container")?.appendChild(buildNodeCard(newNode));
    updateSystemDropdowns();
    return newNode;
  }

  function buildConnectionRow(targetId, conn) {
    const wrap = document.createElement("div");
    wrap.className = "connection-wrapper-adv";
    if (conn.arrow === undefined) conn.arrow = true;
    if (conn.width === undefined) conn.width = 2;
    if (conn.type === undefined) conn.type = "solid";
    if (conn.color === undefined) conn.color = "#333333";

    const peerSel = document.createElement("select");
    peerSel.className = "connect-select";
    peerSel.innerHTML = `<option value="">Source Node</option>` +
      nodes.filter(n => n.id !== targetId).map(n => `<option value="${n.id}" ${n.id === conn.source ? "selected" : ""}>${esc(n.label || n.id)}</option>`).join("");

    const labelInput = document.createElement("input");
    labelInput.type = "text"; labelInput.placeholder = "Label"; labelInput.value = conn.label || "";

    const typeSel = document.createElement("select");
    ["solid", "plain", "dashed", "dashedNo", "dotted", "dottedNo", "thick", "thickNo", "double", "none"].forEach(t => {
      const o = document.createElement("option"); o.value = t; o.textContent = t; if (conn.type === t) o.selected = true;
      typeSel.appendChild(o);
    });

    const arrowChk = document.createElement("input");
    arrowChk.type = "checkbox"; arrowChk.checked = !!conn.arrow; arrowChk.title = "Arrow Head";

    const widthSel = document.createElement("select");
    for (let i = 1; i <= 6; i++) {
      const o = document.createElement("option");
      o.value = i; o.textContent = `W${i}`;
      if (conn.width === i) o.selected = true;
      widthSel.appendChild(o);
    }

    const colorInput = document.createElement("input");
    colorInput.type = "color"; colorInput.value = sanitizeColor(conn.color || "#333333");

    const delBtn = document.createElement("button");
    delBtn.type = "button"; delBtn.className = "conn-delete-btn"; delBtn.textContent = "✖";

    function sync() {
      conn.source = peerSel.value;
      conn.label = labelInput.value;
      conn.type = typeSel.value;
      conn.arrow = arrowChk.checked;
      conn.width = parseInt(widthSel.value, 10) || 2;
      conn.color = sanitizeColor(colorInput.value);
      generateMermaid();
    }

    [peerSel, labelInput, typeSel, widthSel, colorInput].forEach(el => {
      el.addEventListener(el.tagName === "SELECT" ? "change" : "input", sync);
    });
    arrowChk.addEventListener("change", sync);
    delBtn.addEventListener("click", () => {
      const node = nodes.find(n => n.id === targetId);
      if (!node) return;
      node.connections = node.connections.filter(c => c !== conn);
      wrap.remove();
      generateMermaid();
    });

    function mkField(lbl, el) {
      const f = document.createElement("div"); f.className = "conn-field";
      const l = document.createElement("label"); l.textContent = lbl;
      f.append(l, el); return f;
    }

    wrap.append(
      mkField("Source", peerSel),
      mkField("Label", labelInput),
      mkField("Type", typeSel),
      mkField("Width", widthSel),
      mkField("Color", colorInput)
    );
    const arrowWrap = document.createElement("div");
    arrowWrap.className = "conn-arrow-toggle";
    const arrowLab = document.createElement("label");
    arrowLab.style.fontSize = ".55rem";
    arrowLab.textContent = "Arrow";
    arrowWrap.append(arrowLab, arrowChk);

    wrap.append(arrowWrap, delBtn);
    return wrap;
  }

  function updateConnectDropdowns() {
    $$(".connection-wrapper-adv .connect-select").forEach(sel => {
      const nodeEl = sel.closest(".node");
      const targetId = nodeEl?.dataset.id;
      const current = sel.value;
      sel.innerHTML = `<option value="">Source Node</option>` +
        nodes.filter(n => n.id !== targetId).map(n => `<option value="${n.id}" ${n.id === current ? "selected" : ""}>${esc(n.label || n.id)}</option>`).join("");
      sel.value = current;
    });
  }

  function populateSubgroups(systemName, selectEl, selected) {
    const subs = systems[systemName]?.subgroups || {};
    selectEl.innerHTML = `<option value="">-- Subgroup --</option>` +
      Object.keys(subs).map(sg => `<option value="${sg}" ${sg === selected ? "selected" : ""}>${sg}</option>`).join("");
  }

  function saveNode(id) {
    const node = nodes.find(n => n.id === id); if (!node) return;
    const card = document.querySelector(`.node[data-id='${CSS.escape(id)}']`);
    if (!card) return;
    node.label = card.querySelector(".node-name-input")?.value.trim() || "";
    node.desc = card.querySelector("textarea")?.value || "";
    node.shape = card.querySelector(".shape-select")?.value || "rect";
    node.system = card.querySelector(".system-select")?.value || "";
    node.subgroup = card.querySelector(".subgroup-select")?.value || "";
    node.textColor = sanitizeColor(card.querySelector(".text-color-select")?.value || "#000000");
    node.bgColor = sanitizeColor(card.querySelector(".bg-color-select")?.value || "#ffffff");
    node.outlineColor = sanitizeColor(card.querySelector(".outline-color-select")?.value || "#333333");
  }

  function buildNodeCard(n) {
    const card = document.createElement("div");
    card.className = "node"; card.dataset.id = n.id;

    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button"; collapseBtn.className = "node-collapse-btn"; collapseBtn.textContent = "▾";
    collapseBtn.addEventListener("click", () => {
      card.classList.toggle("collapsed");
      collapseBtn.textContent = card.classList.contains("collapsed") ? "▸" : "▾";
    });
    card.appendChild(collapseBtn);

    const titleBar = document.createElement("div");
    titleBar.className = "node-title-bar";
    const nameLabel = document.createElement("label"); nameLabel.textContent = "Name";
    const nameInput = document.createElement("input");
    nameInput.type = "text"; nameInput.className = "node-name-input";
    nameInput.placeholder = "Step name"; nameInput.value = n.label;
    titleBar.append(nameLabel, nameInput);
    card.appendChild(titleBar);

    const grid = document.createElement("div");
    grid.className = "node-inner-grid";

    function wrap(label, el) {
      const w = document.createElement("div");
      const l = document.createElement("label"); l.textContent = label;
      w.append(l, el); return w;
    }

    const desc = document.createElement("textarea"); desc.rows = 2; desc.placeholder = "Description"; desc.value = n.desc;
    const shape = document.createElement("select"); shape.className = "shape-select";
    ["rect", "round", "stadium", "subroutine", "cylinder", "circle", "diamond"].forEach(s => {
      const o = document.createElement("option"); o.value = s; o.textContent = s; if (n.shape === s) o.selected = true; shape.appendChild(o);
    });
    const sysSel = document.createElement("select"); sysSel.className = "system-select";
    const sgSel = document.createElement("select"); sgSel.className = "subgroup-select";
    const textColor = document.createElement("input"); textColor.type = "color"; textColor.value = n.textColor; textColor.className = "text-color-select";
    const bgColor = document.createElement("input"); bgColor.type = "color"; bgColor.value = n.bgColor; bgColor.className = "bg-color-select";
    const outlineColor = document.createElement("input"); outlineColor.type = "color"; outlineColor.value = n.outlineColor; outlineColor.className = "outline-color-select";

    const connContainer = document.createElement("div");
    connContainer.className = "connections-container";
    n.connections.forEach(c => connContainer.appendChild(buildConnectionRow(n.id, c)));

    const addConn = document.createElement("button");
    addConn.type = "button"; addConn.textContent = "➕ Add Connection";
    addConn.className = "add-conn-btn small-btn";
    addConn.addEventListener("click", () => {
      n.connections.push({ source: "", label: "", type: "solid", color: "#333333", width: 2, arrow: true });
      connContainer.appendChild(buildConnectionRow(n.id, n.connections[n.connections.length - 1]));
    });

    const delNode = document.createElement("button");
    delNode.type = "button"; delNode.textContent = "🗑️ Delete Node";
    delNode.className = "delete-btn small-btn";
    delNode.addEventListener("click", () => {
      if (!confirm("Delete this node?")) return;
      nodes = nodes.filter(x => x.id !== n.id);
      card.remove();
      updateConnectDropdowns();
      generateMermaid();
    });

    [nameInput, desc, shape, sysSel, sgSel, textColor, bgColor, outlineColor].forEach(el => {
      el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
        saveNode(n.id);
        if (el === sysSel) populateSubgroups(sysSel.value, sgSel, "");
        generateMermaid();
        updateConnectDropdowns();
      });
    });

    grid.append(
      wrap("Desc", desc),
      wrap("Shape", shape),
      wrap("System", sysSel),
      wrap("Subgroup", sgSel),
      wrap("Text", textColor),
      wrap("Fill", bgColor),
      wrap("Outline", outlineColor),
      connContainer,
      addConn,
      delNode
    );
    card.appendChild(grid);

    if (!isImporting) {
      updateSystemDropdowns();
      if (n.system) sysSel.value = n.system;
      populateSubgroups(n.system, sgSel, n.subgroup);
    }
    return card;
  }

  /* =========================== Legend Editor ================================= */
  function renderLegendOverlay() {
    const overlay = $("legendOverlay");
    const content = $("legendOverlayContent");
    if (!overlay || !content) return;
    if (!diagramLegend || !legendOverlayVisible) {
      overlay.classList.add("hidden");
      return;
    }
    content.innerHTML = diagramLegend;
    overlay.classList.remove("hidden");
  }

  function syncLegend() {
    const editor = $("legendEditor");
    diagramLegend = editor ? editor.innerHTML.trim() : "";
    renderLegendOverlay();
  }

  function wireLegendEditor() {
    const editor = $("legendEditor");
    if (!editor) return;
    $$(".color-btn").forEach(btn => {
      btn.addEventListener("click", () => applyTextColor(btn.dataset.color));
    });
    bindClick("addSwatchBtn", () => {
      const span = document.createElement("span");
      span.textContent = "LABEL";
      span.style.cssText = "background:#4a90e2;color:#fff;padding:2px 6px;border-radius:4px;margin-right:4px;";
      insertAtCaret(editor, span); syncLegend();
    });
    bindClick("clearLegendBtn", () => {
      if (!editor.innerHTML.trim()) return;
      if (confirm("Clear legend content?")) {
        editor.innerHTML = ""; syncLegend();
      }
    });
    bindClick("toggleLegendOverlayBtn", () => {
      legendOverlayVisible = !legendOverlayVisible; renderLegendOverlay();
    });
    bindClick("hideLegendOverlayBtn", () => {
      legendOverlayVisible = false; renderLegendOverlay();
    });
    bindClick("applyLegendTextColorBtn", () => {
      applyTextColor($("legendTextColorPicker")?.value || "#222");
    });
    bindClick("applyLegendBgColorBtn", () => {
      applyHighlightColor($("legendBgColorPicker")?.value || "#ffff66");
    });
    editor.addEventListener("input", syncLegend);
  }

  function insertAtCaret(container, node) {
    const sel = window.getSelection();
    if (sel && sel.rangeCount) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(node);
    } else container.appendChild(node);
  }
  function wrapSelection(modifier) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    if (r.collapsed) {
      const span = document.createElement("span");
      modifier(span); span.textContent = "text"; r.insertNode(span);
    } else {
      const span = document.createElement("span");
      modifier(span); span.appendChild(r.extractContents()); r.insertNode(span);
    }
    syncLegend();
  }
  function applyTextColor(c) { wrapSelection(span => span.style.color = c); }
  function applyHighlightColor(c) {
    wrapSelection(span => {
      span.style.background = c;
      span.style.padding = "2px 4px";
      span.style.borderRadius = "4px";
    });
  }

  /* ======================= Section Collapsers ================================ */
  function wireSectionCollapsers() {
    $$(".section-collapse-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const target = btn.dataset.target;
        const panel = document.querySelector(`.panel[data-panel='${target}']`);
        if (!panel) return;
        panel.classList.toggle("collapsed");
        btn.textContent = panel.classList.contains("collapsed") ? "▸" : "▾";
      });
    });
  }

  /* ====================== Edge Operator Builder ============================== */
  function buildEdgeOperator(c) {
    const def = EDGE_STYLE_DEFS[c.type] || EDGE_STYLE_DEFS.solid;
    const arrowWanted = def.forceNoArrow ? false : (c.arrow !== false);
    return arrowWanted ? def.arrowOp : def.noArrowOp;
  }

  /* =================== Mermaid Generation (Stable) ========================== */
  /*
     Ordering Lock Strategy (if ENABLE_ORDER_LOCK):
     For each lane:
       - Create hidden order nodes O_L<lane>_<i> for each system position.
       - Chain them O_Lx_0 --- O_Lx_1 --- ...
       - Connect each order node to its system subgraph id with an invisible edge:
           O_Lx_i --> <SystemSubgraphID>
     Additionally, order lanes by creating edges from first order node of lane N
     to the first order node of lane N+1 (ensuring vertical stability).
  */
  function generateMermaid() {
    if (!isImporting) nodes.forEach(n => saveNode(n.id));
    migrateLegacyPlacementIfNeeded();

    // Build systemGroups: system -> subgroup -> array of node definition lines
    const systemGroups = {};
    nodes.forEach(n => {
      const line = `${n.id}${shapeWrap(n.shape, `"${esc(n.label || n.id)}"`)}`;
      if (n.system && systems[n.system]) {
        const sg = n.subgroup || "__nogroup";
        (systemGroups[n.system] ||= {});
        (systemGroups[n.system][sg] ||= []).push(line);
      }
    });

    // Determine direction (multi-row vs single arrangement)
    const rowSet = new Set(Object.values(systems).map(s => typeof s.row === "number" ? s.row : 0));
    const multiRow = rowSet.size > 1 || Array.from(rowSet)[0] !== 0;
    const dir = multiRow ? "TD" : (systemsArrangement === "horizontal" ? "LR" : "TD");

    const lines = [];
    lines.push(`graph ${dir}`);
    lines.push("");

    // laneMap: lane -> ordered systems (in enforced canvas order)
    const laneMap = {};
    systemsOrder.forEach(sys => {
      const lane = systemPlacement[sys]?.lane ?? systems[sys]?.row ?? 0;
      (laneMap[lane] ||= []).push(sys);
    });
    const sortedLanes = Object.keys(laneMap).map(Number).sort((a, b) => a - b);

    if (multiRow) {
      sortedLanes.forEach(l => {
        const rowId = `ROW_${l}`;
        lines.push(`subgraph ${rowId}[" "]`);
        lines.push("direction LR");
        laneMap[l].forEach(sys => {
          emitSystemForMermaid(lines, sys, systemGroups[sys] || {});
        });
        lines.push("end");
        lines.push(`style ${rowId} fill:transparent,stroke:transparent`);
        lines.push("");
      });
    } else {
      sortedLanes.forEach(l => {
        laneMap[l].forEach(sys => {
          emitSystemForMermaid(lines, sys, systemGroups[sys] || {});
        });
      });
    }

    // -------- Ordering Lock (Invisible) --------
    const orderEdgeLines = [];
    const orderStylingNodes = [];
    if (ENABLE_ORDER_LOCK) {
      const orderNodesGlobal = [];
      sortedLanes.forEach(l => {
        const sysList = laneMap[l];
        if (!sysList || !sysList.length) return;

        // Create order nodes for this lane
        const laneOrderNodeIds = sysList.map((_, i) => `O_L${l}_${i}`);
        laneOrderNodeIds.forEach(id => {
          orderStylingNodes.push(id);
          // Minimal node (round) – will be hidden later
          lines.push(`${id}([" "])`);
        });

        // Chain within lane (no arrows)
        for (let i = 0; i < laneOrderNodeIds.length - 1; i++) {
          orderEdgeLines.push(`${laneOrderNodeIds[i]} --- ${laneOrderNodeIds[i + 1]}`);
        }

        // Connect each order node to its system subgraph (no arrows)
        sysList.forEach((sys, i) => {
          const clusterId = sanitizeId(sys);
          orderEdgeLines.push(`${laneOrderNodeIds[i]} --- ${clusterId}`);
        });

        orderNodesGlobal.push(laneOrderNodeIds[0]);
        lines.push("");
      });

      // Cross-lane vertical ordering (also no arrows)
      for (let i = 0; i < orderNodesGlobal.length - 1; i++) {
        orderEdgeLines.push(`${orderNodesGlobal[i]} --- ${orderNodesGlobal[i + 1]}`);
      }
    }

    // -------- User Edges & Node Styles --------
    const userEdgeLines = [];
    const nodeStyleLines = [];
    const userLinkStyles = [];
    let corruption = false;

    nodes.forEach(n => {
      nodeStyleLines.push(
        `style ${n.id} fill:${sanitizeColor(n.bgColor)},stroke:${sanitizeColor(n.outlineColor)},stroke-width:2px,color:${sanitizeColor(n.textColor)}`
      );
      n.connections.forEach(c => {
        if (!c.source) return;
        const op = buildEdgeOperator(c);
        const lbl = c.label ? `|${esc(c.label)}|` : "";
        // Index offset: ordering edges come first if enabled
        const idx = (ENABLE_ORDER_LOCK ? orderEdgeLines.length : 0) + userEdgeLines.length;
        userEdgeLines.push(`${c.source} ${op}${lbl} ${n.id}`);
        if (!window.EDGE_STYLE_SAFE_MODE) {
          const color = sanitizeColor(c.color || "#333333");
          const width = Math.min(6, Math.max(1, c.width || 2));
          const def = EDGE_STYLE_DEFS[c.type] || EDGE_STYLE_DEFS.solid;
          const parts = [`stroke:${color}`, `stroke-width:${width}px`];
          if (def.pattern === "dotted") {
            parts.push("stroke-dasharray:2 4");
          } else if (def.pattern === "double") {
            if (width < 4) parts[1] = "stroke-width:4px";
            parts.push("stroke-dasharray:4 2");
          }
          let line = `linkStyle ${idx} ${parts.join(',')};`;
          if (/[^ -~]/.test(line) || !/^#[0-9a-f]{6}$/i.test(color)) {
            corruption = true;
          } else userLinkStyles.push(line);
        }
      });
    });

    // Append ordering edges first (so their indices are 0..n-1)
    if (ENABLE_ORDER_LOCK && orderEdgeLines.length) {
      lines.push("");
      lines.push(...orderEdgeLines);
    }

    // Append user edges
    if (userEdgeLines.length) {
      lines.push("");
      lines.push(...userEdgeLines);
    }

    // Node style lines
    if (nodeStyleLines.length) {
      lines.push("");
      lines.push(...nodeStyleLines);
    }

    // System + subgroup styling (centralized)
    Object.keys(systems).forEach(sys => {
      const cfg = systems[sys];
      const sysId = sanitizeId(sys);
      lines.push(`style ${sysId} fill:${sanitizeColor(cfg.fill)},stroke:${sanitizeColor(cfg.stroke)},stroke-width:2px`);
      Object.entries(cfg.subgroups || {}).forEach(([sg, scfg]) => {
        const sgId = sanitizeId(sys + "_" + sg);
        lines.push(`style ${sgId} fill:${sanitizeColor(scfg.fill)},stroke:${sanitizeColor(scfg.stroke)},stroke-width:2px`);
      });
    });

    // Hide ordering edges & nodes (fully transparent)
    if (ENABLE_ORDER_LOCK && orderEdgeLines.length) {
      lines.push("");
      for (let i = 0; i < orderEdgeLines.length; i++) {
        lines.push(`linkStyle ${i} stroke:transparent,stroke-width:0px;`);
      }
      orderStylingNodes.forEach(id => {
        lines.push(`style ${id} fill:transparent,stroke:transparent,color:transparent`);
      });
    }

    // User link styles
    if (!window.EDGE_STYLE_SAFE_MODE && userLinkStyles.length && !corruption) {
      lines.push("");
      lines.push(...userLinkStyles);
    } else if (corruption && window.FORCE_SKIP_LINKSTYLE_IF_CORRUPT) {
      console.warn("[FlowDesigner] linkStyle corruption detected – user styles skipped.");
    }

    const src = lines.join("\n");
    window.__lastMermaidSrc = src; // for debugging if needed

    const diagram = $("diagram");
    if (!diagram) return;
    diagram.querySelectorAll("svg").forEach(s => s.remove());
    try {
      mermaid.render("flowRenderedStable", src).then(({ svg }) => {
        diagram.insertAdjacentHTML("afterbegin", svg);
        attachTooltips();
        setTimeout(attachTooltips, 50);
        if (typeof renderLegendOverlay === "function") renderLegendOverlay();
      }).catch(e => {
        diagram.innerHTML = `<pre style="color:red;">Mermaid render error: ${e.message}</pre>`;
        console.error("Mermaid render error:", e);
        console.log("Source:\n", src);
      });
    } catch (e) {
      diagram.innerHTML = `<pre style="color:red;">Render exception: ${e.message}</pre>`;
      console.error(e);
      console.log("Source:\n", src);
    }
  }

  /* Emits system subgraph (no anchors). Called by generateMermaid */
  function emitSystemForMermaid(lines, sysName, subgroupMap) {
    const cfg = systems[sysName]; if (!cfg) return;
    const baseId = sanitizeId(sysName);
    lines.push(`%% SYSTEM START: ${baseId}`);
    lines.push(`subgraph ${baseId}["${esc(sysName)}"]`);
    lines.push(cfg.layout === "horizontal" ? "direction LR" : "direction TB");

    const entries = Object.entries(subgroupMap || {});
    if (entries.length) {
      entries.forEach(([sg, items]) => {
        if (!items.length) return;
        if (sg === "__nogroup") {
          items.forEach(nl => lines.push(nl));
        } else {
          const sgId = sanitizeId(sysName + "_" + sg);
          const sgCfg = cfg.subgroups[sg] || { layout: "vertical", fill: "#eef5ff", stroke: "#9dbce6" };
          lines.push(`subgraph ${sgId}["${esc(sg)}"]`);
          lines.push(sgCfg.layout === "horizontal" ? "direction LR" : "direction TB");
          items.forEach(nl => lines.push(nl));
          lines.push("end");
          // style added later centrally
        }
      });
    }

    lines.push("end");
    lines.push(`%% SYSTEM END: ${baseId}`);
    lines.push("");
  }

  /* ============================ Tooltips ===================================== */
  function attachTooltips() {
    const svg = $("diagram")?.querySelector("svg");
    const tip = $("nodeTooltip");
    if (!svg || !tip) return;
    tip.classList.add("hidden");
    nodes.forEach(n => {
      if (!n.desc) return;
      let target = svg.querySelector(`#${CSS.escape(n.id)}`) ||
        svg.querySelector(`g#${CSS.escape(n.id)}`);
      if (!target) {
        const matches = [...svg.querySelectorAll("g")].filter(g => {
          const t = g.querySelector("text");
          return t && t.textContent === n.label;
        });
        if (matches.length === 1) target = matches[0];
      }
      if (!target) return;
      target.style.cursor = "pointer";
      const show = e => {
        tip.textContent = n.desc;
        tip.classList.remove("hidden");
        positionTooltip(e, tip, svg);
      };
      const move = e => positionTooltip(e, tip, svg);
      const hide = () => tip.classList.add("hidden");
      target.addEventListener("mouseenter", show);
      target.addEventListener("mousemove", move);
      target.addEventListener("mouseleave", hide);
    });
  }
  function positionTooltip(evt, tip, svg) {
    const rect = svg.getBoundingClientRect();
    tip.style.left = (evt.clientX - rect.left + svg.parentElement.scrollLeft) + "px";
    tip.style.top = (evt.clientY - rect.top + svg.parentElement.scrollTop) + "px";
  }

  /* ========================== Appearance Settings ============================ */
  function applyInitialSettings() {
    $("pageBgColor")?.addEventListener("change", updatePageBackground);
    $("diagramBgColor")?.addEventListener("change", updateDiagramBackground);
    $("systemsArrangementSelect")?.addEventListener("change", e => {
      systemsArrangement = e.target.value;
      generateMermaid();
    });
    updatePageBackground();
    updateDiagramBackground();
  }
  function updatePageBackground() { const v = $("pageBgColor")?.value; if (v) document.body.style.backgroundColor = v; }
  function updateDiagramBackground() { const d = $("diagram"); if (d) d.style.backgroundColor = $("diagramBgColor")?.value || "#ffffff"; }

  /* ================== Legend Export Integration ============================= */
  function buildExportLegend() {
    const include = $("exportDescriptionsChk");
    if (!include || !include.checked) return diagramLegend;
    if (!nodes.some(n => n.desc)) return diagramLegend;
    const notes = nodes.filter(n => n.desc).map(n => `<div><strong>${esc(n.label || n.id)}:</strong> ${esc(n.desc)}</div>`).join("");
    return diagramLegend +
      `<hr style="margin:4px 0;border:none;border-top:1px solid #ddd;">` +
      `<div style="font-size:11px;"><strong>Node Notes</strong><br/>${notes}</div>`;
  }

  /* ============================= Exporters ================================== */
  function downloadJSON() {
    nodes.forEach(n => saveNode(n.id));
    const data = {
      systems, systemsOrder, systemsArrangement, diagramLegend,
      systemPlacement,
      nodes: nodes.map(n => ({
        id: n.id, label: n.label, shape: n.shape, textColor: n.textColor, bgColor: n.bgColor,
        outlineColor: n.outlineColor, system: n.system, subgroup: n.subgroup, desc: n.desc,
        connections: n.connections.map(c => ({ ...c }))
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "diagram.json"; a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPNG() {
    generateMermaid();
    const diagram = $("diagram"); if (!diagram) return;
    const overlay = $("legendOverlayContent");
    const original = overlay ? overlay.innerHTML : "";
    const augmented = buildExportLegend();
    if (augmented !== diagramLegend && overlay) {
      overlay.innerHTML = augmented; $("legendOverlay")?.classList.remove("hidden");
    }
    $("nodeTooltip")?.classList.add("hidden");
    await new Promise(r => setTimeout(r, 50));
    if (typeof html2canvas === "undefined") return alert("html2canvas not loaded");
    html2canvas(diagram, { scale: 2, backgroundColor: "#ffffff" }).then(canvas => {
      canvas.toBlob(b => {
        const a = document.createElement("a");
        a.download = "diagram.png"; a.href = URL.createObjectURL(b); a.click();
        if (overlay) { overlay.innerHTML = original; renderLegendOverlay(); }
      }, "image/png");
    });
  }

  function downloadPDF() {
    generateMermaid();
    const diagram = $("diagram"); if (!diagram) return;
    const overlay = $("legendOverlayContent");
    const original = overlay ? overlay.innerHTML : "";
    const augmented = buildExportLegend();
    if (augmented !== diagramLegend && overlay) {
      overlay.innerHTML = augmented; $("legendOverlay")?.classList.remove("hidden");
    }
    $("nodeTooltip")?.classList.add("hidden");
    if (!window.jspdf) return alert("jsPDF not loaded");
    html2canvas(diagram, { scale: 2, backgroundColor: "#ffffff" }).then(canvas => {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: [canvas.width, canvas.height] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save("diagram.pdf");
      if (overlay) { overlay.innerHTML = original; renderLegendOverlay(); }
    });
  }

  function downloadSVG() {
    generateMermaid();
    const svgEl = $("diagram")?.querySelector("svg");
    if (!svgEl) { alert("Render diagram first."); return; }
    const clone = svgEl.cloneNode(true);
    const augmented = buildExportLegend();
    if (augmented) {
      const vb = clone.viewBox?.baseVal;
      const width = vb?.width || 1000;
      const height = vb?.height || 800;
      const w = 300;
      const temp = document.createElement("div");
      temp.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:300px;font:12px system-ui;";
      temp.innerHTML = augmented;
      document.body.appendChild(temp);
      const h = Math.min(Math.max(temp.getBoundingClientRect().height + 14, 40), 700);
      temp.remove();
      const x = width - w - 10, y = height - h - 10;
      const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
      fo.setAttribute("x", x); fo.setAttribute("y", y);
      fo.setAttribute("width", w); fo.setAttribute("height", h);
      const div = document.createElement("div");
      div.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
      div.style.cssText = "font:12px system-ui,Arial,sans-serif;background:rgba(255,255,255,.95);border:1px solid #d0d7de;border-radius:6px;padding:6px 8px;line-height:1.25;";
      div.innerHTML = augmented;
      fo.appendChild(div); clone.appendChild(fo);
    }
    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "diagram.svg"; a.click();
    URL.revokeObjectURL(url);
  }

  /* ============================ Help / Docs ================================== */
  function wireHelpDocs() {
    bindClick("helpQuickBtn", () => $("helpPanel")?.classList.toggle("hidden"));
    bindClick("docsBtn", () => $("docsPanel")?.classList.toggle("hidden"));
    bindClick("closeHelpBtn", () => $("helpPanel")?.classList.add("hidden"));
    bindClick("closeDocsBtn", () => $("docsPanel")?.classList.add("hidden"));
    bindClick("openDocsFromHelp", () => {
      $("helpPanel")?.classList.add("hidden");
      $("docsPanel")?.classList.remove("hidden");
    });
    $$("a[href^='#doc-']").forEach(a => {
      a.addEventListener("click", e => {
        const section = document.querySelector(a.getAttribute("href"));
        if (section) {
          e.preventDefault();
          section.scrollIntoView({ behavior: "smooth" });
        }
      });
    });
  }

  /* ============================ Top Toolbars ================================= */
  function wireTopToolbars() {
    bindClick("addNodeBtn", addNode);
    bindClick("generateBtn", generateMermaid);
    bindClick("downloadJsonBtn", downloadJSON);
    bindClick("downloadPngBtn", downloadPNG);
    bindClick("downloadPdfBtn", downloadPDF);
    bindClick("downloadSvgBtn", downloadSVG);
    $("uploadJSON")?.addEventListener("change", handleJSONUpload);

    bindClick("fabAddNodeBtn", addNode);
    bindClick("fabUpdateBtn", generateMermaid);
    bindClick("fabJsonBtn", downloadJSON);
    bindClick("fabPngBtn", downloadPNG);
    bindClick("fabPdfBtn", downloadPDF);
    bindClick("fabSvgBtn", downloadSVG);
    $("fabUploadJSON")?.addEventListener("change", handleJSONUpload);
  }

  /* ===================== Import / Normalize JSON ============================ */
  function handleJSONUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    isImporting = true;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const raw = JSON.parse(ev.target.result);
        const norm = normalizeImportedJSON(raw);
        applyImportedState(norm);
        rebuildUI_AfterImport();
        postImportPipeline();
        alert("JSON Loaded");
      } catch (err) {
        isImporting = false;
        alert("Import failed: " + err.message);
      }
    };
    reader.readAsText(file);
  }

  function normalizeImportedJSON(raw) {
    if (!raw || typeof raw !== "object") throw new Error("Root not object");
    const sysSrc = raw.systems || raw.systemMap || raw.Systems;
    if (!sysSrc || typeof sysSrc !== "object") throw new Error("Missing systems");
    const nodesSrc = Array.isArray(raw.nodes) ? raw.nodes : Array.isArray(raw.Nodes) ? raw.Nodes : null;
    if (!nodesSrc) throw new Error("Missing nodes array");

    const newSystems = {};
    Object.keys(sysSrc).forEach(k => {
      const v = sysSrc[k];
      if (!v || typeof v !== "object") return;
      const name = k.trim();
      const subgroups = {};
      const sgSrc = v.subgroups || v.Subgroups || {};
      Object.keys(sgSrc).forEach(sg => {
        const sgv = sgSrc[sg]; if (!sgv || typeof sgv !== "object") return;
        subgroups[sg.trim()] = {
          layout: sgv.layout === "horizontal" ? "horizontal" : "vertical",
          fill: sanitizeColor(sgv.fill || "#eef5ff"),
          stroke: sanitizeColor(sgv.stroke || "#9dbce6")
        };
      });
      newSystems[name] = {
        stroke: sanitizeColor(v.stroke || "#333333"),
        fill: sanitizeColor(v.fill || "#ffffff"),
        layout: v.layout === "horizontal" ? "horizontal" : "vertical",
        row: typeof v.row === "number" ? v.row : parseInt(v.row || "0", 10) || 0,
        subgroups
      };
    });

    const newNodes = nodesSrc.map(n => {
      const system = (n.system ?? n.systemName ?? n.System ?? "").trim();
      const subgroup = (n.subgroup ?? n.subGroup ?? n.Subgroup ?? n.group ?? "").trim();
      return {
        id: n.id,
        label: n.label || n.name || "",
        shape: ["rect", "round", "stadium", "subroutine", "cylinder", "circle", "diamond"].includes(n.shape) ? n.shape : "rect",
        textColor: sanitizeColor(n.textColor || "#000000"),
        bgColor: sanitizeColor(n.bgColor || "#ffffff"),
        outlineColor: sanitizeColor(n.outlineColor || "#333333"),
        system,
        subgroup,
        desc: n.desc || n.description || "",
        connections: Array.isArray(n.connections) ? n.connections.map(c => ({
          source: c.source,
          label: c.label || "",
          type: ["solid", "plain", "dashed", "dashedNo", "dotted", "dottedNo", "thick", "thickNo", "double", "none"].includes(c.type) ? c.type : "solid",
          color: sanitizeColor(c.color || "#333333"),
          width: typeof c.width === "number" ? c.width : (["thick", "thickNo", "double"].includes(c.type) ? 4 : 2),
          arrow: (c.arrow === undefined ? !/No$|none/.test(c.type) : !!c.arrow)
        })) : []
      };
    });

    newNodes.forEach(n => {
      if (n.system && !newSystems[n.system]) {
        newSystems[n.system] = { stroke: "#333333", fill: "#ffffff", layout: "vertical", row: 0, subgroups: {} };
      }
      if (n.system && n.subgroup) {
        const s = newSystems[n.system];
        if (s && !s.subgroups[n.subgroup]) {
          s.subgroups[n.subgroup] = { layout: "vertical", fill: "#eef5ff", stroke: "#9dbce6" };
        }
      }
    });

    let order = Array.isArray(raw.systemsOrder) ? raw.systemsOrder.map(s => s.trim()).filter(s => newSystems[s])
      : Array.isArray(raw.SystemsOrder) ? raw.SystemsOrder.map(s => s.trim()).filter(s => newSystems[s])
        : Object.keys(newSystems);
    Object.keys(newSystems).forEach(k => { if (!order.includes(k)) order.push(k); });

    const placementSrc = raw.systemPlacement || {};
    const newPlacement = {};
    Object.keys(newSystems).forEach(sys => {
      const p = placementSrc[sys];
      if (p && typeof p === "object") {
        newPlacement[sys] = {
          lane: typeof p.lane === "number" ? p.lane : 0,
          order: typeof p.order === "number" ? p.order : 0,
          x: 0, y: 0
        };
      }
    });

    return {
      systems: newSystems,
      systemsOrder: order,
      systemsArrangement: raw.systemsArrangement === "horizontal" ? "horizontal"
        : raw.systemsArrangement === "vertical" ? "vertical"
          : systemsArrangement,
      diagramLegend: typeof raw.diagramLegend === "string" ? raw.diagramLegend : "",
      systemPlacement: newPlacement,
      nodes: newNodes
    };
  }

  function applyImportedState(state) {
    systems = state.systems;
    systemsOrder = state.systemsOrder;
    systemsArrangement = state.systemsArrangement;
    diagramLegend = state.diagramLegend;
    systemPlacement = state.systemPlacement || {};
    nodes = state.nodes;
    nodeCount = nodes.reduce((m, n) => {
      const num = parseInt((n.id || "").replace(/^N/, ""), 10);
      return isNaN(num) ? m : Math.max(m, num + 1);
    }, 0);
    systemsOrder.forEach(s => ensurePlacement(s, "right_end"));
    recomputeXY(); rebuildSystemsOrder();
  }

  function rebuildUI_AfterImport() {
    renderSystemList();
    const nc = $("nodes-container");
    if (nc) {
      nc.innerHTML = "";
      nodes.forEach(n => nc.appendChild(buildNodeCard(n)));
    }
    if (isImporting) {
      finalizeImportNodeSelects();
    } else {
      updateSystemDropdowns();
      updateConnectDropdowns();
    }
    updateNoSystemsHint();
    const editor = $("legendEditor");
    if (editor) editor.innerHTML = diagramLegend || "";
    syncLegend();
    const layoutSel = $("systemsArrangementSelect");
    if (layoutSel) layoutSel.value = systemsArrangement;
    renderLayoutCanvas();
  }

  function finalizeImportNodeSelects() {
    updateSystemDropdowns();
    nodes.forEach(n => {
      const card = document.querySelector(`.node[data-id='${CSS.escape(n.id)}']`);
      if (!card) return;
      const sysSel = card.querySelector(".system-select");
      const sgSel = card.querySelector(".subgroup-select");
      if (sysSel) sysSel.value = n.system || "";
      if (sgSel) populateSubgroups(n.system, sgSel, n.subgroup);
    });
  }

  function postImportPipeline() {
    Object.keys(systems).forEach(s => {
      if (!systemsOrder.includes(s)) systemsOrder.push(s);
    });
    migrateLegacyPlacementIfNeeded();
    setTimeout(() => {
      try { generateMermaid(); } catch (_) { }
      isImporting = false;
    }, 0);
  }

  /* ====================== System & Node Dropdown Sync ======================= */
  function updateSystemDropdowns() {
    $$(".node .system-select").forEach(sel => {
      const cur = sel.value;
      sel.innerHTML = `<option value="">-- System --</option>` +
        Object.keys(systems).map(s => `<option value="${s}" ${s === cur ? "selected" : ""}>${s}</option>`).join("");
    });
    $$(".node .subgroup-select").forEach(sel => {
      const root = sel.closest(".node");
      const sys = root?.querySelector(".system-select")?.value;
      const cur = sel.value;
      const subs = systems[sys]?.subgroups || {};
      sel.innerHTML = `<option value="">-- Subgroup --</option>` +
        Object.keys(subs).map(sg => `<option value="${sg}" ${sg === cur ? "selected" : ""}>${sg}</option>`).join("");
    });
  }

  function updateNoSystemsHint() {
    const hint = $("noSystemsHint");
    if (hint) hint.textContent = Object.keys(systems).length ? "" : "No systems yet. Add one above.";
  }

  /* =================== End of Consolidated Script =========================== */
  // Expose APIs needed by portal/adapters
  window.generateMermaid = generateMermaid;
  window.applyImportedState = applyImportedState;
  window.rebuildUI_AfterImport = rebuildUI_AfterImport;
  window.postImportPipeline = postImportPipeline;
})();