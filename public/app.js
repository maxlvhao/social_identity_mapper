// Social Identity Mapping App - Revised Flow (10 Steps)
(function() {
  'use strict';

  // ==================== CONSTANTS ====================
  const IDENTITY_TYPES = [
    { value: 'role-group', label: 'Role-based / Group-based' },
    { value: 'personal-trait', label: 'Personal trait' },
    { value: 'belief-value', label: 'Belief or value' },
    { value: 'place-based', label: 'Place-based' },
    { value: 'other', label: 'Other' }
  ];

  const COMMUNITY_SETTINGS = [
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
    { value: 'hybrid', label: 'Hybrid' }
  ];

  const LIKERT_SCALE = [
    { value: 1, label: 'Strongly Disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Slightly Disagree' },
    { value: 4, label: 'Neutral' },
    { value: 5, label: 'Slightly Agree' },
    { value: 6, label: 'Agree' },
    { value: 7, label: 'Strongly Agree' }
  ];

  const BOUNDARY_MARKERS = [
    { value: 'jargon', label: 'Jargon / lingo' },
    { value: 'credentials', label: 'Credentials / insider knowledge' },
    { value: 'sources', label: 'News sources / information sources' },
    { value: 'rituals', label: 'Rituals / events' },
    { value: 'humor', label: 'Humor / memes' },
    { value: 'moral', label: 'Moral stances' },
    { value: 'time', label: 'Time commitment' },
    { value: 'technical', label: 'Technical skill' },
    { value: 'location', label: 'Physical location' }
  ];

  const KEEP_UP_METHODS = [
    { value: 'lurk', label: 'Lurk / read' },
    { value: 'ask', label: 'Ask someone' },
    { value: 'follow-accounts', label: 'Follow key accounts' },
    { value: 'newsletters', label: 'Newsletters' },
    { value: 'discord', label: 'Group chat / Discord' },
    { value: 'official', label: 'Official channels' },
    { value: 'campus', label: 'Campus media' },
    { value: 'mainstream', label: 'Mainstream media' },
    { value: 'podcasts', label: 'Podcasts / YouTube' },
    { value: 'other', label: 'Other' }
  ];

  const TOTAL_STEPS = 10;

  // ==================== STATE ====================
  let state = {
    sessionId: null,
    createdAt: null,
    updatedAt: null,
    currentStep: 0,
    identities: [],
    identityStrength: {},
    communities: [],
    belongingUncertainty: {},
    communityParticipation: {},
    informationNorms: {},
    mapPositions: {}
  };

  let saveTimeout = null;
  let dragState = null;

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

    if (state.identities.length > 0 && state.currentStep > 0) {
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
      5: renderStep5,
      6: renderStep6,
      7: renderStep7,
      8: renderStep8,
      9: renderStep9,
      10: renderStep10
    };
    if (renderFns[stepNum]) renderFns[stepNum]();
  }

  // ==================== EVENT BINDING ====================
  function bindEvents() {
    $('start-btn').addEventListener('click', () => goToStep(1));

    // Step 1: Add Identities
    $('add-identity-btn').addEventListener('click', addIdentity);
    $('new-identity-input').addEventListener('keypress', e => {
      if (e.key === 'Enter') addIdentity();
    });
    $('step1-next').addEventListener('click', () => goToStep(2));

    // Step 2: Rank Identities
    $('step2-back').addEventListener('click', () => goToStep(1));
    $('step2-next').addEventListener('click', () => goToStep(3));

    // Step 3: Identity Strength
    $('step3-back').addEventListener('click', () => goToStep(2));
    $('step3-next').addEventListener('click', () => goToStep(4));

    // Step 4: Add Communities
    $('add-community-btn').addEventListener('click', addCommunity);
    $('new-community-input').addEventListener('keypress', e => {
      if (e.key === 'Enter') addCommunity();
    });
    $('step4-back').addEventListener('click', () => goToStep(3));
    $('step4-next').addEventListener('click', () => goToStep(5));

    // Step 5: Rank Communities
    $('step5-back').addEventListener('click', () => goToStep(4));
    $('step5-next').addEventListener('click', () => goToStep(6));

    // Step 6: Belonging
    $('step6-back').addEventListener('click', () => goToStep(5));
    $('step6-next').addEventListener('click', () => goToStep(7));

    // Step 7: Participation
    $('step7-back').addEventListener('click', () => goToStep(6));
    $('step7-next').addEventListener('click', () => goToStep(8));

    // Step 8: Info Norms
    $('step8-back').addEventListener('click', () => goToStep(7));
    $('step8-next').addEventListener('click', () => goToStep(9));

    // Step 9: Map
    $('step9-back').addEventListener('click', () => goToStep(8));
    $('step9-next').addEventListener('click', () => goToStep(10));

    // Step 10: Complete
    $('download-btn').addEventListener('click', downloadData);
    $('back-to-edit').addEventListener('click', () => goToStep(9));

    // Global drag events
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }

  // ==================== STEP 1: ADD IDENTITIES ====================
  function addIdentity() {
    const input = $('new-identity-input');
    const name = input.value.trim();

    if (!name) return;

    if (state.identities.some(i => i.name.toLowerCase() === name.toLowerCase())) {
      input.select();
      return;
    }

    state.identities.push({
      id: generateId('i_'),
      name: name,
      type: null,
      isTopThree: false,
      topRank: null
    });

    input.value = '';
    input.focus();
    renderStep1();
    saveSession();
  }

  function removeIdentity(identityId) {
    state.identities = state.identities.filter(i => i.id !== identityId);
    delete state.identityStrength[identityId];
    delete state.mapPositions[identityId];
    renderStep1();
    saveSession();
  }

  function renderStep1() {
    const list = $('identities-list');
    const count = $('identities-count');
    const hint = $('identities-hint');

    count.textContent = state.identities.length;
    hint.classList.toggle('hidden', state.identities.length >= 3);
    $('step1-next').disabled = state.identities.length < 3 || !state.identities.every(i => i.type !== null);

    list.innerHTML = state.identities.map(i => `
      <div class="identity-item" data-id="${i.id}">
        <span class="identity-name">${escapeHtml(i.name)}</span>
        <select class="type-select" data-id="${i.id}">
          <option value="">Select type...</option>
          ${IDENTITY_TYPES.map(t => `<option value="${t.value}" ${i.type === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
        <button class="remove-btn" data-id="${i.id}" title="Remove">&times;</button>
      </div>
    `).join('');

    // Bind events
    list.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => removeIdentity(btn.dataset.id));
    });

    list.querySelectorAll('.type-select').forEach(select => {
      select.addEventListener('change', () => {
        const identity = state.identities.find(i => i.id === select.dataset.id);
        if (identity) {
          identity.type = select.value || null;
          renderStep1();
          saveSession();
        }
      });
    });
  }

  // ==================== STEP 2: RANK IDENTITIES ====================
  function renderStep2() {
    const source = $('identity-rank-source');
    const target = $('identity-rank-target');

    // Render source items (non-ranked identities)
    source.innerHTML = state.identities.filter(i => !i.isTopThree).map(i => `
      <div class="rank-item" data-id="${i.id}" draggable="true">
        ${escapeHtml(i.name)}
      </div>
    `).join('');

    // Render target slots
    const slots = target.querySelectorAll('.rank-slot');
    slots.forEach(slot => {
      const slotNum = parseInt(slot.dataset.slot);
      const identity = state.identities.find(i => i.topRank === slotNum);

      if (identity) {
        slot.innerHTML = `<span class="slot-content">${escapeHtml(identity.name)} <button class="slot-remove" data-id="${identity.id}">&times;</button></span>`;
        slot.classList.add('filled');
      } else {
        slot.innerHTML = `<span class="slot-number">${slotNum}</span>`;
        slot.classList.remove('filled');
      }
    });

    // Setup drag events for source items
    source.querySelectorAll('.rank-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', item.dataset.id);
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
    });

    // Setup drop events for slots
    slots.forEach(slot => {
      slot.addEventListener('dragover', e => {
        e.preventDefault();
        slot.classList.add('drag-over');
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
      slot.addEventListener('drop', e => {
        e.preventDefault();
        slot.classList.remove('drag-over');
        handleIdentityRank(e.dataTransfer.getData('text/plain'), parseInt(slot.dataset.slot));
      });
    });

    // Remove buttons
    target.querySelectorAll('.slot-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const identity = state.identities.find(i => i.id === btn.dataset.id);
        if (identity) {
          identity.isTopThree = false;
          identity.topRank = null;
          renderStep2();
          saveSession();
        }
      });
    });

    updateStep2NextButton();
  }

  function handleIdentityRank(identityId, slotNum) {
    // Clear existing identity in this slot
    state.identities.forEach(i => {
      if (i.topRank === slotNum) {
        i.isTopThree = false;
        i.topRank = null;
      }
    });

    // Set new rank
    const identity = state.identities.find(i => i.id === identityId);
    if (identity) {
      // Clear old slot if any
      identity.isTopThree = true;
      identity.topRank = slotNum;
    }

    renderStep2();
    saveSession();
  }

  function updateStep2NextButton() {
    const topThree = state.identities.filter(i => i.isTopThree);
    $('step2-next').disabled = topThree.length < 3;
    $('identity-rank-hint').classList.toggle('hidden', topThree.length >= 3);
  }

  // ==================== STEP 3: IDENTITY STRENGTH ====================
  function renderStep3() {
    const container = $('identity-strength-container');
    const topIdentities = state.identities.filter(i => i.isTopThree).sort((a, b) => a.topRank - b.topRank);

    container.innerHTML = topIdentities.map(identity => {
      const strength = state.identityStrength[identity.id] || {};

      return `
        <div class="strength-card">
          <h3>${escapeHtml(identity.name)}</h3>

          <div class="slider-group">
            <label>Centrality: "This identity is central to who I am"</label>
            <div class="slider-row">
              <span>1</span>
              <input type="range" min="1" max="7" value="${strength.centrality || 4}"
                     data-id="${identity.id}" data-field="centrality">
              <span>7</span>
              <span class="slider-value">${strength.centrality || 4}</span>
            </div>
          </div>

          <div class="slider-group">
            <label>Solidarity/Belonging: "I feel connected to others who share this identity"</label>
            <div class="slider-row">
              <span>1</span>
              <input type="range" min="1" max="7" value="${strength.solidarity || 4}"
                     data-id="${identity.id}" data-field="solidarity">
              <span>7</span>
              <span class="slider-value">${strength.solidarity || 4}</span>
            </div>
          </div>

          <div class="slider-group">
            <label>Satisfaction/Positive affect: "I feel good about having this identity"</label>
            <div class="slider-row">
              <span>1</span>
              <input type="range" min="1" max="7" value="${strength.satisfaction || 4}"
                     data-id="${identity.id}" data-field="satisfaction">
              <span>7</span>
              <span class="slider-value">${strength.satisfaction || 4}</span>
            </div>
          </div>

          <div class="slider-group">
            <label>Stability: "This identity feels stable over time (not easily shaken)"</label>
            <div class="slider-row">
              <span>1</span>
              <input type="range" min="1" max="7" value="${strength.stability || 4}"
                     data-id="${identity.id}" data-field="stability">
              <span>7</span>
              <span class="slider-value">${strength.stability || 4}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('input[type="range"]').forEach(input => {
      const updateValue = () => {
        input.parentElement.querySelector('.slider-value').textContent = input.value;
        const id = input.dataset.id;
        const field = input.dataset.field;
        if (!state.identityStrength[id]) state.identityStrength[id] = {};
        state.identityStrength[id][field] = parseInt(input.value);
        saveSession();
      };
      input.addEventListener('input', updateValue);
      updateValue();
    });
  }

  // ==================== STEP 4: ADD COMMUNITIES ====================
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
      setting: null,
      isTopThree: false,
      topRank: null
    });

    input.value = '';
    input.focus();
    renderStep4();
    saveSession();
  }

  function removeCommunity(communityId) {
    state.communities = state.communities.filter(c => c.id !== communityId);
    delete state.belongingUncertainty[communityId];
    delete state.communityParticipation[communityId];
    delete state.informationNorms[communityId];
    delete state.mapPositions[communityId];
    renderStep4();
    saveSession();
  }

  function renderStep4() {
    const list = $('communities-list');
    const count = $('communities-count');
    const hint = $('communities-hint');

    count.textContent = state.communities.length;
    hint.classList.toggle('hidden', state.communities.length >= 3);
    $('step4-next').disabled = state.communities.length < 3 || !state.communities.every(c => c.setting !== null);

    list.innerHTML = state.communities.map(c => `
      <div class="community-item" data-id="${c.id}">
        <span class="community-name">${escapeHtml(c.name)}</span>
        <select class="setting-select" data-id="${c.id}">
          <option value="">Select setting...</option>
          ${COMMUNITY_SETTINGS.map(s => `<option value="${s.value}" ${c.setting === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
        </select>
        <button class="remove-btn" data-id="${c.id}" title="Remove">&times;</button>
      </div>
    `).join('');

    list.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => removeCommunity(btn.dataset.id));
    });

    list.querySelectorAll('.setting-select').forEach(select => {
      select.addEventListener('change', () => {
        const community = state.communities.find(c => c.id === select.dataset.id);
        if (community) {
          community.setting = select.value || null;
          renderStep4();
          saveSession();
        }
      });
    });
  }

  // ==================== STEP 5: RANK COMMUNITIES ====================
  function renderStep5() {
    const source = $('community-rank-source');
    const target = $('community-rank-target');

    source.innerHTML = state.communities.filter(c => !c.isTopThree).map(c => `
      <div class="rank-item community" data-id="${c.id}" draggable="true">
        ${escapeHtml(c.name)}
      </div>
    `).join('');

    const slots = target.querySelectorAll('.rank-slot');
    slots.forEach(slot => {
      const slotNum = parseInt(slot.dataset.slot);
      const community = state.communities.find(c => c.topRank === slotNum);

      if (community) {
        slot.innerHTML = `<span class="slot-content">${escapeHtml(community.name)} <button class="slot-remove" data-id="${community.id}">&times;</button></span>`;
        slot.classList.add('filled');
      } else {
        slot.innerHTML = `<span class="slot-number">${slotNum}</span>`;
        slot.classList.remove('filled');
      }
    });

    source.querySelectorAll('.rank-item').forEach(item => {
      item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', item.dataset.id);
        item.classList.add('dragging');
      });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
    });

    slots.forEach(slot => {
      slot.addEventListener('dragover', e => {
        e.preventDefault();
        slot.classList.add('drag-over');
      });
      slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
      slot.addEventListener('drop', e => {
        e.preventDefault();
        slot.classList.remove('drag-over');
        handleCommunityRank(e.dataTransfer.getData('text/plain'), parseInt(slot.dataset.slot));
      });
    });

    target.querySelectorAll('.slot-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const community = state.communities.find(c => c.id === btn.dataset.id);
        if (community) {
          community.isTopThree = false;
          community.topRank = null;
          renderStep5();
          saveSession();
        }
      });
    });

    updateStep5NextButton();
  }

  function handleCommunityRank(communityId, slotNum) {
    state.communities.forEach(c => {
      if (c.topRank === slotNum) {
        c.isTopThree = false;
        c.topRank = null;
      }
    });

    const community = state.communities.find(c => c.id === communityId);
    if (community) {
      community.isTopThree = true;
      community.topRank = slotNum;
    }

    renderStep5();
    saveSession();
  }

  function updateStep5NextButton() {
    const topThree = state.communities.filter(c => c.isTopThree);
    $('step5-next').disabled = topThree.length < 3;
    $('community-rank-hint').classList.toggle('hidden', topThree.length >= 3);
  }

  // ==================== STEP 6: BELONGING UNCERTAINTY ====================
  function renderStep6() {
    const container = $('belonging-container');
    const topCommunities = state.communities.filter(c => c.isTopThree).sort((a, b) => a.topRank - b.topRank);

    container.innerHTML = topCommunities.map(community => {
      const belonging = state.belongingUncertainty[community.id] || {};

      return `
        <div class="belonging-card">
          <h3>${escapeHtml(community.name)}</h3>

          <div class="likert-group">
            <label>Sometimes I feel that I belong at <strong>${escapeHtml(community.name)}</strong>, and sometimes I feel that I don't belong.</label>
            <div class="likert-scale">
              ${LIKERT_SCALE.map(opt => `
                <label class="likert-option">
                  <input type="radio" name="belong-sometimes-${community.id}" value="${opt.value}"
                         ${belonging.belongSometimes === opt.value ? 'checked' : ''}
                         data-id="${community.id}" data-field="belongSometimes">
                  <span class="likert-label">${opt.value}</span>
                  <span class="likert-text">${opt.label}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="likert-group">
            <label>When something bad happens, I feel that maybe I don't belong at <strong>${escapeHtml(community.name)}</strong>.</label>
            <div class="likert-scale">
              ${LIKERT_SCALE.map(opt => `
                <label class="likert-option">
                  <input type="radio" name="belong-bad-${community.id}" value="${opt.value}"
                         ${belonging.belongBad === opt.value ? 'checked' : ''}
                         data-id="${community.id}" data-field="belongBad">
                  <span class="likert-label">${opt.value}</span>
                  <span class="likert-text">${opt.label}</span>
                </label>
              `).join('')}
            </div>
          </div>

          <div class="likert-group">
            <label>When something good happens, I feel that I really belong at <strong>${escapeHtml(community.name)}</strong>.</label>
            <div class="likert-scale">
              ${LIKERT_SCALE.map(opt => `
                <label class="likert-option">
                  <input type="radio" name="belong-good-${community.id}" value="${opt.value}"
                         ${belonging.belongGood === opt.value ? 'checked' : ''}
                         data-id="${community.id}" data-field="belongGood">
                  <span class="likert-label">${opt.value}</span>
                  <span class="likert-text">${opt.label}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('input[type="radio"]').forEach(input => {
      input.addEventListener('change', () => {
        const id = input.dataset.id;
        const field = input.dataset.field;
        if (!state.belongingUncertainty[id]) state.belongingUncertainty[id] = {};
        state.belongingUncertainty[id][field] = parseInt(input.value);
        saveSession();
      });
    });
  }

  // ==================== STEP 7: COMMUNITY PARTICIPATION ====================
  function renderStep7() {
    const container = $('participation-container');
    const topCommunities = state.communities.filter(c => c.isTopThree).sort((a, b) => a.topRank - b.topRank);

    container.innerHTML = topCommunities.map(community => {
      const participation = state.communityParticipation[community.id] || { boundaryMarkers: [] };

      return `
        <div class="participation-card">
          <h3>${escapeHtml(community.name)}</h3>

          <div class="slider-group">
            <label>How hard is it for a newcomer to legitimately participate in this community?</label>
            <div class="slider-row">
              <span>1 (Easy)</span>
              <input type="range" min="1" max="7" value="${participation.difficulty || 4}"
                     data-id="${community.id}" data-field="difficulty">
              <span>7 (Hard)</span>
              <span class="slider-value">${participation.difficulty || 4}</span>
            </div>
          </div>

          <div class="checkbox-group">
            <label>What differentiates people in this community (in-group) from outsiders? (Select all that apply)</label>
            <div class="checkbox-grid">
              ${BOUNDARY_MARKERS.map(marker => `
                <label class="checkbox-option">
                  <input type="checkbox" value="${marker.value}"
                         ${participation.boundaryMarkers && participation.boundaryMarkers.includes(marker.value) ? 'checked' : ''}
                         data-id="${community.id}" data-field="boundaryMarkers">
                  ${marker.label}
                </label>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('input[type="range"]').forEach(input => {
      const updateValue = () => {
        input.parentElement.querySelector('.slider-value').textContent = input.value;
        const id = input.dataset.id;
        if (!state.communityParticipation[id]) state.communityParticipation[id] = { boundaryMarkers: [] };
        state.communityParticipation[id].difficulty = parseInt(input.value);
        saveSession();
      };
      input.addEventListener('input', updateValue);
    });

    container.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => {
        const id = input.dataset.id;
        if (!state.communityParticipation[id]) state.communityParticipation[id] = { boundaryMarkers: [] };
        if (!state.communityParticipation[id].boundaryMarkers) state.communityParticipation[id].boundaryMarkers = [];

        if (input.checked) {
          if (!state.communityParticipation[id].boundaryMarkers.includes(input.value)) {
            state.communityParticipation[id].boundaryMarkers.push(input.value);
          }
        } else {
          state.communityParticipation[id].boundaryMarkers = state.communityParticipation[id].boundaryMarkers.filter(v => v !== input.value);
        }
        saveSession();
      });
    });
  }

  // ==================== STEP 8: INFORMATION NORMS ====================
  function renderStep8() {
    const container = $('info-norms-container');
    const topCommunities = state.communities.filter(c => c.isTopThree).sort((a, b) => a.topRank - b.topRank);

    container.innerHTML = topCommunities.map(community => {
      const norms = state.informationNorms[community.id] || { keepUpMethods: [] };

      return `
        <div class="info-norms-card">
          <h3>${escapeHtml(community.name)}</h3>

          <div class="slider-group">
            <label>"To be taken seriously here, you need to know the community's language (terms/memes/ways of speaking)"</label>
            <div class="slider-row">
              <span>1</span>
              <input type="range" min="1" max="7" value="${norms.languageNeeded || 4}"
                     data-id="${community.id}" data-field="languageNeeded">
              <span>7</span>
              <span class="slider-value">${norms.languageNeeded || 4}</span>
            </div>
          </div>

          <div class="slider-group">
            <label>"I've put effort into learning that language"</label>
            <div class="slider-row">
              <span>1</span>
              <input type="range" min="1" max="7" value="${norms.effortLearning || 4}"
                     data-id="${community.id}" data-field="effortLearning">
              <span>7</span>
              <span class="slider-value">${norms.effortLearning || 4}</span>
            </div>
          </div>

          <div class="slider-group">
            <label>"There are sources (news/accounts/sites) you're expected to follow to 'get it'"</label>
            <div class="slider-row">
              <span>1</span>
              <input type="range" min="1" max="7" value="${norms.sourcesExpected || 4}"
                     data-id="${community.id}" data-field="sourcesExpected">
              <span>7</span>
              <span class="slider-value">${norms.sourcesExpected || 4}</span>
            </div>
          </div>

          <div class="slider-group">
            <label>"Using the 'wrong' sources or framing gets judged here"</label>
            <div class="slider-row">
              <span>1</span>
              <input type="range" min="1" max="7" value="${norms.wrongSourcesJudged || 4}"
                     data-id="${community.id}" data-field="wrongSourcesJudged">
              <span>7</span>
              <span class="slider-value">${norms.wrongSourcesJudged || 4}</span>
            </div>
          </div>

          <div class="checkbox-group">
            <label>"How do you usually keep up?" (Choose up to 3)</label>
            <div class="checkbox-grid">
              ${KEEP_UP_METHODS.map(method => `
                <label class="checkbox-option">
                  <input type="checkbox" value="${method.value}"
                         ${norms.keepUpMethods && norms.keepUpMethods.includes(method.value) ? 'checked' : ''}
                         data-id="${community.id}" data-field="keepUpMethods">
                  ${method.label}
                </label>
              `).join('')}
            </div>
          </div>

          <div class="text-group">
            <label>Name up to 3 sources/places/people that help you "stay fluent" in this community:</label>
            <textarea data-id="${community.id}" data-field="fluencySources"
                      placeholder="e.g., @username, subreddit, podcast name...">${norms.fluencySources || ''}</textarea>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('input[type="range"]').forEach(input => {
      const updateValue = () => {
        input.parentElement.querySelector('.slider-value').textContent = input.value;
        const id = input.dataset.id;
        const field = input.dataset.field;
        if (!state.informationNorms[id]) state.informationNorms[id] = { keepUpMethods: [] };
        state.informationNorms[id][field] = parseInt(input.value);
        saveSession();
      };
      input.addEventListener('input', updateValue);
    });

    container.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.addEventListener('change', () => {
        const id = input.dataset.id;
        if (!state.informationNorms[id]) state.informationNorms[id] = { keepUpMethods: [] };
        if (!state.informationNorms[id].keepUpMethods) state.informationNorms[id].keepUpMethods = [];

        if (input.checked) {
          if (state.informationNorms[id].keepUpMethods.length < 3) {
            state.informationNorms[id].keepUpMethods.push(input.value);
          } else {
            input.checked = false;
            return;
          }
        } else {
          state.informationNorms[id].keepUpMethods = state.informationNorms[id].keepUpMethods.filter(v => v !== input.value);
        }
        saveSession();
      });
    });

    container.querySelectorAll('textarea').forEach(textarea => {
      textarea.addEventListener('input', () => {
        const id = textarea.dataset.id;
        if (!state.informationNorms[id]) state.informationNorms[id] = { keepUpMethods: [] };
        state.informationNorms[id].fluencySources = textarea.value;
        saveSession();
      });
    });
  }

  // ==================== STEP 9: COORDINATE MAP ====================
  // Note: Positions are stored as percentages (0-1) to ensure consistency across different container sizes

  function renderStep9() {
    const canvas = $('coordinate-canvas');
    const container = $('canvas-container-step9');

    canvas.innerHTML = '';

    const topIdentities = state.identities.filter(i => i.isTopThree).sort((a, b) => a.topRank - b.topRank);
    const topCommunities = state.communities.filter(c => c.isTopThree).sort((a, b) => a.topRank - b.topRank);

    // Get container dimensions
    const containerRect = container.getBoundingClientRect();

    // Helper to convert old pixel positions to percentages if needed
    function normalizePosition(pos, containerWidth, containerHeight) {
      // If values are > 1, they're old pixel values - convert to percentages
      if (pos.x > 1 || pos.y > 1) {
        return {
          x: Math.min(1, Math.max(0, pos.x / 800)), // Assume old container was ~800px wide
          y: Math.min(1, Math.max(0, pos.y / 600))  // Assume old container was ~600px tall
        };
      }
      return pos;
    }

    // Initialize positions if not set (as percentages 0-1)
    topIdentities.forEach((identity, i) => {
      if (!state.mapPositions[identity.id]) {
        const angle = (i / 3) * Math.PI - Math.PI / 2;
        state.mapPositions[identity.id] = {
          x: 0.5 + Math.cos(angle) * 0.15,
          y: 0.5 + Math.sin(angle) * 0.15
        };
      } else {
        // Normalize existing positions
        state.mapPositions[identity.id] = normalizePosition(state.mapPositions[identity.id], containerRect.width, containerRect.height);
      }
    });

    topCommunities.forEach((community, i) => {
      if (!state.mapPositions[community.id]) {
        const angle = ((i + 3) / 6) * 2 * Math.PI + Math.PI / 6;
        state.mapPositions[community.id] = {
          x: 0.5 + Math.cos(angle) * 0.2,
          y: 0.5 + Math.sin(angle) * 0.2
        };
      } else {
        // Normalize existing positions
        state.mapPositions[community.id] = normalizePosition(state.mapPositions[community.id], containerRect.width, containerRect.height);
      }
    });

    // Render identity markers (dots)
    topIdentities.forEach(identity => {
      const pos = state.mapPositions[identity.id];
      const marker = document.createElement('div');
      marker.className = 'map-marker identity-marker';
      marker.dataset.id = identity.id;
      marker.style.left = (pos.x * containerRect.width) + 'px';
      marker.style.top = (pos.y * containerRect.height) + 'px';
      marker.innerHTML = `
        <span class="marker-label">${escapeHtml(identity.name)}</span>
        <span class="marker-dot"></span>
      `;

      marker.addEventListener('mousedown', e => startMapDrag(e, identity.id, canvas, container));
      canvas.appendChild(marker);
    });

    // Render community markers (squares)
    topCommunities.forEach(community => {
      const pos = state.mapPositions[community.id];
      const marker = document.createElement('div');
      marker.className = 'map-marker community-marker';
      marker.dataset.id = community.id;
      marker.style.left = (pos.x * containerRect.width) + 'px';
      marker.style.top = (pos.y * containerRect.height) + 'px';
      marker.innerHTML = `
        <span class="marker-label">${escapeHtml(community.name)}</span>
        <span class="marker-square"></span>
      `;

      marker.addEventListener('mousedown', e => startMapDrag(e, community.id, canvas, container));
      canvas.appendChild(marker);
    });

    saveSession();
  }

  function startMapDrag(e, itemId, canvas, container) {
    const marker = canvas.querySelector(`[data-id="${itemId}"]`);
    const rect = marker.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    dragState = {
      itemId,
      canvas,
      container,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      containerRect
    };

    marker.classList.add('dragging');
  }

  function handleMouseMove(e) {
    if (!dragState) return;

    const marker = dragState.canvas.querySelector(`[data-id="${dragState.itemId}"]`);
    if (!marker) return;

    // Get fresh container rect in case of resize
    const containerRect = dragState.container.getBoundingClientRect();

    let pixelX = e.clientX - containerRect.left - dragState.offsetX;
    let pixelY = e.clientY - containerRect.top - dragState.offsetY;

    // Constrain to container
    pixelX = Math.max(0, Math.min(pixelX, containerRect.width - 20));
    pixelY = Math.max(20, Math.min(pixelY, containerRect.height));

    marker.style.left = pixelX + 'px';
    marker.style.top = pixelY + 'px';

    // Store as percentages (0-1)
    state.mapPositions[dragState.itemId] = {
      x: pixelX / containerRect.width,
      y: pixelY / containerRect.height
    };
  }

  function handleMouseUp() {
    if (dragState) {
      const marker = dragState.canvas.querySelector(`[data-id="${dragState.itemId}"]`);
      if (marker) marker.classList.remove('dragging');
      dragState = null;
      saveSession();
    }
  }

  // ==================== STEP 10: COMPLETE ====================
  function renderStep10() {
    const topIdentities = state.identities.filter(i => i.isTopThree);
    const topCommunities = state.communities.filter(c => c.isTopThree);

    $('final-identities').textContent = topIdentities.length;
    $('final-communities').textContent = topCommunities.length;

    const canvas = $('final-coordinate-canvas');
    const container = $('final-canvas-container');
    canvas.innerHTML = '';

    // Get container dimensions for converting percentages to pixels
    const containerRect = container.getBoundingClientRect();

    // Helper to convert old pixel positions to percentages if needed
    function normalizePosition(pos) {
      if (!pos) return null;
      if (pos.x > 1 || pos.y > 1) {
        return {
          x: Math.min(1, Math.max(0, pos.x / 800)),
          y: Math.min(1, Math.max(0, pos.y / 600))
        };
      }
      return pos;
    }

    // Render identity markers
    topIdentities.forEach(identity => {
      const pos = normalizePosition(state.mapPositions[identity.id]);
      if (!pos) return;

      const marker = document.createElement('div');
      marker.className = 'map-marker identity-marker';
      marker.style.left = (pos.x * containerRect.width) + 'px';
      marker.style.top = (pos.y * containerRect.height) + 'px';
      marker.innerHTML = `
        <span class="marker-label">${escapeHtml(identity.name)}</span>
        <span class="marker-dot"></span>
      `;
      canvas.appendChild(marker);
    });

    // Render community markers
    topCommunities.forEach(community => {
      const pos = normalizePosition(state.mapPositions[community.id]);
      if (!pos) return;

      const marker = document.createElement('div');
      marker.className = 'map-marker community-marker';
      marker.style.left = (pos.x * containerRect.width) + 'px';
      marker.style.top = (pos.y * containerRect.height) + 'px';
      marker.innerHTML = `
        <span class="marker-label">${escapeHtml(community.name)}</span>
        <span class="marker-square"></span>
      `;
      canvas.appendChild(marker);
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

  // ==================== UTILITIES ====================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== START ====================
  init();
})();
