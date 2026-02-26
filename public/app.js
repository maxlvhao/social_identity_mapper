// Social Identity Mapping App - 6-Step Flow
// Steps: Landing → 1. Communal Life → 2. Details → 3. Topics → 4. Position → 5. Discourse → 6. Complete
(function() {
  'use strict';

  const TOTAL_STEPS = 6;

  // News topic categories
  const NEWS_TOPICS = [
    { id: 'international', icon: '\u{1F30D}', short: 'International', full: 'International / World News' },
    { id: 'national', icon: '\u{1F3DB}\uFE0F', short: 'National', full: 'National Politics' },
    { id: 'local', icon: '\u{1F3D8}\uFE0F', short: 'Local', full: 'Local / Community News' },
    { id: 'campus', icon: '\u{1F393}', short: 'Campus', full: 'Campus / Education' },
    { id: 'business', icon: '\u{1F4BC}', short: 'Business', full: 'Business & Economy' },
    { id: 'science', icon: '\u{1F52C}', short: 'Science', full: 'Science & Technology' },
    { id: 'entertainment', icon: '\u{1F3AC}', short: 'Entertainment', full: 'Entertainment' },
    { id: 'sports', icon: '\u26BD', short: 'Sports', full: 'Sports' },
    { id: 'health', icon: '\u{1F3E5}', short: 'Health', full: 'Health & Lifestyle' },
    { id: 'professional', icon: '\u{1F4CA}', short: 'Professional', full: 'Professional / Industry' }
  ];

  // ==================== STATE ====================
  let state = {
    sessionId: null,
    createdAt: null,
    updatedAt: null,
    currentStep: 0,
    communities: [],  // { id, name, importance, positivity, contact, tenure, representativeness, x, y }
    connections: [],   // { from, to, type }
    placedTopics: []   // { id, topicId, communityId }
  };

  // Detect mobile/touch-primary device
  const isMobile = ('ontouchstart' in window || navigator.maxTouchPoints > 0)
    && window.matchMedia('(max-width: 768px)').matches;

  let saveTimeout = null;
  let dragState = null;
  let drawingConnection = null;
  let pendingConnection = null;
  let typewriterTimeout = null;
  let topicDragState = null;

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

    // Record the device used for this session (always update to current device)
    state.device = isMobile ? 'mobile' : 'desktop';

    // Migrate old data format: placedTopics with {x, y} → {communityId}
    migratePlacedTopics();

    // Migrate old tutorial state keys
    if (state.tutorialStep3Shown && !state.tutorialPositionShown) {
      state.tutorialPositionShown = true;
    }
    if (state.tutorialStep4Shown && !state.tutorialDiscourseShown) {
      state.tutorialDiscourseShown = true;
    }

    if (state.communities.length > 0 && state.currentStep > 0) {
      goToStep(state.currentStep);
    }
  }

  function migratePlacedTopics() {
    if (!state.placedTopics || state.placedTopics.length === 0) return;

    // Check if any placed topic still uses old {x, y} format
    const needsMigration = state.placedTopics.some(p => p.x !== undefined && p.communityId === undefined);
    if (!needsMigration) return;

    // Find nearest community for each old-format topic
    // Use original desktop sizes since the saved x/y positions were created with these
    const LEGACY_SIZES = { high: 130, medium: 100, low: 75 };
    state.placedTopics = state.placedTopics.map(placed => {
      if (placed.communityId !== undefined) return placed;
      if (placed.x === undefined || placed.y === undefined) return placed;

      let nearestId = null;
      let nearestDist = Infinity;

      state.communities.forEach(c => {
        if (c.x === null || c.y === null) return;
        const size = LEGACY_SIZES[c.importance] || LEGACY_SIZES.medium;
        const cx = c.x + size / 2;
        const cy = c.y + size / 2;
        const dx = placed.x - cx;
        const dy = placed.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestId = c.id;
        }
      });

      return {
        id: placed.id,
        topicId: placed.topicId,
        communityId: nearestId
      };
    }).filter(p => p.communityId !== null);

    saveSession();
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
      3: renderTopicsStep,
      4: renderPositionStep,
      5: renderDiscourseStep,
      6: renderStep6
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
    clearTimeout(typewriterTimeout);

    const originalHTML = element.dataset.originalHtml || element.innerHTML;
    element.dataset.originalHtml = originalHTML;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = originalHTML;
    const fullText = tempDiv.textContent;

    element.classList.add('typewriter');
    element.innerHTML = '<span class="typewriter-text"></span><span class="typewriter-cursor"></span>';

    const textSpan = element.querySelector('.typewriter-text');

    let charIndex = 0;
    const speed = 15;

    function type() {
      if (charIndex < fullText.length) {
        textSpan.textContent = fullText.substring(0, charIndex + 1);
        charIndex++;
        typewriterTimeout = setTimeout(type, speed);
      } else {
        setTimeout(() => {
          element.innerHTML = originalHTML;
          element.classList.remove('typewriter');
        }, 500);
      }
    }

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

    // Step 3: Topics
    $('step3-back').addEventListener('click', () => goToStep(2));
    $('step3-next').addEventListener('click', () => goToStep(4));

    // Step 4: Position
    $('step4-back').addEventListener('click', () => goToStep(3));
    $('step4-next').addEventListener('click', () => goToStep(5));

    // Step 5: Discourse
    $('step5-back').addEventListener('click', () => goToStep(4));
    $('step5-next').addEventListener('click', () => goToStep(6));

    // Step 6: Complete
    $('back-to-edit').addEventListener('click', () => goToStep(5));

    // Connection Modal
    $('cancel-conn-btn').addEventListener('click', closeConnectionModal);
    $('remove-conn-btn').addEventListener('click', removeConnection);
    $$('.conn-option-compact').forEach(btn => {
      btn.addEventListener('click', () => setConnectionType(btn.dataset.type));
    });
    $('connection-modal').querySelector('.modal-backdrop').addEventListener('click', closeConnectionModal);

    // Global pointer events for dragging (unified mouse + touch + pen)
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
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
    state.placedTopics = state.placedTopics.filter(p => p.communityId !== communityId);
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
    if (isMobile) {
      $('details-table-container').classList.add('hidden');
      $('details-cards').classList.remove('hidden');
      renderStep2Mobile();
    } else {
      $('details-table-container').classList.remove('hidden');
      $('details-cards').classList.add('hidden');
      renderStep2Desktop();
    }
    updateStep2NextButton();
  }

  function renderStep2Desktop() {
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

    bindStep2Events(tbody);
  }

  function renderStep2Mobile() {
    const container = $('details-cards');

    container.innerHTML = state.communities.map(c => `
      <div class="detail-card" data-id="${c.id}">
        <div class="detail-card-name">${escapeHtml(c.name)}</div>
        <div class="detail-card-fields">
          <label class="detail-field">
            <span class="detail-field-label">Importance</span>
            <select class="importance-select" data-id="${c.id}">
              <option value="">Select...</option>
              <option value="high" ${c.importance === 'high' ? 'selected' : ''}>Very Important</option>
              <option value="medium" ${c.importance === 'medium' ? 'selected' : ''}>Moderate</option>
              <option value="low" ${c.importance === 'low' ? 'selected' : ''}>Less Important</option>
            </select>
          </label>
          <div class="detail-field-row">
            <label class="detail-field half">
              <span class="detail-field-label">Positivity <span class="detail-field-hint">(1-10)</span></span>
              <input type="number" inputmode="numeric" min="1" max="10" ${c.positivity !== null ? `value="${c.positivity}"` : ''} data-field="positivity" placeholder="1-10">
            </label>
            <label class="detail-field half">
              <span class="detail-field-label">Contact <span class="detail-field-hint">(days/mo)</span></span>
              <input type="number" inputmode="numeric" min="0" max="30" ${c.contact !== null ? `value="${c.contact}"` : ''} data-field="contact" placeholder="0-30">
            </label>
          </div>
          <div class="detail-field-row">
            <label class="detail-field half">
              <span class="detail-field-label">Tenure <span class="detail-field-hint">(years)</span></span>
              <input type="number" inputmode="decimal" min="0" step="0.5" ${c.tenure !== null ? `value="${c.tenure}"` : ''} data-field="tenure" placeholder="e.g. 2.5">
            </label>
            <label class="detail-field half">
              <span class="detail-field-label">Representative <span class="detail-field-hint">(1-10)</span></span>
              <input type="number" inputmode="numeric" min="1" max="10" ${c.representativeness !== null ? `value="${c.representativeness}"` : ''} data-field="representativeness" placeholder="1-10">
            </label>
          </div>
        </div>
      </div>
    `).join('');

    bindStep2Events(container);
  }

  function bindStep2Events(container) {
    container.querySelectorAll('.importance-select').forEach(select => {
      select.addEventListener('change', () => {
        const card = select.closest('[data-id]');
        const communityId = card.dataset.id;
        const community = state.communities.find(c => c.id === communityId);
        if (community) {
          community.importance = select.value || null;
          updateStep2NextButton();
          saveSession();
        }
      });
    });

    container.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        const card = input.closest('[data-id]');
        const communityId = card.dataset.id;
        const field = input.dataset.field;
        const value = input.value ? parseFloat(input.value) : null;

        const community = state.communities.find(c => c.id === communityId);
        if (community) {
          community[field] = value;
          saveSession();
        }
      });
    });
  }

  function updateStep2NextButton() {
    const allHaveImportance = state.communities.every(c => c.importance !== null);
    $('step2-next').disabled = !allHaveImportance;
    $('details-hint').classList.toggle('hidden', allHaveImportance);
  }

  // ==================== SHARED: RENDER GROUP CARDS WITH TOPICS ====================
  function renderGroupCardsWithState(canvas, stateObj, draggable, showTopics) {
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

      // Append topics below card if showTopics is true
      if (showTopics) {
        const topics = (stateObj.placedTopics || state.placedTopics).filter(p => p.communityId === c.id);
        if (topics.length > 0) {
          const topicsContainer = document.createElement('div');
          topicsContainer.className = 'card-topics';

          topics.forEach(placed => {
            const topic = NEWS_TOPICS.find(t => t.id === placed.topicId);
            if (!topic) return;
            const tag = document.createElement('span');
            tag.className = 'card-topic-tag';
            tag.dataset.placedId = placed.id;
            tag.innerHTML = `<span class="topic-icon">${topic.icon}</span> ${topic.short}`;
            topicsContainer.appendChild(tag);
          });

          card.appendChild(topicsContainer);
        }
      }

      if (draggable) {
        card.addEventListener('pointerdown', e => {
          // Don't start card drag if clicking on a topic tag
          if (e.target.closest('.card-topic-tag')) return;
          startDrag(e, c.id, canvas);
        });
      }

      canvas.appendChild(card);
    });
  }

  // ==================== STEP 3: TOPIC MAPPING (snap to cards) ====================
  function renderTopicsStep() {
    const canvas = $('groups-canvas-3');
    const container = $('canvas-container-step3');

    // Update instruction text for mobile
    const instrEl = $('step3-instruction');
    if (instrEl && isMobile) {
      instrEl.textContent = 'Tap on each community card to select the news topics that group discusses. You can assign the same topic to multiple communities.';
      instrEl.dataset.originalHtml = instrEl.textContent;
    }

    // Initialize positions if not set (circular layout)
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;

    state.communities.forEach((c, i) => {
      if (c.x === null || c.y === null) {
        const angle = (i / state.communities.length) * 2 * Math.PI;
        const radius = Math.min(centerX, centerY) * 0.5;
        const size = getCardSize(c.importance);
        c.x = centerX + Math.cos(angle) * radius - size / 2;
        c.y = centerY + Math.sin(angle) * radius - size / 2;
      }
    });

    // Render cards with topics (not draggable — cards are locked)
    renderGroupCardsWithState(canvas, state, false, true);

    if (isMobile) {
      renderTopicsStepMobile(canvas, container);
    } else {
      renderTopicsStepDesktop(canvas, container);
    }
  }

  // Desktop: drag topics from panel onto cards
  function renderTopicsStepDesktop(canvas, container) {
    const topicsPanel = $('topics-list');

    // Setup topic drag-off from cards
    canvas.querySelectorAll('.card-topic-tag').forEach(tag => {
      tag.addEventListener('pointerdown', e => {
        e.preventDefault();
        e.stopPropagation();
        startTopicDragFromCard(e, tag.dataset.placedId, container);
      });
    });

    // Render topics panel
    topicsPanel.innerHTML = NEWS_TOPICS.map(topic => `
      <div class="topic-tag" data-topic-id="${topic.id}" title="${topic.full}">
        <span class="topic-icon">${topic.icon}</span>
        <span class="topic-label">${topic.short}</span>
      </div>
    `).join('');

    // Setup drag from panel
    topicsPanel.querySelectorAll('.topic-tag').forEach(tag => {
      tag.addEventListener('pointerdown', e => startTopicDragFromPanel(e, tag.dataset.topicId, container));
    });
  }

  // Mobile: tap a card to open topic picker sheet
  function renderTopicsStepMobile(canvas, container) {
    // Hide the drag panel on mobile — we use the tap sheet instead
    const panel = $('topics-panel');
    if (panel) panel.classList.add('hidden');

    // Make cards tappable
    canvas.querySelectorAll('.group-card').forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        openTopicPicker(card.dataset.id);
      });
    });
  }

  function openTopicPicker(communityId) {
    const community = state.communities.find(c => c.id === communityId);
    if (!community) return;

    // Get currently assigned topic IDs for this community
    const assignedTopicIds = state.placedTopics
      .filter(p => p.communityId === communityId)
      .map(p => p.topicId);

    const sheet = $('topic-picker-sheet');
    const backdrop = $('topic-picker-backdrop');

    $('topic-picker-title').textContent = community.name;

    const grid = $('topic-picker-grid');
    grid.innerHTML = NEWS_TOPICS.map(topic => {
      const isSelected = assignedTopicIds.includes(topic.id);
      return `
        <button class="topic-chip ${isSelected ? 'selected' : ''}" data-topic-id="${topic.id}">
          <span class="topic-chip-icon">${topic.icon}</span>
          <span class="topic-chip-label">${topic.short}</span>
        </button>
      `;
    }).join('');

    // Toggle topics on tap
    grid.querySelectorAll('.topic-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const topicId = chip.dataset.topicId;
        const isSelected = chip.classList.contains('selected');

        if (isSelected) {
          // Remove this topic from this community
          state.placedTopics = state.placedTopics.filter(
            p => !(p.communityId === communityId && p.topicId === topicId)
          );
          chip.classList.remove('selected');
        } else {
          // Add this topic to this community
          state.placedTopics.push({
            id: generateId('pt_'),
            topicId: topicId,
            communityId: communityId
          });
          chip.classList.add('selected');
        }
        saveSession();
      });
    });

    // Show sheet with animation
    backdrop.classList.remove('hidden');
    sheet.classList.remove('hidden');
    requestAnimationFrame(() => {
      backdrop.classList.add('visible');
      sheet.classList.add('visible');
    });

    // Close handlers
    const close = () => {
      sheet.classList.remove('visible');
      backdrop.classList.remove('visible');
      setTimeout(() => {
        sheet.classList.add('hidden');
        backdrop.classList.add('hidden');
        renderTopicsStep(); // re-render cards with updated topics
      }, 250);
    };

    backdrop.onclick = close;
    $('topic-picker-done').onclick = close;
  }

  function startTopicDragFromPanel(e, topicId, container) {
    e.preventDefault();

    const topic = NEWS_TOPICS.find(t => t.id === topicId);

    topicDragState = {
      topicId,
      placedId: null,
      isNew: true,
      pointerId: e.pointerId,
      container
    };

    // Capture pointer on the source element for reliable tracking
    e.target.closest('.topic-tag').setPointerCapture(e.pointerId);

    // Create ghost element
    const ghost = document.createElement('div');
    ghost.className = 'card-topic-tag topic-drag-ghost';
    ghost.id = 'topic-drag-ghost';
    ghost.innerHTML = `<span class="topic-icon">${topic.icon}</span> ${topic.short}`;
    ghost.style.position = 'fixed';
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.opacity = '0.85';
    ghost.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(ghost);

    // Add drop target hints to all cards
    container.querySelectorAll('.group-card').forEach(card => {
      card.classList.add('drop-target-hint');
    });
  }

  function startTopicDragFromCard(e, placedId, container) {
    const placed = state.placedTopics.find(p => p.id === placedId);
    if (!placed) return;

    const topic = NEWS_TOPICS.find(t => t.id === placed.topicId);

    topicDragState = {
      topicId: placed.topicId,
      placedId,
      isNew: false,
      pointerId: e.pointerId,
      container
    };

    // Capture pointer on the source element for reliable tracking
    e.target.closest('.card-topic-tag').setPointerCapture(e.pointerId);

    // Create ghost
    const ghost = document.createElement('div');
    ghost.className = 'card-topic-tag topic-drag-ghost';
    ghost.id = 'topic-drag-ghost';
    ghost.innerHTML = `<span class="topic-icon">${topic.icon}</span> ${topic.short}`;
    ghost.style.position = 'fixed';
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '9999';
    ghost.style.opacity = '0.85';
    ghost.style.transform = 'translate(-50%, -50%)';
    document.body.appendChild(ghost);

    // Add drop target hints
    container.querySelectorAll('.group-card').forEach(card => {
      card.classList.add('drop-target-hint');
    });
  }

  // ==================== STEP 4: POSITION GROUPS ====================
  function renderPositionStep() {
    const canvas = $('groups-canvas-4');
    const container = $('canvas-container-step4');
    const tutorial = $('drag-tutorial-4');

    // Initialize positions if not set
    const containerRect = container.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;

    state.communities.forEach((c, i) => {
      if (c.x === null || c.y === null) {
        const angle = (i / state.communities.length) * 2 * Math.PI;
        const radius = Math.min(centerX, centerY) * 0.5;
        const size = getCardSize(c.importance);
        c.x = centerX + Math.cos(angle) * radius - size / 2;
        c.y = centerY + Math.sin(angle) * radius - size / 2;
      }
    });

    renderGroupCardsWithState(canvas, state, true, true);

    // Show tutorial once
    if (!state.tutorialPositionShown) {
      tutorial.classList.remove('hidden');
      tutorial.addEventListener('click', () => {
        tutorial.classList.add('hidden');
        state.tutorialPositionShown = true;
        saveSession();
      }, { once: true });

      setTimeout(() => {
        tutorial.classList.add('hidden');
        state.tutorialPositionShown = true;
        saveSession();
      }, 3000);
    } else {
      tutorial.classList.add('hidden');
    }
  }

  // ==================== STEP 5: DISCOURSE ====================
  function renderDiscourseStep() {
    const canvas = $('groups-canvas-5');
    const container = $('canvas-container-step5');
    const tutorial = $('drag-tutorial-5');

    renderGroupCardsWithState(canvas, state, false, true);
    renderConnections();

    // Setup connection drawing from groups
    canvas.querySelectorAll('.group-card').forEach(card => {
      card.addEventListener('pointerdown', e => startDrawingConnection(e, card.dataset.id, container));
    });

    // Show tutorial once
    if (!state.tutorialDiscourseShown) {
      tutorial.classList.remove('hidden');
      tutorial.addEventListener('click', () => {
        tutorial.classList.add('hidden');
        state.tutorialDiscourseShown = true;
        saveSession();
      }, { once: true });

      setTimeout(() => {
        tutorial.classList.add('hidden');
        state.tutorialDiscourseShown = true;
        saveSession();
      }, 3000);
    } else {
      tutorial.classList.add('hidden');
    }
  }

  // ==================== CONNECTIONS ====================
  function renderConnections() {
    const svg = $('connections-svg');
    const canvas = $('groups-canvas-5') || $('final-groups-canvas');

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
      pointerId: e.pointerId,
      container
    };

    card.setPointerCapture(e.pointerId);
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

    let fromId = drawingConnection.fromId;
    let toId = toCommunityId;
    if (fromId > toId) {
      [fromId, toId] = [toId, fromId];
    }

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

    const questionText = `Would discussions about news between <strong>${fromCommunity.name}</strong> and <strong>${toCommunity.name}</strong> members be easy or difficult?`;

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

    state.connections = state.connections.filter(c =>
      !((c.from === pendingConnection.from && c.to === pendingConnection.to) ||
        (c.from === pendingConnection.to && c.to === pendingConnection.from))
    );

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
    $('final-communities').textContent = state.communities.length;
    $('final-connections').textContent = state.connections.length;
    $('final-topics').textContent = state.placedTopics.length;

    const canvas = $('final-groups-canvas');
    const svg = $('final-connections-svg');
    const container = $('final-canvas-container');

    // Clear old labels
    container.querySelectorAll('.connection-label').forEach(l => l.remove());

    // Calculate bounds to fit all content
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    state.communities.forEach(c => {
      const size = getCardSize(c.importance);
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x + size > maxX) maxX = c.x + size;
      if (c.y + size > maxY) maxY = c.y + size;
    });

    // Account for topics extending below cards
    state.communities.forEach(c => {
      const topicsForCard = state.placedTopics.filter(p => p.communityId === c.id);
      if (topicsForCard.length > 0) {
        const size = getCardSize(c.importance);
        const topicHeight = Math.ceil(topicsForCard.length / 2) * 24 + 8;
        const bottomY = c.y + size + topicHeight;
        if (bottomY > maxY) maxY = bottomY;
      }
    });

    const contentWidth = maxX - minX + 40;
    const contentHeight = maxY - minY + 40;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    canvas.style.transform = `scale(${scale})`;
    canvas.style.width = contentWidth + 'px';
    canvas.style.height = contentHeight + 'px';
    svg.style.transform = `scale(${scale})`;
    svg.style.width = contentWidth + 'px';
    svg.style.height = contentHeight + 'px';

    const offsetX = (containerWidth - contentWidth * scale) / 2;
    const offsetY = (containerHeight - contentHeight * scale) / 2;
    canvas.style.transformOrigin = 'top left';
    canvas.style.left = offsetX + 'px';
    canvas.style.top = offsetY + 'px';
    svg.style.transformOrigin = 'top left';
    svg.style.left = offsetX + 'px';
    svg.style.top = offsetY + 'px';

    const offsetState = {
      ...state,
      communities: state.communities.map(c => ({
        ...c,
        x: c.x - minX + 20,
        y: c.y - minY + 20
      }))
    };

    renderGroupCardsWithState(canvas, offsetState, false, true);

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

        container.appendChild(labelDiv);
      });
    });
  }

  // ==================== DRAG HANDLING ====================
  function startDrag(e, communityId, canvas) {
    e.preventDefault();
    const card = canvas.querySelector(`[data-id="${communityId}"]`);
    const rect = card.getBoundingClientRect();
    const containerRect = canvas.parentElement.getBoundingClientRect();

    dragState = {
      communityId,
      canvas,
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      containerRect
    };

    card.setPointerCapture(e.pointerId);
    card.classList.add('dragging');
  }

  function handlePointerMove(e) {
    // Card dragging
    if (dragState) {
      const card = dragState.canvas.querySelector(`[data-id="${dragState.communityId}"]`);
      const community = state.communities.find(c => c.id === dragState.communityId);

      let x = e.clientX - dragState.containerRect.left - dragState.offsetX;
      let y = e.clientY - dragState.containerRect.top - dragState.offsetY;

      // Constrain to container (leave extra room at bottom for topics)
      x = Math.max(0, Math.min(x, dragState.containerRect.width - card.offsetWidth));
      y = Math.max(0, Math.min(y, dragState.containerRect.height - card.offsetHeight - 30));

      card.style.left = x + 'px';
      card.style.top = y + 'px';

      community.x = x;
      community.y = y;
    }

    // Connection drawing
    if (drawingConnection) {
      const rect = drawingConnection.container.getBoundingClientRect();
      drawingConnection.currentX = e.clientX - rect.left;
      drawingConnection.currentY = e.clientY - rect.top;
      updateDrawingLine();
    }

    // Topic dragging
    if (topicDragState) {
      const ghost = document.getElementById('topic-drag-ghost');
      if (ghost) {
        ghost.style.left = e.clientX + 'px';
        ghost.style.top = e.clientY + 'px';
      }

      // Detect hovered card
      const container = topicDragState.container;
      container.querySelectorAll('.group-card').forEach(card => {
        card.classList.remove('drop-target-active');
      });

      // Temporarily hide ghost to check what's under cursor
      if (ghost) ghost.style.display = 'none';
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (ghost) ghost.style.display = '';

      const hoveredCard = target?.closest('.group-card');
      if (hoveredCard) {
        hoveredCard.classList.add('drop-target-active');
      }
    }
  }

  function handlePointerUp(e) {
    // Card drag end
    if (dragState) {
      const card = dragState.canvas.querySelector(`[data-id="${dragState.communityId}"]`);
      releaseCapture(card, dragState.pointerId);
      card.classList.remove('dragging');
      dragState = null;
      saveSession();
    }

    // Connection drawing end
    if (drawingConnection) {
      const srcCard = drawingConnection.container.querySelector(`[data-id="${drawingConnection.fromId}"]`);
      releaseCapture(srcCard, drawingConnection.pointerId);
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const card = target?.closest('.group-card');

      if (card && card.dataset.id !== drawingConnection.fromId) {
        finishDrawingConnection(card.dataset.id);
      } else {
        drawingConnection = null;
        updateDrawingLine();
      }
    }

    // Topic drag end
    if (topicDragState) {
      // Remove ghost
      const ghost = document.getElementById('topic-drag-ghost');
      if (ghost) ghost.remove();

      // Remove all highlights
      const container = topicDragState.container;
      container.querySelectorAll('.group-card').forEach(card => {
        card.classList.remove('drop-target-hint');
        card.classList.remove('drop-target-active');
      });

      // Release capture so elementFromPoint can find what's under the pointer
      try { e.target.releasePointerCapture(topicDragState.pointerId); } catch (_) {}
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const hoveredCard = target?.closest('.group-card');

      if (topicDragState.isNew) {
        // Dragging from panel
        if (hoveredCard) {
          const communityId = hoveredCard.dataset.id;
          state.placedTopics.push({
            id: generateId('pt_'),
            topicId: topicDragState.topicId,
            communityId: communityId
          });
          saveSession();
          renderTopicsStep();
        }
        // If not over a card, discard
      } else {
        // Dragging existing topic
        if (hoveredCard) {
          // Assign to this card (same or different)
          const placed = state.placedTopics.find(p => p.id === topicDragState.placedId);
          if (placed) {
            placed.communityId = hoveredCard.dataset.id;
            saveSession();
          }
          renderTopicsStep();
        } else {
          // Not over any card — remove
          state.placedTopics = state.placedTopics.filter(p => p.id !== topicDragState.placedId);
          saveSession();
          renderTopicsStep();
        }
      }

      topicDragState = null;
    }
  }

  // ==================== UTILITIES ====================
  function releaseCapture(el, pointerId) {
    try { if (el && pointerId != null) el.releasePointerCapture(pointerId); } catch (_) {}
  }

  function getCardSize(importance) {
    // Read actual rendered size from a temporary element to match CSS (including media queries)
    const test = document.createElement('div');
    test.className = `group-card size-${importance || 'medium'}`;
    test.style.position = 'absolute';
    test.style.visibility = 'hidden';
    document.body.appendChild(test);
    const w = test.offsetWidth;
    document.body.removeChild(test);
    return w;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== START ====================
  init();
})();
