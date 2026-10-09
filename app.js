(() => {
  const canvas = document.querySelector('#boardCanvas');
  let context = canvas.getContext('2d');
  const canvasWrap = document.querySelector('#canvasWrap');
  const magnifierCanvas = document.querySelector('#magnifierCanvas');
  const magnifierContext = magnifierCanvas.getContext('2d');
  const STORAGE_KEY = 'stone-plate-state-v1';
  const ADMIN_STORAGE_KEY = 'stone-plate-admin-library-v1';
  const LEGACY_STORAGE_KEY = 'talus-board-v1';
  const LEGACY_HEALTH_STORAGE_KEY = 'health-state';
  const GRID = 64;
  const MAX_ELEVATION_TILES = 2;
  const MAX_MAP_DIMENSION = 10000;
  const DEFAULT_OPACITY = 0.65;
  const DEFAULT_MAP = { shape: 'square', width: 50, height: 50 };
  const TILE_STYLES = {
    stone: { fill: '#67675d', stroke: '#8a897c' },
    water: { fill: '#477e83', stroke: '#86b8b6' },
    grass: { fill: '#66824e', stroke: '#9cb277' },
    lava: { fill: '#a84e3c', stroke: '#e99561' },
    wall: { fill: '#9d9a8c', stroke: '#d0cdbd' }
  };
  const PROJECTILE_TYPES = {
    nullus: { label: 'Nullus', color: '#9c85ee', accent: '#e4d9ff', form: 'orb', particle: 'spark', trailOpacity: 0.68 },
    bansho: { label: 'Bansho', color: '#dce5ed', accent: '#ffffff', form: 'blade', particle: 'shard', trailOpacity: 0.82 },
    brutalis: { label: 'Brutalis', color: '#e58346', accent: '#ffd09a', form: 'impact', particle: 'shard', trailOpacity: 0.72 },
    geo: { label: 'Geo', color: '#78a957', accent: '#d8cf87', form: 'geo', particle: 'leaf', trailOpacity: 0.58 },
    tormenta: { label: 'Tormenta', color: '#50bde0', accent: '#e3fbff', form: 'storm', particle: 'bubble', trailOpacity: 0.78 },
    ignus: { label: 'Ignus', color: '#f05a32', accent: '#ffd35c', form: 'flame', particle: 'ember', trailOpacity: 0.52 },
    echo: { label: 'Echo', color: '#ed8fce', accent: '#ffe2f4', form: 'sonic', particle: 'ring', trailOpacity: 0.62 },
    psykos: { label: 'Psykos', color: '#c46ce6', accent: '#ffc7f4', form: 'mind', particle: 'spark', trailOpacity: 0.5 },
    pestys: { label: 'Pestys', color: '#a5c833', accent: '#eaff80', form: 'chemical', particle: 'bubble', trailOpacity: 0.6 },
    quimera: { label: 'Quimera', color: '#b54f62', accent: '#f2b0a5', form: 'flesh', particle: 'droplet', trailOpacity: 0.7 },
    techno: { label: 'Techno', color: '#55c7ae', accent: '#e4ffd9', form: 'tech', particle: 'spark', trailOpacity: 0.78 },
    gravitas: { label: 'Gravitas', color: '#8a78b8', accent: '#ddd0ff', form: 'gravity', particle: 'swirl', trailOpacity: 0.65 },
    spatium: { label: 'Spatium', color: '#58a8ed', accent: '#e4f2ff', form: 'space', particle: 'spark', trailOpacity: 0.74 },
    kronus: { label: 'Kronus', color: '#deb75b', accent: '#fff1b3', form: 'time', particle: 'ring', trailOpacity: 0.56 },
    umbrasis: { label: 'Umbrasis', color: '#57536d', accent: '#b5a9db', form: 'shadow', particle: 'smoke', trailOpacity: 0.48 },
    santis: { label: 'Santis', color: '#f3dc78', accent: '#ffffff', form: 'holy', particle: 'spark', trailOpacity: 0.82 },
    inmortus: { label: 'Inmortus', color: '#8296c9', accent: '#d8e2ff', form: 'soul', particle: 'smoke', trailOpacity: 0.54 },
    aius: { label: 'Aius', color: '#6cce8c', accent: '#d9ffbd', form: 'life', particle: 'leaf', trailOpacity: 0.66 },
    selenis: { label: 'Selenis', color: '#9daed9', accent: '#eef3ff', form: 'moon', particle: 'spark', trailOpacity: 0.56 },
    helios: { label: 'Helios', color: '#ffb932', accent: '#fff3a3', form: 'sun', particle: 'ember', trailOpacity: 0.86 },
    draco: { label: 'Draco', color: '#dc594c', accent: '#ffc56d', form: 'dragon', particle: 'ember', trailOpacity: 0.8 },
    inanis: { label: 'Inanis', color: '#49445f', accent: '#c7b9ef', form: 'void', particle: 'smoke', trailOpacity: 0.42 },
    kaos: { label: 'Kaos', color: '#e14db0', accent: '#ffd861', form: 'chaos', particle: 'spark', trailOpacity: 0.72 },
    destructio: { label: 'Destructio', color: '#53d66c', accent: '#f4fff2', form: 'destruction', particle: 'shard', trailOpacity: 0.88 },
    creatio: { label: 'Creatio', color: '#9e59d8', accent: '#1b1228', form: 'creation', particle: 'spark', trailOpacity: 0.64 }
  };
  const defaultHealthState = () => ({ currentHp: 80, maxHp: 100, color: '#22c55e', label: 'HP', textOutlineColor: '#111827', displayMode: 'values', imageDataUrl: '', damageEmoji: '💥', characters: [{ id: crypto.randomUUID(), name: 'Personagem 1', vitality: 70, vitalityMax: 100, lucidity: 55, lucidityMax: 100, linkedTokenId: null, imageDataUrl: '', emojiAuraEnabled: false, emojiAuraEmoji: '💥' }], bossName: 'Boss', bossMovement: 'none', bossAfterImageModes: ['bruta'], bossAfterImageColor: '#ff4d4d', turnOrder: [], activeTurnIndex: 0, lastDamage: null });
  const defaultState = () => ({ tokens: [], tiles: [], shapes: [], elevation: [], layers: [{ id: 'layer-1', name: 'Camada 1' }], activeLayerId: 'layer-1', opacity: DEFAULT_OPACITY, gridVisible: true, map: { ...DEFAULT_MAP }, initiative: { round: 1, activeTokenId: null, combatants: [] }, health: defaultHealthState() });
  const stateChannel = 'BroadcastChannel' in window ? new BroadcastChannel('stone-plate-state-v1') : null;
  const stateSubscribers = new Set();
  const seenDiceRolls = new Set();
  let state = loadState();
  let adminLibrary = loadAdminLibrary();
  let tool = 'select';
  let elevationLevel = 0.25;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let gridVisible = state.gridVisible !== false;
  let magnifierMode = 0;
  let magnifierZoom = 3;
  let magnifierFixedZoom = 0.3;
  let magnifierPointer = null;
  let lastPointerRaw = null;
  let lastPointerScreen = null;
  let selectedId = null;
  let selectedIds = new Set();
  let selectionBox = null;
  let activePointer = null;
  let currentShape = null;
  let currentToken = null;
  let pendingLineStart = null;
  let linePreview = null;
  let pendingProjectileStart = null;
  let projectilePreview = null;
  let activeProjectiles = [];
  let projectileImpacts = [];
  let projectileMarks = [];
  let projectileParticles = [];
  let projectileFrame = null;
  const objectTransitions = new Map();
  let objectAnimationFrame = null;
  const seenProjectiles = new Set();
  const seenProjectileTurns = new Set();
  let pendingTokenMove = null;
  let plannedMove = null;
  let movementMode = 'free';
  let locatedTokenId = null;
  let locateTimer = 0;
  let initiativeUiSignature = '';
  let layerUiSignature = '';
  let dragToken = null;
  let dragReadout = null;
  let movementRoute = null;
  let aimWorld = null;
  let panPointer = null;
  let peer = null;
  let hostMode = false;
  let roomId = '';
  let connections = new Map();
  let roomRole = 'admin';
  let localMemberTokenId = null;
  const roomMembers = new Map();
  let toastTimer = 0;
  let mapPathCacheKey = '';
  let mapPathCache = null;
  let mapOutlineCacheKey = '';
  let mapOutlineCache = null;
  let mapTileCountCacheKey = '';
  let mapTileCountCache = 0;
  const tokenImageCache = new Map();

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
      const health = saved?.health || JSON.parse(localStorage.getItem(LEGACY_HEALTH_STORAGE_KEY) || 'null') || defaultHealthState();
      if (saved && Array.isArray(saved.tokens) && Array.isArray(saved.tiles) && Array.isArray(saved.shapes)) return alignStateToGrid({ ...saved, health });
      return alignStateToGrid({ ...defaultState(), health });
    } catch (error) {
      console.warn('Não foi possível carregar o mapa salvo.', error);
    }
    return defaultState();
  }

  function loadAdminLibrary() {
    try {
      const saved = JSON.parse(localStorage.getItem(ADMIN_STORAGE_KEY) || '{}');
      return { maps: Array.isArray(saved.maps) ? saved.maps : [], projectiles: Array.isArray(saved.projectiles) ? saved.projectiles : [], tokens: Array.isArray(saved.tokens) ? saved.tokens : [] };
    } catch (error) {
      console.warn('Não foi possível carregar a biblioteca administrativa.', error);
      return { maps: [], projectiles: [], tokens: [] };
    }
  }

  function saveAdminLibrary() {
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(adminLibrary));
      renderAdminLibrary();
    } catch (error) { showToast('Não foi possível salvar na biblioteca local.'); }
  }

  function renderAdminLibrary() {
    for (const category of ['maps', 'projectiles', 'tokens']) {
      const list = document.querySelector(`#saved${category[0].toUpperCase()}${category.slice(1)}List`);
      if (!list) continue;
      list.replaceChildren();
      if (!adminLibrary[category].length) {
        const empty = document.createElement('div');
        empty.className = 'admin-empty';
        empty.textContent = 'Nenhum item salvo.';
        list.append(empty);
        continue;
      }
      for (const item of adminLibrary[category]) {
        const row = document.createElement('div');
        row.className = 'admin-saved-item';
        const name = document.createElement('span');
        name.className = 'admin-saved-name';
        name.textContent = item.name;
        const actions = document.createElement('div');
        actions.className = 'admin-saved-actions';
        const apply = document.createElement('button');
        apply.type = 'button';
        apply.dataset.libraryAction = 'apply';
        apply.dataset.category = category;
        apply.dataset.id = item.id;
        apply.textContent = category === 'maps' ? 'Abrir' : 'Aplicar';
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.dataset.libraryAction = 'delete';
        remove.dataset.category = category;
        remove.dataset.id = item.id;
        remove.textContent = 'Excluir';
        actions.append(apply, remove);
        row.append(name, actions);
        list.append(row);
      }
    }
  }

  function saveAdminPreset(category, name) {
    let data;
    if (category === 'maps') data = JSON.parse(JSON.stringify(state));
    if (category === 'projectiles') {
      data = Object.fromEntries(['projectileType', 'projectileAngle', 'projectileAoe', 'projectileSpeed', 'projectileWidth', 'projectileHeight', 'projectileDamage', 'projectileDamageDice'].map(id => [id, document.querySelector(`#${id}`).value]));
      data.projectileLinearTrail = document.querySelector('#projectileLinearTrail').checked;
      data.projectileAutoRollDamage = document.querySelector('#projectileAutoRollDamage').checked;
      data.projectilePierce = document.querySelector('#projectilePierce').checked;
      data.projectileInstant = document.querySelector('#projectileInstant').checked;
    }
    if (category === 'tokens') {
      data = Object.fromEntries(['tokenName', 'tokenColor', 'tokenWidth', 'tokenHeight'].map(id => [id, document.querySelector(`#${id}`).value]));
    }
    adminLibrary[category].unshift({ id: crypto.randomUUID(), name: name.trim(), data });
    saveAdminLibrary();
    showToast('Item salvo na biblioteca administrativa.');
  }

  function applyAdminPreset(category, item) {
    if (category === 'maps') {
      state = alignStateToGrid({ ...item.data, health: item.data.health || state.health });
      gridVisible = state.gridVisible !== false;
      setSelection([]);
      broadcastState();
      setWorkspace('map');
      showToast(`Mapa "${item.name}" carregado.`);
      return;
    }
    for (const [id, value] of Object.entries(item.data)) {
      const input = document.querySelector(`#${id}`);
      if (!input) continue;
      if (input.type === 'checkbox') input.checked = Boolean(value);
      else input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (category === 'tokens') document.querySelector('#tokenColorValue').textContent = document.querySelector('#tokenColor').value.toUpperCase();
    showToast(`Configuração "${item.name}" aplicada.`);
  }

  document.querySelectorAll('[data-library-form]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault();
    const name = form.elements.name.value.trim();
    if (!name) return;
    saveAdminPreset(form.dataset.libraryForm, name);
    form.reset();
  }));
  document.querySelector('#adminWorkspace').addEventListener('click', event => {
    const button = event.target.closest('[data-library-action]');
    if (!button) return;
    const { category, id, libraryAction } = button.dataset;
    const itemIndex = adminLibrary[category]?.findIndex(item => item.id === id);
    if (itemIndex < 0) return;
    if (libraryAction === 'delete') {
      adminLibrary[category].splice(itemIndex, 1);
      saveAdminLibrary();
      return;
    }
    if (libraryAction === 'apply') applyAdminPreset(category, adminLibrary[category][itemIndex]);
  });
  renderAdminLibrary();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      stateChannel?.postMessage({ type: 'state', state });
    }
    catch (error) { showToast('Não foi possível salvar. O mapa pode estar muito grande.'); }
  }

  function notifyStateSubscribers() {
    for (const subscriber of stateSubscribers) subscriber(state);
  }

  function syncHealthToTokens() {
    const characters = state.health?.characters;
    if (!Array.isArray(characters)) return;
    for (const character of characters) {
      const token = state.tokens.find(item => String(item.id) === String(character.linkedTokenId));
      if (!token) continue;
      token.name = character.name || token.name;
      token.health = {
        vitality: Number(character.vitality ?? character.hp ?? 0),
        vitalityMax: Number(character.vitalityMax ?? 100),
        lucidity: Number(character.lucidity ?? character.sanity ?? 0),
        lucidityMax: Number(character.lucidityMax ?? 100)
      };
    }
  }

  function syncTokenNamesToHealth() {
    const characters = state.health?.characters;
    if (!Array.isArray(characters)) return;
    for (const character of characters) {
      const token = state.tokens.find(item => String(item.id) === String(character.linkedTokenId));
      if (token && token.name) character.name = token.name;
    }
  }

  function syncInitiativeFromHealth() {
    const health = state.health;
    const characters = Array.isArray(health.characters) ? health.characters : [];
    for (const character of characters) {
      const tokenId = character.linkedTokenId;
      if (!tokenId || !state.tokens.some(token => String(token.id) === String(tokenId))) continue;
      if (!state.initiative.combatants.some(combatant => String(combatant.tokenId) === String(tokenId))) {
        state.initiative.combatants.push({ tokenId, initiative: null });
      }
    }
    const entries = [...characters.map(character => ({ id: `character-${character.id}`, character })), { id: 'boss', character: null }];
    const ordered = [];
    const seen = new Set();
    for (const item of Array.isArray(health.turnOrder) ? health.turnOrder : []) {
      const entry = entries.find(candidate => candidate.id === item.id);
      if (entry && !seen.has(entry.id)) { ordered.push(entry); seen.add(entry.id); }
    }
    for (const entry of entries) if (!seen.has(entry.id)) ordered.push(entry);
    const active = ordered[Math.max(0, Number(health.activeTurnIndex) || 0)];
    const activeTokenId = active?.character?.linkedTokenId;
    if (activeTokenId && state.initiative.combatants.some(item => String(item.tokenId) === String(activeTokenId))) state.initiative.activeTokenId = activeTokenId;
    else if (active?.id === 'boss') state.initiative.activeTokenId = null;
    state.initiative.round = Math.max(1, Number(health.round) || state.initiative.round || 1);
  }

  function syncHealthTurnFromMap() {
    const activeTokenId = state.initiative.activeTokenId;
    const character = state.health.characters.find(item => String(item.linkedTokenId || '') === String(activeTokenId || ''));
    if (character) {
      const entries = [...state.health.characters.map(item => ({ id: `character-${item.id}` })), { id: 'boss' }];
      const ordered = [];
      const seen = new Set();
      for (const item of Array.isArray(state.health.turnOrder) ? state.health.turnOrder : []) {
        if (entries.some(entry => entry.id === item.id) && !seen.has(item.id)) { ordered.push(item.id); seen.add(item.id); }
      }
      for (const entry of entries) if (!seen.has(entry.id)) ordered.push(entry.id);
      state.health.activeTurnIndex = ordered.indexOf(`character-${character.id}`);
    }
    state.health.round = state.initiative.round;
  }

  function broadcastState(origin = 'map') {
    if (origin !== 'characters') syncTokenNamesToHealth();
    if (origin !== 'characters') syncHealthTurnFromMap();
    syncHealthToTokens();
    saveState();
    render();
    notifyStateSubscribers();
    updatePlayers();
    if (hostMode) broadcast({ type: 'state', state });
    else if (peer && connections.has('host') && roomRole === 'admin') connections.get('host').send({ type: 'state', state });
  }

  function updateHealth(mutator) {
    const previousTurn = `${state.health.round || 1}:${state.health.activeTurnIndex || 0}`;
    mutator(state.health);
    if (previousTurn !== `${state.health.round || 1}:${state.health.activeTurnIndex || 0}`) advanceShapeAlerts();
    syncInitiativeFromHealth();
    broadcastState('characters');
  }

  function nextCharacterTokenPosition() {
    const { map } = mapWorldBounds();
    const origin = { x: snapCellCenter(0), y: snapCellCenter(0) };
    const occupied = new Set(state.tokens.map(token => `${token.x}:${token.y}`));
    for (let radius = 0; radius <= Math.max(map.width, map.height); radius++) {
      for (let row = -radius; row <= radius; row++) {
        for (let column = -radius; column <= radius; column++) {
          if (Math.max(Math.abs(column), Math.abs(row)) !== radius) continue;
          const position = { x: origin.x + column * GRID, y: origin.y + row * GRID };
          if (pointInsideMap(position) && !occupied.has(`${position.x}:${position.y}`)) return position;
        }
      }
    }
    return null;
  }

  function ensureCharacterTokens() {
    const health = state.health;
    if (health.characterTokensMigrated) return;
    let complete = true;
    for (const character of Array.isArray(health.characters) ? health.characters : []) {
      if (state.tokens.some(token => String(token.id) === String(character.linkedTokenId))) continue;
      const position = nextCharacterTokenPosition();
      if (!position) { complete = false; break; }
      const token = {
        id: crypto.randomUUID(), ...position, widthTiles: 1, heightTiles: 1, name: character.name || 'Personagem',
        color: '#d87054', opacity: state.opacity, layerId: state.activeLayerId || 'layer-1'
      };
      character.linkedTokenId = token.id;
      state.tokens.push(token);
    }
    health.characterTokensMigrated = complete;
  }

  function addCharacter(character) {
    const position = nextCharacterTokenPosition();
    if (!position) { showToast('Não há espaço livre no mapa para criar o token.'); return false; }
    const token = {
      id: crypto.randomUUID(), ...position, widthTiles: 1, heightTiles: 1, name: character.name || 'Personagem',
      color: '#d87054', opacity: state.opacity, layerId: state.activeLayerId || 'layer-1'
    };
    character.linkedTokenId = token.id;
    state.health.characters.push(character);
    state.tokens.push(token);
    syncHealthToTokens();
    syncInitiativeFromHealth();
    broadcastState('characters');
    return true;
  }

  function advanceHealthTurn() {
    const characters = Array.isArray(state.health.characters) ? state.health.characters : [];
    const entries = [...characters.map(character => ({ id: `character-${character.id}` })), { id: 'boss' }];
    const ordered = [];
    const seen = new Set();
    for (const saved of Array.isArray(state.health.turnOrder) ? state.health.turnOrder : []) {
      if (entries.some(entry => entry.id === saved.id) && !seen.has(saved.id)) { ordered.push(saved.id); seen.add(saved.id); }
    }
    for (const entry of entries) if (!seen.has(entry.id)) ordered.push(entry.id);
    state.health.activeTurnIndex = ((Number(state.health.activeTurnIndex) || 0) + 1) % ordered.length;
    state.health.round = Math.max(1, Number(state.health.round) || 1) + (state.health.activeTurnIndex === 0 ? 1 : 0);
    advanceShapeAlerts();
    syncInitiativeFromHealth();
    advanceProjectiles();
    broadcastState('characters');
  }

  window.StonePlate = {
    getState: () => state,
    updateHealth,
    addCharacter,
    advanceTurn: advanceHealthTurn,
    broadcastDiceRoll: publishDiceRoll,
    subscribe(callback) { stateSubscribers.add(callback); callback(state); return () => stateSubscribers.delete(callback); },
    notify: notifyStateSubscribers
  };

  function broadcast(message) {
    for (const connection of connections.values()) {
      if (connection.open) connection.send(message);
    }
  }

  function isRoomAdmin() { return hostMode || roomRole === 'admin'; }

  function canPlanToken(token) {
    if (!token) return false;
    if (isRoomAdmin()) return true;
    return Boolean(peer && roomRole === 'player' && String(localMemberTokenId) === String(token.id) && String(state.initiative.activeTokenId) === String(token.id));
  }

  function setPlannedMove(token, destination) {
    if (!canPlanToken(token)) {
      showToast('Esse token só pode ser movido por um admin ou por seu jogador no próprio turno.');
      return false;
    }
    if (!pointInsideMap(destination) || constructionBlocksRoute(token, destination)) {
      showToast('Uma construção bloqueia essa rota ou o destino está fora do mapa.');
      return false;
    }
    plannedMove = { tokenId: token.id, x: destination.x, y: destination.y };
    movementRoute = { start: { x: token.x, y: token.y }, end: { x: destination.x, y: destination.y } };
    drawMapScene(canvas.clientWidth, canvas.clientHeight);
    drawDragReadout();
    updateInspectorSelection();
    return true;
  }

  function clearPlannedMove() {
    plannedMove = null;
    pendingTokenMove = null;
    movementRoute = null;
    dragReadout = null;
    render();
  }

  function confirmPlannedMove() {
    const token = state.tokens.find(item => String(item.id) === String(plannedMove?.tokenId));
    if (!token || !canPlanToken(token)) { clearPlannedMove(); return; }
    const destination = { x: plannedMove.x, y: plannedMove.y };
    if (!pointInsideMap(destination) || constructionBlocksRoute(token, destination)) {
      showToast('A rota não é mais válida.');
      clearPlannedMove();
      return;
    }
    if (peer && !hostMode && connections.has('host')) {
      connections.get('host').send({ type: 'move-token', tokenId: token.id, x: destination.x, y: destination.y });
      clearPlannedMove();
      showToast('Movimento enviado à sala.');
      return;
    }
    const from = objectGeometry(visualObject(token));
    token.x = destination.x;
    token.y = destination.y;
    animateObjectFrom(token, from);
    clearPlannedMove();
    broadcastState();
  }

  function planTokenStep(dx, dy, distance = 1) {
    const token = state.tokens.find(item => String(item.id) === String(selectedId));
    if (!token || !canPlanToken(token)) return false;
    const start = plannedMove?.tokenId === token.id ? { x: plannedMove.x, y: plannedMove.y } : { x: token.x, y: token.y };
    return setPlannedMove(token, { x: start.x + dx * GRID * distance, y: start.y + dy * GRID * distance });
  }

  function receiveMoveRequest(message, connectionId) {
    const member = roomMembers.get(connectionId);
    const token = state.tokens.find(item => String(item.id) === String(message.tokenId));
    const isAdminRequest = member?.role === 'admin';
    const isPlayerRequest = member?.role === 'player' && String(member.tokenId || '') === String(message.tokenId) && String(state.initiative.activeTokenId || '') === String(message.tokenId);
    const destination = { x: snapCellCenter(Number(message.x)), y: snapCellCenter(Number(message.y)) };
    if ((!isAdminRequest && !isPlayerRequest) || !token || !Number.isFinite(destination.x) || !Number.isFinite(destination.y) ||
      !pointInsideMap(destination) || constructionBlocksRoute(token, destination)) return;
    const from = objectGeometry(visualObject(token));
    token.x = snapCellCenter(destination.x);
    token.y = snapCellCenter(destination.y);
    animateObjectFrom(token, from);
    broadcastState();
  }

  function broadcastRoomMembers(targetConnection = null) {
    const members = [...roomMembers.entries()].map(([id, member]) => ({ id, role: member.role, tokenId: member.tokenId || null }));
    const message = { type: 'room-members', members };
    if (targetConnection?.open) targetConnection.send(message);
    else if (hostMode) broadcast(message);
  }

  function applyRoomMemberUpdate(message, connectionId) {
    if (!hostMode) {
      if (roomRole === 'admin' && connections.get('host')?.open) connections.get('host').send({ type: 'member-update', memberId: message.memberId, role: message.role, tokenId: message.tokenId });
      return;
    }
    const sender = roomMembers.get(connectionId);
    if (connectionId !== 'local-admin' && (!sender || sender.role !== 'admin')) return;
    const target = roomMembers.get(String(message.memberId || ''));
    if (!target) return;
    if (message.role === 'admin' || message.role === 'player') target.role = message.role;
    const tokenExists = state.tokens.some(token => String(token.id) === String(message.tokenId || ''));
    target.tokenId = tokenExists ? String(message.tokenId) : null;
    const targetConnection = connections.get(String(message.memberId));
    if (targetConnection?.open) targetConnection.send({ type: 'room-session', role: target.role, tokenId: target.tokenId });
    broadcastRoomMembers();
    updatePlayers();
  }

  function renderRoomMembers(members) {
    roomMembers.clear();
    for (const member of members) if (member?.id) roomMembers.set(String(member.id), { role: member.role === 'admin' ? 'admin' : 'player', tokenId: member.tokenId || null });
    updatePlayers();
  }

  function publishDiceRoll(roll) {
    seenDiceRolls.add(roll.id);
    stateChannel?.postMessage({ type: 'dice-roll', roll });
    if (hostMode) broadcast({ type: 'dice-roll', roll });
    else if (peer && connections.has('host')) connections.get('host').send({ type: 'dice-roll', roll });
  }

  function receiveDiceRoll(roll, source) {
    const validSides = [2, 4, 6, 8, 10, 12, 20, 30, 60, 100];
    const validGroups = Array.isArray(roll?.groups) && roll.groups.length > 0 && roll.groups.length <= 20 &&
      roll.groups.every(group => group && typeof group === 'object' && validSides.includes(group.sides) && Array.isArray(group.values) &&
        group.values.length > 0 && group.values.length <= 999 &&
        group.values.every(value => Number.isInteger(value) && value >= 1 && value <= group.sides));
    const totalDice = validGroups ? roll.groups.reduce((sum, group) => sum + group.values.length, 0) : 0;
    if (!roll?.id || typeof roll.id !== 'string' || roll.id.length > 80 || seenDiceRolls.has(roll.id) ||
      !Number.isInteger(roll.criticalRate) || roll.criticalRate < 1 || roll.criticalRate > 5 ||
      !validGroups || totalDice > 999 || !Number.isSafeInteger(roll.modifier) || Math.abs(roll.modifier) > 100000 ||
      typeof roll.expression !== 'string' || roll.expression.length > 100 ||
      !/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/i.test(roll.expression)) return;
    seenDiceRolls.add(roll.id);
    if (seenDiceRolls.size > 200) seenDiceRolls.delete(seenDiceRolls.values().next().value);
    if (source === 'peer') {
      stateChannel?.postMessage({ type: 'dice-roll', roll });
      if (hostMode) broadcast({ type: 'dice-roll', roll });
    } else if (hostMode) broadcast({ type: 'dice-roll', roll });
    else if (peer && connections.has('host')) connections.get('host').send({ type: 'dice-roll', roll });
  }

  function resizeCanvas() {
    const bounds = canvasWrap.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    canvas.style.width = `${bounds.width}px`;
    canvas.style.height = `${bounds.height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    magnifierCanvas.width = Math.max(1, Math.round(196 * ratio));
    magnifierCanvas.height = Math.max(1, Math.round(196 * ratio));
    magnifierContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    render();
  }

  function viewSize() {
    return { width: canvas.clientWidth, height: canvas.clientHeight };
  }

  function worldToScreen(point) {
    const { width, height } = viewSize();
    return { x: point.x * zoom + width / 2 + panX, y: point.y * zoom + height / 2 + panY };
  }

  function screenToWorld(point) {
    const { width, height } = viewSize();
    return { x: (point.x - width / 2 - panX) / zoom, y: (point.y - height / 2 - panY) / zoom };
  }

  function pointerPosition(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function interactionPointerPosition(event) {
    const raw = pointerPosition(event);
    const screen = magnifierMode !== 0 && lastPointerRaw && lastPointerScreen
      ? {
          x: lastPointerScreen.x + (raw.x - lastPointerRaw.x) * 0.8,
          y: lastPointerScreen.y + (raw.y - lastPointerRaw.y) * 0.8
        }
      : raw;
    lastPointerRaw = raw;
    lastPointerScreen = screen;
    return screen;
  }

  function updateMagnifier() {
    const hud = document.querySelector('#magnifierHud');
    const visible = magnifierMode !== 0 && magnifierPointer !== null;
    hud.hidden = !visible;
    if (!visible) return;
    const size = 196;
    const center = screenToWorld(magnifierPointer);
    const mainContext = context;
    const mainZoom = zoom;
    const mainPanX = panX;
    const mainPanY = panY;
    try {
      context = magnifierContext;
      zoom = magnifierMode === 2 ? magnifierFixedZoom : mainZoom * magnifierZoom;
      panX = -center.x * zoom;
      panY = -center.y * zoom;
      drawMapScene(size, size);
    } finally {
      context = mainContext;
      zoom = mainZoom;
      panX = mainPanX;
      panY = mainPanY;
    }
    const readout = magnifierMode === 2
      ? `LUPA FIXA ~${Math.round(size / (GRID * magnifierFixedZoom))} tiles`
      : `LUPA ${magnifierZoom.toFixed(1)}x`;
    document.querySelector('#magnifierReadout').textContent = readout;
  }

  function mapWorldBounds(config = state.map) {
    const map = normalizeMapConfig(config);
    const left = -Math.floor(map.width / 2) * GRID;
    const top = -Math.floor(map.height / 2) * GRID;
    return { left, top, right: left + map.width * GRID, bottom: top + map.height * GRID, width: map.width * GRID, height: map.height * GRID, map };
  }

  function mapPath(config = state.map) {
    const bounds = mapWorldBounds(config);
    const cacheKey = `${bounds.map.shape}:${bounds.map.width}:${bounds.map.height}`;
    if (cacheKey === mapPathCacheKey && mapPathCache) return mapPathCache;
    const path = new Path2D();
    if (bounds.map.shape === 'circle' || bounds.map.shape === 'triangle') {
      for (let row = 0; row < bounds.map.height; row++) {
        const range = mapCellRange(bounds.map, row);
        if (range.start < range.end) path.rect(bounds.left + range.start * GRID, bounds.top + row * GRID, (range.end - range.start) * GRID, GRID);
      }
    } else path.rect(bounds.left, bounds.top, bounds.width, bounds.height);
    mapPathCacheKey = cacheKey;
    mapPathCache = path;
    return mapPathCache;
  }

  function mapCellInside(map, column, row) {
    if (column < 0 || row < 0 || column >= map.width || row >= map.height) return false;
    const x = (column + 0.5) / map.width;
    const y = (row + 0.5) / map.height;
    if (map.shape === 'circle') return ((x - 0.5) / 0.5) ** 2 + ((y - 0.5) / 0.5) ** 2 <= 1;
    if (map.shape === 'triangle') return Math.abs(x - 0.5) <= y / 2;
    return true;
  }

  function mapCellRange(map, row) {
    const y = (row + 0.5) / map.height;
    const halfWidth = map.shape === 'circle' ? Math.sqrt(Math.max(0, 1 - (2 * y - 1) ** 2)) / 2 : y / 2;
    let start = Math.max(0, Math.ceil((0.5 - halfWidth) * map.width - 0.5) - 1);
    let end = Math.min(map.width, Math.floor((0.5 + halfWidth) * map.width - 0.5) + 2);
    while (start < end && !mapCellInside(map, start, row)) start++;
    while (end > start && !mapCellInside(map, end - 1, row)) end--;
    return { start, end };
  }

  function mapOutlinePath(bounds) {
    const cacheKey = `${bounds.map.shape}:${bounds.map.width}:${bounds.map.height}`;
    if (cacheKey === mapOutlineCacheKey && mapOutlineCache) return mapOutlineCache;
    const path = new Path2D();
    const addExposedHorizontalEdges = (range, neighbor, y) => {
      if (range.start >= range.end) return;
      if (neighbor.start >= neighbor.end) {
        path.moveTo(bounds.left + range.start * GRID, y);
        path.lineTo(bounds.left + range.end * GRID, y);
        return;
      }
      if (range.start < neighbor.start) {
        path.moveTo(bounds.left + range.start * GRID, y);
        path.lineTo(bounds.left + Math.min(range.end, neighbor.start) * GRID, y);
      }
      if (range.end > neighbor.end) {
        path.moveTo(bounds.left + Math.max(range.start, neighbor.end) * GRID, y);
        path.lineTo(bounds.left + range.end * GRID, y);
      }
    };
    for (let row = 0; row < bounds.map.height; row++) {
      const range = mapCellRange(bounds.map, row);
      if (range.start >= range.end) continue;
      const top = bounds.top + row * GRID;
      const bottom = top + GRID;
      const empty = { start: 0, end: 0 };
      const previous = row > 0 ? mapCellRange(bounds.map, row - 1) : empty;
      const next = row + 1 < bounds.map.height ? mapCellRange(bounds.map, row + 1) : empty;
      addExposedHorizontalEdges(range, previous, top);
      addExposedHorizontalEdges(range, next, bottom);
      path.moveTo(bounds.left + range.start * GRID, top);
      path.lineTo(bounds.left + range.start * GRID, bottom);
      path.moveTo(bounds.left + range.end * GRID, top);
      path.lineTo(bounds.left + range.end * GRID, bottom);
    }
    mapOutlineCacheKey = cacheKey;
    mapOutlineCache = path;
    return mapOutlineCache;
  }

  function pointInsideMap(point, config = state.map) {
    const bounds = mapWorldBounds(config);
    const column = Math.floor((point.x - bounds.left) / GRID);
    const row = Math.floor((point.y - bounds.top) / GRID);
    return mapCellInside(bounds.map, column, row);
  }

  function countMapTiles(config = state.map) {
    const map = normalizeMapConfig(config);
    if (map.shape === 'rectangle' || map.shape === 'square') return map.width * map.height;
    const cacheKey = `${map.shape}:${map.width}:${map.height}`;
    if (cacheKey === mapTileCountCacheKey) return mapTileCountCache;
    let count = 0;
    for (let row = 0; row < map.height; row++) {
      const range = mapCellRange(map, row);
      count += range.end - range.start;
    }
    mapTileCountCacheKey = cacheKey;
    mapTileCountCache = count;
    return mapTileCountCache;
  }

  function aimPointFor(point) {
    if (tool === 'square' || tool === 'circle') return { x: snap(point.x), y: snap(point.y) };
    return { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
  }

  function drawAimIndicator() {
    if (!aimWorld) return;
    const cellBased = !['square', 'circle'].includes(tool);
    context.save();
    context.strokeStyle = '#dce8becc';
    context.lineWidth = 1.5 / zoom;
    context.setLineDash([4 / zoom, 3 / zoom]);
    if (cellBased) context.strokeRect(aimWorld.x - GRID / 2, aimWorld.y - GRID / 2, GRID, GRID);
    const radius = cellBased ? 8 / zoom : 11 / zoom;
    context.beginPath();
    context.moveTo(aimWorld.x - radius, aimWorld.y); context.lineTo(aimWorld.x + radius, aimWorld.y);
    context.moveTo(aimWorld.x, aimWorld.y - radius); context.lineTo(aimWorld.x, aimWorld.y + radius);
    context.stroke();
    context.restore();
  }

  function drawMovementRoute() {
    if (!movementRoute) return;
    const cells = gridCellRoute(movementRoute.start, movementRoute.end);
    if (cells.length < 2) return;
    context.save();
    cells.forEach((cell, index) => {
      const left = cell.x - GRID / 2;
      const top = cell.y - GRID / 2;
      context.fillStyle = index === 0 ? '#c1d48a24' : '#c1d48a42';
      context.fillRect(left, top, GRID, GRID);
      context.strokeStyle = '#c1d48add';
      context.lineWidth = 2 / zoom;
      context.strokeRect(left + 2 / zoom, top + 2 / zoom, GRID - 4 / zoom, GRID - 4 / zoom);
      const badgeX = left + 13 / zoom;
      const badgeY = top + 13 / zoom;
      context.beginPath();
      context.arc(badgeX, badgeY, 9 / zoom, 0, Math.PI * 2);
      context.fillStyle = '#20261def';
      context.fill();
      context.strokeStyle = '#d9e7ae';
      context.lineWidth = 1 / zoom;
      context.stroke();
      context.fillStyle = '#f2f5e8';
      context.font = `700 ${10 / zoom}px "DM Mono", Consolas, monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(index === 0 ? 'S' : String(index), badgeX, badgeY + 0.5 / zoom);
    });
    context.restore();
  }

  function projectileColor(type) {
    return PROJECTILE_TYPES[type]?.color || PROJECTILE_TYPES.nullus.color;
  }

  function projectileAccent(type) {
    return PROJECTILE_TYPES[type]?.accent || PROJECTILE_TYPES.nullus.accent;
  }

  function projectileVisualSize(projectile) {
    const widthTiles = Math.max(0.25, Number(projectile.widthTiles) || 0.5);
    const heightTiles = Math.max(0.25, Number(projectile.heightTiles) || 0.5);
    return {
      scaleX: widthTiles * GRID / 26,
      scaleY: heightTiles * GRID / 26,
      effectScale: Math.sqrt(widthTiles * heightTiles) * GRID / 26
    };
  }

  function drawProjectileParticles(projectile, position, angle, now) {
    const style = PROJECTILE_TYPES[projectile.kind]?.particle || 'spark';
    const color = projectileColor(projectile.kind);
    const accent = projectileAccent(projectile.kind);
    const opacity = PROJECTILE_TYPES[projectile.kind]?.trailOpacity ?? 0.7;
    const phase = now / (style === 'bubble' ? 360 : 125) + String(projectile.id).length;
    const particleCount = style === 'shard' ? 4 : style === 'ring' ? 3 : 6;
    context.save();
    context.translate(position.x, position.y);
    context.rotate(angle);
    const dimensions = projectileVisualSize(projectile);
    context.scale(dimensions.scaleX, dimensions.scaleY);
    for (let index = 0; index < particleCount; index++) {
      const age = (phase + index / particleCount) % 1;
      const distance = 8 + age * 34;
      const side = (index % 2 ? -1 : 1) * (4 + Math.sin(phase + index) * 5);
      const x = -distance;
      const y = style === 'swirl' ? side + Math.sin(age * Math.PI * 4 + index) * 9 : side;
      const size = (style === 'shard' ? 2.5 : 1.8) * (1 - age * 0.55);
      context.globalAlpha = (1 - age) * 0.82 * opacity;
      context.fillStyle = index % 2 ? accent : color;
      context.strokeStyle = context.fillStyle;
      context.lineWidth = 1.2;
      if (style === 'bubble') {
        context.beginPath(); context.arc(x, y, size * 1.6, 0, Math.PI * 2); context.stroke();
        context.beginPath(); context.arc(x - size / 2, y - size / 2, size / 3, 0, Math.PI * 2); context.fill();
      } else if (style === 'ring') {
        context.beginPath(); context.ellipse(x, y, size * 2.1, size, 0, 0, Math.PI * 2); context.stroke();
      } else if (style === 'swirl') {
        context.beginPath(); context.moveTo(x + size * 2, y); context.quadraticCurveTo(x, y - size * 2, x - size * 2, y); context.quadraticCurveTo(x, y + size * 2, x + size * 2, y); context.stroke();
      } else if (style === 'ember') {
        context.beginPath(); context.moveTo(x, y - size * 1.8); context.quadraticCurveTo(x + size * 1.8, y, x, y + size); context.quadraticCurveTo(x - size * 1.8, y, x, y - size * 1.8); context.fill();
      } else if (style === 'shard' || style === 'leaf') {
        context.translate(x, y);
        context.rotate((style === 'leaf' ? 1 : -1) * (phase + index));
        context.beginPath();
        context.moveTo(size * 1.6, 0); context.lineTo(0, -size * 0.65); context.lineTo(-size, 0); context.lineTo(0, size * 0.65); context.closePath(); context.fill();
        if (style === 'leaf') { context.beginPath(); context.moveTo(-size, 0); context.lineTo(size, 0); context.stroke(); }
        context.rotate(-(style === 'leaf' ? 1 : -1) * (phase + index));
        context.translate(-x, -y);
      } else if (style === 'smoke') {
        context.globalAlpha *= 0.5;
        context.beginPath(); context.arc(x, y, size * (1.5 + age), 0, Math.PI * 2); context.fill();
      } else if (style === 'droplet') {
        context.beginPath(); context.moveTo(x, y - size * 1.7); context.quadraticCurveTo(x + size * 1.8, y, x, y + size); context.quadraticCurveTo(x - size * 1.8, y, x, y - size * 1.7); context.fill();
      } else {
        context.beginPath(); context.moveTo(x - size * 1.5, y); context.lineTo(x + size * 1.5, y); context.moveTo(x, y - size * 1.5); context.lineTo(x, y + size * 1.5); context.stroke();
        context.beginPath(); context.arc(x, y, size * 0.55, 0, Math.PI * 2); context.fill();
      }
    }
    context.restore();
  }

  function drawProjectileTrailDetail(projectile, tailStart, position, angle, now) {
    const form = PROJECTILE_TYPES[projectile.kind]?.form;
    const color = projectileColor(projectile.kind);
    const accent = projectileAccent(projectile.kind);
    const size = projectileVisualSize(projectile).effectScale;
    const opacity = PROJECTILE_TYPES[projectile.kind]?.trailOpacity ?? 0.7;
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 2 * size;
    if (form === 'orb') {
      context.globalAlpha = 0.5 * opacity;
      context.strokeStyle = accent;
      for (let glyph = 0; glyph < 3; glyph++) {
        const t = Math.max(0, projectile.progress - glyph * 0.09);
        const center = projectilePoint(projectile, t);
        const rotation = now / 420 + glyph * Math.PI / 4;
        context.beginPath();
        for (let point = 0; point < 6; point++) {
          const a = rotation + point * Math.PI / 3;
          const px = center.x + Math.cos(a) * (4 + glyph * 2) * size;
          const py = center.y + Math.sin(a) * (4 + glyph * 2) * size;
          if (!point) context.moveTo(px, py); else context.lineTo(px, py);
        }
        context.closePath(); context.stroke();
      }
    } else if (form === 'storm') {
      const dx = position.x - tailStart.x;
      const dy = position.y - tailStart.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / length;
      const ny = dx / length;
      context.globalAlpha = 0.72 * opacity;
      context.strokeStyle = accent;
      context.beginPath();
      for (let step = 0; step <= 6; step++) {
        const t = step / 6;
        const offset = step === 0 || step === 6 ? 0 : (step % 2 ? 6 : -6) * size;
        const x = tailStart.x + dx * t + nx * offset;
        const y = tailStart.y + dy * t + ny * offset;
        if (!step) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.stroke();
      context.globalAlpha = 0.45 * opacity;
      context.strokeStyle = color;
      for (let wave = 0; wave < 2; wave++) {
        const center = projectilePoint(projectile, Math.max(0, projectile.progress - 0.08 * wave));
        context.beginPath(); context.ellipse(center.x, center.y, 12 * size, 5 * size, angle, 0, Math.PI * 2); context.stroke();
      }
      context.globalAlpha = 0.7 * opacity;
      context.strokeStyle = '#d7fff9';
      for (let ribbon = -1; ribbon <= 1; ribbon += 2) {
        context.beginPath();
        context.moveTo(tailStart.x, tailStart.y);
        context.quadraticCurveTo((tailStart.x + position.x) / 2 - Math.sin(angle) * ribbon * 9 * size, (tailStart.y + position.y) / 2 + Math.cos(angle) * ribbon * 9 * size, position.x, position.y);
        context.stroke();
      }
    } else if (form === 'geo') {
      context.globalAlpha = 0.32 * opacity;
      context.strokeStyle = '#d8cf87';
      context.beginPath(); context.moveTo(tailStart.x, tailStart.y); context.lineTo(position.x, position.y); context.stroke();
      for (let bit = 0; bit < 5; bit++) {
        const t = ((now / 90 + bit * 0.21) % 1);
        const point = projectilePoint(projectile, Math.max(0, projectile.progress - t * 0.24));
        context.globalAlpha = (1 - t) * 0.8 * opacity;
        context.fillStyle = bit % 2 ? '#756749' : '#a8b978';
        context.beginPath(); context.arc(point.x + Math.sin(bit * 8) * 7 * size, point.y + Math.cos(bit * 5) * 6 * size, (1.5 + (bit % 2)) * size, 0, Math.PI * 2); context.fill();
      }
    } else if (form === 'flame') {
      context.globalAlpha = 0.23 * opacity;
      context.fillStyle = '#77736b';
      for (let puff = 0; puff < 5; puff++) {
        const t = (now / 420 + puff * 0.2) % 1;
        const point = projectilePoint(projectile, Math.max(0, projectile.progress - t * 0.28));
        const radius = (3 + t * 7) * size;
        context.beginPath(); context.arc(point.x - Math.cos(angle) * t * 22 * size, point.y - Math.sin(angle) * t * 22 * size, radius, 0, Math.PI * 2); context.fill();
      }
      context.globalAlpha = 0.4 * opacity;
      context.strokeStyle = '#ffbf52';
      for (let wave = -1; wave <= 1; wave += 2) {
        context.beginPath();
        context.moveTo(tailStart.x, tailStart.y + wave * 5 * size);
        context.quadraticCurveTo((tailStart.x + position.x) / 2, (tailStart.y + position.y) / 2 + Math.sin(now / 65 + wave) * 8 * size, position.x, position.y + wave * 5 * size);
        context.stroke();
      }
    } else if (form === 'blade') {
      context.globalAlpha = 0.62 * opacity;
      context.strokeStyle = accent;
      for (let slash = -1; slash <= 1; slash++) {
        context.beginPath(); context.moveTo(tailStart.x - Math.sin(angle) * slash * 5 * size, tailStart.y + Math.cos(angle) * slash * 5 * size);
        context.lineTo(position.x - Math.sin(angle) * slash * 2 * size, position.y + Math.cos(angle) * slash * 2 * size); context.stroke();
      }
    } else if (form === 'impact' || form === 'tech' || form === 'destruction') {
      context.globalAlpha = 0.5 * opacity;
      context.strokeStyle = form === 'destruction' ? '#ffffff' : accent;
      for (let streak = -1; streak <= 1; streak++) {
        context.beginPath(); context.moveTo(tailStart.x + Math.sin(angle) * streak * 5 * size, tailStart.y - Math.cos(angle) * streak * 5 * size);
        context.lineTo(position.x, position.y); context.stroke();
      }
      if (form === 'tech') { context.globalAlpha = 0.75 * opacity; context.fillStyle = accent; context.beginPath(); context.arc(tailStart.x, tailStart.y, 2 * size, 0, Math.PI * 2); context.fill(); }
    } else if (form === 'sonic' || form === 'holy' || form === 'time' || form === 'soul') {
      context.globalAlpha = 0.4 * opacity;
      context.strokeStyle = accent;
      for (let ring = 0; ring < 3; ring++) {
        const t = ring / 3;
        const center = projectilePoint(projectile, Math.max(0, projectile.progress - t * 0.12));
        context.beginPath(); context.ellipse(center.x, center.y, (8 + ring * 4) * size, (4 + ring * 2) * size, angle, 0, Math.PI * 2); context.stroke();
      }
    } else if (form === 'chemical' || form === 'flesh' || form === 'life') {
      context.globalAlpha = 0.55 * opacity;
      for (let drop = 0; drop < 4; drop++) {
        const t = ((now / 260 + drop * 0.25) % 1);
        const point = projectilePoint(projectile, Math.max(0, projectile.progress - t * 0.25));
        context.fillStyle = form === 'life' ? '#9ded83' : accent;
        context.beginPath(); context.arc(point.x + Math.sin(drop * 7) * 7 * size, point.y + Math.cos(drop * 4) * 5 * size, (1.5 + t * 2) * size, 0, Math.PI * 2); context.fill();
      }
    } else if (form === 'gravity' || form === 'space' || form === 'moon' || form === 'void') {
      context.globalAlpha = 0.55 * opacity;
      for (let orbit = 0; orbit < 3; orbit++) {
        const t = (now / 500 + orbit / 3) % 1;
        const center = projectilePoint(projectile, Math.max(0, projectile.progress - t * 0.18));
        const a = now / 180 + orbit * Math.PI * 2 / 3;
        context.fillStyle = orbit % 2 ? accent : color;
        context.beginPath(); context.arc(center.x + Math.cos(a) * 8 * size, center.y + Math.sin(a) * 5 * size, (1.4 + orbit * 0.3) * size, 0, Math.PI * 2); context.fill();
      }
    } else if (form === 'mind' || form === 'chaos' || form === 'creation' || form === 'shadow') {
      context.globalAlpha = 0.58 * opacity;
      context.strokeStyle = accent;
      context.beginPath();
      for (let step = 0; step <= 8; step++) {
        const t = step / 8;
        const point = projectilePoint(projectile, Math.max(0, projectile.progress - t * 0.28));
        const offset = Math.sin(now / 75 + step * 1.8) * (3 + step) * size;
        if (!step) context.moveTo(point.x + offset, point.y - offset); else context.lineTo(point.x + offset, point.y - offset);
      }
      context.stroke();
    } else if (form === 'sun' || form === 'dragon' || form === 'santis') {
      context.globalAlpha = 0.48 * opacity;
      context.strokeStyle = accent;
      context.beginPath(); context.moveTo(tailStart.x, tailStart.y); context.lineTo(position.x, position.y); context.stroke();
      for (let spark = 0; spark < 4; spark++) {
        const t = (now / 180 + spark * 0.25) % 1;
        const point = projectilePoint(projectile, Math.max(0, projectile.progress - t * 0.22));
        context.beginPath(); context.arc(point.x + Math.sin(now / 90 + spark) * 5 * size, point.y + Math.cos(now / 110 + spark) * 5 * size, 1.5 * size, 0, Math.PI * 2); context.fill();
      }
    }
    context.restore();
  }

  function drawProjectileImpactDetail(impact, progress, now) {
    const form = PROJECTILE_TYPES[impact.kind]?.form;
    const color = projectileColor(impact.kind);
    const accent = projectileAccent(impact.kind);
    const size = projectileVisualSize(impact).effectScale;
    const radius = (8 + progress * 38) * size;
    const x = impact.end.x;
    const y = impact.end.y;
    context.save();
    context.globalAlpha = (1 - progress) * 0.85;
    context.lineWidth = 2 * size;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = color;
    context.fillStyle = color;
    const circle = (r, alpha = 1) => { context.globalAlpha = (1 - progress) * alpha; context.beginPath(); context.arc(x, y, r * size, 0, Math.PI * 2); context.stroke(); };
    if (form === 'storm') {
      circle(radius, 0.65);
      context.strokeStyle = '#e1ffff';
      for (let arc = 0; arc < 3; arc++) {
        const a = now / 130 + arc * Math.PI * 2 / 3;
        context.beginPath(); context.arc(x, y, (10 + progress * 18) * size, a, a + 1.25); context.stroke();
      }
      for (let bolt = 0; bolt < 6; bolt++) {
        const a = bolt * Math.PI / 3;
        const bx = x + Math.cos(a) * radius * 0.35;
        const by = y + Math.sin(a) * radius * 0.35;
        context.beginPath(); context.moveTo(bx, by); context.lineTo(bx + Math.cos(a + 0.2) * 7 * size, by + Math.sin(a + 0.2) * 7 * size); context.lineTo(bx + Math.cos(a) * 17 * size, by + Math.sin(a) * 17 * size); context.stroke();
      }
      context.globalAlpha = (1 - progress) * 0.34;
      context.fillStyle = '#9befff';
      context.beginPath(); context.arc(x, y, (5 + progress * 12) * size, 0, Math.PI * 2); context.fill();
    } else if (form === 'geo') {
      context.globalAlpha = (1 - progress) * 0.18;
      context.fillStyle = '#79684e';
      context.beginPath(); context.ellipse(x, y, (14 + progress * 26) * size, (9 + progress * 15) * size, 0, 0, Math.PI * 2); context.fill();
      context.globalAlpha = (1 - progress) * 0.85;
      context.strokeStyle = '#b7a27b';
      for (let crack = 0; crack < 8; crack++) {
        const a = crack * Math.PI / 4 + Math.sin(now / 100 + crack) * 0.08;
        const reach = (12 + progress * 28) * size;
        context.beginPath(); context.moveTo(x, y); context.lineTo(x + Math.cos(a) * reach * 0.55, y + Math.sin(a) * reach * 0.55); context.lineTo(x + Math.cos(a + 0.08) * reach, y + Math.sin(a + 0.08) * reach); context.stroke();
      }
      context.fillStyle = '#87995a';
      for (let moss = 0; moss < 5; moss++) {
        const a = moss * Math.PI * 2 / 5;
        context.beginPath(); context.ellipse(x + Math.cos(a) * radius * 0.65, y + Math.sin(a) * radius * 0.65, 3 * size, 1.5 * size, a, 0, Math.PI * 2); context.fill();
      }
      circle(radius, 0.32);
    } else if (form === 'flame') {
      context.globalAlpha = (1 - progress) * 0.7;
      context.strokeStyle = '#ffdb72';
      context.lineWidth = (4 - progress * 2) * size;
      circle(radius * 0.72, 0.7);
      context.globalAlpha = (1 - progress) * 0.32;
      context.fillStyle = '#ff542d';
      context.beginPath(); context.arc(x, y, (8 + progress * 25) * size, 0, Math.PI * 2); context.fill();
      context.globalAlpha = (1 - progress) * 0.58;
      context.strokeStyle = '#ffae48';
      for (let flame = 0; flame < 8; flame++) {
        const a = flame * Math.PI / 4 + now / 400;
        const r1 = (7 + progress * 10) * size;
        const r2 = (20 + progress * 24) * size;
        context.beginPath(); context.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); context.quadraticCurveTo(x + Math.cos(a + 0.12) * r2, y + Math.sin(a + 0.12) * r2, x + Math.cos(a) * r2, y + Math.sin(a) * r2); context.stroke();
      }
      context.fillStyle = '#6d6964'; context.globalAlpha = (1 - progress) * 0.18;
      for (let smoke = 0; smoke < 4; smoke++) { context.beginPath(); context.arc(x + Math.sin(now / 200 + smoke) * 12 * size, y - (smoke * 7 + progress * 18) * size, (3 + smoke) * size, 0, Math.PI * 2); context.fill(); }
    } else {
      circle(radius, 0.72);
      context.strokeStyle = accent;
      const spin = form === 'gravity' || form === 'space' || form === 'time' || form === 'chaos' ? now / 220 : 0;
      for (let ray = 0; ray < 8; ray++) {
        const a = ray * Math.PI / 4 + spin;
        const inner = (5 + progress * 8) * size;
        const outer = (14 + progress * 34) * size;
        context.beginPath(); context.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner); context.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer); context.stroke();
      }
      if (form === 'sonic') {
        for (let wave = 0; wave < 3; wave++) { context.globalAlpha = (1 - progress) * (0.7 - wave * 0.15); context.beginPath(); context.ellipse(x, y, radius + wave * 8 * size, radius * 0.55 + wave * 5 * size, 0, 0, Math.PI * 2); context.stroke(); }
      } else if (form === 'blade') {
        context.beginPath(); context.moveTo(x - radius, y - radius * 0.35); context.lineTo(x + radius, y + radius * 0.35); context.moveTo(x - radius, y + radius * 0.35); context.lineTo(x + radius, y - radius * 0.35); context.stroke();
      } else if (form === 'tech') {
        context.strokeRect(x - radius * 0.6, y - radius * 0.6, radius * 1.2, radius * 1.2);
      } else if (form === 'moon') {
        context.fillStyle = '#171a19'; context.globalAlpha = 1 - progress; context.beginPath(); context.arc(x + 5 * size, y - 4 * size, 9 * size, 0, Math.PI * 2); context.fill();
      } else if (form === 'life' || form === 'geo') {
        context.fillStyle = accent; context.globalAlpha = (1 - progress) * 0.8;
        context.beginPath(); context.ellipse(x - 4 * size, y - 5 * size, 3 * size, 7 * size, -0.6, 0, Math.PI * 2); context.ellipse(x + 4 * size, y - 5 * size, 3 * size, 7 * size, 0.6, 0, Math.PI * 2); context.fill();
      } else if (form === 'destruction') {
        context.fillStyle = '#ffffff'; context.globalAlpha = (1 - progress) * 0.85; context.beginPath(); context.arc(x, y, (3 + progress * 7) * size, 0, Math.PI * 2); context.fill();
      } else if (form === 'creation') {
        context.fillStyle = '#1b1228'; context.globalAlpha = (1 - progress) * 0.85; context.beginPath(); context.arc(x, y, (3 + progress * 7) * size, 0, Math.PI * 2); context.fill();
      } else if (form === 'impact') {
        context.strokeStyle = accent;
        context.lineWidth = (4 - progress * 2) * size;
        for (let ring = 0; ring < 3; ring++) {
          context.beginPath(); context.ellipse(x, y, (8 + progress * 30 + ring * 7) * size, (5 + progress * 14 + ring * 4) * size, now / 900 + ring * 0.12, 0, Math.PI * 2); context.stroke();
        }
      } else if (form === 'mind') {
        context.globalAlpha = (1 - progress) * 0.45;
        for (let illusion = 0; illusion < 3; illusion++) {
          const offset = Math.sin(now / 100 + illusion * 2) * 10 * size;
          context.strokeStyle = illusion % 2 ? accent : color;
          context.beginPath(); context.arc(x + offset, y - offset * 0.5, (8 + progress * 18) * size, 0, Math.PI * 2); context.stroke();
        }
      } else if (form === 'chemical') {
        context.globalAlpha = (1 - progress) * 0.34;
        context.fillStyle = color;
        context.beginPath(); context.ellipse(x, y, (10 + progress * 22) * size, (6 + progress * 12) * size, 0, 0, Math.PI * 2); context.fill();
        context.globalAlpha = 1 - progress;
        context.strokeStyle = accent;
        for (let bubble = 0; bubble < 7; bubble++) {
          const a = bubble * Math.PI * 2 / 7;
          const bx = x + Math.cos(a) * radius * 0.65;
          const by = y + Math.sin(a) * radius * 0.5;
          context.beginPath(); context.arc(bx, by, (1.5 + (bubble % 3)) * size, 0, Math.PI * 2); context.stroke();
        }
      } else if (form === 'flesh') {
        context.globalAlpha = (1 - progress) * 0.7;
        context.strokeStyle = accent;
        for (let drop = 0; drop < 7; drop++) {
          const a = drop * Math.PI * 2 / 7;
          const reach = (8 + progress * 24 + (drop % 2) * 6) * size;
          context.beginPath(); context.moveTo(x, y); context.lineTo(x + Math.cos(a) * reach, y + Math.sin(a) * reach); context.stroke();
          context.beginPath(); context.arc(x + Math.cos(a) * reach, y + Math.sin(a) * reach, (1.5 + drop % 2) * size, 0, Math.PI * 2); context.fill();
        }
      } else if (form === 'gravity') {
        context.strokeStyle = accent;
        for (let orbit = 0; orbit < 3; orbit++) {
          const a = now / 260 + orbit * Math.PI * 2 / 3;
          context.beginPath(); context.ellipse(x, y, (radius - orbit * 5 * size), (radius * 0.4 - orbit * 2 * size), a, 0.15, Math.PI * 1.65); context.stroke();
        }
        context.globalAlpha = (1 - progress) * 0.24;
        context.fillStyle = '#111018'; context.beginPath(); context.arc(x, y, (4 + progress * 12) * size, 0, Math.PI * 2); context.fill();
      } else if (form === 'space') {
        context.strokeStyle = accent;
        context.beginPath(); context.ellipse(x, y, radius, radius * 0.42, now / 600, 0, Math.PI * 2); context.stroke();
        context.beginPath(); context.ellipse(x, y, radius * 0.42, radius, -now / 700, 0, Math.PI * 2); context.stroke();
        context.fillStyle = '#ffffff';
        for (let star = 0; star < 5; star++) { const a = star * Math.PI * 2 / 5; context.beginPath(); context.arc(x + Math.cos(a) * radius * 0.55, y + Math.sin(a) * radius * 0.55, 1.4 * size, 0, Math.PI * 2); context.fill(); }
      } else if (form === 'time') {
        context.strokeStyle = accent;
        context.beginPath(); context.arc(x, y, radius * 0.72, 0, Math.PI * 2); context.stroke();
        for (let tick = 0; tick < 12; tick++) { const a = tick * Math.PI / 6; context.beginPath(); context.moveTo(x + Math.cos(a) * radius * 0.58, y + Math.sin(a) * radius * 0.58); context.lineTo(x + Math.cos(a) * radius * 0.7, y + Math.sin(a) * radius * 0.7); context.stroke(); }
        context.beginPath(); context.moveTo(x, y); context.lineTo(x + Math.cos(now / 400) * radius * 0.45, y + Math.sin(now / 400) * radius * 0.45); context.stroke();
      } else if (form === 'shadow' || form === 'void') {
        context.globalAlpha = (1 - progress) * 0.3;
        context.fillStyle = '#100e19'; context.beginPath(); context.ellipse(x, y, radius, radius * 0.55, 0, 0, Math.PI * 2); context.fill();
        if (form === 'void') { context.strokeStyle = accent; context.globalAlpha = 1 - progress; context.beginPath(); context.arc(x, y, radius * 0.55, now / 500, now / 500 + Math.PI * 1.6); context.stroke(); }
        else { context.fillStyle = color; for (let wisp = 0; wisp < 4; wisp++) { context.beginPath(); context.arc(x + Math.sin(now / 300 + wisp) * radius * 0.55, y - wisp * 3 * size, (3 + wisp) * size, 0, Math.PI * 2); context.fill(); } }
      } else if (form === 'holy') {
        context.strokeStyle = accent;
        context.beginPath(); context.ellipse(x, y, radius * 0.8, radius * 0.28, now / 900, 0, Math.PI * 2); context.stroke();
        context.beginPath(); context.ellipse(x, y, radius * 0.28, radius * 0.8, -now / 900, 0, Math.PI * 2); context.stroke();
      } else if (form === 'soul') {
        context.globalAlpha = (1 - progress) * 0.48;
        for (let soul = 0; soul < 3; soul++) {
          const drift = Math.sin(now / 160 + soul * 2) * 8 * size;
          context.fillStyle = soul % 2 ? accent : color;
          context.beginPath(); context.moveTo(x + drift, y - radius * 0.45); context.quadraticCurveTo(x + drift + 8 * size, y, x + drift, y + radius * 0.4); context.quadraticCurveTo(x + drift - 8 * size, y, x + drift, y - radius * 0.45); context.fill();
        }
      } else if (form === 'sun' || form === 'dragon') {
        context.strokeStyle = accent;
        context.lineWidth = (form === 'dragon' ? 3 : 2) * size;
        for (let ray = 0; ray < (form === 'dragon' ? 6 : 12); ray++) {
          const a = ray * Math.PI * 2 / (form === 'dragon' ? 6 : 12) + (form === 'dragon' ? 0 : now / 500);
          const inner = (7 + progress * 6) * size;
          const outer = (radius + (ray % 2) * 5 * size);
          context.beginPath(); context.moveTo(x + Math.cos(a) * inner, y + Math.sin(a) * inner); context.lineTo(x + Math.cos(a) * outer, y + Math.sin(a) * outer); context.stroke();
        }
      } else if (form === 'brutalis') {
        circle(radius * 0.7, 0.8);
      }
    }
    context.restore();
  }

  function projectilePoint(projectile, progress) {
    const amount = Math.min(1, Math.max(0, progress));
    return {
      x: projectile.start.x + (projectile.end.x - projectile.start.x) * amount,
      y: projectile.start.y + (projectile.end.y - projectile.start.y) * amount
    };
  }

  function drawProjectileEffect(projectile, progress, preview = false) {
    const color = projectileColor(projectile.kind);
    const position = projectilePoint(projectile, progress);
    const distance = Math.max(1, projectile.distance || Math.hypot(projectile.end.x - projectile.start.x, projectile.end.y - projectile.start.y));
    const trailProgress = Math.min(progress, 34 / distance);
    const tailStart = projectilePoint(projectile, Math.max(0, progress - trailProgress));
    const heading = Math.hypot(position.x - tailStart.x, position.y - tailStart.y) > 0.01
      ? tailStart
      : projectilePoint(projectile, Math.min(1, progress + 0.01));
    const angle = Math.atan2(position.y - heading.y, position.x - heading.x) + (heading === tailStart ? 0 : Math.PI);
    const fade = Math.max(0, 1 - Math.max(0, progress - 0.92) / 0.08);
    context.save();
    if (preview) {
      context.globalAlpha = 0.62;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.setLineDash([8, 5]);
      context.beginPath(); context.moveTo(projectile.start.x, projectile.start.y); context.lineTo(projectile.end.x, projectile.end.y); context.stroke();
      context.setLineDash([]);
      context.translate(projectile.end.x, projectile.end.y);
      context.rotate(angle);
      const projectileDimensions = projectileVisualSize(projectile);
      context.scale(projectileDimensions.scaleX, projectileDimensions.scaleY);
      context.fillStyle = color;
      context.beginPath(); context.moveTo(8, 0); context.lineTo(-4, -4); context.lineTo(-4, 4); context.closePath(); context.fill();
    } else {
      const accent = projectileAccent(projectile.kind);
      const pulse = 0.82 + Math.sin(performance.now() / 55) * 0.18;
      context.globalAlpha = fade * (PROJECTILE_TYPES[projectile.kind]?.trailOpacity ?? 0.7);
      context.strokeStyle = color;
      context.lineCap = 'round';
      context.shadowColor = color;
      context.shadowBlur = 13;
      context.lineWidth = PROJECTILE_TYPES[projectile.kind]?.form === 'blade' ? 2.2 : 5;
      if (projectile.linearTrail) {
        context.beginPath(); context.moveTo(tailStart.x, tailStart.y); context.lineTo(position.x, position.y); context.stroke();
      }
      drawProjectileTrailDetail(projectile, tailStart, position, angle, performance.now());
      drawProjectileParticles(projectile, position, angle, performance.now());
      context.translate(position.x, position.y); context.rotate(angle);
      const projectileDimensions = projectileVisualSize(projectile);
      context.scale(projectileDimensions.scaleX, projectileDimensions.scaleY);
      context.globalAlpha = fade * pulse;
      context.shadowBlur = 12;
      context.shadowColor = color;
      context.lineWidth = 1.7;
      context.fillStyle = color;
      context.strokeStyle = accent;
      const form = PROJECTILE_TYPES[projectile.kind]?.form || 'orb';
      if (form === 'blade') {
        context.beginPath(); context.moveTo(13, 0); context.lineTo(-7, -5); context.lineTo(-2, 0); context.lineTo(-7, 5); context.closePath(); context.fill();
        context.beginPath(); context.moveTo(7, -2); context.lineTo(-9, -7); context.moveTo(7, 2); context.lineTo(-9, 7); context.stroke();
      } else if (form === 'impact' || form === 'geo') {
        context.beginPath(); context.moveTo(11, 0); context.lineTo(4, -7); context.lineTo(-2, -5); context.lineTo(-9, -2); context.lineTo(-6, 5); context.lineTo(2, 8); context.lineTo(8, 5); context.closePath(); context.fill();
        context.beginPath(); context.moveTo(-4, -2); context.lineTo(1, 1); context.lineTo(5, -3); context.stroke();
        if (form === 'impact') { context.beginPath(); context.moveTo(-11, -8); context.lineTo(-6, -4); context.moveTo(-12, 8); context.lineTo(-6, 4); context.stroke(); }
      } else if (form === 'storm') {
        context.beginPath(); context.moveTo(2, -11); context.lineTo(-5, -1); context.lineTo(0, -1); context.lineTo(-3, 10); context.lineTo(7, -3); context.lineTo(2, -3); context.closePath(); context.fill();
        context.beginPath(); context.arc(0, 0, 10, -1.15, 1.15); context.stroke();
      } else if (form === 'flame' || form === 'dragon' || form === 'sun') {
        context.beginPath(); context.moveTo(12, 0); context.quadraticCurveTo(2, -4, 2, -10); context.quadraticCurveTo(-3, -6, -2, -3); context.quadraticCurveTo(-10, -7, -8, -1); context.quadraticCurveTo(-13, 5, -3, 8); context.quadraticCurveTo(5, 9, 12, 0); context.fill();
        context.fillStyle = accent; context.beginPath(); context.moveTo(7, 0); context.quadraticCurveTo(0, -3, -5, 0); context.quadraticCurveTo(0, 4, 7, 0); context.fill();
        if (form === 'sun') { context.strokeStyle = accent; for (let ray = 0; ray < 8; ray++) { const a = ray * Math.PI / 4; context.beginPath(); context.moveTo(Math.cos(a) * 11, Math.sin(a) * 11); context.lineTo(Math.cos(a) * 15, Math.sin(a) * 15); context.stroke(); } }
        if (form === 'dragon') { context.strokeStyle = accent; context.beginPath(); context.moveTo(-3, -2); context.lineTo(-11, -9); context.lineTo(-8, 0); context.moveTo(-3, 2); context.lineTo(-11, 9); context.lineTo(-8, 0); context.stroke(); }
      } else if (form === 'sonic' || form === 'gravity' || form === 'space' || form === 'time') {
        context.globalAlpha = fade * pulse;
        context.beginPath(); context.ellipse(0, 0, form === 'sonic' ? 12 : 10, form === 'gravity' ? 5 : 8, performance.now() / 500, 0, Math.PI * 2); context.stroke();
        context.beginPath(); context.ellipse(0, 0, 6, 10, -performance.now() / 700, 0, Math.PI * 2); context.stroke();
        if (form === 'time') { context.beginPath(); context.arc(0, 0, 4, 0, Math.PI * 2); context.stroke(); context.beginPath(); context.moveTo(0, 0); context.lineTo(0, -3); context.lineTo(2, 0); context.stroke(); }
        else if (form === 'space') { context.beginPath(); context.moveTo(0, -4); context.lineTo(1.5, -1); context.lineTo(4, 0); context.lineTo(1.5, 1); context.lineTo(0, 4); context.lineTo(-1.5, 1); context.lineTo(-4, 0); context.lineTo(-1.5, -1); context.closePath(); context.fill(); }
        else { context.fillStyle = accent; context.beginPath(); context.arc(0, 0, 2.5, 0, Math.PI * 2); context.fill(); }
      } else if (form === 'mind' || form === 'tech' || form === 'chaos' || form === 'destruction' || form === 'creation') {
        context.beginPath();
        for (let point = 0; point < 10; point++) { const a = point * Math.PI / 5; const radius = point % 2 ? 4 : 10; const x = Math.cos(a) * radius; const y = Math.sin(a) * radius; if (!point) context.moveTo(x, y); else context.lineTo(x, y); }
        context.closePath(); context.fill();
        context.strokeStyle = accent;
        if (form === 'mind') { context.beginPath(); context.arc(0, 0, 4, 0, Math.PI * 2); context.stroke(); context.beginPath(); context.arc(-7, -6, 1.5, 0, Math.PI * 2); context.arc(7, 6, 1.5, 0, Math.PI * 2); context.stroke(); }
        if (form === 'tech') { context.beginPath(); context.rect(-3, -3, 6, 6); context.stroke(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; context.beginPath(); context.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); context.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); context.stroke(); } }
        if (form === 'chaos') { context.beginPath(); context.moveTo(-7, 0); context.lineTo(7, 0); context.moveTo(0, -7); context.lineTo(0, 7); context.stroke(); }
        if (form === 'destruction') { context.fillStyle = '#ffffff'; context.beginPath(); context.moveTo(9, 0); context.lineTo(2, -2); context.lineTo(0, 0); context.closePath(); context.fill(); }
        if (form === 'creation') { context.fillStyle = '#171020'; context.beginPath(); context.arc(0, 0, 3, 0, Math.PI * 2); context.fill(); }
      } else if (form === 'chemical' || form === 'flesh' || form === 'life' || form === 'soul') {
        context.beginPath(); context.arc(0, 0, form === 'flesh' ? 8 : 7, 0, Math.PI * 2); context.fill();
        context.fillStyle = accent;
        if (form === 'chemical') { context.beginPath(); context.arc(-7, -6, 3, 0, Math.PI * 2); context.arc(8, 5, 2, 0, Math.PI * 2); context.fill(); }
        if (form === 'flesh') { context.beginPath(); context.moveTo(-5, -2); context.quadraticCurveTo(0, -8, 5, -2); context.quadraticCurveTo(8, 5, 0, 7); context.quadraticCurveTo(-8, 5, -5, -2); context.fill(); }
        if (form === 'life') { context.beginPath(); context.ellipse(-4, 0, 4, 8, -0.5, 0, Math.PI * 2); context.ellipse(4, 0, 4, 8, 0.5, 0, Math.PI * 2); context.fill(); }
        if (form === 'soul') { context.beginPath(); context.moveTo(0, -9); context.quadraticCurveTo(10, 2, 0, 9); context.quadraticCurveTo(-10, 2, 0, -9); context.fill(); }
      } else if (form === 'shadow' || form === 'moon' || form === 'void') {
        context.beginPath(); context.arc(0, 0, 9, 0, Math.PI * 2); context.fill();
        context.fillStyle = form === 'void' ? '#111018' : accent;
        context.beginPath(); context.arc(5, -4, 8, 0, Math.PI * 2); context.fill();
        if (form === 'void') { context.strokeStyle = accent; context.beginPath(); context.arc(0, 0, 12, 0, Math.PI * 2); context.stroke(); }
      } else if (form === 'holy') {
        context.beginPath(); context.arc(0, 0, 5, 0, Math.PI * 2); context.fill();
        context.strokeStyle = accent; for (let ray = 0; ray < 8; ray++) { const a = ray * Math.PI / 4; context.beginPath(); context.moveTo(Math.cos(a) * 7, Math.sin(a) * 7); context.lineTo(Math.cos(a) * 12, Math.sin(a) * 12); context.stroke(); }
      } else {
        context.beginPath(); context.arc(0, 0, 8, 0, Math.PI * 2); context.fill();
        context.fillStyle = accent; context.beginPath(); context.arc(-2, -2, 3, 0, Math.PI * 2); context.fill();
      }
    }
    context.restore();
  }

  function drawProjectileLayer() {
    if (projectilePreview) drawProjectileEffect(projectilePreview, 0.88, true);
    const now = performance.now();
    for (const mark of projectileMarks) {
      const token = state.tokens.find(item => item.id === mark.tokenId);
      if (!token) continue;
      const progress = Math.min(1, (now - mark.startedAt) / mark.duration);
      const visualSize = projectileVisualSize(mark).effectScale;
      context.save();
      context.globalAlpha = 1 - progress;
      context.strokeStyle = projectileColor(mark.kind);
      context.lineWidth = 2.5 * visualSize;
      context.beginPath();
      const dimensions = tokenDimensions(token);
      const radius = Math.max(dimensions.width, dimensions.height) / 2 + (8 + progress * 24) * visualSize;
      context.arc(token.x, token.y, radius, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = projectileColor(mark.kind);
      context.globalAlpha = (1 - progress) * 0.16;
      context.beginPath(); context.arc(token.x, token.y, radius, 0, Math.PI * 2); context.fill();
      drawProjectileImpactDetail({ end: token, kind: mark.kind, widthTiles: mark.widthTiles, heightTiles: mark.heightTiles }, progress, now);
      if (mark.kind === 'tormenta') {
        context.save();
        context.globalAlpha = 1 - progress;
        context.strokeStyle = '#dcffff';
        context.fillStyle = '#85e9ff66';
        context.lineWidth = 2 * visualSize;
        for (let shard = 0; shard < 6; shard++) {
          const angle = shard * Math.PI / 3;
          const shardX = token.x + Math.cos(angle) * (radius * 0.7);
          const shardY = token.y + Math.sin(angle) * (radius * 0.7);
          context.beginPath(); context.moveTo(shardX, shardY - 7 * visualSize); context.lineTo(shardX + 3 * visualSize, shardY); context.lineTo(shardX, shardY + 5 * visualSize); context.lineTo(shardX - 3 * visualSize, shardY); context.closePath(); context.fill(); context.stroke();
        }
        context.restore();
      }
      context.restore();
    }
    for (const impact of projectileImpacts) {
      const progress = Math.min(1, (now - impact.startedAt) / impact.duration);
      const color = projectileColor(impact.kind);
      const visualSize = projectileVisualSize(impact).effectScale;
      const radius = impact.aoe * GRID * progress || (8 + progress * 28) * visualSize;
      context.save();
      context.globalAlpha = 1 - progress;
      context.strokeStyle = color;
      context.lineWidth = (3 - progress * 1.5) * visualSize;
      context.beginPath();
      context.arc(impact.end.x, impact.end.y, radius, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = color;
      context.globalAlpha = (1 - progress) * 0.18;
      context.beginPath(); context.arc(impact.end.x, impact.end.y, radius, 0, Math.PI * 2); context.fill();
      context.globalAlpha = 1 - progress;
      context.strokeStyle = projectileAccent(impact.kind);
      context.lineWidth = 2 * visualSize;
      for (let ray = 0; ray < 8; ray++) {
        const rayAngle = ray * Math.PI / 4 + (['space', 'time', 'gravity', 'chaos'].includes(PROJECTILE_TYPES[impact.kind]?.form) ? progress * 0.5 : 0);
        const inner = (5 + progress * 10) * visualSize;
        const outer = (13 + progress * 30) * visualSize;
        context.beginPath();
        context.moveTo(impact.end.x + Math.cos(rayAngle) * inner, impact.end.y + Math.sin(rayAngle) * inner);
        context.lineTo(impact.end.x + Math.cos(rayAngle) * outer, impact.end.y + Math.sin(rayAngle) * outer);
        context.stroke();
      }
      drawProjectileImpactDetail(impact, progress, now);
      context.restore();
    }
    for (const projectile of activeProjectiles) {
      drawProjectileEffect(projectile, projectile.progress);
    }
  }

  function animateProjectiles() {
    projectileFrame = null;
    const now = performance.now();
    for (const projectile of activeProjectiles) {
      if (projectile.travelToProgress === undefined) continue;
      const travelProgress = Math.min(1, (now - projectile.travelStartedAt) / projectile.travelDuration);
      const nextProgress = projectile.travelFromProgress + (projectile.travelToProgress - projectile.travelFromProgress) * travelProgress;
      if (moveProjectileTo(projectile, nextProgress)) {
        delete projectile.travelToProgress;
        addProjectileImpact(projectile);
      } else if (travelProgress >= 1) delete projectile.travelToProgress;
    }
    activeProjectiles = activeProjectiles.filter(projectile => projectile.progress < 1);
    projectileImpacts = projectileImpacts.filter(impact => now - impact.startedAt < impact.duration);
    projectileMarks = projectileMarks.filter(mark => now - mark.startedAt < mark.duration && state.tokens.some(token => token.id === mark.tokenId));
    render();
    const travelling = activeProjectiles.some(projectile => projectile.travelToProgress !== undefined);
    if ((projectileImpacts.length || projectileMarks.length || travelling) && projectileFrame === null) projectileFrame = requestAnimationFrame(animateProjectiles);
  }

  function projectileSettings() {
    const angleValue = document.querySelector('#projectileAngle').value;
    const aoe = Number(document.querySelector('#projectileAoe').value);
    const speed = Number(document.querySelector('#projectileSpeed').value);
    const widthTiles = Number(document.querySelector('#projectileWidth').value);
    const heightTiles = Number(document.querySelector('#projectileHeight').value);
    return {
      kind: document.querySelector('#projectileType').value,
      angle: angleValue === '' ? null : Number(angleValue),
      aoe: Number.isFinite(aoe) ? Math.max(0, Math.min(20, aoe)) : 0,
      speed: Number.isFinite(speed) ? Math.max(1, Math.min(999, Math.round(speed))) : 1,
      widthTiles: Number.isFinite(widthTiles) ? Math.max(0.25, Math.min(8, widthTiles)) : 0.5,
      heightTiles: Number.isFinite(heightTiles) ? Math.max(0.25, Math.min(8, heightTiles)) : 0.5,
      linearTrail: document.querySelector('#projectileLinearTrail').checked,
      damageExpression: document.querySelector('#projectileDamageDice').value.trim(),
      autoRollDamage: document.querySelector('#projectileAutoRollDamage').checked,
      damage: Math.max(0, Math.min(1000, Number(document.querySelector('#projectileDamage').value) || 0)),
      pierce: document.querySelector('#projectilePierce').checked,
      instant: document.querySelector('#projectileInstant').checked
    };
  }

  function projectileEndForAngle(start, target, angle) {
    let endpoint = { ...target };
    if (Number.isFinite(angle)) {
      const distance = Math.hypot(target.x - start.x, target.y - start.y);
      const radians = angle * Math.PI / 180;
      endpoint = { x: start.x + Math.cos(radians) * distance, y: start.y + Math.sin(radians) * distance };
    }
    return { x: snapCellCenter(endpoint.x), y: snapCellCenter(endpoint.y) };
  }

  function markProjectileToken(projectile, token) {
    if (projectile.markedTokenIds.has(token.id)) return;
    projectile.markedTokenIds.add(token.id);
    projectileMarks.push({ tokenId: token.id, kind: projectile.kind, widthTiles: projectile.widthTiles, heightTiles: projectile.heightTiles, startedAt: performance.now(), duration: 1200 });
    const authoritative = hostMode || !connections.has('host');
    let rolledDamage = 0;
    if (authoritative && projectile.autoRollDamage && projectile.damageExpression) {
      const roll = window.StonePlateDice?.rollExpression(projectile.damageExpression);
      if (roll && Array.isArray(roll.groups)) {
        rolledDamage = Math.max(0, roll.groups.reduce((sum, group) => sum + group.values.reduce((groupSum, value) => groupSum + value, 0), roll.modifier));
      }
    }
    const totalDamage = projectile.damage + rolledDamage;
    if (authoritative && totalDamage > 0) {
      const character = state.health.characters.find(item => String(item.linkedTokenId || '') === String(token.id));
      if (character) {
        character.vitality = Math.max(0, Number(character.vitality ?? character.hp ?? 0) - totalDamage);
        state.health.damageEffect = { id: `${projectile.id}:${token.id}`, damage: totalDamage, emoji: state.health.damageEmoji || '💥' };
        broadcastState('projectile');
      }
    }
  }

  function moveProjectileTo(projectile, targetIndex) {
    const nextProgress = Math.min(1, Math.max(projectile.progress, targetIndex));
    for (let index = projectile.pathIndex + 1; index < projectile.path.length; index++) {
      if (projectile.pathProgress[index] > nextProgress + 1e-9) break;
      const cell = projectile.path[index];
      const token = state.tokens.find(item => item.x === cell.x && item.y === cell.y);
      projectile.pathIndex = index;
      if (!token) continue;
      markProjectileToken(projectile, token);
      if (!projectile.pierce) {
        const hitProgress = projectile.pathProgress[index];
        projectile.end = projectilePoint(projectile, hitProgress);
        projectile.path = projectile.path.slice(0, index + 1);
        projectile.pathProgress = projectile.pathProgress.slice(0, index + 1);
        projectile.progress = 1;
        return true;
      }
    }
    projectile.progress = nextProgress;
    return nextProgress >= 1;
  }

  function markProjectileAoe(projectile) {
    const radius = projectile.aoe * GRID;
    if (!radius) return;
    for (const token of state.tokens) {
      if (Math.hypot(token.x - projectile.end.x, token.y - projectile.end.y) <= radius) markProjectileToken(projectile, token);
    }
  }

  function addProjectileImpact(projectile) {
    markProjectileAoe(projectile);
    const form = PROJECTILE_TYPES[projectile.kind]?.form;
    const duration = form === 'geo' ? 2600 : form === 'storm' ? 1500 : form === 'flame' ? 1150 : 850;
    projectileImpacts.push({ end: projectile.end, kind: projectile.kind, aoe: projectile.aoe, widthTiles: projectile.widthTiles, heightTiles: projectile.heightTiles, startedAt: performance.now(), duration });
    if (projectileFrame === null) projectileFrame = requestAnimationFrame(animateProjectiles);
  }

  function advanceProjectiles(id = crypto.randomUUID(), relay = true) {
    if (seenProjectileTurns.has(id)) return false;
    seenProjectileTurns.add(id);
    if (seenProjectileTurns.size > 256) seenProjectileTurns.delete(seenProjectileTurns.values().next().value);
    const now = performance.now();
    for (const projectile of activeProjectiles) {
      if (projectile.travelToProgress !== undefined) continue;
      projectile.travelFromProgress = projectile.progress;
      projectile.travelToProgress = Math.min(1, projectile.progress + projectile.speed * GRID / projectile.distance);
      projectile.travelStartedAt = now;
      projectile.travelDuration = 450;
    }
    if (activeProjectiles.some(projectile => projectile.travelToProgress !== undefined) && projectileFrame === null) projectileFrame = requestAnimationFrame(animateProjectiles);
    if (relay) {
      const message = { type: 'projectile-turn', id };
      if (hostMode) broadcast(message);
      else if (connections.has('host')) connections.get('host').send(message);
    }
    render();
    return true;
  }

  function drawLocatedTokenMarker() {
    if (!locatedTokenId) return;
    const token = state.tokens.find(item => item.id === locatedTokenId);
    if (!token) return;
    context.save();
    context.strokeStyle = '#f4c95d';
    context.lineWidth = 2 / zoom;
    context.setLineDash([5 / zoom, 3 / zoom]);
    const dimensions = tokenDimensions(token);
    context.beginPath();
    context.rect(token.x - dimensions.width / 2 - 12 / zoom, token.y - dimensions.height / 2 - 12 / zoom, dimensions.width + 24 / zoom, dimensions.height + 24 / zoom);
    context.stroke();
    context.restore();
  }

  function drawMapScene(width, height) {
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(width / 2 + panX, height / 2 + panY);
    context.scale(zoom, zoom);
    const visibleLeft = (-width / 2 - panX) / zoom;
    const visibleTop = (-height / 2 - panY) / zoom;
    const visibleBounds = { left: visibleLeft, top: visibleTop, right: visibleLeft + width / zoom, bottom: visibleTop + height / zoom };
    const boardPath = mapPath();
    context.fillStyle = '#111512c9';
    context.fillRect(visibleLeft, visibleTop, width / zoom, height / zoom);
    context.fillStyle = '#252b27';
    context.fill(boardPath);
    context.save();
    context.clip(boardPath);
    if (gridVisible) drawGrid(width, height);
    const layers = Array.isArray(state.layers) && state.layers.length ? state.layers : [{ id: 'layer-1', name: 'Camada 1' }];
    for (const layer of layers) drawLayerContents(layer.id, visibleBounds);
    if (currentShape) drawShape(currentShape, true);
    if (linePreview) drawShape(linePreview, true);
    if (currentToken) drawToken(visualObject(currentToken), true);
    drawMovementRoute();
    drawLocatedTokenMarker();
    drawProjectileLayer();
    drawAimIndicator();
    context.restore();
    context.strokeStyle = '#a8b992';
    context.lineWidth = 2 / zoom;
    if (state.map.shape === 'circle' || state.map.shape === 'triangle') context.stroke(mapOutlinePath(mapWorldBounds()));
    else context.stroke(boardPath);
    context.restore();
    drawSelectionBox();
  }

  function drawSelectionBox() {
    if (!selectionBox) return;
    const left = Math.min(selectionBox.startX, selectionBox.x);
    const top = Math.min(selectionBox.startY, selectionBox.y);
    const width = Math.abs(selectionBox.x - selectionBox.startX);
    const height = Math.abs(selectionBox.y - selectionBox.startY);
    context.save();
    context.fillStyle = '#c1d48a22';
    context.strokeStyle = '#c1d48a';
    context.lineWidth = 1;
    context.setLineDash([5, 4]);
    context.fillRect(left, top, width, height);
    context.strokeRect(left, top, width, height);
    context.restore();
  }

  function groupItemsByLayer(collection, fallbackLayerId = null) {
    const grouped = new Map();
    const defaultLayerId = String(fallbackLayerId ?? state.activeLayerId ?? 'layer-1');
    for (const item of collection) {
      const layerId = String(item?.layerId ?? defaultLayerId);
      if (!grouped.has(layerId)) grouped.set(layerId, []);
      grouped.get(layerId).push(item);
    }
    return grouped;
  }

  function isWorldObjectVisible(object, bounds) {
    if (!object || !bounds) return true;
    if (object.kind === 'stroke' || object.kind === 'line' || object.kind === 'circle' || object.kind === 'square') {
      const box = shapeBounds(object);
      return box.x <= bounds.right && box.x + box.width >= bounds.left && box.y <= bounds.bottom && box.y + box.height >= bounds.top;
    }
    if (object.x == null || object.y == null) return true;
    if (object.level != null) {
      const depth = Number(object.level || 0) * GRID;
      const offset = depth * 0.36;
      const half = GRID / 2;
      const left = object.x - half;
      const top = object.y - half;
      const right = object.x + half + offset;
      const bottom = object.y + half + depth;
      return left <= bounds.right && right >= bounds.left && top <= bounds.bottom && bottom >= bounds.top;
    }
    if (object.widthTiles != null || object.heightTiles != null) {
      const dimensions = tokenDimensions(object);
      const left = object.x - dimensions.width / 2;
      const top = object.y - dimensions.height / 2;
      return left <= bounds.right && left + dimensions.width >= bounds.left && top <= bounds.bottom && top + dimensions.height >= bounds.top;
    }
    const half = GRID / 2;
    return object.x + half >= bounds.left && object.x - half <= bounds.right && object.y + half >= bounds.top && object.y - half <= bounds.bottom;
  }

  let renderQueued = false;

  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    window.requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  function render() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    drawMapScene(width, height);
    drawDragReadout();
    updateOpacityControl();
    updateMapControls();
    updateInitiativePanel();
    updateLayerControls();
    updateObjectCount();
    updateInspectorSelection();
    document.querySelector('#canvasHint').classList.toggle('hidden', state.tokens.length + state.tiles.length + state.shapes.length + state.elevation.length > 0);
    updateMagnifier();
  }

  function objectGeometry(item) {
    if (item.kind === 'stroke' || item.kind === 'line' || item.kind === 'circle' || item.kind === 'square') {
      return item.kind === 'stroke'
        ? { points: item.points.map(point => ({ ...point })) }
        : { x1: item.x1, y1: item.y1, x2: item.x2, y2: item.y2 };
    }
    return { x: item.x, y: item.y };
  }

  function objectAtGeometry(item, geometry) {
    if (geometry.points) return { ...item, points: geometry.points };
    if ('x1' in geometry) return { ...item, ...geometry };
    return { ...item, x: geometry.x, y: geometry.y };
  }

  function visualObject(item) {
    const transition = objectTransitions.get(item.id);
    if (!transition) return item;
    const progress = Math.min(1, (performance.now() - transition.startedAt) / transition.duration);
    const eased = 1 - (1 - progress) ** 3;
    const interpolate = (from, to) => from + (to - from) * eased;
    let geometry;
    if (transition.from.points) {
      geometry = { points: transition.to.points.map((point, index) => ({
        x: interpolate(transition.from.points[index].x, point.x),
        y: interpolate(transition.from.points[index].y, point.y)
      })) };
    } else if ('x1' in transition.from) {
      geometry = Object.fromEntries(['x1', 'y1', 'x2', 'y2'].map(key => [key, interpolate(transition.from[key], transition.to[key])]));
    } else {
      geometry = { x: interpolate(transition.from.x, transition.to.x), y: interpolate(transition.from.y, transition.to.y) };
    }
    return progress >= 1 ? item : objectAtGeometry(item, geometry);
  }

  function animateObjectFrom(item, from, duration = 260) {
    objectTransitions.set(item.id, { from, to: objectGeometry(item), startedAt: performance.now(), duration });
    if (objectAnimationFrame === null) {
      const step = () => {
        objectAnimationFrame = null;
        const now = performance.now();
        for (const [id, transition] of objectTransitions) {
          if (now - transition.startedAt >= transition.duration) objectTransitions.delete(id);
        }
        render();
        if (objectTransitions.size) objectAnimationFrame = requestAnimationFrame(step);
      };
      objectAnimationFrame = requestAnimationFrame(step);
    }
  }

  function drawGrid(width, height) {
    const left = (-width / 2 - panX) / zoom;
    const right = (width / 2 - panX) / zoom;
    const top = (-height / 2 - panY) / zoom;
    const bottom = (height / 2 - panY) / zoom;
    const step = GRID;
    context.beginPath();
    context.lineWidth = 1 / zoom;
    context.strokeStyle = '#85918419';
    for (let x = Math.floor(left / step) * step; x < right; x += step) {
      context.moveTo(x, top); context.lineTo(x, bottom);
    }
    for (let y = Math.floor(top / step) * step; y < bottom; y += step) {
      context.moveTo(left, y); context.lineTo(right, y);
    }
    context.stroke();
  }

  function drawTile(tile) {
    const style = TILE_STYLES[tile.kind];
    if (!style) return;
    const half = GRID / 2;
    context.save();
    context.globalAlpha = opacityOf(tile);
    context.fillStyle = style.fill;
    context.fillRect(tile.x - half, tile.y - half, GRID, GRID);
    context.strokeStyle = style.stroke + '88';
    context.lineWidth = 1.5 / zoom;
    context.strokeRect(tile.x - half, tile.y - half, GRID, GRID);
    context.restore();
    if (selectedIds.has(tile.id)) drawSelection(tile.x, tile.y, GRID, GRID);
  }

  function drawElevation() {
    if (!state.elevation.length) return;
    const cells = [...state.elevation].sort((first, second) => first.y - second.y || first.x - second.x);
    const half = GRID / 2;
    for (const cell of cells) {
      const depth = cell.level * GRID;
      const offset = depth * 0.36;
      context.save();
      context.fillStyle = '#394a3a';
      context.beginPath();
      context.moveTo(cell.x - half, cell.y + half);
      context.lineTo(cell.x + half, cell.y + half);
      context.lineTo(cell.x + half + offset, cell.y + half + depth);
      context.lineTo(cell.x - half + offset, cell.y + half + depth);
      context.closePath();
      context.fill();
      context.fillStyle = '#2d392f';
      context.beginPath();
      context.moveTo(cell.x + half, cell.y - half);
      context.lineTo(cell.x + half + offset, cell.y - half + depth);
      context.lineTo(cell.x + half + offset, cell.y + half + depth);
      context.lineTo(cell.x + half, cell.y + half);
      context.closePath();
      context.fill();
      context.fillStyle = '#748d65';
      context.fillRect(cell.x - half, cell.y - half, GRID, GRID);
      context.strokeStyle = '#b1c89a';
      context.lineWidth = 1.5 / zoom;
      context.strokeRect(cell.x - half, cell.y - half, GRID, GRID);
      context.restore();
    }
  }

  function drawShape(shape, preview = false) {
    context.save();
    context.strokeStyle = shape.mode === 'construction' ? '#9cac9d' : shape.mode === 'alert' ? '#ef755b' : shape.color || '#f4c95d';
    context.fillStyle = shape.mode === 'construction' ? '#829387' : shape.mode === 'alert' ? '#e06d52' : shape.color || '#f4c95d';
    context.globalAlpha = opacityOf(shape) * (shape.mode === 'construction' ? 0.58 : shape.mode === 'alert' ? 0.34 : 1) * (preview ? 0.72 : 1);
    if (shape.kind === 'stroke') {
      for (const cell of shape.points) context.fillRect(cell.x - GRID / 2, cell.y - GRID / 2, GRID, GRID);
    } else if (shape.kind === 'line') {
      for (const cell of pixelLineCells(shape)) context.fillRect(cell.x - GRID / 2, cell.y - GRID / 2, GRID, GRID);
    } else {
      const bounds = shapeBounds(shape);
      const rows = Math.max(1, Math.round(bounds.height / GRID));
      context.beginPath();
      for (let row = 0; row < rows; row++) {
        const range = shapeCellRange(shape, row, bounds);
        if (range.start < range.end) context.rect(bounds.x + range.start * GRID, bounds.y + row * GRID, (range.end - range.start) * GRID, GRID);
      }
      context.fill();
    }
    if (selectedIds.has(shape.id) && !preview) {
      context.globalAlpha = 1;
      const bounds = shapeBounds(shape);
      drawSelection(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, bounds.width, bounds.height);
    }
    context.restore();
    if (!preview && shape.mode === 'alert') {
      const bounds = shapeBounds(shape);
      const label = shape.alertTriggered ? 'DISPARADO' : `ALERTA · ${Math.max(0, shape.alertTurnsRemaining)}T · ${Math.max(0, shape.alertDamage)}D`;
      context.save();
      context.font = `700 ${Math.max(9, 10 / zoom)}px "DM Mono", Consolas, monospace`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const labelWidth = context.measureText(label).width + 12 / zoom;
      const labelX = bounds.x + bounds.width / 2;
      const labelY = bounds.y - 12 / zoom;
      context.fillStyle = '#351d1beF';
      context.fillRect(labelX - labelWidth / 2, labelY - 9 / zoom, labelWidth, 18 / zoom);
      context.fillStyle = '#ffd8c8';
      context.fillText(label, labelX, labelY);
      context.restore();
    }
  }

  function shapeBounds(shape) {
    if (shape.kind === 'stroke') {
      const xs = shape.points.map(point => point.x), ys = shape.points.map(point => point.y);
      return {
        x: Math.min(...xs) - GRID / 2, y: Math.min(...ys) - GRID / 2,
        width: Math.max(...xs) - Math.min(...xs) + GRID,
        height: Math.max(...ys) - Math.min(...ys) + GRID
      };
    }
    if (shape.kind === 'line') {
      return {
        x: Math.min(shape.x1, shape.x2) - GRID / 2,
        y: Math.min(shape.y1, shape.y2) - GRID / 2,
        width: Math.abs(shape.x2 - shape.x1) + GRID,
        height: Math.abs(shape.y2 - shape.y1) + GRID
      };
    }
    return {
      x: Math.min(shape.x1, shape.x2), y: Math.min(shape.y1, shape.y2),
      width: Math.max(GRID, Math.abs(shape.x2 - shape.x1)), height: Math.max(GRID, Math.abs(shape.y2 - shape.y1))
    };
  }

  function shapeCellRange(shape, row, bounds = shapeBounds(shape)) {
    const columns = Math.max(1, Math.round(bounds.width / GRID));
    const rows = Math.max(1, Math.round(bounds.height / GRID));
    if (row < 0 || row >= rows) return { start: 0, end: 0 };
    if (shape.kind !== 'circle') return { start: 0, end: columns };
    const y = (row + 0.5) / rows;
    const halfWidth = Math.sqrt(Math.max(0, 1 - (2 * y - 1) ** 2)) / 2;
    let start = Math.max(0, Math.ceil((0.5 - halfWidth) * columns - 0.5) - 1);
    let end = Math.min(columns, Math.floor((0.5 + halfWidth) * columns - 0.5) + 2);
    const inside = column => {
      const x = (column + 0.5) / columns;
      return ((x - 0.5) / 0.5) ** 2 + ((y - 0.5) / 0.5) ** 2 <= 1;
    };
    while (start < end && !inside(start)) start++;
    while (end > start && !inside(end - 1)) end--;
    return { start, end };
  }

  function shapeCellCount(shape) {
    const bounds = shapeBounds(shape);
    const rows = Math.max(1, Math.round(bounds.height / GRID));
    let count = 0;
    for (let row = 0; row < rows; row++) {
      const range = shapeCellRange(shape, row, bounds);
      count += range.end - range.start;
    }
    return count;
  }

  function shapeCellAtPoint(shape, point) {
    const bounds = shapeBounds(shape);
    const column = Math.floor((point.x - bounds.x) / GRID);
    const row = Math.floor((point.y - bounds.y) / GRID);
    const range = shapeCellRange(shape, row, bounds);
    return column >= range.start && column < range.end;
  }

  function shapeContainsPoint(shape, point) {
    const bounds = shapeBounds(shape);
    if (point.x < bounds.x || point.x > bounds.x + bounds.width || point.y < bounds.y || point.y > bounds.y + bounds.height) return false;
    if (shape.kind === 'stroke') return (shape.points || []).some(cell => Math.abs(point.x - cell.x) < GRID / 2 && Math.abs(point.y - cell.y) < GRID / 2);
    if (shape.kind === 'line') return pixelLineCells(shape).some(cell => Math.abs(point.x - cell.x) < GRID / 2 && Math.abs(point.y - cell.y) < GRID / 2);
    return shapeCellAtPoint(shape, point);
  }

  function constructionBlocksRoute(start, end) {
    const route = gridCellRoute(start, end).slice(1);
    return state.shapes.some(shape => {
      if (shape.mode !== 'construction') return false;
      const startsInside = shapeContainsPoint(shape, start);
      const endsInside = shapeContainsPoint(shape, end);
      if (startsInside && !endsInside) return false;
      return route.some(point => shapeContainsPoint(shape, point));
    });
  }

  function constructionBlocksPoint(point) {
    return state.shapes.some(shape => shape.mode === 'construction' && shapeContainsPoint(shape, point));
  }

  function advanceShapeAlerts() {
    let healthChanged = false;
    for (const shape of state.shapes) {
      if (shape.mode !== 'alert' || shape.alertTriggered) continue;
      shape.alertTurnsRemaining = Math.max(0, Math.floor(Number(shape.alertTurnsRemaining) || 0) - 1);
      if (shape.alertTurnsRemaining > 0) continue;
      shape.alertTriggered = true;
      const damage = Math.max(0, Math.min(1000, Number(shape.alertDamage) || 0));
      if (!damage) continue;
      for (const token of state.tokens) {
        if (!shapeContainsPoint(shape, token)) continue;
        const character = state.health.characters.find(item => String(item.linkedTokenId || '') === String(token.id));
        if (!character) continue;
        character.vitality = Math.max(0, Number(character.vitality ?? character.hp ?? 0) - damage);
        if (!healthChanged) state.health.damageEffect = { id: `${shape.id}:${state.health.round}:${shape.alertTurnsTotal}`, damage, emoji: state.health.damageEmoji || '💥' };
        healthChanged = true;
      }
    }
    if (healthChanged) syncHealthToTokens();
  }

  function shapeFitsMap(shape, config = state.map) {
    if (shape.kind === 'stroke') return shape.points.every(point => pointInsideMap(point, config));
    if (shape.kind === 'line') return pixelLineCells(shape).every(point => pointInsideMap(point, config));
    const bounds = shapeBounds(shape);
    const columns = Math.max(1, Math.round(bounds.width / GRID));
    const rows = Math.max(1, Math.round(bounds.height / GRID));
    for (let row = 0; row < rows; row++) {
      const range = shapeCellRange(shape, row, bounds);
      for (let column = range.start; column < range.end; column++) {
        if (!pointInsideMap({ x: bounds.x + (column + 0.5) * GRID, y: bounds.y + (row + 0.5) * GRID }, config)) return false;
      }
    }
    return columns > 0;
  }

  function pixelLineCells(shape) {
    return gridCellRoute({ x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 });
  }

  function gridCellRoute(start, end) {
    let x = Math.round((start.x - GRID / 2) / GRID);
    let y = Math.round((start.y - GRID / 2) / GRID);
    const endX = Math.round((end.x - GRID / 2) / GRID);
    const endY = Math.round((end.y - GRID / 2) / GRID);
    const deltaX = Math.abs(endX - x), stepX = x < endX ? 1 : -1;
    const deltaY = -Math.abs(endY - y), stepY = y < endY ? 1 : -1;
    let error = deltaX + deltaY;
    const cells = [];
    while (true) {
      cells.push({ x: x * GRID + GRID / 2, y: y * GRID + GRID / 2 });
      if (x === endX && y === endY) return cells;
      const doubledError = 2 * error;
      if (doubledError >= deltaY) { error += deltaY; x += stepX; }
      if (doubledError <= deltaX) { error += deltaX; y += stepY; }
    }
  }

  function projectileCellRoute(start, end) {
    let x = Math.round((start.x - GRID / 2) / GRID);
    let y = Math.round((start.y - GRID / 2) / GRID);
    const endX = Math.round((end.x - GRID / 2) / GRID);
    const endY = Math.round((end.y - GRID / 2) / GRID);
    const deltaX = Math.abs(endX - x);
    const deltaY = Math.abs(endY - y);
    const stepX = x < endX ? 1 : -1;
    const stepY = y < endY ? 1 : -1;
    let movedX = 0;
    let movedY = 0;
    const cells = [{ x: x * GRID + GRID / 2, y: y * GRID + GRID / 2 }];
    const addCell = (cellX, cellY) => {
      if (!cells.some(cell => cell.x === cellX * GRID + GRID / 2 && cell.y === cellY * GRID + GRID / 2)) {
        cells.push({ x: cellX * GRID + GRID / 2, y: cellY * GRID + GRID / 2 });
      }
    };
    while (movedX < deltaX || movedY < deltaY) {
      const decision = (1 + 2 * movedX) * deltaY - (1 + 2 * movedY) * deltaX;
      if (decision === 0) {
        addCell(x + stepX, y);
        addCell(x, y + stepY);
        x += stepX;
        y += stepY;
        movedX++;
        movedY++;
        addCell(x, y);
      } else if (decision < 0) {
        x += stepX;
        movedX++;
        addCell(x, y);
      } else {
        y += stepY;
        movedY++;
        addCell(x, y);
      }
    }
    return cells;
  }

  function shapeTileReadout(shape) {
    if (shape.kind === 'stroke') return `${shape.points.length} ${shape.points.length === 1 ? 'tile' : 'tiles'}`;
    if (shape.kind === 'line') return `${pixelLineCells(shape).length} ${pixelLineCells(shape).length === 1 ? 'tile' : 'tiles'}`;
    const bounds = shapeBounds(shape);
    const columns = Math.max(1, Math.round(bounds.width / GRID));
    const rows = Math.max(1, Math.round(bounds.height / GRID));
    const total = shapeCellCount(shape);
    return `${columns} × ${rows} tiles · ${total} total`;
  }

  function syncRgbChannels(color) {
    const hex = String(color).replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(hex)) return;
    ['red', 'green', 'blue'].forEach((channel, index) => {
      const value = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
      document.querySelector(`#drawColor${channel}`).value = String(value);
      document.querySelector(`#drawColor${channel}Value`).textContent = String(value);
    });
    document.querySelector('#drawColorValue').textContent = `#${hex.toUpperCase()}`;
  }

  function updateDrawColorFromRgb() {
    const values = ['red', 'green', 'blue'].map(channel => Number(document.querySelector(`#drawColor${channel}`).value));
    const color = `#${values.map(value => Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0')).join('')}`;
    document.querySelector('#drawColor').value = color;
    syncRgbChannels(color);
  }

  function drawDragReadout() {
    if (!dragReadout) return;
    context.save();
    context.font = '500 11px "DM Mono", Consolas, monospace';
    context.textBaseline = 'middle';
    const width = context.measureText(dragReadout.text).width + 18;
    const x = Math.min(canvas.clientWidth - width - 8, Math.max(8, dragReadout.x + 14));
    const y = Math.min(canvas.clientHeight - 30, Math.max(8, dragReadout.y + 14));
    context.fillStyle = '#171c19ed';
    context.strokeStyle = '#71806d';
    context.lineWidth = 1;
    context.beginPath();
    context.roundRect(x, y, width, 26, 4);
    context.fill();
    context.stroke();
    context.fillStyle = '#dce8be';
    context.fillText(dragReadout.text, x + 9, y + 13);
    context.restore();
  }

  function drawToken(token, preview = false) {
    const dimensions = tokenDimensions(token);
    const left = token.x - dimensions.width / 2;
    const top = token.y - dimensions.height / 2;
    const inset = Math.min(4 / zoom, dimensions.width / 4, dimensions.height / 4);
    const character = state.health?.characters?.find(item => String(item.linkedTokenId) === String(token.id));
    const imageDataUrl = character ? character.imageDataUrl || characterAvatarDataUrl(character) : '';
    let portrait = imageDataUrl ? tokenImageCache.get(imageDataUrl) : null;
    if (imageDataUrl && !portrait) {
      portrait = new Image();
      portrait.addEventListener('load', render, { once: true });
      portrait.src = imageDataUrl;
      tokenImageCache.set(imageDataUrl, portrait);
    }
    if (portrait && (!portrait.complete || !portrait.naturalWidth)) portrait = null;
    context.save();
    const tokenAlpha = opacityOf(token) * (preview ? 0.65 : 1);
    context.shadowColor = '#0009'; context.shadowBlur = 8; context.shadowOffsetY = 3;
    context.fillStyle = token.color || '#d87054'; context.globalAlpha = tokenAlpha; context.fillRect(left, top, dimensions.width, dimensions.height);
    context.shadowColor = 'transparent'; context.shadowBlur = 0; context.shadowOffsetY = 0;
    if (portrait) {
      context.save();
      context.beginPath(); context.rect(left, top, dimensions.width, dimensions.height); context.clip();
      context.globalAlpha = tokenAlpha;
      context.drawImage(portrait, left, top, dimensions.width, dimensions.height);
      context.restore();
    }
    context.globalAlpha = 1;
    context.lineWidth = 2 / zoom; context.strokeStyle = '#f0dfca'; context.strokeRect(left, top, dimensions.width, dimensions.height);
    context.strokeStyle = '#ffffff66'; context.lineWidth = 1 / zoom; context.strokeRect(left + inset, top + inset, dimensions.width - inset * 2, dimensions.height - inset * 2);
    if (!portrait) {
      context.fillStyle = '#fff4e9'; context.font = `700 ${Math.max(10, Math.min(dimensions.width, dimensions.height) * 0.28)}px Manrope, sans-serif`;
      context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillText(initials(token.name), token.x, token.y + 1);
    }
    context.restore();
    context.save();
    context.font = `600 ${11 / zoom}px Manrope, sans-serif`;
    context.textAlign = 'center'; context.textBaseline = 'top';
    const label = token.name || 'Token';
    const labelWidth = context.measureText(label).width;
    context.fillStyle = '#171a19dd';
    const bottom = top + dimensions.height;
    context.fillRect(token.x - labelWidth / 2 - 5 / zoom, bottom + 5 / zoom, labelWidth + 10 / zoom, 18 / zoom);
    context.fillStyle = '#e5e7dc'; context.fillText(label, token.x, bottom + 8 / zoom);
    context.restore();
    if (token.health && token.health.vitalityMax > 0 && token.health.lucidityMax > 0) {
      const barWidth = Math.max(8 / zoom, dimensions.width - 8 / zoom);
      const barX = token.x - barWidth / 2;
      const barY = bottom + 25 / zoom;
      context.save();
      context.fillStyle = '#171a19e8';
      context.fillRect(barX - 2 / zoom, barY - 2 / zoom, barWidth + 4 / zoom, 10 / zoom);
      context.fillStyle = '#df8568';
      context.fillRect(barX, barY, barWidth * Math.max(0, Math.min(1, token.health.vitality / token.health.vitalityMax)), 3 / zoom);
      context.fillStyle = '#91b8c3';
      context.fillRect(barX, barY + 4 / zoom, barWidth * Math.max(0, Math.min(1, token.health.lucidity / token.health.lucidityMax)), 3 / zoom);
      context.restore();
    }
    if (selectedIds.has(token.id)) {
      context.save(); context.setLineDash([4 / zoom, 4 / zoom]); context.strokeStyle = '#c1d48a'; context.lineWidth = 1.5 / zoom;
      context.strokeRect(left - 5 / zoom, top - 5 / zoom, dimensions.width + 10 / zoom, dimensions.height + 10 / zoom); context.restore();
    }
    if (state.initiative?.activeTokenId === token.id) {
      context.save(); context.strokeStyle = '#f4c95d'; context.lineWidth = 2.5 / zoom;
      context.strokeRect(left - 9 / zoom, top - 9 / zoom, dimensions.width + 18 / zoom, dimensions.height + 18 / zoom); context.restore();
    }
  }

  function drawSelection(x, y, width, height) {
    context.save(); context.setLineDash([5 / zoom, 4 / zoom]); context.strokeStyle = '#dce8be'; context.lineWidth = 1.5 / zoom;
    context.strokeRect(x - width / 2 - 3 / zoom, y - height / 2 - 3 / zoom, width + 6 / zoom, height + 6 / zoom); context.restore();
  }

  function initials(name) {
    return String(name || 'T').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'T';
  }

  function characterAvatarDataUrl(character) {
    const characters = state.health?.characters || [];
    const index = Math.max(0, characters.indexOf(character));
    const colors = ['#2563eb', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444', '#10b981'];
    const name = character.name || `Personagem ${index + 1}`;
    const initial = (String(name).trim().charAt(0) || 'P').replace(/[&<>"']/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[value]));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="${colors[index % colors.length]}"/><circle cx="48" cy="36" r="20" fill="#ffffff55"/><text x="48" y="84" text-anchor="middle" font-family="sans-serif" font-size="36" font-weight="700" fill="white">${initial}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  }

  function setTool(nextTool) {
    if (!isRoomAdmin() && nextTool !== 'select') nextTool = 'select';
    if (nextTool !== 'straight-line') {
      pendingLineStart = null;
      linePreview = null;
      dragReadout = null;
    }
    if (nextTool !== 'projectile') { pendingProjectileStart = null; projectilePreview = null; }
    if (nextTool !== 'select') { pendingTokenMove = null; plannedMove = null; movementRoute = null; }
    tool = nextTool;
    document.querySelectorAll('.tool-button[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === tool));
    canvas.className = `tool-${tool}`;
    document.querySelector('#selectionOptions').hidden = tool !== 'select';
    document.querySelector('#selectionOptions').style.display = tool === 'select' ? 'flex' : 'none';
    document.querySelector('#colorOptions').hidden = !['line', 'straight-line', 'circle', 'square'].includes(tool);
    document.querySelector('#tokenOptions').hidden = tool !== 'token';
    document.querySelector('#elevationOptions').hidden = tool !== 'elevation';
    document.querySelector('#locateOptions').hidden = tool !== 'locate';
    document.querySelector('#projectileOptions').hidden = tool !== 'projectile';
  }

  function snap(value) { return Math.round(value / GRID) * GRID; }
  function snapCellCenter(value) { return snap(value - GRID / 2) + GRID / 2; }
  function normalizeMapConfig(config = {}) {
    const allowedShapes = ['rectangle', 'square', 'circle', 'triangle'];
    const shape = allowedShapes.includes(config.shape) ? config.shape : DEFAULT_MAP.shape;
    let width = Math.max(1, Math.min(MAX_MAP_DIMENSION, Math.floor(Number(config.width) || DEFAULT_MAP.width)));
    let height = Math.max(1, Math.min(MAX_MAP_DIMENSION, Math.floor(Number(config.height) || DEFAULT_MAP.height)));
    if (shape === 'square' || shape === 'circle') height = width;
    return { shape, width, height };
  }

  function clampOpacity(value, fallback = DEFAULT_OPACITY) {
    const opacity = Number(value);
    return Number.isFinite(opacity) ? Math.min(1, Math.max(0.2, opacity)) : fallback;
  }
  function opacityOf(item) { return clampOpacity(item.opacity); }

  function tokenTileCount(value, legacyRadius = 22) {
    const size = Number(value);
    if (Number.isFinite(size) && size > 0) return Math.max(1, Math.round(size));
    return Math.max(1, Math.round((Number(legacyRadius) || 22) * 2 / GRID));
  }

  function tokenDimensions(token) {
    return {
      width: tokenTileCount(token.widthTiles, token.radius) * GRID,
      height: tokenTileCount(token.heightTiles, token.radius) * GRID
    };
  }

  function alignStateToGrid(mapState) {
    const coordinate = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    const defaultOpacity = clampOpacity(mapState.opacity);
    const layers = [];
    const layerIds = new Set();
    for (const [index, layer] of (Array.isArray(mapState.layers) ? mapState.layers : []).entries()) {
      const id = String(layer?.id || '');
      if (!id || layerIds.has(id)) continue;
      layerIds.add(id);
      layers.push({ id, name: String(layer.name || `Camada ${index + 1}`).trim().slice(0, 32) || `Camada ${index + 1}` });
    }
    if (!layers.length) layers.push({ id: 'layer-1', name: 'Camada 1' });
    const validLayerIds = new Set(layers.map(layer => layer.id));
    const activeLayerId = validLayerIds.has(String(mapState.activeLayerId || '')) ? String(mapState.activeLayerId) : layers[0].id;
    const withLayer = item => ({ ...item, layerId: validLayerIds.has(String(item.layerId || '')) ? String(item.layerId) : activeLayerId });
    return {
      ...mapState,
      layers,
      activeLayerId,
      health: mapState.health && Array.isArray(mapState.health.characters) ? mapState.health : defaultHealthState(),
      gridVisible: mapState.gridVisible !== false,
      opacity: defaultOpacity,
      elevation: (Array.isArray(mapState.elevation) ? mapState.elevation : []).map(cell => ({
        ...withLayer(cell),
        x: snapCellCenter(coordinate(cell.x)),
        y: snapCellCenter(coordinate(cell.y)),
        level: Math.round(Math.max(0.25, Math.min(MAX_ELEVATION_TILES, Number(cell.level) || 0.25)) * 4) / 4
      })),
      map: normalizeMapConfig(mapState.map),
      initiative: normalizeInitiative(mapState.initiative, mapState.tokens),
      tokens: mapState.tokens.map(token => ({ ...withLayer(token), widthTiles: tokenTileCount(token.widthTiles, token.radius), heightTiles: tokenTileCount(token.heightTiles, token.radius), opacity: clampOpacity(token.opacity, defaultOpacity), x: snapCellCenter(coordinate(token.x)), y: snapCellCenter(coordinate(token.y)) })),
      tiles: mapState.tiles.map(tile => ({ ...withLayer(tile), opacity: clampOpacity(tile.opacity, defaultOpacity), x: snapCellCenter(coordinate(tile.x)), y: snapCellCenter(coordinate(tile.y)) })),
      shapes: mapState.shapes.map(shape => {
        if (shape.kind === 'stroke') {
          const points = Array.isArray(shape.points) ? shape.points : [];
          return {
            ...withLayer(shape),
            points: points.map(point => ({ x: snapCellCenter(coordinate(point.x)), y: snapCellCenter(coordinate(point.y)) })),
            opacity: clampOpacity(shape.opacity, defaultOpacity)
          };
        }
        const align = shape.kind === 'line' ? snapCellCenter : snap;
        return {
          ...withLayer(shape),
          filled: shape.kind === 'circle' || shape.kind === 'square' ? true : shape.filled,
          opacity: clampOpacity(shape.opacity, defaultOpacity),
          x1: align(coordinate(shape.x1)), y1: align(coordinate(shape.y1)),
          x2: align(coordinate(shape.x2)), y2: align(coordinate(shape.y2))
        };
      })
    };
  }

  function addLayer() {
    if (!isRoomAdmin()) {
      showToast('Apenas o administrador pode alterar camadas.');
      return null;
    }
    const baseName = `Camada ${state.layers.length + 1}`;
    const layerId = `layer-${crypto.randomUUID().slice(0, 8)}`;
    state.layers.push({ id: layerId, name: baseName });
    state.activeLayerId = layerId;
    broadcastState();
    render();
    return layerId;
  }

  function moveLayer(layerId, direction) {
    if (!isRoomAdmin()) {
      showToast('Apenas o administrador pode reorganizar camadas.');
      return;
    }
    const index = state.layers.findIndex(layer => String(layer.id) === String(layerId));
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= state.layers.length) return;
    [state.layers[index], state.layers[targetIndex]] = [state.layers[targetIndex], state.layers[index]];
    broadcastState();
  }

  function removeLayer(layerId) {
    if (!isRoomAdmin()) {
      showToast('Apenas o administrador pode remover camadas.');
      return;
    }
    if (state.layers.length <= 1) return;
    const index = state.layers.findIndex(layer => String(layer.id) === String(layerId));
    if (index < 0) return;
    const nextLayer = state.layers[index === 0 ? 1 : index - 1];
    const nextLayerId = nextLayer?.id || state.layers[0].id;
    for (const collection of [state.tiles, state.shapes, state.tokens, state.elevation]) {
      for (const item of collection) {
        if (item.layerId === layerId) item.layerId = nextLayerId;
      }
    }
    state.layers.splice(index, 1);
    if (state.activeLayerId === layerId) state.activeLayerId = nextLayerId;
    broadcastState();
  }

  function updateLayerControls() {
    const activeName = document.querySelector('#activeLayerName');
    const layerList = document.querySelector('#layerList');
    if (!activeName || !layerList) return;
    const layers = Array.isArray(state.layers) && state.layers.length ? state.layers : [{ id: 'layer-1', name: 'Camada 1' }];
    const activeLayer = layers.find(layer => String(layer.id) === String(state.activeLayerId)) || layers[0];
    const activeLabel = activeLayer?.name || 'Camada 1';
    const signature = JSON.stringify(layers.map((layer, index) => [
      String(layer.id),
      String(layer.name || `Camada ${index + 1}`),
      String(layer.id) === String(activeLayer.id),
      index === 0,
      index === layers.length - 1,
      layers.length
    ]));
    activeName.textContent = activeLabel;
    if (signature === layerUiSignature) return;
    layerUiSignature = signature;
    layerList.innerHTML = layers.map((layer, index) => {
      const isActive = String(layer.id) === String(activeLayer.id);
      return `
        <div class="layer-row ${isActive ? 'active' : ''}">
          <button class="layer-select" type="button" data-layer-action="select" data-layer-id="${layer.id}" ${isActive ? 'disabled' : ''}>
            <span class="layer-eye" aria-hidden="true">${isActive ? '●' : '○'}</span>
            <span class="layer-name">${layer.name}</span>
            ${isActive ? '<span class="layer-current">ATUAL</span>' : ''}
          </button>
          <button class="layer-order" type="button" data-layer-action="up" data-layer-id="${layer.id}" aria-label="Mover para cima" ${index === 0 ? 'disabled' : ''}>▲</button>
          <button class="layer-order" type="button" data-layer-action="down" data-layer-id="${layer.id}" aria-label="Mover para baixo" ${index === layers.length - 1 ? 'disabled' : ''}>▼</button>
          <button class="layer-remove" type="button" data-layer-action="delete" data-layer-id="${layer.id}" aria-label="Excluir camada" ${layers.length === 1 ? 'disabled' : ''}>×</button>
        </div>
      `;
    }).join('');
  }

  function drawLayerContents(layerId, visibleBounds = null) {
    const layers = state.layers || [{ id: 'layer-1', name: 'Camada 1' }];
    const activeIndex = layers.findIndex(layer => String(layer.id) === String(state.activeLayerId));
    const layerIndex = layers.findIndex(layer => String(layer.id) === String(layerId));
    const isActive = layerId === state.activeLayerId;
    const distance = activeIndex >= 0 && layerIndex >= 0 ? Math.abs(activeIndex - layerIndex) : 0;
    const alpha = isActive ? 1 : Math.max(0.52, 0.94 - distance * 0.12);
    const dimAlpha = isActive ? 0 : Math.min(0.2, 0.08 + distance * 0.045);
    const tilesByLayer = groupItemsByLayer(state.tiles, state.activeLayerId);
    const shapesByLayer = groupItemsByLayer(state.shapes, state.activeLayerId);
    const tokensByLayer = groupItemsByLayer(state.tokens, state.activeLayerId);
    const elevationByLayer = groupItemsByLayer(state.elevation, state.activeLayerId);
    const layerKey = String(layerId);

    context.save();
    context.globalAlpha = alpha;
    if (!isActive) {
      const bounds = mapWorldBounds();
      context.fillStyle = `rgba(10, 14, 12, ${dimAlpha})`;
      context.fillRect(bounds.left, bounds.top, bounds.width, bounds.height);
    }
    for (const tile of tilesByLayer.get(layerKey) || []) {
      if (visibleBounds && !isWorldObjectVisible(tile, visibleBounds)) continue;
      drawTile(visualObject(tile));
    }
    for (const shape of shapesByLayer.get(layerKey) || []) {
      if (visibleBounds && !isWorldObjectVisible(shape, visibleBounds)) continue;
      drawShape(visualObject(shape));
    }
    for (const token of tokensByLayer.get(layerKey) || []) {
      if (visibleBounds && !isWorldObjectVisible(token, visibleBounds)) continue;
      drawToken(visualObject(token));
    }
    for (const cell of elevationByLayer.get(layerKey) || []) {
      if (visibleBounds && !isWorldObjectVisible(cell, visibleBounds)) continue;
      const depth = cell.level * GRID;
      const offset = depth * 0.36;
      const half = GRID / 2;
      context.fillStyle = '#394a3a';
      context.beginPath();
      context.moveTo(cell.x - half, cell.y + half);
      context.lineTo(cell.x + half, cell.y + half);
      context.lineTo(cell.x + half + offset, cell.y + half + depth);
      context.lineTo(cell.x - half + offset, cell.y + half + depth);
      context.closePath();
      context.fill();
      context.fillStyle = '#2d392f';
      context.beginPath();
      context.moveTo(cell.x + half, cell.y - half);
      context.lineTo(cell.x + half + offset, cell.y - half + depth);
      context.lineTo(cell.x + half + offset, cell.y + half + depth);
      context.lineTo(cell.x + half, cell.y + half);
      context.closePath();
      context.fill();
      context.fillStyle = '#748d65';
      context.fillRect(cell.x - half, cell.y - half, GRID, GRID);
      context.strokeStyle = '#b1c89a';
      context.lineWidth = 1.5 / zoom;
      context.strokeRect(cell.x - half, cell.y - half, GRID, GRID);
    }
    context.restore();
  }

  function normalizeInitiative(value, tokens) {
    const tokenIds = new Set(tokens.map(token => token.id));
    const seen = new Set();
    const combatants = (Array.isArray(value?.combatants) ? value.combatants : []).filter(combatant => {
      if (!tokenIds.has(combatant.tokenId) || seen.has(combatant.tokenId)) return false;
      seen.add(combatant.tokenId);
      return true;
    }).map(combatant => {
      const score = combatant.initiative == null || combatant.initiative === '' ? NaN : Number(combatant.initiative);
      return { tokenId: combatant.tokenId, initiative: Number.isFinite(score) ? Math.max(1, Math.min(30, score)) : null };
    });
    const activeTokenId = combatants.some(combatant => combatant.tokenId === value?.activeTokenId) ? value.activeTokenId : null;
    const round = Math.max(1, Math.floor(Number(value?.round) || 1));
    return { round, activeTokenId, combatants };
  }

  function orderedCombatants() {
    const tokenOrder = new Map(state.tokens.map((token, index) => [token.id, index]));
    return [...state.initiative.combatants].sort((left, right) => {
      const leftScore = left.initiative ?? -1;
      const rightScore = right.initiative ?? -1;
      return rightScore - leftScore || tokenOrder.get(left.tokenId) - tokenOrder.get(right.tokenId);
    });
  }

  function findToken(point) {
    for (let index = state.tokens.length - 1; index >= 0; index--) {
      const token = state.tokens[index];
      const dimensions = tokenDimensions(token);
      if (Math.abs(point.x - token.x) <= dimensions.width / 2 + 4 && Math.abs(point.y - token.y) <= dimensions.height / 2 + 4) return token;
    }
    const cellX = snapCellCenter(point.x), cellY = snapCellCenter(point.y);
    for (let index = state.tokens.length - 1; index >= 0; index--) {
      const token = state.tokens[index];
      if (token.x === cellX && token.y === cellY) return token;
    }
    return null;
  }

  function setSelection(ids, primaryId = null) {
    selectedIds = new Set(ids);
    selectedId = primaryId && selectedIds.has(primaryId) ? primaryId : selectedIds.values().next().value || null;
  }

  function objectIntersectsSelection(item, bounds) {
    const itemBounds = state.tokens.includes(item)
      ? (() => { const dimensions = tokenDimensions(item); return { left: item.x - dimensions.width / 2, right: item.x + dimensions.width / 2, top: item.y - dimensions.height / 2, bottom: item.y + dimensions.height / 2 }; })()
      : state.tiles.includes(item)
        ? { left: item.x - GRID / 2, right: item.x + GRID / 2, top: item.y - GRID / 2, bottom: item.y + GRID / 2 }
        : (() => { const shape = shapeBounds(item); return { left: shape.x, right: shape.x + shape.width, top: shape.y, bottom: shape.y + shape.height }; })();
    return itemBounds.right >= bounds.left && itemBounds.left <= bounds.right && itemBounds.bottom >= bounds.top && itemBounds.top <= bounds.bottom;
  }

  function completeBoxSelection() {
    const start = screenToWorld({ x: selectionBox.startX, y: selectionBox.startY });
    const end = screenToWorld({ x: selectionBox.x, y: selectionBox.y });
    const bounds = { left: Math.min(start.x, end.x), right: Math.max(start.x, end.x), top: Math.min(start.y, end.y), bottom: Math.max(start.y, end.y) };
    const picked = [...state.tokens, ...state.tiles, ...state.shapes].filter(item => objectIntersectsSelection(item, bounds)).map(item => item.id);
    setSelection(selectionBox.additive ? [...selectedIds, ...picked] : picked);
    selectionBox = null;
    render();
  }

  function findTile(point) {
    for (let index = state.tiles.length - 1; index >= 0; index--) {
      const tile = state.tiles[index];
      if (Math.abs(point.x - tile.x) <= GRID / 2 && Math.abs(point.y - tile.y) <= GRID / 2) return tile;
    }
    return null;
  }

  function findShape(point) {
    for (let index = state.shapes.length - 1; index >= 0; index--) {
      const shape = state.shapes[index];
      const bounds = shapeBounds(shape);
      const pad = 9 / zoom;
      if (point.x < bounds.x - pad || point.x > bounds.x + bounds.width + pad || point.y < bounds.y - pad || point.y > bounds.y + bounds.height + pad) continue;
      if (shape.kind === 'line') {
        if (pixelLineCells(shape).some(cell => Math.abs(point.x - cell.x) <= GRID / 2 && Math.abs(point.y - cell.y) <= GRID / 2)) return shape;
      } else if (shape.kind === 'stroke') {
        if (shape.points.some(cell => Math.abs(point.x - cell.x) <= GRID / 2 && Math.abs(point.y - cell.y) <= GRID / 2)) return shape;
      } else if (shape.kind === 'circle' && shape.filled) {
        if (shapeCellAtPoint(shape, point)) return shape;
      } else if (shape.kind === 'square' || shape.filled) return shape;
      else {
        const rx = Math.max(bounds.width / 2, 1), ry = Math.max(bounds.height / 2, 1);
        const distance = ((point.x - (bounds.x + rx)) / rx) ** 2 + ((point.y - (bounds.y + ry)) / ry) ** 2;
        if (Math.abs(distance - 1) < 0.24) return shape;
      }
    }
    return null;
  }

  function drawingShapeMetadata() {
    const mode = document.querySelector('#shapeMode').value;
    if (mode !== 'alert') return { mode };
    const turns = Math.max(1, Math.min(99, Math.floor(Number(document.querySelector('#shapeAlertTurns').value) || 1)));
    return {
      mode,
      alertDamage: Math.max(0, Math.min(1000, Number(document.querySelector('#shapeAlertDamage').value) || 0)),
      alertTurnsTotal: turns,
      alertTurnsRemaining: turns,
      alertTriggered: false
    };
  }

  function onDoubleClick(event) {
    if (tool !== 'select' || !plannedMove) return;
    const point = screenToWorld(pointerPosition(event));
    const destination = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
    if (plannedMove.x === destination.x && plannedMove.y === destination.y) {
      event.preventDefault();
      confirmPlannedMove();
    }
  }

  function onPointerDown(event) {
    lastPointerRaw = pointerPosition(event);
    lastPointerScreen = lastPointerRaw;
    if (canvas.dataset.space === 'true' || event.button === 1 || event.button === 2) {
      startPan(event); return;
    }
    if (event.button !== 0) return;
    const screen = lastPointerScreen;
    const point = screenToWorld(screen);
    aimWorld = aimPointFor(point);
    if (!pointInsideMap(point)) return;
    if (tool === 'straight-line') {
      const endpoint = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
      if (!pointInsideMap(endpoint)) return;
      if (!pendingLineStart) {
        pendingLineStart = endpoint;
        linePreview = { id: 'line-preview', kind: 'line', x1: endpoint.x, y1: endpoint.y, x2: endpoint.x, y2: endpoint.y, color: document.querySelector('#drawColor').value, width: GRID, opacity: state.opacity };
        dragReadout = { x: screen.x, y: screen.y, text: shapeTileReadout(linePreview) };
      } else {
        const line = { id: crypto.randomUUID(), kind: 'line', x1: pendingLineStart.x, y1: pendingLineStart.y, x2: endpoint.x, y2: endpoint.y, color: document.querySelector('#drawColor').value, width: GRID, opacity: state.opacity, layerId: state.activeLayerId || 'layer-1', ...drawingShapeMetadata() };
        state.shapes.push(line);
        setSelection([line.id], line.id);
        pendingLineStart = null;
        linePreview = null;
        dragReadout = null;
        broadcastState();
        return;
      }
      render();
      return;
    }
    if (tool === 'select' && pendingTokenMove) {
      const token = state.tokens.find(item => item.id === pendingTokenMove.id);
      if (token) {
        const destination = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
        if (!pointInsideMap(destination)) return;
        if (!setPlannedMove(token, destination)) return;
      }
      pendingTokenMove = null;
      updateInspectorSelection();
      return;
    }
    if (tool === 'locate') {
      const token = findToken(point);
      if (token) {
        setSelection([token.id], token.id);
        locatedTokenId = token.id;
        panX = -token.x * zoom;
        panY = -token.y * zoom;
        window.clearTimeout(locateTimer);
        locateTimer = window.setTimeout(() => { locatedTokenId = null; render(); }, 1800);
        render();
      } else showToast('Clique em um token para localizá-lo.');
      return;
    }
    if (tool === 'projectile') {
      const position = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
      if (!pointInsideMap(position)) return;
      if (!pendingProjectileStart) {
        pendingProjectileStart = { ...position };
        const settings = projectileSettings();
        projectilePreview = { start: position, end: position, aimEnd: position, kind: settings.kind, widthTiles: settings.widthTiles, heightTiles: settings.heightTiles };
        render();
      } else {
        const start = { x: pendingProjectileStart.x, y: pendingProjectileStart.y };
        const settings = projectileSettings();
        const end = projectileEndForAngle(start, position, settings.angle);
        if (!pointInsideMap(end)) { showToast('O destino calculado fica fora do mapa.'); return; }
        pendingProjectileStart = null;
        projectilePreview = null;
        dragReadout = null;
        launchProjectile(start, end, settings);
      }
      return;
    }
    if (tool === 'elevation') {
      const x = snapCellCenter(point.x);
      const y = snapCellCenter(point.y);
      const index = state.elevation.findIndex(cell => cell.x === x && cell.y === y);
      if (elevationLevel === 0) {
        if (index >= 0) state.elevation.splice(index, 1);
      } else if (index >= 0) state.elevation[index].level = elevationLevel;
      else state.elevation.push({ x, y, level: elevationLevel, layerId: state.activeLayerId || 'layer-1' });
      broadcastState();
      return;
    }
    activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    if (tool === 'token') {
      const position = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
      if (!pointInsideMap(position)) return;
      if (constructionBlocksPoint(position)) { showToast('Não é possível posicionar um token dentro de uma construção.'); return; }
      currentToken = { id: crypto.randomUUID(), ...position, widthTiles: tokenTileCount(document.querySelector('#tokenWidth').value), heightTiles: tokenTileCount(document.querySelector('#tokenHeight').value), name: document.querySelector('#tokenName').value.trim() || 'Token', color: document.querySelector('#tokenColor').value, opacity: state.opacity, layerId: state.activeLayerId || 'layer-1' };
      dragReadout = { x: screen.x, y: screen.y, startX: point.x, startY: point.y, text: '0 tiles' };
      render(); return;
    }
    if (['line', 'circle', 'square'].includes(tool)) {
      const align = tool === 'line' ? snapCellCenter : snap;
      const x = align(point.x), y = align(point.y);
      if (!pointInsideMap({ x, y })) return;
      currentShape = tool === 'line'
        ? { id: crypto.randomUUID(), kind: 'stroke', points: [{ x, y }], color: document.querySelector('#drawColor').value, width: GRID, opacity: state.opacity, layerId: state.activeLayerId || 'layer-1', ...drawingShapeMetadata() }
        : { id: crypto.randomUUID(), kind: tool, x1: x, y1: y, x2: x, y2: y, color: document.querySelector('#drawColor').value, filled: true, opacity: state.opacity, layerId: state.activeLayerId || 'layer-1', ...drawingShapeMetadata() };
      dragReadout = { x: screen.x, y: screen.y, text: shapeTileReadout(currentShape) };
      render(); return;
    }
    const found = findToken(point);
    if (found) {
      if (event.shiftKey) {
        const next = new Set(selectedIds);
        if (next.has(found.id)) next.delete(found.id); else next.add(found.id);
        setSelection(next, found.id);
      } else if (!selectedIds.has(found.id)) setSelection([found.id], found.id);
      if (!canPlanToken(found)) { render(); return; }
      dragToken = { id: found.id, offsetX: point.x - found.x, offsetY: point.y - found.y, startX: found.x, startY: found.y, didMove: false };
      movementRoute = { start: { x: found.x, y: found.y }, end: { x: found.x, y: found.y } };
      dragReadout = { x: screen.x, y: screen.y, text: '0 tiles' };
      render(); return;
    }
    const tile = findTile(point);
    const shape = findShape(point);
    const foundObject = tile || shape;
    if (foundObject) {
      if (event.shiftKey) setSelection([...selectedIds, foundObject.id], foundObject.id);
      else setSelection([foundObject.id], foundObject.id);
    } else {
      selectionBox = { startX: screen.x, startY: screen.y, x: screen.x, y: screen.y, additive: event.shiftKey };
      activePointer = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      render();
      return;
    }
    if (shape) dragToken = { id: shape.id, offsetX: point.x, offsetY: point.y, x1: shape.x1, y1: shape.y1, x2: shape.x2, y2: shape.y2, points: shape.kind === 'stroke' ? shape.points.map(cell => ({ ...cell })) : null, shape: true };
    else if (tile) dragToken = { id: tile.id, offsetX: point.x - tile.x, offsetY: point.y - tile.y, startX: tile.x, startY: tile.y, didMove: false, tile: true };
    if (shape || tile) dragReadout = { x: screen.x, y: screen.y, text: '0 tiles' };
    render();
  }

  function onPointerMove(event) {
    const screen = interactionPointerPosition(event);
    magnifierPointer = screen;
    const point = screenToWorld(screen);
    aimWorld = aimPointFor(point);
    if (magnifierMode !== 0) updateMagnifier();
    document.querySelector('#coordinates').textContent = `X ${String(Math.round(point.x)).padStart(3, '0')} · Y ${String(Math.round(point.y)).padStart(3, '0')}`;
    const shouldRenderForInteraction = panPointer?.id === event.pointerId || selectionBox && activePointer === event.pointerId || currentShape || currentToken || dragToken || pendingLineStart || pendingProjectileStart || pendingTokenMove;
    if (!shouldRenderForInteraction) return;
    if (panPointer && panPointer.id === event.pointerId) {
      panX = panPointer.panX + screen.x - panPointer.x;
      panY = panPointer.panY + screen.y - panPointer.y;
      requestRender(); return;
    }
    if (selectionBox && activePointer === event.pointerId) {
      selectionBox.x = screen.x;
      selectionBox.y = screen.y;
      requestRender(); return;
    }
    if (!pointInsideMap(point)) { requestRender(); return; }
    if (activePointer !== event.pointerId) {
      if (tool === 'straight-line' && pendingLineStart) {
        const endpoint = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
        linePreview.x2 = endpoint.x; linePreview.y2 = endpoint.y;
        dragReadout = { x: screen.x, y: screen.y, text: shapeTileReadout(linePreview) };
      }
      if (tool === 'projectile' && pendingProjectileStart) {
        const target = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
        const settings = projectileSettings();
        const endpoint = projectileEndForAngle(pendingProjectileStart, target, settings.angle);
        projectilePreview = { start: { x: pendingProjectileStart.x, y: pendingProjectileStart.y }, end: endpoint, aimEnd: target, kind: settings.kind, widthTiles: settings.widthTiles, heightTiles: settings.heightTiles };
        const tiles = Math.ceil(Math.hypot(target.x - pendingProjectileStart.x, target.y - pendingProjectileStart.y) / GRID);
        dragReadout = { x: screen.x, y: screen.y, text: `${tiles} tiles` };
      }
      if (tool === 'select' && pendingTokenMove) {
        const token = state.tokens.find(item => item.id === pendingTokenMove.id);
        if (token) {
          const endpoint = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
          movementRoute.end = endpoint;
          const movedX = Math.round((endpoint.x - pendingTokenMove.x) / GRID);
          const movedY = Math.round((endpoint.y - pendingTokenMove.y) / GRID);
          dragReadout = { x: screen.x, y: screen.y, text: `${movedX >= 0 ? '+' : ''}${movedX}, ${movedY >= 0 ? '+' : ''}${movedY} tiles` };
        }
      }
      requestRender(); return;
    }
    if (currentShape) {
      if (currentShape.kind === 'stroke') {
        const endpoint = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
        if (!pointInsideMap(endpoint)) { requestRender(); return; }
        const previous = currentShape.points[currentShape.points.length - 1];
        currentShape.points.push(...gridCellRoute(previous, endpoint).slice(1).filter(cell => pointInsideMap(cell)));
      } else {
        const endpoint = { x: snap(point.x), y: snap(point.y) };
        if (!pointInsideMap(endpoint)) { requestRender(); return; }
        currentShape.x2 = endpoint.x; currentShape.y2 = endpoint.y;
      }
      dragReadout = { x: screen.x, y: screen.y, text: shapeTileReadout(currentShape) };
      requestRender(); return;
    }
    if (currentToken) {
      const from = objectGeometry(visualObject(currentToken));
      const destination = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
      if (!pointInsideMap(destination)) { requestRender(); return; }
      currentToken.x = destination.x;
      currentToken.y = destination.y;
      animateObjectFrom(currentToken, from, 100);
      const movedX = Math.round((currentToken.x - snapCellCenter(dragReadout.startX)) / GRID);
      const movedY = Math.round((currentToken.y - snapCellCenter(dragReadout.startY)) / GRID);
      dragReadout = { ...dragReadout, x: screen.x, y: screen.y, text: `${movedX >= 0 ? '+' : ''}${movedX}, ${movedY >= 0 ? '+' : ''}${movedY} tiles` };
      requestRender(); return;
    }
    if (dragToken && !dragToken.shape) {
      const item = dragToken.tile ? state.tiles.find(candidate => candidate.id === dragToken.id) : state.tokens.find(candidate => candidate.id === dragToken.id);
      if (item) {
        const destination = { x: snapCellCenter(point.x - dragToken.offsetX), y: snapCellCenter(point.y - dragToken.offsetY) };
        if (!pointInsideMap(destination)) { requestRender(); return; }
        if (dragToken.tile) {
          item.x = destination.x; item.y = destination.y;
        } else {
          if (constructionBlocksRoute(item, destination)) { requestRender(); return; }
          if (movementRoute) movementRoute.end = { x: destination.x, y: destination.y };
        }
        dragToken.didMove = destination.x !== dragToken.startX || destination.y !== dragToken.startY;
        const movedX = Math.round((destination.x - dragToken.startX) / GRID);
        const movedY = Math.round((destination.y - dragToken.startY) / GRID);
        dragReadout = { x: screen.x, y: screen.y, text: `${movedX >= 0 ? '+' : ''}${movedX}, ${movedY >= 0 ? '+' : ''}${movedY} tiles` };
        requestRender();
      }
      return;
    }
    if (dragToken?.shape) {
      const shape = state.shapes.find(item => item.id === dragToken.id);
      if (shape) {
        const from = objectGeometry(visualObject(shape));
        const dx = snap(point.x - dragToken.offsetX), dy = snap(point.y - dragToken.offsetY);
        const movedShape = shape.kind === 'stroke'
          ? { ...shape, points: dragToken.points.map(cell => ({ x: cell.x + dx, y: cell.y + dy })) }
          : { ...shape, x1: dragToken.x1 + dx, x2: dragToken.x2 + dx, y1: dragToken.y1 + dy, y2: dragToken.y2 + dy };
        if (!shapeFitsMap(movedShape)) { requestRender(); return; }
        if (shape.kind === 'stroke') shape.points = movedShape.points;
        else {
          shape.x1 = movedShape.x1; shape.x2 = movedShape.x2;
          shape.y1 = movedShape.y1; shape.y2 = movedShape.y2;
        }
        animateObjectFrom(shape, from, 100);
        dragReadout = { x: screen.x, y: screen.y, text: `${dx >= 0 ? '+' : ''}${dx / GRID}, ${dy >= 0 ? '+' : ''}${dy / GRID} tiles` };
        requestRender();
      }
    }
  }

  function onPointerUp(event) {
    if (event.type === 'pointercancel') {
      if (dragToken) {
        objectTransitions.delete(dragToken.id);
        if (dragToken.shape) {
          const shape = state.shapes.find(item => item.id === dragToken.id);
          if (shape) {
            if (shape.kind === 'stroke') shape.points = dragToken.points;
            else {
              shape.x1 = dragToken.x1; shape.y1 = dragToken.y1;
              shape.x2 = dragToken.x2; shape.y2 = dragToken.y2;
            }
          }
        } else {
          const collection = dragToken.tile ? state.tiles : state.tokens;
          const item = collection.find(candidate => candidate.id === dragToken.id);
          if (item) { item.x = dragToken.startX; item.y = dragToken.startY; }
        }
      }
      currentShape = null;
      currentToken = null;
      dragToken = null;
      selectionBox = null;
      pendingTokenMove = null;
      dragReadout = null;
      movementRoute = null;
      activePointer = null;
      if (panPointer?.id === event.pointerId) { panPointer = null; canvas.classList.remove('is-panning'); }
      render();
      return;
    }
    if (panPointer && panPointer.id === event.pointerId) { panPointer = null; canvas.classList.remove('is-panning'); return; }
    if (activePointer !== event.pointerId) return;
    if (selectionBox) {
      completeBoxSelection();
      activePointer = null;
      return;
    }
    if (currentToken) {
      state.tokens.push(currentToken);
      setSelection([currentToken.id], currentToken.id);
      currentToken = null;
      dragReadout = null;
      broadcastState();
      activePointer = null;
      return;
    }
    if (currentShape) {
      const shape = currentShape;
      currentShape = null;
      dragReadout = null;
      if (shape.kind === 'stroke' || Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1) > 5) { state.shapes.push(shape); setSelection([shape.id], shape.id); broadcastState(); }
      else render();
    } else if (dragToken) {
      if (!dragToken.shape && !dragToken.tile && !dragToken.didMove) {
        pendingTokenMove = { id: dragToken.id, x: dragToken.startX, y: dragToken.startY };
        movementRoute = { start: { x: dragToken.startX, y: dragToken.startY }, end: { x: dragToken.startX, y: dragToken.startY } };
        dragReadout = { x: pointerPosition(event).x, y: pointerPosition(event).y, text: '0, 0 tiles' };
        render();
      } else if (!dragToken.shape && !dragToken.tile && movementRoute) {
        const token = state.tokens.find(item => item.id === dragToken.id);
        const destination = movementRoute.end;
        plannedMove = { tokenId: dragToken.id, x: destination.x, y: destination.y };
        dragReadout = { x: pointerPosition(event).x, y: pointerPosition(event).y, text: `${Math.round((destination.x - dragToken.startX) / GRID)}, ${Math.round((destination.y - dragToken.startY) / GRID)} tiles` };
        if (token) setSelection([token.id], token.id);
        updateInspectorSelection();
        render();
      } else {
        dragReadout = null;
        movementRoute = null;
        broadcastState();
      }
    }
    dragToken = null;
    activePointer = null;
  }

  function startPan(event) {
    const screen = pointerPosition(event);
    panPointer = { id: event.pointerId, x: screen.x, y: screen.y, panX, panY };
    canvas.classList.add('is-panning');
    canvas.setPointerCapture(event.pointerId);
  }

  function zoomAt(nextZoom, screenPoint) {
    const before = screenToWorld(screenPoint);
    zoom = Math.max(0.02, Math.min(2.5, nextZoom));
    const { width, height } = viewSize();
    panX = screenPoint.x - width / 2 - before.x * zoom;
    panY = screenPoint.y - height / 2 - before.y * zoom;
    updateZoomLabel(); render();
  }

  function updateZoomLabel() { document.querySelector('#zoomReadout').textContent = `${Math.round(zoom * 100)}%`; }
  function updateObjectCount() {
    const count = state.tokens.length + state.tiles.length + state.shapes.length + state.elevation.length;
    document.querySelector('#objectCount').textContent = `${count} ${count === 1 ? 'objeto' : 'objetos'} no mapa`;
  }

  function updateOpacityControl() {
    const percentage = Math.round(clampOpacity(state.opacity) * 100);
    document.querySelector('#objectOpacity').value = String(percentage);
    document.querySelector('#objectOpacityValue').textContent = `${percentage}%`;
  }

  function mapRatioFor(map) {
    const ratio = map.width / map.height;
    return [['1:1', 1], ['4:3', 4 / 3], ['16:9', 16 / 9], ['2:1', 2]]
      .find(([, value]) => Math.abs(ratio - value) < 0.025)?.[0] || 'custom';
  }

  function updateMapControls() {
    const map = normalizeMapConfig(state.map);
    const square = map.shape === 'square' || map.shape === 'circle';
    document.querySelector('#mapShape').value = map.shape;
    document.querySelector('#mapWidth').value = String(map.width);
    document.querySelector('#mapHeight').value = String(map.height);
    document.querySelector('#mapHeightField').hidden = square;
    document.querySelector('#mapRatioField').hidden = map.shape !== 'rectangle';
    document.querySelector('#mapRatio').hidden = map.shape !== 'rectangle';
    document.querySelector('#mapRatio').value = mapRatioFor(map);
    document.querySelector('#mapWidth').max = String(MAX_MAP_DIMENSION);
    document.querySelector('#mapHeight').max = String(MAX_MAP_DIMENSION);
    document.querySelector('#mapCapacity').textContent = `${countMapTiles(map).toLocaleString('pt-BR')} tiles`;
  }

  function updateInitiativePanel() {
    const ordered = orderedCombatants();
    const tokens = new Map(state.tokens.map(token => [token.id, token]));
    const signature = JSON.stringify({
      round: state.initiative.round,
      active: state.initiative.activeTokenId,
      combatants: ordered.map(combatant => [combatant.tokenId, combatant.initiative, tokens.get(combatant.tokenId)?.name])
    });
    document.querySelector('#initiativeRound').textContent = `RODADA ${state.initiative.round}`;
    document.querySelector('#initiativeEmpty').hidden = ordered.length > 0;
    if (signature === initiativeUiSignature) return;
    initiativeUiSignature = signature;
    document.querySelector('#initiativeList').innerHTML = ordered.map((combatant, index) => {
      const token = tokens.get(combatant.tokenId);
      if (!token) return '';
      const active = combatant.tokenId === state.initiative.activeTokenId;
      return `<div class="initiative-row${active ? ' active' : ''}" data-token-id="${escapeAttribute(token.id)}">
        <span class="initiative-order">${index + 1}</span>
        <button class="initiative-token" type="button" data-action="locate" title="Localizar token">${escapeHTML(token.name || 'Token')}</button>
        <input class="initiative-score" type="number" min="1" max="30" value="${combatant.initiative ?? ''}" placeholder="—" aria-label="Iniciativa de ${escapeAttribute(token.name || 'token')}" data-action="score">
        <button class="initiative-remove" type="button" data-action="remove" aria-label="Remover da iniciativa" title="Remover">×</button>
      </div>`;
    }).join('');
  }

  function addTokensToInitiative() {
    const existing = new Set(state.initiative.combatants.map(combatant => combatant.tokenId));
    const added = state.tokens.filter(token => !existing.has(token.id)).map(token => ({ tokenId: token.id, initiative: null }));
    if (!added.length) { showToast(state.tokens.length ? 'Todos os tokens já estão na iniciativa.' : 'Adicione tokens ao mapa primeiro.'); return; }
    state.initiative.combatants.push(...added);
    broadcastState();
  }

  function rollInitiative() {
    if (!state.initiative.combatants.length) addTokensToInitiative();
    if (!state.initiative.combatants.length) return;
    for (const combatant of state.initiative.combatants) combatant.initiative = 1 + Math.floor(Math.random() * 30);
    state.initiative.round = 1;
    state.initiative.activeTokenId = orderedCombatants()[0].tokenId;
    broadcastState();
    focusToken(state.initiative.activeTokenId);
  }

  function advanceInitiative() {
    const ordered = orderedCombatants();
    if (!ordered.length) { showToast('Adicione tokens para iniciar a iniciativa.'); return; }
    const nextIndex = ordered.findIndex(combatant => combatant.tokenId === state.initiative.activeTokenId) + 1;
    if (nextIndex >= ordered.length) {
      state.initiative.round++;
      state.initiative.activeTokenId = ordered[0].tokenId;
    } else state.initiative.activeTokenId = ordered[nextIndex].tokenId;
    advanceShapeAlerts();
    advanceProjectiles();
    broadcastState();
    focusToken(state.initiative.activeTokenId);
  }

  function focusToken(tokenId) {
    const token = state.tokens.find(item => item.id === tokenId);
    if (!token) return;
    setSelection([token.id], token.id);
    locatedTokenId = token.id;
    panX = -token.x * zoom;
    panY = -token.y * zoom;
    window.clearTimeout(locateTimer);
    locateTimer = window.setTimeout(() => { locatedTokenId = null; render(); }, 1800);
    render();
  }

  function launchProjectile(start, end, settings, id = crypto.randomUUID(), relay = true) {
    const kind = settings?.kind;
    if (!PROJECTILE_TYPES[kind] || !Number.isFinite(start?.x) || !Number.isFinite(start?.y) || !Number.isFinite(end?.x) || !Number.isFinite(end?.y) || !pointInsideMap(start) || !pointInsideMap(end) || seenProjectiles.has(id)) return false;
    seenProjectiles.add(id);
    if (seenProjectiles.size > 256) seenProjectiles.delete(seenProjectiles.values().next().value);
    const aoe = Number.isFinite(Number(settings.aoe)) ? Math.max(0, Math.min(20, Number(settings.aoe))) : 0;
    const speed = Number.isFinite(Number(settings.speed)) ? Math.max(1, Math.min(999, Math.round(Number(settings.speed)))) : 1;
    const damage = Number.isFinite(Number(settings.damage)) ? Math.max(0, Math.min(1000, Number(settings.damage))) : 0;
    const widthTiles = Number.isFinite(Number(settings.widthTiles)) ? Math.max(0.25, Math.min(8, Number(settings.widthTiles))) : 0.5;
    const heightTiles = Number.isFinite(Number(settings.heightTiles)) ? Math.max(0.25, Math.min(8, Number(settings.heightTiles))) : 0.5;
    const pierce = Boolean(settings.pierce);
    const path = projectileCellRoute(start, end);
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const distanceSquared = deltaX * deltaX + deltaY * deltaY;
    const pathProgress = path.map(cell => distanceSquared
      ? Math.max(0, Math.min(1, ((cell.x - start.x) * deltaX + (cell.y - start.y) * deltaY) / distanceSquared))
      : 0);
    const orderedPath = path.map((cell, index) => ({ cell, progress: pathProgress[index] }))
      .sort((first, second) => first.progress - second.progress);
    const projectile = {
      id, start: { ...start }, end: { ...end }, kind, aoe, speed,
      widthTiles, heightTiles,
      linearTrail: Boolean(settings.linearTrail),
      damageExpression: String(settings.damageExpression || '').slice(0, 100),
      autoRollDamage: Boolean(settings.autoRollDamage),
      damage, pierce,
      path: orderedPath.map(item => item.cell), pathProgress: orderedPath.map(item => item.progress),
      distance: Math.max(1, Math.hypot(deltaX, deltaY)), pathIndex: 0, progress: 0, markedTokenIds: new Set()
    };
    if (settings.instant) {
      moveProjectileTo(projectile, 1);
      projectile.progress = 1;
      addProjectileImpact(projectile);
    } else activeProjectiles.push(projectile);
    if (projectileFrame === null) projectileFrame = requestAnimationFrame(animateProjectiles);
    if (relay) {
      const message = { type: 'projectile', projectile: { id, start, end, kind, aoe, speed, widthTiles, heightTiles, linearTrail: projectile.linearTrail, damageExpression: projectile.damageExpression, autoRollDamage: projectile.autoRollDamage, damage, pierce, instant: Boolean(settings.instant) } };
      if (hostMode) broadcast(message);
      else if (connections.has('host')) connections.get('host').send(message);
    }
    render();
    return true;
  }

  function mapObjectsFit(config) {
    return [...state.tokens, ...state.tiles].every(item => pointInsideMap(item, config)) && state.shapes.every(shape => shapeFitsMap(shape, config));
  }

  function applyMapSettings(changedField) {
    const shape = document.querySelector('#mapShape').value;
    let width = Number(document.querySelector('#mapWidth').value) || state.map.width;
    let height = Number(document.querySelector('#mapHeight').value) || state.map.height;
    const ratioChoice = document.querySelector('#mapRatio').value;
    const ratio = ratioChoice === 'custom' ? null : ratioChoice.split(':').map(Number).reduce((a, b) => a / b);
    if (shape === 'square' || shape === 'circle') {
      const side = changedField === 'height' ? height : width;
      width = side; height = side;
    } else if (shape === 'rectangle' && ratio) {
      if (changedField === 'height') width = Math.round(height * ratio);
      else height = Math.max(1, Math.round(width / ratio));
    }
    const candidate = normalizeMapConfig({ shape, width, height });
    if (!mapObjectsFit(candidate)) {
      showToast('A nova forma cortaria objetos. Mova-os ou aumente o mapa primeiro.');
      updateMapControls();
      return;
    }
    state.map = candidate;
    broadcastState();
  }

  function updateInspectorSelection() {
    const selectedItems = [...state.tokens, ...state.tiles, ...state.shapes].filter(item => selectedIds.has(item.id));
    const selected = selectedItems.find(item => item.id === selectedId) || selectedItems[0];
    const section = document.querySelector('#selectedSection');
    section.hidden = selectedItems.length === 0;
    const movementControls = document.querySelector('#movementControls');
    movementControls.hidden = selectedItems.length !== 1 || !state.tokens.includes(selected) || !canPlanToken(selected);
    document.querySelector('#movementModeFree').setAttribute('aria-pressed', String(movementMode === 'free'));
    document.querySelector('#movementModeAngles').setAttribute('aria-pressed', String(movementMode === 'angles'));
    document.querySelector('#movementAngleControls').hidden = movementMode !== 'angles';
    const currentPlan = plannedMove?.tokenId === selected?.id ? plannedMove : null;
    document.querySelector('#movementStatus').textContent = currentPlan
      ? `Destino marcado: ${Math.round((currentPlan.x - selected.x) / GRID)}, ${Math.round((currentPlan.y - selected.y) / GRID)} tiles. Confirme para mover.`
      : movementMode === 'free' ? 'Use as setas ou WASD para marcar o trajeto.' : 'Escolha um dos oito ângulos e a distância.';
    document.querySelector('#confirmMovement').disabled = !currentPlan || !canPlanToken(selected);
    const details = document.querySelector('#selectedDetails');
    if (!selectedItems.length) { details.replaceChildren(); return; }
    if (selectedItems.length > 1) {
      details.innerHTML = `<div class="selected-object"><span>${selectedItems.length} objetos selecionados</span><button class="delete-selected" type="button" aria-label="Excluir seleção" title="Excluir">×</button></div>`;
      details.querySelector('.delete-selected').addEventListener('click', deleteSelected);
      return;
    }
    const label = selected.name || ({ line: 'Linha', circle: 'Círculo', square: 'Quadrado' }[selected.kind] || 'Tile');
    const selectedWidth = tokenTileCount(selected.widthTiles, selected.radius);
    const selectedHeight = tokenTileCount(selected.heightTiles, selected.radius);
    const tokenSizeControl = isRoomAdmin() && state.tokens.includes(selected) ? `<div class="token-size-fields spacing-top"><label class="field-label" for="selectedTokenWidth">LARGURA (TILES)<input id="selectedTokenWidth" class="text-input map-number" type="number" min="1" step="1" value="${selectedWidth}"></label><label class="field-label" for="selectedTokenHeight">ALTURA (TILES)<input id="selectedTokenHeight" class="text-input map-number" type="number" min="1" step="1" value="${selectedHeight}"></label></div>` : '';
    const shapeControls = state.shapes.includes(selected) ? `<div class="selected-shape-mode"><label class="field-label" for="selectedShapeMode">MODO</label><select class="text-input" id="selectedShapeMode" data-shape-field="mode"><option value="free" ${selected.mode !== 'construction' && selected.mode !== 'alert' ? 'selected' : ''}>Livre</option><option value="construction" ${selected.mode === 'construction' ? 'selected' : ''}>Construção · bloqueia</option><option value="alert" ${selected.mode === 'alert' ? 'selected' : ''}>Alerta · dano após turnos</option></select>${selected.mode === 'alert' ? `<label class="field-label spacing-top" for="selectedAlertTurns">TURNOS RESTANTES</label><input class="text-input" id="selectedAlertTurns" type="number" min="1" max="99" value="${Math.max(1, selected.alertTurnsRemaining || selected.alertTurnsTotal || 1)}" data-shape-field="alertTurnsRemaining"><label class="field-label spacing-top" for="selectedAlertDamage">DANO</label><input class="text-input" id="selectedAlertDamage" type="number" min="0" max="1000" value="${Math.max(0, selected.alertDamage || 0)}" data-shape-field="alertDamage">` : ''}</div>` : '';
    details.innerHTML = `<div class="selected-object"><span class="selected-swatch" style="background:${escapeAttribute(selected.color || TILE_STYLES[selected.kind]?.fill || '#7a8279')}"></span><span>${escapeHTML(label)}</span>${isRoomAdmin() ? '<button class="delete-selected" type="button" aria-label="Excluir seleção" title="Excluir">×</button>' : ''}</div>${tokenSizeControl}${shapeControls}`;
    details.querySelector('.delete-selected')?.addEventListener('click', deleteSelected);
    for (const [field, input] of [['widthTiles', details.querySelector('#selectedTokenWidth')], ['heightTiles', details.querySelector('#selectedTokenHeight')]]) {
      input?.addEventListener('input', event => {
        selected[field] = tokenTileCount(event.target.value, selected.radius);
        event.target.value = String(selected[field]);
        drawMapScene(canvas.clientWidth, canvas.clientHeight);
        drawDragReadout();
      });
      input?.addEventListener('change', broadcastState);
    }
  }

  function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  function escapeAttribute(value) { return String(value).replace(/[&"<>]/g, char => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[char])); }

  function deleteSelected() {
    if (!isRoomAdmin()) return;
    for (const collection of [state.tokens, state.tiles, state.shapes]) {
      for (let index = collection.length - 1; index >= 0; index--) {
        if (selectedIds.has(collection[index].id)) collection.splice(index, 1);
      }
    }
    state.initiative.combatants = state.initiative.combatants.filter(combatant => !selectedIds.has(combatant.tokenId));
    if (selectedIds.has(state.initiative.activeTokenId)) state.initiative.activeTokenId = null;
    setSelection([]); broadcastState();
  }

  function moveSelectedToken(dx, dy) {
    const token = state.tokens.find(item => item.id === selectedId);
    if (!token) return false;
    return planTokenStep(dx, dy);
  }

  function showToast(message) {
    const toast = document.querySelector('#toast');
    toast.textContent = message; toast.classList.add('visible');
    window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast.classList.remove('visible'), 2600);
  }

  function setConnectionStatus(status, label) {
    const indicator = document.querySelector('#connectionIndicator');
    indicator.classList.toggle('online', status === 'online');
    indicator.classList.toggle('connecting', status === 'connecting');
    document.querySelector('#connectionLabel').textContent = label;
  }

  function normalizeRoom(value) { return value.toLowerCase().trim().replace(/[^a-z0-9-]/g, '').slice(0, 24); }

  function createRoom() {
    if (!window.Peer) { showToast('Não foi possível carregar a conexão multiplayer. Verifique sua internet.'); return; }
    const codeInput = document.querySelector('#roomCode');
    roomId = normalizeRoom(codeInput.value) || Math.random().toString(36).slice(2, 8);
    codeInput.value = roomId;
    disconnectPeer(); hostMode = true; roomRole = 'admin'; roomMembers.clear(); updatePlayers();
    setConnectionStatus('connecting', 'Criando sala…');
    peer = new Peer(`stone-plate-${roomId}`, { debug: 1 });
    peer.on('open', () => {
      setConnectionStatus('online', `Sala ${roomId}`);
      document.querySelector('#inviteNote').textContent = `Compartilhe o código ${roomId} para convidar jogadores.`;
      showToast(`Sala ${roomId} pronta para receber jogadores.`);
    });
    peer.on('connection', connection => registerConnection(connection));
    peer.on('error', error => {
      setConnectionStatus('', 'Local');
      showToast(error.type === 'unavailable-id' ? 'Esse código já está em uso. Tente outro.' : 'A sala não pôde ser criada. Confira a conexão.');
      disconnectPeer(false);
    });
    peer.on('disconnected', () => {
      if (!peer || peer.destroyed) return;
      setConnectionStatus('connecting', 'Reconectando…');
      peer.reconnect();
    });
  }

  function joinRoom() {
    if (!window.Peer) { showToast('Não foi possível carregar a conexão multiplayer. Verifique sua internet.'); return; }
    const code = normalizeRoom(document.querySelector('#roomCode').value);
    if (!code) { showToast('Digite o código da sala.'); return; }
    roomId = code; disconnectPeer(); hostMode = false; roomRole = 'player'; localMemberTokenId = null; roomMembers.clear(); updatePlayers();
    setConnectionStatus('connecting', 'Conectando…');
    peer = new Peer(undefined, { debug: 1 });
    peer.on('open', () => {
      document.querySelector('#localPlayerName').textContent = 'Você';
      const connection = peer.connect(`stone-plate-${roomId}`, { reliable: true });
      connections.set('host', connection);
      connection.on('open', () => {
        setConnectionStatus('online', `Sala ${roomId}`);
        document.querySelector('#inviteNote').textContent = `Conectado à sala ${roomId}.`;
      });
      wireConnection(connection, 'host');
    });
    peer.on('error', error => {
      showToast(error.type === 'peer-unavailable' ? 'Sala não encontrada. Confira o código.' : 'Falha ao conectar. Confira sua conexão.');
      setConnectionStatus('', 'Local'); disconnectPeer(false);
    });
    peer.on('disconnected', () => {
      if (!peer || peer.destroyed) return;
      setConnectionStatus('connecting', 'Reconectando…');
      peer.reconnect();
    });
  }

  function registerConnection(connection) {
    const id = connection.peer;
    connections.set(id, connection);
    roomMembers.set(id, { role: 'player', tokenId: null });
    wireConnection(connection, id);
    updatePlayers();
    connection.on('open', () => {
      connection.send({ type: 'state', state });
      connection.send({ type: 'room-session', role: 'player', tokenId: null });
      broadcastRoomMembers();
    });
  }

  function wireConnection(connection, id) {
    connection.on('data', message => {
      if (!message) return;
      if (message.type === 'room-session' && id === 'host') {
        roomRole = message.role === 'admin' ? 'admin' : 'player';
        localMemberTokenId = message.tokenId || null;
        updatePlayers();
        if (roomRole === 'player') setWorkspace('map');
        updateInspectorSelection();
        return;
      }
      if (message.type === 'room-members' && id === 'host' && Array.isArray(message.members)) { renderRoomMembers(message.members); return; }
      if (message.type === 'member-update' && hostMode) { applyRoomMemberUpdate(message, id); return; }
      if (message.type === 'move-token' && hostMode) { receiveMoveRequest(message, id); return; }
      if (message.type === 'dice-roll') { receiveDiceRoll(message.roll, 'peer'); return; }
      if (message.type === 'projectile' && message.projectile) {
        if (hostMode && roomMembers.get(id)?.role !== 'admin') return;
        const projectile = message.projectile;
        const accepted = launchProjectile(projectile.start, projectile.end, projectile, projectile.id, false);
        if (accepted && hostMode) broadcast(message);
        return;
      }
      if (message.type === 'projectile-turn' && message.id) {
        if (hostMode && roomMembers.get(id)?.role !== 'admin') return;
        const accepted = advanceProjectiles(message.id, false);
        if (accepted && hostMode) broadcast(message);
        return;
      }
      if (message.type !== 'state' || !message.state) return;
      if (!Array.isArray(message.state.tokens) || !Array.isArray(message.state.tiles) || !Array.isArray(message.state.shapes)) return;
      if (!hostMode && id === 'host') {
        state = alignStateToGrid(message.state); gridVisible = state.gridVisible !== false; syncHealthToTokens(); saveState(); render(); notifyStateSubscribers(); updatePlayers(); return;
      }
      if (hostMode) {
        if (roomMembers.get(id)?.role !== 'admin') return;
        state = alignStateToGrid(message.state); gridVisible = state.gridVisible !== false; syncHealthToTokens(); saveState(); render(); notifyStateSubscribers(); updatePlayers(); broadcast({ type: 'state', state });
      }
    });
    connection.on('close', () => { connections.delete(id); roomMembers.delete(id); updatePlayers(); broadcastRoomMembers(); });
    connection.on('error', () => { connections.delete(id); roomMembers.delete(id); updatePlayers(); broadcastRoomMembers(); });
  }

  function updatePlayers() {
    const remote = document.querySelector('#remotePlayers');
    const admins = document.querySelector('#roomAdminsList');
    const localRow = document.querySelector('#localPlayerRow');
    remote.replaceChildren();
    admins.replaceChildren();
    const manageable = isRoomAdmin();
    document.body.classList.toggle('player-room', Boolean(peer && !hostMode && roomRole === 'player'));
    localRow.querySelector('.player-role').textContent = roomRole === 'admin' ? 'ADMIN' : 'JOGADOR';
    localRow.querySelector('.avatar').textContent = roomRole === 'admin' ? 'A' : 'J';
    (roomRole === 'admin' ? admins : remote).append(localRow);
    let playerIndex = 0;
    let adminIndex = 0;
    for (const [memberId, member] of roomMembers) {
      if (peer && !hostMode && memberId === peer.id) continue;
      const tokenOptions = state.tokens.map(token => `<option value="${escapeAttribute(token.id)}" ${String(member.tokenId || '') === String(token.id) ? 'selected' : ''}>${escapeHTML(token.name || 'Token')}</option>`).join('');
      const memberIndex = member.role === 'admin' ? adminIndex++ : playerIndex++;
      const row = document.createElement('div');
      row.className = 'player-row';
      const avatar = document.createElement('span'); avatar.className = 'avatar remote'; avatar.textContent = String.fromCharCode(65 + (memberIndex % 26));
      const name = document.createElement('span'); name.className = 'player-name'; name.textContent = `${member.role === 'admin' ? 'Admin' : 'Jogador'} ${memberIndex + 1}`; name.title = memberId;
      const role = document.createElement('span'); role.className = 'player-role'; role.textContent = member.role === 'admin' ? 'ADMIN' : 'JOGADOR';
      const presence = document.createElement('span'); presence.className = 'presence-dot';
      row.append(avatar, name);
      if (manageable) {
        const roleSelect = document.createElement('select');
        roleSelect.className = 'room-member-select'; roleSelect.dataset.memberRole = memberId; roleSelect.setAttribute('aria-label', `Cargo de participante ${memberIndex + 1}`);
        roleSelect.innerHTML = `<option value="player" ${member.role !== 'admin' ? 'selected' : ''}>Jogador</option><option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option>`;
        const tokenSelect = document.createElement('select');
        tokenSelect.className = 'room-member-select room-token-select'; tokenSelect.dataset.memberToken = memberId; tokenSelect.setAttribute('aria-label', `Token de participante ${memberIndex + 1}`);
        tokenSelect.innerHTML = `<option value="">Sem token</option>${tokenOptions}`;
        row.append(roleSelect, tokenSelect);
      } else row.append(role, presence);
      (member.role === 'admin' ? admins : remote).append(row);
    }
    document.querySelector('#playerCount').textContent = String(playerIndex + adminIndex + 1);
  }

  function setWorkspace(view) {
    if (!isRoomAdmin() && view !== 'map') view = 'map';
    const showCharacters = view === 'characters';
    const showAdmin = view === 'admin';
    document.body.classList.toggle('settings-workspace-open', showCharacters);
    document.querySelector('#workspace').hidden = showCharacters || showAdmin;
    document.querySelector('#healthWorkspace').hidden = !showCharacters;
    document.querySelector('#adminWorkspace').hidden = !showAdmin;
    document.querySelector('#mapViewButton').classList.toggle('active', !showCharacters && !showAdmin);
    document.querySelector('#mapViewButton').setAttribute('aria-pressed', String(!showCharacters && !showAdmin));
    document.querySelector('#charactersViewButton').classList.toggle('active', showCharacters);
    document.querySelector('#charactersViewButton').setAttribute('aria-pressed', String(showCharacters));
    document.querySelector('#adminViewButton').classList.toggle('active', showAdmin);
    document.querySelector('#adminViewButton').setAttribute('aria-pressed', String(showAdmin));
    if (!showCharacters && !showAdmin) resizeCanvas();
  }

  stateChannel?.addEventListener('message', event => {
    if (event.data?.type === 'dice-roll') { receiveDiceRoll(event.data.roll, 'channel'); return; }
    if (event.data?.type !== 'state' || !event.data.state) return;
    state = alignStateToGrid(event.data.state);
    gridVisible = state.gridVisible !== false;
    render();
    notifyStateSubscribers();
  });

  function disconnectPeer(resetStatus = true) {
    for (const connection of connections.values()) connection.close();
    connections.clear();
    roomMembers.clear();
    if (peer) { peer.destroy(); peer = null; }
    if (resetStatus) { hostMode = false; roomRole = 'admin'; localMemberTokenId = null; setConnectionStatus('', 'Local'); updatePlayers(); }
  }

  function exportMap() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'stone-plate-mapa.json'; link.click();
    URL.revokeObjectURL(link.href);
  }

  function importMap(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported.tokens) || !Array.isArray(imported.tiles) || !Array.isArray(imported.shapes)) throw new Error('Formato inválido');
        state = alignStateToGrid({ ...imported, health: imported.health || state.health }); setSelection([]); broadcastState(); showToast('Mapa importado.');
      } catch (error) { showToast('Arquivo de mapa inválido.'); }
    };
    reader.readAsText(file);
  }

  document.querySelector('#mapViewButton').addEventListener('click', () => setWorkspace('map'));
  document.querySelector('#charactersViewButton').addEventListener('click', () => setWorkspace('characters'));
  document.querySelector('#adminViewButton').addEventListener('click', () => setWorkspace('admin'));
  window.StonePlateCharacters?.mount(window.StonePlate);
  document.querySelectorAll('.tool-button[data-tool]').forEach(button => button.addEventListener('click', () => setTool(button.dataset.tool)));
  document.querySelector('#layersToggle').addEventListener('click', event => {
    const panel = document.querySelector('#layersPopover');
    panel.hidden = !panel.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
    event.currentTarget.classList.toggle('active', !panel.hidden);
  });
  document.querySelector('#addLayerButton').addEventListener('click', addLayer);
  document.querySelector('#layerList').addEventListener('click', event => {
    const button = event.target.closest('[data-layer-action]');
    if (!button || button.disabled) return;
    const { layerAction, layerId } = button.dataset;
    if (layerAction === 'select' && isRoomAdmin()) { state.activeLayerId = layerId; broadcastState(); }
    else if (layerAction === 'up') moveLayer(layerId, 1);
    else if (layerAction === 'down') moveLayer(layerId, -1);
    else if (layerAction === 'delete') removeLayer(layerId);
  });
  document.querySelector('#elevationLevel').addEventListener('input', event => {
    elevationLevel = Math.round(Math.max(0, Math.min(MAX_ELEVATION_TILES, Number(event.target.value) || 0)) * 4) / 4;
    const unit = elevationLevel === 1 ? 'tile' : 'tiles';
    document.querySelector('#elevationLevelValue').textContent = elevationLevel === 0 ? 'Apagar' : `${elevationLevel.toLocaleString('pt-BR')} ${unit}`;
  });
  document.querySelector('#drawColor').addEventListener('input', event => syncRgbChannels(event.target.value));
  ['red', 'green', 'blue'].forEach(channel => document.querySelector(`#drawColor${channel}`).addEventListener('input', updateDrawColorFromRgb));
  syncRgbChannels(document.querySelector('#drawColor').value);
  document.querySelector('#shapeMode').addEventListener('change', event => {
    document.querySelector('#shapeAlertOptions').hidden = event.target.value !== 'alert';
  });
  document.querySelector('#selectedDetails').addEventListener('change', event => {
    const input = event.target.closest('[data-shape-field]');
    const shape = state.shapes.find(item => item.id === selectedId);
    if (!input || !shape) return;
    if (input.dataset.shapeField === 'mode') {
      shape.mode = input.value;
      if (shape.mode === 'alert') {
        const turns = Math.max(1, Math.min(99, Math.floor(Number(document.querySelector('#shapeAlertTurns').value) || 1)));
        shape.alertTurnsTotal = shape.alertTurnsTotal || turns;
        shape.alertTurnsRemaining = Math.max(1, shape.alertTurnsRemaining || turns);
        shape.alertDamage = Math.max(0, Number(document.querySelector('#shapeAlertDamage').value) || 0);
        shape.alertTriggered = false;
      }
    } else if (input.dataset.shapeField === 'alertTurnsRemaining') {
      shape.alertTurnsRemaining = Math.max(1, Math.min(99, Math.floor(Number(input.value) || 1)));
      shape.alertTurnsTotal = shape.alertTurnsRemaining;
      shape.alertTriggered = false;
    } else if (input.dataset.shapeField === 'alertDamage') shape.alertDamage = Math.max(0, Math.min(1000, Number(input.value) || 0));
    broadcastState();
  });
  document.querySelector('#tokenColor').addEventListener('input', event => document.querySelector('#tokenColorValue').textContent = event.target.value.toUpperCase());
  const updateProjectilePreview = () => {
    if (!pendingProjectileStart || !projectilePreview) return;
    const settings = projectileSettings();
    projectilePreview.end = projectileEndForAngle(pendingProjectileStart, projectilePreview.aimEnd, settings.angle);
    projectilePreview.kind = settings.kind;
    projectilePreview.widthTiles = settings.widthTiles;
    projectilePreview.heightTiles = settings.heightTiles;
    render();
  };
  document.querySelector('#projectileAngle').addEventListener('input', updateProjectilePreview);
  document.querySelector('#projectileType').addEventListener('change', updateProjectilePreview);
  document.querySelector('#projectileWidth').addEventListener('input', updateProjectilePreview);
  document.querySelector('#projectileHeight').addEventListener('input', updateProjectilePreview);
  document.querySelector('#objectOpacity').addEventListener('input', event => {
    state.opacity = clampOpacity(Number(event.target.value) / 100);
    for (const item of [...state.tokens, ...state.tiles, ...state.shapes]) item.opacity = state.opacity;
    updateOpacityControl(); render();
  });
  document.querySelector('#objectOpacity').addEventListener('change', broadcastState);
  document.querySelector('#mapShape').addEventListener('change', () => applyMapSettings('shape'));
  document.querySelector('#mapWidth').addEventListener('change', () => applyMapSettings('width'));
  document.querySelector('#mapHeight').addEventListener('change', () => applyMapSettings('height'));
  document.querySelector('#mapRatio').addEventListener('change', () => applyMapSettings('ratio'));
  document.querySelector('#addCombatants').addEventListener('click', addTokensToInitiative);
  document.querySelector('#rollInitiative').addEventListener('click', rollInitiative);
  document.querySelector('#nextTurn').addEventListener('click', advanceInitiative);
  document.querySelector('#initiativeList').addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const row = button.closest('[data-token-id]');
    if (!row) return;
    if (button.dataset.action === 'locate') focusToken(row.dataset.tokenId);
    if (button.dataset.action === 'remove') {
      state.initiative.combatants = state.initiative.combatants.filter(combatant => combatant.tokenId !== row.dataset.tokenId);
      if (state.initiative.activeTokenId === row.dataset.tokenId) state.initiative.activeTokenId = null;
      broadcastState();
    }
  });
  document.querySelector('#initiativeList').addEventListener('change', event => {
    if (event.target.dataset.action !== 'score') return;
    const row = event.target.closest('[data-token-id]');
    const combatant = state.initiative.combatants.find(item => item.tokenId === row?.dataset.tokenId);
    if (!combatant) return;
    const value = event.target.value === '' ? null : Number(event.target.value);
    combatant.initiative = Number.isFinite(value) ? Math.max(1, Math.min(30, value)) : null;
    broadcastState();
  });
  document.querySelector('#createRoomButton').addEventListener('click', createRoom);
  document.querySelector('#joinRoomButton').addEventListener('click', joinRoom);
  document.querySelector('#movementModeFree').addEventListener('click', () => { movementMode = 'free'; updateInspectorSelection(); });
  document.querySelector('#movementModeAngles').addEventListener('click', () => { movementMode = 'angles'; updateInspectorSelection(); });
  document.querySelector('#movementAngleControls').addEventListener('click', event => {
    const button = event.target.closest('[data-move-angle]');
    if (!button) return;
    const [dx, dy] = button.dataset.moveAngle.split(',').map(Number);
    const distance = Math.max(1, Math.min(99, Math.floor(Number(document.querySelector('#movementDistance').value) || 1)));
    document.querySelector('#movementDistance').value = String(distance);
    planTokenStep(dx, dy, distance);
  });
  document.querySelector('#confirmMovement').addEventListener('click', confirmPlannedMove);
  document.querySelector('#cancelMovement').addEventListener('click', clearPlannedMove);
  for (const list of [document.querySelector('#roomAdminsList'), document.querySelector('#remotePlayers')]) {
    list.addEventListener('change', event => {
      const select = event.target.closest('[data-member-role], [data-member-token]');
      if (!select) return;
      const memberId = select.dataset.memberRole || select.dataset.memberToken;
      const member = roomMembers.get(memberId);
      if (!member) return;
      const row = select.closest('.player-row');
      const role = row.querySelector('[data-member-role]')?.value || member.role;
      const tokenId = row.querySelector('[data-member-token]')?.value || null;
      applyRoomMemberUpdate({ memberId, role, tokenId }, hostMode ? 'local-admin' : peer?.id);
    });
  }
  document.querySelector('#shareButton').addEventListener('click', async () => {
    if (!roomId) { showToast('Crie ou entre em uma sala primeiro.'); return; }
    try { await navigator.clipboard.writeText(roomId); showToast('Código da sala copiado.'); }
    catch (error) { document.querySelector('#roomCode').select(); showToast(`Código da sala: ${roomId}`); }
  });
  document.querySelector('#gridToggle').addEventListener('click', event => { gridVisible = !gridVisible; state.gridVisible = gridVisible; event.currentTarget.classList.toggle('active', !gridVisible); broadcastState(); });
  document.querySelector('#clearButton').addEventListener('click', () => {
    if (!state.tokens.length && !state.tiles.length && !state.shapes.length && !state.elevation.length) return;
    if (window.confirm('Remover tokens, tiles, elevações e marcações deste mapa?')) { state = { ...defaultState(), map: state.map, opacity: state.opacity, health: state.health }; gridVisible = true; setSelection([]); broadcastState(); }
  });
  document.querySelector('#exportButton').addEventListener('click', exportMap);
  document.querySelector('#importButton').addEventListener('click', () => document.querySelector('#importFile').click());
  document.querySelector('#importFile').addEventListener('change', event => { if (event.target.files[0]) importMap(event.target.files[0]); event.target.value = ''; });
  document.querySelector('#zoomIn').addEventListener('click', () => zoomAt(zoom * 1.2, { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }));
  document.querySelector('#zoomOut').addEventListener('click', () => zoomAt(zoom / 1.2, { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }));
  document.querySelector('#zoomReadout').addEventListener('click', () => { zoom = 1; panX = 0; panY = 0; updateZoomLabel(); render(); });
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('dblclick', onDoubleClick);
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    if (magnifierMode !== 0) {
      if (magnifierMode === 2) {
        magnifierFixedZoom = Math.min(0.8, Math.max(0.1, magnifierFixedZoom * (event.deltaY < 0 ? 1.05 : 1 / 1.05)));
      } else {
        magnifierZoom = Math.min(8, Math.max(1.5, magnifierZoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15)));
      }
      updateMagnifier();
      return;
    }
    const position = pointerPosition(event);
    zoomAt(zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08), position);
  }, { passive: false });
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', event => {
    if (event.code === 'Space' && !event.repeat && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); canvas.dataset.space = 'true'; }
    if (event.key === 'Escape') { currentShape = null; pendingLineStart = null; linePreview = null; pendingProjectileStart = null; projectilePreview = null; pendingTokenMove = null; plannedMove = null; movementRoute = null; dragReadout = null; selectionBox = null; setSelection([]); render(); }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && selectedId) deleteSelected();
    }
    if (event.key === 'Enter' && plannedMove) { event.preventDefault(); confirmPlannedMove(); return; }
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
    if (event.code === 'KeyM' && !event.repeat) {
      event.preventDefault();
      magnifierMode = (magnifierMode + 1) % 3;
      updateMagnifier();
      return;
    }
    const movement = { arrowup: [0, -1], arrowdown: [0, 1], arrowleft: [-1, 0], arrowright: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0], q: [-1, -1], e: [1, -1], z: [-1, 1], c: [1, 1] }[event.key.toLowerCase()];
    if (movement && movementMode === 'free' && moveSelectedToken(movement[0], movement[1])) { event.preventDefault(); return; }
    const shortcuts = { v: 'select', t: 'token', u: 'elevation', l: 'line', r: 'straight-line', p: 'locate', j: 'projectile', c: 'circle', q: 'square' };
    if (shortcuts[event.key.toLowerCase()]) setTool(shortcuts[event.key.toLowerCase()]);
  });
  window.addEventListener('keyup', event => { if (event.code === 'Space') delete canvas.dataset.space; });
  document.querySelector('#roomCode').addEventListener('keydown', event => { if (event.key === 'Enter') joinRoom(); });

  ensureCharacterTokens(); syncHealthToTokens(); syncInitiativeFromHealth();
  setTool('select'); resizeCanvas(); updatePlayers(); saveState();
  if (new URLSearchParams(window.location.search).get('view') === 'characters') setWorkspace('characters');
})();