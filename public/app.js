// Social Identity Mapping App - Guided Flow
(function() {
  'use strict';

  // ==================== STATE ====================
  let state = {
    sessionId: null,
    createdAt: null,
    updatedAt: null,
    currentStep: 0,
    groups: [],      // { id, name, importance, positivity, contact, tenure, representativeness, x, y }
    connections: []  // { from, to, type }
  };

  let saveTimeout = null;
  let dragState = null;
  let drawingConnection = null;
  let pendingConnection = null;

  // ==================== DOM HELPERS ====================
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  // ==================== INITIALIZATION ====================
  function init() {
    // Get session ID from URL
    const params = new URLSearchParams(window.location.search);
    state.sessionId = params.get('session') || generateId('sim_');

    if (!params.get('session')) {
      const newUrl = `${window.location.pathname}?session=${state.sessionId}`;
      window.history.replaceState({}, '', newUrl);
    }

    $('session-display').textContent = state.sessionId;

    // Load existing session
    loadSession();

    // Bind all event listeners
    bindEvents();
  }

  function generateId(prefix = '') {
    return prefix + Math.random().toString(36).substr(2, 9);
  }

  // ==================== SESSION MANAGEMENT ====================
  async function loadSession() {
    // Try localStorage first
    const localData = localStorage.getItem(`sim_${state.sessionId}`);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        Object.assign(state, parsed);
      } catch (e) {
        console.error('Failed to parse local data');
      }
    }

    // Then try server
    try {
      const res = await fetch(`/api/session/${state.sessionId}`);
      if (res.ok) {
        const serverData = await res.json();
        if (!state.updatedAt || serverData.updatedAt > state.updatedAt) {
          Object.assign(state, serverData);
        }
      }
    } catch (e) {
      console.log('Server unavailable, using local data');
    }

    // If we have existing data, resume from last step
    if (state.groups.length > 0 && state.currentStep > 0) {
      goToStep(state.currentStep);
    }
  }

  function saveSession() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      state.updatedAt = new Date().toISOString();
      if (!state.createdAt) {
        state.createdAt = state.updatedAt;
      }

      localStorage.setItem(`sim_${state.sessionId}`, JSON.stringify(state));

      try {
        await fetch(`/api/session/${state.sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        });
      } catch (e) {
        console.log('Server save failed, data saved locally');
      }
    }, 500);
  }

  // ==================== NAVIGATION ====================
  function goToStep(stepNum) {
    state.currentStep = stepNum;
    saveSession();

    // Hide all steps
    $$('.step-screen').forEach(s => s.classList.remove('active'));

    // Show target step
    const targetId = stepNum === 0 ? 'step-landing' : `step-${stepNum}`;
    $(targetId).classList.add('active');

    // Show/hide progress header
    $('progress-header').classList.toggle('hidden', stepNum === 0);

    // Show/hide researcher link (only on landing page)
    $('researcher-link').classList.toggle('hidden', stepNum !== 0);

    // Update progress bar
    if (stepNum > 0) {
      const progress = ((stepNum - 1) / 5) * 100;
      $('progress-fill').style.width = progress + '%';

      // Update step indicators
      $$('.progress-steps .step').forEach(s => {
        const sNum = parseInt(s.dataset.step);
        s.classList.toggle('active', sNum === stepNum);
        s.classList.toggle('completed', sNum < stepNum);
      });
    }

    // Render step-specific content
    if (stepNum === 1) renderStep1();
    if (stepNum === 2) renderStep2();
    if (stepNum === 3) renderStep3();
    if (stepNum === 4) renderStep4();
    if (stepNum === 5) renderStep5();
    if (stepNum === 6) renderStep6();
  }

  // ==================== EVENT BINDING ====================
  function bindEvents() {
    // Landing
    $('start-btn').addEventListener('click', () => goToStep(1));

    // Step 1: Identify Groups
    $('add-group-btn').addEventListener('click', addGroup);
    $('new-group-input').addEventListener('keypress', e => {
      if (e.key === 'Enter') addGroup();
    });
    $('step1-next').addEventListener('click', () => goToStep(2));

    // Step 2: Importance
    $('step2-back').addEventListener('click', () => goToStep(1));
    $('step2-next').addEventListener('click', () => goToStep(3));

    // Step 3: Details
    $('step3-back').addEventListener('click', () => goToStep(2));
    $('step3-next').addEventListener('click', () => goToStep(4));

    // Step 4: Position
    $('step4-back').addEventListener('click', () => goToStep(3));
    $('step4-next').addEventListener('click', () => goToStep(5));

    // Step 5: Connections
    $('step5-back').addEventListener('click', () => goToStep(4));
    $('step5-next').addEventListener('click', () => goToStep(6));

    // Step 6: Complete
    $('download-btn').addEventListener('click', downloadData);
    $('back-to-edit').addEventListener('click', () => goToStep(5));

    // Connection Modal
    $('cancel-conn-btn').addEventListener('click', closeConnectionModal);
    $('remove-conn-btn').addEventListener('click', removeConnection);
    $$('.conn-option-compact').forEach(btn => {
      btn.addEventListener('click', () => setConnectionType(btn.dataset.type));
    });
    $('connection-modal').querySelector('.modal-backdrop').addEventListener('click', closeConnectionModal);

    // Global mouse events for dragging
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  // ==================== STEP 1: IDENTIFY GROUPS ====================
  function addGroup() {
    const input = $('new-group-input');
    const name = input.value.trim();

    if (!name) return;

    // Check for duplicates
    if (state.groups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
      input.select();
      return;
    }

    state.groups.push({
      id: generateId('g_'),
      name: name,
      importance: null,  // No default - user must select
      positivity: null,
      contact: null,
      tenure: null,
      representativeness: null,
      x: null,
      y: null
    });

    input.value = '';
    input.focus();
    renderStep1();
    saveSession();
  }

  function removeGroup(groupId) {
    state.groups = state.groups.filter(g => g.id !== groupId);
    state.connections = state.connections.filter(c => c.from !== groupId && c.to !== groupId);
    renderStep1();
    saveSession();
  }

  function renderStep1() {
    const list = $('groups-list');
    const count = $('groups-count');
    const hint = $('groups-hint');
    const nextBtn = $('step1-next');

    count.textContent = state.groups.length;
    hint.classList.toggle('hidden', state.groups.length > 0);
    nextBtn.disabled = state.groups.length === 0;

    list.innerHTML = state.groups.map(g => `
      <li>
        <span class="group-name">${escapeHtml(g.name)}</span>
        <button class="remove-btn" data-id="${g.id}" title="Remove">&times;</button>
      </li>
    `).join('');

    list.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => removeGroup(btn.dataset.id));
    });
  }

  // ==================== STEP 2: IMPORTANCE ====================
  function renderStep2() {
    const list = $('importance-list');

    list.innerHTML = state.groups.map(g => `
      <div class="importance-item" data-id="${g.id}">
        <span class="group-name">${escapeHtml(g.name)}</span>
        <div class="importance-buttons">
          <button class="importance-btn high ${g.importance === 'high' ? 'selected' : ''}" data-value="high">
            Very Important
          </button>
          <button class="importance-btn medium ${g.importance === 'medium' ? 'selected' : ''}" data-value="medium">
            Moderate
          </button>
          <button class="importance-btn low ${g.importance === 'low' ? 'selected' : ''}" data-value="low">
            Less Important
          </button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.importance-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.importance-item');
        const groupId = item.dataset.id;
        const value = btn.dataset.value;

        // Update state
        const group = state.groups.find(g => g.id === groupId);
        if (group) group.importance = value;

        // Update UI
        item.querySelectorAll('.importance-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');

        updateStep2NextButton();
        saveSession();
      });
    });

    updateStep2NextButton();
  }

  function updateStep2NextButton() {
    const allRated = state.groups.every(g => g.importance !== null);
    $('step2-next').disabled = !allRated;
    $('importance-hint').classList.toggle('hidden', allRated);
  }

  // ==================== STEP 3: DETAILS ====================
  function renderStep3() {
    const tbody = $('details-tbody');

    tbody.innerHTML = state.groups.map(g => `
      <tr data-id="${g.id}">
        <td>${escapeHtml(g.name)}</td>
        <td><input type="number" min="1" max="10" ${g.positivity !== null ? `value="${g.positivity}"` : ''} data-field="positivity" placeholder="1-10"></td>
        <td><input type="number" min="0" max="30" ${g.contact !== null ? `value="${g.contact}"` : ''} data-field="contact" placeholder="0-30"></td>
        <td><input type="number" min="0" step="0.5" ${g.tenure !== null ? `value="${g.tenure}"` : ''} data-field="tenure" placeholder="years"></td>
        <td><input type="number" min="1" max="10" ${g.representativeness !== null ? `value="${g.representativeness}"` : ''} data-field="representativeness" placeholder="1-10"></td>
      </tr>
    `).join('');

    // Handle input changes
    tbody.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        const row = input.closest('tr');
        const groupId = row.dataset.id;
        const field = input.dataset.field;
        const value = input.value ? parseFloat(input.value) : null;

        const group = state.groups.find(g => g.id === groupId);
        if (group) {
          group[field] = value;
          saveSession();
        }
      });
    });
  }

  // ==================== STEP 4: POSITION GROUPS ====================
  function renderStep4() {
    const canvas = $('groups-canvas-4');
    const container = $('canvas-container-step4');
    const tutorial = $('drag-tutorial-4');

    // Initialize "Me" position if not set
    if (state.meX === undefined || state.meX === null) {
      state.meX = 400;
      state.meY = 250;
    }

    // Initialize positions if not set
    state.groups.forEach((g, i) => {
      if (g.x === null || g.y === null) {
        // Spread groups around
        const angle = (i / state.groups.length) * 2 * Math.PI;
        const radius = 180;
        g.x = state.meX + Math.cos(angle) * radius - 50;
        g.y = state.meY + Math.sin(angle) * radius - 50;
      }
    });

    renderGroupCards(canvas, true);
    renderMeBlock(canvas, true);

    // Show tutorial once
    if (!state.tutorialStep4Shown) {
      tutorial.classList.remove('hidden');
      tutorial.addEventListener('click', () => {
        tutorial.classList.add('hidden');
        state.tutorialStep4Shown = true;
        saveSession();
      }, { once: true });

      // Auto-hide after 3 seconds
      setTimeout(() => {
        tutorial.classList.add('hidden');
        state.tutorialStep4Shown = true;
        saveSession();
      }, 3000);
    } else {
      tutorial.classList.add('hidden');
    }
  }

  function renderMeBlock(canvas, draggable = false) {
    renderMeBlockWithState(canvas, state, draggable);
  }

  function renderMeBlockWithState(canvas, stateObj, draggable = false) {
    // Remove existing me block
    const existing = canvas.querySelector('.me-block');
    if (existing) existing.remove();

    const meBlock = document.createElement('div');
    meBlock.className = 'me-block' + (draggable ? '' : ' locked');
    meBlock.textContent = 'Me';
    meBlock.style.left = (stateObj.meX - 30) + 'px';
    meBlock.style.top = (stateObj.meY - 30) + 'px';

    if (draggable) {
      meBlock.addEventListener('mousedown', e => startMeDrag(e, canvas));
    }

    canvas.appendChild(meBlock);
  }

  let meDragState = null;

  function startMeDrag(e, canvas) {
    const meBlock = canvas.querySelector('.me-block');
    const rect = meBlock.getBoundingClientRect();
    const containerRect = canvas.parentElement.getBoundingClientRect();

    meDragState = {
      canvas,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      containerRect
    };

    meBlock.classList.add('dragging');
  }

  function renderGroupCards(canvas, draggable = false) {
    renderGroupCardsWithState(canvas, state, draggable);
  }

  function renderGroupCardsWithState(canvas, stateObj, draggable = false) {
    canvas.innerHTML = '';

    stateObj.groups.forEach(g => {
      const card = document.createElement('div');
      card.className = `group-card size-${g.importance || 'medium'}`;
      card.dataset.id = g.id;
      card.style.left = g.x + 'px';
      card.style.top = g.y + 'px';

      const displayVal = v => v !== null && v !== undefined ? v : '?';

      card.innerHTML = `
        <span class="card-corner tl">${displayVal(g.positivity)}</span>
        <span class="card-corner tr">${displayVal(g.contact)}</span>
        <span class="card-name">${escapeHtml(g.name)}</span>
        <span class="card-corner bl">${displayVal(g.tenure)}</span>
        <span class="card-corner br">${displayVal(g.representativeness)}</span>
      `;

      if (draggable) {
        card.addEventListener('mousedown', e => startDrag(e, g.id, canvas));
      }

      canvas.appendChild(card);
    });
  }

  // ==================== STEP 5: CONNECTIONS ====================
  function renderStep5() {
    const canvas = $('groups-canvas-5');
    const container = $('canvas-container-step5');
    const tutorial = $('drag-tutorial-5');

    renderGroupCards(canvas, false);
    renderMeBlock(canvas, false); // Me is locked in step 5
    renderConnections();

    // Setup connection drawing from groups
    canvas.querySelectorAll('.group-card').forEach(card => {
      card.addEventListener('mousedown', e => startDrawingConnection(e, card.dataset.id, container));
    });

    // Setup connection drawing from Me block
    const meBlock = canvas.querySelector('.me-block');
    if (meBlock) {
      meBlock.addEventListener('mousedown', e => startDrawingConnection(e, 'me', container));
    }

    // Show tutorial once
    if (!state.tutorialStep5Shown) {
      tutorial.classList.remove('hidden');
      tutorial.addEventListener('click', () => {
        tutorial.classList.add('hidden');
        state.tutorialStep5Shown = true;
        saveSession();
      }, { once: true });

      // Auto-hide after 3 seconds
      setTimeout(() => {
        tutorial.classList.add('hidden');
        state.tutorialStep5Shown = true;
        saveSession();
      }, 3000);
    } else {
      tutorial.classList.add('hidden');
    }
  }

  function renderConnections() {
    const svg = $('connections-svg');
    const canvas = $('groups-canvas-5') || $('final-groups-canvas');

    svg.innerHTML = '';

    // Clear old labels
    const container = svg.parentElement;
    container.querySelectorAll('.connection-label').forEach(l => l.remove());

    state.connections.forEach(conn => {
      let x1, y1, x2, y2;

      // Handle Me as from
      if (conn.from === 'me') {
        x1 = state.meX;
        y1 = state.meY;
      } else {
        const fromGroup = state.groups.find(g => g.id === conn.from);
        const fromCard = canvas.querySelector(`[data-id="${conn.from}"]`);
        if (!fromGroup || !fromCard) return;
        x1 = fromGroup.x + fromCard.offsetWidth / 2;
        y1 = fromGroup.y + fromCard.offsetHeight / 2;
      }

      // Handle Me as to
      if (conn.to === 'me') {
        x2 = state.meX;
        y2 = state.meY;
      } else {
        const toGroup = state.groups.find(g => g.id === conn.to);
        const toCard = canvas.querySelector(`[data-id="${conn.to}"]`);
        if (!toGroup || !toCard) return;
        x2 = toGroup.x + toCard.offsetWidth / 2;
        y2 = toGroup.y + toCard.offsetHeight / 2;
      }

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', `connection-line conn-${conn.type}`);
      path.setAttribute('d', getConnectionPath(x1, y1, x2, y2, conn.type));
      path.setAttribute('fill', 'none');
      path.dataset.from = conn.from;
      path.dataset.to = conn.to;

      path.addEventListener('click', () => {
        pendingConnection = { from: conn.from, to: conn.to, existing: true };
        showConnectionModal();
      });

      svg.appendChild(path);

      // Add label at midpoint
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const labelText = conn.type === 'easy' ? 'Very Easy' :
                        conn.type === 'moderate' ? 'Moderate' : 'Not Easy';

      const labelDiv = document.createElement('div');
      labelDiv.className = 'connection-label';
      labelDiv.style.left = midX + 'px';
      labelDiv.style.top = midY + 'px';
      labelDiv.style.transform = 'translate(-50%, -50%)';
      labelDiv.textContent = labelText;

      container.appendChild(labelDiv);
    });
  }

  function getConnectionPath(x1, y1, x2, y2, type) {
    if (type === 'easy') {
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    } else if (type === 'moderate') {
      // Wavy line
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const amp = 15;
      const waves = Math.max(2, Math.floor(dist / 50));

      let d = `M ${x1} ${y1}`;
      for (let i = 1; i <= waves * 2; i++) {
        const t = i / (waves * 2);
        const px = x1 + dx * t;
        const py = y1 + dy * t;
        const offset = amp * (i % 2 === 0 ? 1 : -1);
        const perpX = -dy / dist * offset;
        const perpY = dx / dist * offset;

        if (i === waves * 2) {
          d += ` L ${x2} ${y2}`;
        } else {
          d += ` Q ${px + perpX} ${py + perpY} ${x1 + dx * (t + 0.5 / (waves * 2))} ${y1 + dy * (t + 0.5 / (waves * 2))}`;
        }
      }
      return d;
    } else {
      // Jagged line
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const amp = 12;
      const segments = Math.max(3, Math.floor(dist / 30));

      let d = `M ${x1} ${y1}`;
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        const px = x1 + dx * t;
        const py = y1 + dy * t;

        if (i < segments) {
          const offset = amp * (i % 2 === 0 ? 1 : -1);
          const perpX = -dy / dist * offset;
          const perpY = dx / dist * offset;
          d += ` L ${px + perpX} ${py + perpY}`;
        } else {
          d += ` L ${x2} ${y2}`;
        }
      }
      return d;
    }
  }

  function startDrawingConnection(e, groupId, container) {
    e.preventDefault();
    e.stopPropagation();

    let startX, startY;

    if (groupId === 'me') {
      startX = state.meX;
      startY = state.meY;
    } else {
      const group = state.groups.find(g => g.id === groupId);
      const card = container.querySelector(`[data-id="${groupId}"]`);
      startX = group.x + card.offsetWidth / 2;
      startY = group.y + card.offsetHeight / 2;
    }

    drawingConnection = {
      fromId: groupId,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      container
    };

    updateDrawingLine();
  }

  function updateDrawingLine() {
    const svg = $('drawing-svg');
    if (!drawingConnection) {
      svg.innerHTML = '';
      return;
    }

    svg.innerHTML = `
      <line x1="${drawingConnection.startX}" y1="${drawingConnection.startY}"
            x2="${drawingConnection.currentX}" y2="${drawingConnection.currentY}" />
    `;
  }

  function finishDrawingConnection(toGroupId) {
    if (!drawingConnection || drawingConnection.fromId === toGroupId) {
      drawingConnection = null;
      updateDrawingLine();
      return;
    }

    // Normalize: if one is 'me', make sure 'me' is always 'from'
    let fromId = drawingConnection.fromId;
    let toId = toGroupId;
    if (toId === 'me') {
      fromId = 'me';
      toId = drawingConnection.fromId;
    }

    // Check if connection already exists
    const existing = state.connections.find(c =>
      (c.from === fromId && c.to === toId) ||
      (c.from === toId && c.to === fromId)
    );

    pendingConnection = {
      from: fromId,
      to: toId,
      existing: !!existing
    };

    drawingConnection = null;
    updateDrawingLine();
    showConnectionModal();
  }

  function showConnectionModal() {
    const fromIsMe = pendingConnection.from === 'me';
    const toGroup = state.groups.find(g => g.id === pendingConnection.to);
    const fromGroup = fromIsMe ? null : state.groups.find(g => g.id === pendingConnection.from);

    let questionText;
    if (fromIsMe) {
      questionText = `How easy is it for you to belong to <strong>${toGroup.name}</strong>?`;
    } else {
      questionText = `How easy is it to be a member of both <strong>${fromGroup.name}</strong> and <strong>${toGroup.name}</strong> at the same time?`;
    }

    $('modal-question').innerHTML = questionText;
    $('remove-conn-btn').classList.toggle('hidden', !pendingConnection.existing);
    $('connection-modal').classList.remove('hidden');
  }

  function closeConnectionModal() {
    $('connection-modal').classList.add('hidden');
    pendingConnection = null;
  }

  function setConnectionType(type) {
    if (!pendingConnection) return;

    // Remove existing connection if any
    state.connections = state.connections.filter(c =>
      !((c.from === pendingConnection.from && c.to === pendingConnection.to) ||
        (c.from === pendingConnection.to && c.to === pendingConnection.from))
    );

    // Add new connection
    state.connections.push({
      from: pendingConnection.from,
      to: pendingConnection.to,
      type
    });

    saveSession();
    closeConnectionModal();
    clearConnectionLabels();
    renderConnections();
  }

  function removeConnection() {
    if (!pendingConnection) return;

    state.connections = state.connections.filter(c =>
      !((c.from === pendingConnection.from && c.to === pendingConnection.to) ||
        (c.from === pendingConnection.to && c.to === pendingConnection.from))
    );

    saveSession();
    closeConnectionModal();
    clearConnectionLabels();
    renderConnections();
  }

  function clearConnectionLabels() {
    $$('.connection-label').forEach(l => l.remove());
  }

  // ==================== STEP 6: COMPLETE ====================
  function renderStep6() {
    $('final-groups').textContent = state.groups.length;
    $('final-connections').textContent = state.connections.length;

    // Render final preview
    const canvas = $('final-groups-canvas');
    const svg = $('final-connections-svg');
    const container = $('final-canvas-container');

    // Clear old labels
    container.querySelectorAll('.connection-label').forEach(l => l.remove());

    // Calculate bounds to fit all content
    let minX = state.meX - 30, minY = state.meY - 30;
    let maxX = state.meX + 30, maxY = state.meY + 30;

    state.groups.forEach(g => {
      const size = g.importance === 'high' ? 130 : g.importance === 'low' ? 75 : 100;
      if (g.x < minX) minX = g.x;
      if (g.y < minY) minY = g.y;
      if (g.x + size > maxX) maxX = g.x + size;
      if (g.y + size > maxY) maxY = g.y + size;
    });

    const contentWidth = maxX - minX + 40;
    const contentHeight = maxY - minY + 40;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Calculate scale to fit
    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

    // Apply transform
    canvas.style.transform = `scale(${scale})`;
    canvas.style.width = contentWidth + 'px';
    canvas.style.height = contentHeight + 'px';
    svg.style.transform = `scale(${scale})`;
    svg.style.width = contentWidth + 'px';
    svg.style.height = contentHeight + 'px';

    // Offset to center
    const offsetX = (containerWidth - contentWidth * scale) / 2;
    const offsetY = (containerHeight - contentHeight * scale) / 2;
    canvas.style.transformOrigin = 'top left';
    canvas.style.left = offsetX + 'px';
    canvas.style.top = offsetY + 'px';
    svg.style.transformOrigin = 'top left';
    svg.style.left = offsetX + 'px';
    svg.style.top = offsetY + 'px';

    // Adjust positions for rendering (offset by minX, minY)
    const offsetState = {
      ...state,
      meX: state.meX - minX + 20,
      meY: state.meY - minY + 20,
      groups: state.groups.map(g => ({
        ...g,
        x: g.x - minX + 20,
        y: g.y - minY + 20
      }))
    };

    renderGroupCardsWithState(canvas, offsetState);
    renderMeBlockWithState(canvas, offsetState);

    // Wait for cards to render before drawing connections
    requestAnimationFrame(() => {
      svg.innerHTML = '';

      state.connections.forEach(conn => {
        let x1, y1, x2, y2;

        // Handle Me as from
        if (conn.from === 'me') {
          x1 = offsetState.meX;
          y1 = offsetState.meY;
        } else {
          const fromGroup = offsetState.groups.find(g => g.id === conn.from);
          const fromCard = canvas.querySelector(`[data-id="${conn.from}"]`);
          if (!fromGroup || !fromCard) return;
          x1 = fromGroup.x + fromCard.offsetWidth / 2;
          y1 = fromGroup.y + fromCard.offsetHeight / 2;
        }

        // Handle Me as to
        if (conn.to === 'me') {
          x2 = offsetState.meX;
          y2 = offsetState.meY;
        } else {
          const toGroup = offsetState.groups.find(g => g.id === conn.to);
          const toCard = canvas.querySelector(`[data-id="${conn.to}"]`);
          if (!toGroup || !toCard) return;
          x2 = toGroup.x + toCard.offsetWidth / 2;
          y2 = toGroup.y + toCard.offsetHeight / 2;
        }

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', `connection-line conn-${conn.type}`);
        path.setAttribute('d', getConnectionPath(x1, y1, x2, y2, conn.type));
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      });

      // Add connection labels (scaled with transform, so use offset positions)
      state.connections.forEach(conn => {
        let x1, y1, x2, y2;

        if (conn.from === 'me') {
          x1 = offsetState.meX;
          y1 = offsetState.meY;
        } else {
          const fromGroup = offsetState.groups.find(g => g.id === conn.from);
          const fromCard = canvas.querySelector(`[data-id="${conn.from}"]`);
          if (!fromGroup || !fromCard) return;
          x1 = fromGroup.x + fromCard.offsetWidth / 2;
          y1 = fromGroup.y + fromCard.offsetHeight / 2;
        }

        if (conn.to === 'me') {
          x2 = offsetState.meX;
          y2 = offsetState.meY;
        } else {
          const toGroup = offsetState.groups.find(g => g.id === conn.to);
          const toCard = canvas.querySelector(`[data-id="${conn.to}"]`);
          if (!toGroup || !toCard) return;
          x2 = toGroup.x + toCard.offsetWidth / 2;
          y2 = toGroup.y + toCard.offsetHeight / 2;
        }

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const labelText = conn.type === 'easy' ? 'Very Easy' :
                          conn.type === 'moderate' ? 'Moderate' : 'Not Easy';

        const labelDiv = document.createElement('div');
        labelDiv.className = 'connection-label';
        labelDiv.style.left = midX + 'px';
        labelDiv.style.top = midY + 'px';
        labelDiv.style.transform = 'translate(-50%, -50%)';
        labelDiv.textContent = labelText;

        $('final-canvas-container').appendChild(labelDiv);
      });
    });
  }

  function downloadData() {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `social-identity-map-${state.sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ==================== DRAG HANDLING ====================
  function startDrag(e, groupId, canvas) {
    const card = canvas.querySelector(`[data-id="${groupId}"]`);
    const rect = card.getBoundingClientRect();
    const containerRect = canvas.parentElement.getBoundingClientRect();

    dragState = {
      groupId,
      canvas,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      containerRect
    };

    card.classList.add('dragging');
  }

  function handleMouseMove(e) {
    if (dragState) {
      const card = dragState.canvas.querySelector(`[data-id="${dragState.groupId}"]`);
      const group = state.groups.find(g => g.id === dragState.groupId);

      let x = e.clientX - dragState.containerRect.left - dragState.offsetX;
      let y = e.clientY - dragState.containerRect.top - dragState.offsetY;

      // Constrain to container
      x = Math.max(0, Math.min(x, dragState.containerRect.width - card.offsetWidth));
      y = Math.max(0, Math.min(y, dragState.containerRect.height - card.offsetHeight));

      card.style.left = x + 'px';
      card.style.top = y + 'px';

      group.x = x;
      group.y = y;
    }

    if (meDragState) {
      const meBlock = meDragState.canvas.querySelector('.me-block');

      let x = e.clientX - meDragState.containerRect.left - meDragState.offsetX + 30;
      let y = e.clientY - meDragState.containerRect.top - meDragState.offsetY + 30;

      // Constrain to container
      x = Math.max(30, Math.min(x, meDragState.containerRect.width - 30));
      y = Math.max(30, Math.min(y, meDragState.containerRect.height - 30));

      meBlock.style.left = (x - 30) + 'px';
      meBlock.style.top = (y - 30) + 'px';

      state.meX = x;
      state.meY = y;
    }

    if (drawingConnection) {
      const rect = drawingConnection.container.getBoundingClientRect();
      drawingConnection.currentX = e.clientX - rect.left;
      drawingConnection.currentY = e.clientY - rect.top;
      updateDrawingLine();
    }
  }

  function handleMouseUp(e) {
    if (dragState) {
      const card = dragState.canvas.querySelector(`[data-id="${dragState.groupId}"]`);
      card.classList.remove('dragging');
      dragState = null;
      saveSession();
    }

    if (meDragState) {
      const meBlock = meDragState.canvas.querySelector('.me-block');
      meBlock.classList.remove('dragging');
      meDragState = null;
      saveSession();
    }

    if (drawingConnection) {
      // Check if we're over a group card or Me block
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const card = target?.closest('.group-card');
      const meBlock = target?.closest('.me-block');

      if (card && card.dataset.id !== drawingConnection.fromId) {
        finishDrawingConnection(card.dataset.id);
      } else if (meBlock && drawingConnection.fromId !== 'me') {
        finishDrawingConnection('me');
      } else {
        drawingConnection = null;
        updateDrawingLine();
      }
    }
  }

  // ==================== UTILITIES ====================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== START ====================
  init();
})();
