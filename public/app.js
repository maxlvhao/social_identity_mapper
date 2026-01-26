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
    $$('.conn-option').forEach(btn => {
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
    const list = $('details-list');

    list.innerHTML = state.groups.map((g, i) => `
      <div class="detail-item ${i === 0 ? 'expanded' : ''}" data-id="${g.id}">
        <div class="detail-item-header">
          <div class="group-info">
            <div class="group-swatch importance-${g.importance || 'medium'}"></div>
            <span class="group-name">${escapeHtml(g.name)}</span>
          </div>
          <span class="toggle-icon">▼</span>
        </div>
        <div class="detail-item-body">
          <div class="detail-fields">
            <div class="detail-field">
              <label>Positivity</label>
              <input type="number" min="1" max="10" ${g.positivity !== null ? `value="${g.positivity}"` : ''} data-field="positivity" placeholder="1-10" required>
              <div class="field-hint">How positive do you feel about being a member of this group?<br><em>1 = not at all positive, 10 = very positive</em></div>
            </div>
            <div class="detail-field">
              <label>Contact (days per month)</label>
              <input type="number" min="0" max="30" ${g.contact !== null ? `value="${g.contact}"` : ''} data-field="contact" placeholder="0-30" required>
              <div class="field-hint">In a typical month, how many days would you engage in activities related to this group?<br><em>0 = never, 30 = every day</em></div>
            </div>
            <div class="detail-field">
              <label>Tenure (years)</label>
              <input type="number" min="0" step="0.5" ${g.tenure !== null ? `value="${g.tenure}"` : ''} data-field="tenure" placeholder="e.g., 2.5" required>
              <div class="field-hint">How many years have you been a member of this group?<br><em>Use decimals for months (e.g., 0.5 = 6 months)</em></div>
            </div>
            <div class="detail-field">
              <label>Representativeness</label>
              <input type="number" min="1" max="10" ${g.representativeness !== null ? `value="${g.representativeness}"` : ''} data-field="representativeness" placeholder="1-10" required>
              <div class="field-hint">How well do you represent or exemplify what it means to be a member of this group?<br><em>1 = not at all, 10 = very well</em></div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    // Toggle expand/collapse
    list.querySelectorAll('.detail-item-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.detail-item');
        item.classList.toggle('expanded');
      });
    });

    // Handle input changes
    list.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        const item = input.closest('.detail-item');
        const groupId = item.dataset.id;
        const field = input.dataset.field;
        const value = parseFloat(input.value) || 0;

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

    // Initialize positions if not set
    const containerRect = container.getBoundingClientRect();
    state.groups.forEach((g, i) => {
      if (g.x === null || g.y === null) {
        // Spread groups in a grid pattern
        const cols = Math.ceil(Math.sqrt(state.groups.length));
        const row = Math.floor(i / cols);
        const col = i % cols;
        const spacing = 150;
        g.x = 50 + col * spacing;
        g.y = 50 + row * spacing;
      }
    });

    renderGroupCards(canvas, true);
  }

  function renderGroupCards(canvas, draggable = false) {
    canvas.innerHTML = '';

    state.groups.forEach(g => {
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
    renderGroupCards(canvas, false);
    renderConnections();

    // Setup connection drawing
    const container = $('canvas-container-step5');

    canvas.querySelectorAll('.group-card').forEach(card => {
      card.addEventListener('mousedown', e => startDrawingConnection(e, card.dataset.id, container));
    });
  }

  function renderConnections() {
    const svg = $('connections-svg');
    const canvas = $('groups-canvas-5') || $('final-groups-canvas');

    svg.innerHTML = '';

    state.connections.forEach(conn => {
      const fromGroup = state.groups.find(g => g.id === conn.from);
      const toGroup = state.groups.find(g => g.id === conn.to);
      if (!fromGroup || !toGroup) return;

      const fromCard = canvas.querySelector(`[data-id="${conn.from}"]`);
      const toCard = canvas.querySelector(`[data-id="${conn.to}"]`);
      if (!fromCard || !toCard) return;

      const x1 = fromGroup.x + fromCard.offsetWidth / 2;
      const y1 = fromGroup.y + fromCard.offsetHeight / 2;
      const x2 = toGroup.x + toCard.offsetWidth / 2;
      const y2 = toGroup.y + toCard.offsetHeight / 2;

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

      const container = svg.parentElement;
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
    const rect = container.getBoundingClientRect();
    const group = state.groups.find(g => g.id === groupId);
    const card = container.querySelector(`[data-id="${groupId}"]`);

    const startX = group.x + card.offsetWidth / 2;
    const startY = group.y + card.offsetHeight / 2;

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

    // Check if connection already exists
    const existing = state.connections.find(c =>
      (c.from === drawingConnection.fromId && c.to === toGroupId) ||
      (c.from === toGroupId && c.to === drawingConnection.fromId)
    );

    pendingConnection = {
      from: drawingConnection.fromId,
      to: toGroupId,
      existing: !!existing
    };

    drawingConnection = null;
    updateDrawingLine();
    showConnectionModal();
  }

  function showConnectionModal() {
    const fromGroup = state.groups.find(g => g.id === pendingConnection.from);
    const toGroup = state.groups.find(g => g.id === pendingConnection.to);

    $('modal-from').textContent = fromGroup.name;
    $('modal-to').textContent = toGroup.name;
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

    // Calculate bounds to fit all groups
    let maxX = 0, maxY = 0;
    state.groups.forEach(g => {
      const size = g.importance === 'high' ? 130 : g.importance === 'low' ? 75 : 100;
      if (g.x + size > maxX) maxX = g.x + size;
      if (g.y + size > maxY) maxY = g.y + size;
    });

    // Set canvas size to fit all groups
    canvas.style.width = Math.max(maxX + 50, container.clientWidth) + 'px';
    canvas.style.height = Math.max(maxY + 50, 500) + 'px';
    svg.style.width = canvas.style.width;
    svg.style.height = canvas.style.height;

    renderGroupCards(canvas, false);

    // Wait for cards to render before drawing connections
    requestAnimationFrame(() => {
      svg.innerHTML = '';

      state.connections.forEach(conn => {
        const fromGroup = state.groups.find(g => g.id === conn.from);
        const toGroup = state.groups.find(g => g.id === conn.to);
        if (!fromGroup || !toGroup) return;

        const fromCard = canvas.querySelector(`[data-id="${conn.from}"]`);
        const toCard = canvas.querySelector(`[data-id="${conn.to}"]`);
        if (!fromCard || !toCard) return;

        const x1 = fromGroup.x + fromCard.offsetWidth / 2;
        const y1 = fromGroup.y + fromCard.offsetHeight / 2;
        const x2 = toGroup.x + toCard.offsetWidth / 2;
        const y2 = toGroup.y + toCard.offsetHeight / 2;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', `connection-line conn-${conn.type}`);
        path.setAttribute('d', getConnectionPath(x1, y1, x2, y2, conn.type));
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      });

      // Add connection labels
      state.connections.forEach(conn => {
        const fromGroup = state.groups.find(g => g.id === conn.from);
        const toGroup = state.groups.find(g => g.id === conn.to);
        if (!fromGroup || !toGroup) return;

        const fromCard = canvas.querySelector(`[data-id="${conn.from}"]`);
        const toCard = canvas.querySelector(`[data-id="${conn.to}"]`);
        if (!fromCard || !toCard) return;

        const x1 = fromGroup.x + fromCard.offsetWidth / 2;
        const y1 = fromGroup.y + fromCard.offsetHeight / 2;
        const x2 = toGroup.x + toCard.offsetWidth / 2;
        const y2 = toGroup.y + toCard.offsetHeight / 2;

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

    if (drawingConnection) {
      // Check if we're over a group card
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const card = target?.closest('.group-card');

      if (card && card.dataset.id !== drawingConnection.fromId) {
        finishDrawingConnection(card.dataset.id);
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
