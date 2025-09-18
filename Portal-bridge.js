/* Robust portal bridge: waits for DOM, tolerates ID variants, safe listeners */
document.addEventListener('DOMContentLoaded', () => {
    const $ = (id) => document.getElementById(id);

    const statusEl = $('portalStatus');
    const designerFrame = $('designerFrame');
    // Steps iframe may be called stepsFrame (preferred) or harnessFrame (older)
    const stepsFrame = $('stepsFrame') || $('harnessFrame');

    function setStatus(msg) {
        if (statusEl) statusEl.textContent = msg;
        console.log('[Portal]', msg);
    }

    // Tab buttons: support either "tabHarnessBtn" (older) or "tabStepsBtn" (newer)
    const tabDesignerBtn = $('tabDesignerBtn');
    const tabStepsBtn = $('tabStepsBtn') || $('tabHarnessBtn');

    function switchTab(which) {
        const isDesigner = which === 'designer';
        const paneDesigner = $('paneDesigner');
        const paneSteps = $('paneSteps') || $('paneHarness');

        if (tabDesignerBtn) {
            tabDesignerBtn.classList.toggle('active', isDesigner);
            tabDesignerBtn.setAttribute('aria-selected', String(isDesigner));
        }
        if (tabStepsBtn) {
            tabStepsBtn.classList.toggle('active', !isDesigner);
            tabStepsBtn.setAttribute('aria-selected', String(!isDesigner));
        }
        if (paneDesigner) paneDesigner.classList.toggle('active', isDesigner);
        if (paneSteps) paneSteps.classList.toggle('active', !isDesigner);
    }

    if (tabDesignerBtn) tabDesignerBtn.addEventListener('click', () => switchTab('designer'));
    if (tabStepsBtn) tabStepsBtn.addEventListener('click', () => switchTab('steps'));

    // Sync buttons: support either naming style
    const syncToStepsBtn = $('syncToStepsBtn') || $('syncToHarnessBtn');
    const syncToDesignerBtn = $('syncToDesignerBtn') || $('syncToShapesBtn');

    function postToDesigner(msg) {
        if (!designerFrame?.contentWindow) return;
        designerFrame.contentWindow.postMessage(msg, '*');
    }
    function postToSteps(msg) {
        if (!stepsFrame?.contentWindow) return;
        stepsFrame.contentWindow.postMessage(msg, '*');
    }

    if (syncToStepsBtn) {
        syncToStepsBtn.addEventListener('click', () => {
            setStatus('Requesting Designer state...');
            postToDesigner({ type: 'portal:getDesignerState' });
        });
    }
    if (syncToDesignerBtn) {
        syncToDesignerBtn.addEventListener('click', () => {
            setStatus('Requesting Steps/Harness state...');
            postToSteps({ type: 'portal:getHarnessState' }); // Steps app uses harness adapter API
        });
    }

    // Message relay
    window.addEventListener('message', (e) => {
        const msg = e.data || {};
        // Designer -> Portal
        if (msg.type === 'portal:designerState') {
            setStatus('Designer state received. Sending to Steps/Harness...');
            postToSteps({ type: 'portal:applyDesignerState', payload: msg.payload });
        }
        if (msg.type === 'portal:designerAppliedHarnessState') {
            setStatus('Designer updated from Steps/Harness.');
        }
        // Steps/Harness -> Portal
        if (msg.type === 'portal:harnessState') {
            setStatus('Steps/Harness state received. Sending to Designer...');
            postToDesigner({ type: 'portal:applyHarnessState', payload: msg.payload });
        }
        if (msg.type === 'portal:harnessAppliedDesignerState') {
            setStatus('Steps/Harness updated from Designer.');
        }
    });

    // Initial state
    switchTab('designer');
    setStatus('Ready');
});