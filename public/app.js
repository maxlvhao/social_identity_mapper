// Social Identity Mapping App - Simplified 5-Step Flow
(function() {
  'use strict';

  const TOTAL_STEPS = 5;

  // ==================== STATE ====================
  let state = {
    sessionId: null,
    createdAt: null,
    updatedAt: null,
    currentStep: 0,
    // Communities with all fields
    communities: [],  // { id, name, importance, positivity, contact, tenure, representativeness, x, y }
    connections: []   // { from, to, type }
  };

  let saveTimeout = null;
  let dragState = null;
  let drawingConnection = null;
  let pendingConnection = null;
  let typewriterTimeout = null;

  // ==================== DOM HELPERS ====================
  const $ = id => document.getElementById(id);
  const $$ = sel => document.querySelectorAll(sel);

  // ==================== INITIALIZATION ====================
  function init() {
    const params = new URLSearchParams(window.location.search);
    state.sessionId = params.get('session') || generateId('sim_');

    if (!params.get('session')) {
      const newUrl = `${window.location.pathname}?session=${state.sessionId}`;
      window.history.replaceState({}, '', newUrl);
    }

    $('session-display').textContent = state.sessionId;

    loadSession();
    bindEvents();
  }

  function generateId(prefix = '') {
    return prefix + Math.random().toString(36).substr(2, 9);
  }

  // ==================== SESSION MANAGEMENT ====================
  async function loadSession() {
    const localData = localStorage.getItem(`sim_${state.sessionId}`);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        Object.assign(state, parsed);
      } catch (e) {
        console.error('Failed to parse local data');
      }
    }

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

    if (state.communities.length > 0 && state.currentStep > 0) {
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

    $$('.step-screen').forEach(s => s.classList.remove('active'));

    const targetId = stepNum === 0 ? 'step-landing' : `step-${stepNum}`;
    $(targetId).classList.add('active');

    $('progress-header').classList.toggle('hidden', stepNum === 0);
    $('researcher-link').classList.toggle('hidden', stepNum !== 0);

    if (stepNum > 0) {
      const progress = ((stepNum - 1) / (TOTAL_STEPS - 1)) * 100;
      $('progress-fill').style.width = progress + '%';

      $$('.progress-steps .step').forEach(s => {
        const sNum = parseInt(s.dataset.step);
        s.classList.toggle('active', sNum === stepNum);
        s.classList.toggle('completed', sNum < stepNum);
      });
    }

    // Render step content
    const renderFns = {
      1: renderStep1,
      2: renderStep2,
      3: renderStep3,
      4: renderStep4,
      5: renderStep5
    };
    if (renderFns[stepNum]) renderFns[stepNum]();

    // Trigger typewriter effect on instruction text
    if (stepNum > 0) {
      const instruction = $(targetId).querySelector('.instruction');
      if (instruction) {
        typewriterEffect(instruction);
      }
    }
  }

  // ==================== TYPEWRITER EFFECT ====================
  function typewriterEffect(element) {
    // Clear any existing typewriter
    clearTimeout(typewriterTimeout);

    // Store original HTML content (to preserve <strong> tags etc)
    const originalHTML = element.dataset.originalHtml || element.innerHTML;
    element.dataset.originalHtml = originalHTML;

    // Get plain text for typing
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = originalHTML;
    const fullText = tempDiv.textContent;

    // Set up typewriter
    element.classList.add('typewriter');
    element.innerHTML = '<span class="typewriter-text"></span><span class="typewriter-cursor"></span>';

    const textSpan = element.querySelector('.typewriter-text');
    const cursor = element.querySelector('.typewriter-cursor');

    let charIndex = 0;
    const speed = 15; // ms per character

    function type() {
      if (charIndex < fullText.length) {
        textSpan.textContent = fullText.substring(0, charIndex + 1);
        charIndex++;
        typewriterTimeout = setTimeout(type, speed);
      } else {
        // Typing complete - restore original HTML with formatting and remove cursor
        setTimeout(() => {
          element.innerHTML = originalHTML;
          element.classList.remove('typewriter');
        }, 500);
      }
    }

    // Start typing after a brief delay
    typewriterTimeout = setTimeout(type, 300);
  }

  // ==================== EVENT BINDING ====================
  function bindEvents() {
    $('start-btn').addEventListener('click', () => goToStep(1));

    // Step 1: Add Communities
    $('add-community-btn').addEventListener('click', addCommunity);
    $('new-community-input').addEventListener('keypress', e => {
      if (e.key === 'Enter') addCommunity();
    });
    $('step1-next').addEventListener('click', () => goToStep(2));

    // Step 2: Community Details
    $('step2-back').addEventListener('click', () => goToStep(1));
    $('step2-next').addEventListener('click', () => goToStep(3));

    // Step 3: Position
    $('step3-back').addEventListener('click', () => goToStep(2));
    $('step3-next').addEventListener('click', () => goToStep(4));

    // Step 4: Connections
    $('step4-back').addEventListener('click', () => goToStep(3));
    $('step4-next').addEventListener('click', () => goToStep(5));

    // Step 5: Complete
    $('download-btn').addEventListener('click', downloadData);
    $('back-to-edit').addEventListener('click', () => goToStep(4));

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

  // ==================== STEP 1: ADD COMMUNITIES ====================
  function addCommunity() {
    const input = $('new-community-input');
    const name = input.value.trim();

    if (!name) return;

    if (state.communities.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      input.select();
      return;
    }

    state.communities.push({
      id: generateId('c_'),
      name: name,
      importance: null,
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

  function removeCommunity(communityId) {
    state.communities = state.communities.filter(c => c.id !== communityId);
    state.connections = state.connections.filter(c => c.from !== communityId && c.to !== communityId);
    renderStep1();
    saveSession();
  }

  function renderStep1() {
    const list = $('communities-list');
    const count = $('communities-count');
    const hint = $('communities-hint');

    count.textContent = state.communities.length;
    hint.classList.toggle('hidden', state.communities.length >= 3);
    $('step1-next').disabled = state.communities.length < 3;

    list.innerHTML = state.communities.map(c => `
      <div class="community-item" data-id="${c.id}">
        <span class="community-name">${escapeHtml(c.name)}</span>
        <button class="remove-btn" data-id="${c.id}" title="Remove">&times;</button>
      </div>
    `).join('');

    list.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => removeCommunity(btn.dataset.id));
    });
  }

  // ==================== STEP 2: COMMUNITY DETAILS ====================
  function renderStep2() {
    const tbody = $('details-tbody');

    tbody.innerHTML = state.communities.map(c => `
      <tr data-id="${c.id}">
        <td>${escapeHtml(c.name)}</td>
        <td>
          <select class="importance-select" data-id="${c.id}">
            <option value="">Select...</option>
            <option value="high" ${c.importance === 'high' ? 'selected' : ''}>Very Important</option>
            <option value="medium" ${c.importance === 'medium' ? 'selected' : ''}>Moderate</option>
            <option value="low" ${c.importance === 'low' ? 'selected' : ''}>Less Important</option>
          </select>
        </td>
        <td><input type="number" min="1" max="10" ${c.positivity !== null ? `value="${c.positivity}"` : ''} data-field="positivity" placeholder="1-10"></td>
        <td><input type="number" min="0" max="30" ${c.contact !== null ? `value="${c.contact}"` : ''} data-field="contact" placeholder="0-30"></td>
        <td><input type="number" min="0" step="0.5" ${c.tenure !== null ? `value="${c.tenure}"` : ''} data-field="tenure" placeholder="years"></td>
        <td><input type="number" min="1" max="10" ${c.representativeness !== null ? `value="${c.representativeness}"` : ''} data-field="representativeness" placeholder="1-10"></td>
      </tr>
    `).join('');

    // Handle importance changes
    tbody.querySelectorAll('.importance-select').forEach(select => {
      select.addEventListener('change', () => {
        const row = select.closest('tr');
        const communityId = row.dataset.id;
        const community = state.communities.find(c => c.id === communityId);
        if (community) {
          community.importance = select.value || null;
          updateStep2NextButton();
          saveSession();
        }
      });
    });

    // Handle input changes
    tbody.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        const row = input.closest('tr');
        const communityId = row.dataset.id;
        const field = input.dataset.field;
        const value = input.value ? parseFloat(input.value) : null;

        const community = state.communities.find(c => c.id === communityId);
        if (community) {
          community[field] = value;
          saveSession();
        }
      });
    });

    updateStep2NextButton();
  }

  function updateStep2NextButton() {
    const allHaveImportance = state.communities.every(c => c.importance !== null);
    $('step2-next').disabled = !allHaveImportance;
    $('details-hint').classList.toggle('hidden', allHaveImportance);
  }

  // ==================== STEP 3: POSITION GROUPS ====================
  function renderStep3() {
    const canvas = $('groups-canvas-3');
    const container = $('canvas-container-step3');
    const tutorial = $('drag-tutorial-3');

    // Initialize positions if not set
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;

    state.communities.forEach((c, i) => {
      if (c.x === null || c.y === null) {
        // Spread communities around center
        const angle = (i / state.communities.length) * 2 * Math.PI;
        const radius = Math.min(centerX, centerY) * 0.6;
        c.x = centerX + Math.cos(angle) * radius - 50;
        c.y = centerY + Math.sin(angle) * radius - 50;
      }
    });

    renderGroupCards(canvas, true);

    // Show tutorial once
    if (!state.tutorialStep3Shown) {
      tutorial.classList.remove('hidden');
      tutorial.addEventListener('click', () => {
        tutorial.classList.add('hidden');
        state.tutorialStep3Shown = true;
        saveSession();
      }, { once: true });

      // Auto-hide after 3 seconds
      setTimeout(() => {
        tutorial.classList.add('hidden');
        state.tutorialStep3Shown = true;
        saveSession();
      }, 3000);
    } else {
      tutorial.classList.add('hidden');
    }
  }

  function renderGroupCards(canvas, draggable = false) {
    renderGroupCardsWithState(canvas, state, draggable);
  }

  function renderGroupCardsWithState(canvas, stateObj, draggable = false) {
    canvas.innerHTML = '';

    stateObj.communities.forEach(c => {
      const card = document.createElement('div');
      card.className = `group-card size-${c.importance || 'medium'}`;
      card.dataset.id = c.id;
      card.style.left = c.x + 'px';
      card.style.top = c.y + 'px';

      const displayVal = v => v !== null && v !== undefined ? v : '?';

      card.innerHTML = `
        <span class="card-corner tl">${displayVal(c.positivity)}</span>
        <span class="card-corner tr">${displayVal(c.contact)}</span>
        <span class="card-name">${escapeHtml(c.name)}</span>
        <span class="card-corner bl">${displayVal(c.tenure)}</span>
        <span class="card-corner br">${displayVal(c.representativeness)}</span>
      `;

      if (draggable) {
        card.addEventListener('mousedown', e => startDrag(e, c.id, canvas));
      }

      canvas.appendChild(card);
    });
  }

  // ==================== STEP 4: CONNECTIONS ====================
  function renderStep4() {
    const canvas = $('groups-canvas-4');
    const container = $('canvas-container-step4');
    const tutorial = $('drag-tutorial-4');

    renderGroupCards(canvas, false);
    renderConnections();

    // Setup connection drawing from groups
    canvas.querySelectorAll('.group-card').forEach(card => {
      card.addEventListener('mousedown', e => startDrawingConnection(e, card.dataset.id, container));
    });

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

  function renderConnections() {
    const svg = $('connections-svg');
    const canvas = $('groups-canvas-4') || $('final-groups-canvas');

    svg.innerHTML = '';

    // Clear old labels
    const container = svg.parentElement;
    container.querySelectorAll('.connection-label').forEach(l => l.remove());

    state.connections.forEach(conn => {
      const fromCommunity = state.communities.find(c => c.id === conn.from);
      const fromCard = canvas.querySelector(`[data-id="${conn.from}"]`);
      if (!fromCommunity || !fromCard) return;

      const toCommunity = state.communities.find(c => c.id === conn.to);
      const toCard = canvas.querySelector(`[data-id="${conn.to}"]`);
      if (!toCommunity || !toCard) return;

      const x1 = fromCommunity.x + fromCard.offsetWidth / 2;
      const y1 = fromCommunity.y + fromCard.offsetHeight / 2;
      const x2 = toCommunity.x + toCard.offsetWidth / 2;
      const y2 = toCommunity.y + toCard.offsetHeight / 2;

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
      const labelText = conn.type === 'easy' ? 'Easy' :
                        conn.type === 'moderate' ? 'Moderate' : 'Difficult';

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

  function startDrawingConnection(e, communityId, container) {
    e.preventDefault();
    e.stopPropagation();

    const community = state.communities.find(c => c.id === communityId);
    const card = container.querySelector(`[data-id="${communityId}"]`);
    const startX = community.x + card.offsetWidth / 2;
    const startY = community.y + card.offsetHeight / 2;

    drawingConnection = {
      fromId: communityId,
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

  function finishDrawingConnection(toCommunityId) {
    if (!drawingConnection || drawingConnection.fromId === toCommunityId) {
      drawingConnection = null;
      updateDrawingLine();
      return;
    }

    // Normalize connection order (alphabetically by id)
    let fromId = drawingConnection.fromId;
    let toId = toCommunityId;
    if (fromId > toId) {
      [fromId, toId] = [toId, fromId];
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
    const fromCommunity = state.communities.find(c => c.id === pendingConnection.from);
    const toCommunity = state.communities.find(c => c.id === pendingConnection.to);

    const questionText = `How easy would it be to discuss the same news topic across <strong>${fromCommunity.name}</strong> and <strong>${toCommunity.name}</strong>?`;

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

  // ==================== STEP 5: COMPLETE ====================
  function renderStep5() {
    $('final-communities').textContent = state.communities.length;
    $('final-connections').textContent = state.connections.length;

    // Render final preview
    const canvas = $('final-groups-canvas');
    const svg = $('final-connections-svg');
    const container = $('final-canvas-container');

    // Clear old labels
    container.querySelectorAll('.connection-label').forEach(l => l.remove());

    // Calculate bounds to fit all content
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    state.communities.forEach(c => {
      const size = c.importance === 'high' ? 130 : c.importance === 'low' ? 75 : 100;
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x + size > maxX) maxX = c.x + size;
      if (c.y + size > maxY) maxY = c.y + size;
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
      communities: state.communities.map(c => ({
        ...c,
        x: c.x - minX + 20,
        y: c.y - minY + 20
      }))
    };

    renderGroupCardsWithState(canvas, offsetState);

    // Wait for cards to render before drawing connections
    requestAnimationFrame(() => {
      svg.innerHTML = '';

      state.connections.forEach(conn => {
        const fromCommunity = offsetState.communities.find(c => c.id === conn.from);
        const fromCard = canvas.querySelector(`[data-id="${conn.from}"]`);
        if (!fromCommunity || !fromCard) return;

        const toCommunity = offsetState.communities.find(c => c.id === conn.to);
        const toCard = canvas.querySelector(`[data-id="${conn.to}"]`);
        if (!toCommunity || !toCard) return;

        const x1 = fromCommunity.x + fromCard.offsetWidth / 2;
        const y1 = fromCommunity.y + fromCard.offsetHeight / 2;
        const x2 = toCommunity.x + toCard.offsetWidth / 2;
        const y2 = toCommunity.y + toCard.offsetHeight / 2;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', `connection-line conn-${conn.type}`);
        path.setAttribute('d', getConnectionPath(x1, y1, x2, y2, conn.type));
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      });

      // Add connection labels
      state.connections.forEach(conn => {
        const fromCommunity = offsetState.communities.find(c => c.id === conn.from);
        const fromCard = canvas.querySelector(`[data-id="${conn.from}"]`);
        if (!fromCommunity || !fromCard) return;

        const toCommunity = offsetState.communities.find(c => c.id === conn.to);
        const toCard = canvas.querySelector(`[data-id="${conn.to}"]`);
        if (!toCommunity || !toCard) return;

        const x1 = fromCommunity.x + fromCard.offsetWidth / 2;
        const y1 = fromCommunity.y + fromCard.offsetHeight / 2;
        const x2 = toCommunity.x + toCard.offsetWidth / 2;
        const y2 = toCommunity.y + toCard.offsetHeight / 2;

        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const labelText = conn.type === 'easy' ? 'Easy' :
                          conn.type === 'moderate' ? 'Moderate' : 'Difficult';

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
  function startDrag(e, communityId, canvas) {
    const card = canvas.querySelector(`[data-id="${communityId}"]`);
    const rect = card.getBoundingClientRect();
    const containerRect = canvas.parentElement.getBoundingClientRect();

    dragState = {
      communityId,
      canvas,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      containerRect
    };

    card.classList.add('dragging');
  }

  function handleMouseMove(e) {
    if (dragState) {
      const card = dragState.canvas.querySelector(`[data-id="${dragState.communityId}"]`);
      const community = state.communities.find(c => c.id === dragState.communityId);

      let x = e.clientX - dragState.containerRect.left - dragState.offsetX;
      let y = e.clientY - dragState.containerRect.top - dragState.offsetY;

      // Constrain to container
      x = Math.max(0, Math.min(x, dragState.containerRect.width - card.offsetWidth));
      y = Math.max(0, Math.min(y, dragState.containerRect.height - card.offsetHeight));

      card.style.left = x + 'px';
      card.style.top = y + 'px';

      community.x = x;
      community.y = y;
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
      const card = dragState.canvas.querySelector(`[data-id="${dragState.communityId}"]`);
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
