(() => {
  const canvas = document.querySelector('#boardCanvas');
  let context = canvas.getContext('2d');
  const canvasWrap = document.querySelector('#canvasWrap');
  const magnifierCanvas = document.querySelector('#magnifierCanvas');
  const magnifierContext = magnifierCanvas.getContext('2d');
  const STORAGE_KEY = 'stone-plate-state-v1';
  const LEGACY_STORAGE_KEY = 'talus-board-v1';
  const LEGACY_HEALTH_STORAGE_KEY = 'health-state';
  const GRID = 64;
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
  const defaultHealthState = () => ({ currentHp: 80, maxHp: 100, color: '#22c55e', label: 'HP', textOutlineColor: '#111827', displayMode: 'values', imageDataUrl: '', damageEmoji: '💥', characters: [{ id: crypto.randomUUID(), name: 'Personagem 1', vitality: 70, vitalityMax: 100, lucidity: 55, lucidityMax: 100, linkedTokenId: null, imageDataUrl: '', emojiAuraEnabled: false, emojiAuraEmoji: '💥' }], bossName: 'Boss', bossMovement: 'none', bossAfterImageModes: ['bruta'], bossAfterImageColor: '#ff4d4d', turnOrder: [], activeTurnIndex: 0, lastDamage: null });
  const defaultState = () => ({ tokens: [], tiles: [], shapes: [], opacity: DEFAULT_OPACITY, gridVisible: true, map: { ...DEFAULT_MAP }, initiative: { round: 1, activeTokenId: null, combatants: [] }, health: defaultHealthState() });
  const stateChannel = 'BroadcastChannel' in window ? new BroadcastChannel('stone-plate-state-v1') : null;
  const stateSubscribers = new Set();
  const seenDiceRolls = new Set();
  let state = loadState();
  let tool = 'select';
  let tileType = 'stone';
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
  let projectileFrame = null;
  const seenProjectiles = new Set();
  const seenProjectileTurns = new Set();
  let pendingTokenMove = null;
  let locatedTokenId = null;
  let locateTimer = 0;
  let initiativeUiSignature = '';
  let dragToken = null;
  let dragReadout = null;
  let movementRoute = null;
  let aimWorld = null;
  let panPointer = null;
  let lastPaintCell = '';
  let peer = null;
  let hostMode = false;
  let roomId = '';
  let connections = new Map();
  let toastTimer = 0;
  let mapPathCacheKey = '';
  let mapPathCache = null;
  let mapOutlineCacheKey = '';
  let mapOutlineCache = null;
  let mapTileCountCacheKey = '';
  let mapTileCountCache = 0;

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
    if (hostMode) broadcast({ type: 'state', state });
    else if (peer && connections.has('host')) connections.get('host').send({ type: 'state', state });
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
        color: '#d87054', opacity: state.opacity
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
      color: '#d87054', opacity: state.opacity
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

  function publishDiceRoll(roll) {
    seenDiceRolls.add(roll.id);
    stateChannel?.postMessage({ type: 'dice-roll', roll });
    if (hostMode) broadcast({ type: 'dice-roll', roll });
    else if (peer && connections.has('host')) connections.get('host').send({ type: 'dice-roll', roll });
  }

  function receiveDiceRoll(roll, source) {
    const validSides = [2, 4, 6, 8, 10, 12, 20, 30, 60, 100];
    if (!roll?.id || typeof roll.id !== 'string' || roll.id.length > 80 || seenDiceRolls.has(roll.id) ||
      !validSides.includes(roll.sides) || !Number.isInteger(roll.quantity) || roll.quantity < 1 || roll.quantity > 999 ||
      !Array.isArray(roll.values) || roll.values.length !== roll.quantity ||
      !roll.values.every(value => Number.isInteger(value) && value >= 1 && value <= roll.sides)) return;
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
    context.strokeStyle = '#c1d48add';
    context.fillStyle = '#c1d48add';
    context.lineWidth = 3 / zoom;
    context.setLineDash([7 / zoom, 5 / zoom]);
    context.beginPath();
    context.moveTo(cells[0].x, cells[0].y);
    for (const cell of cells.slice(1)) context.lineTo(cell.x, cell.y);
    context.stroke();
    context.setLineDash([]);
    context.beginPath();
    context.arc(movementRoute.end.x, movementRoute.end.y, 5 / zoom, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function projectileColor(type) {
    return type === 'arrow' ? '#d6c39a' : type === 'fire' ? '#ff7856' : '#78c9f0';
  }

  function projectilePoint(projectile, progress) {
    const path = projectile.path || gridCellRoute(projectile.start, projectile.end);
    const pathPosition = Math.min(path.length - 1, Math.max(0, progress * (path.length - 1)));
    const index = Math.floor(pathPosition);
    const segmentProgress = pathPosition - index;
    const first = path[index];
    const second = path[Math.min(index + 1, path.length - 1)];
    const x = first.x + (second.x - first.x) * segmentProgress;
    const distance = Math.hypot(projectile.end.x - projectile.start.x, projectile.end.y - projectile.start.y);
    const arc = Math.min(90, distance * 0.18);
    const y = first.y + (second.y - first.y) * segmentProgress - Math.sin(Math.PI * progress) * arc;
    return { x, y };
  }

  function drawProjectileEffect(projectile, progress, preview = false) {
    const color = projectileColor(projectile.kind);
    const position = projectilePoint(projectile, progress);
    context.save();
    if (preview) {
      context.globalAlpha = 0.52;
      context.strokeStyle = color;
      context.lineWidth = 2 / zoom;
      context.setLineDash([7 / zoom, 6 / zoom]);
      context.beginPath(); context.moveTo(projectile.start.x, projectile.start.y); context.lineTo(projectile.end.x, projectile.end.y); context.stroke();
    } else {
      const tailStart = projectilePoint(projectile, Math.max(0, progress - 0.22));
      context.globalAlpha = Math.max(0, 0.75 * (1 - Math.max(0, progress - 0.88) / 0.12));
      context.strokeStyle = color; context.lineWidth = (projectile.kind === 'arrow' ? 2 : 4) / zoom;
      context.shadowColor = color; context.shadowBlur = 12 / zoom;
      context.beginPath(); context.moveTo(tailStart.x, tailStart.y); context.lineTo(position.x, position.y); context.stroke();
      const angle = Math.atan2(position.y - tailStart.y, position.x - tailStart.x);
      context.translate(position.x, position.y); context.rotate(angle);
      context.fillStyle = color; context.globalAlpha = Math.max(0, 1 - Math.max(0, progress - 0.9) / 0.1);
      if (projectile.kind === 'arrow') {
        context.beginPath(); context.moveTo(9 / zoom, 0); context.lineTo(-5 / zoom, -4 / zoom); context.lineTo(-3 / zoom, 0); context.lineTo(-5 / zoom, 4 / zoom); context.closePath(); context.fill();
      } else {
        context.beginPath(); context.arc(0, 0, (projectile.kind === 'fire' ? 7 : 6) / zoom, 0, Math.PI * 2); context.fill();
        context.fillStyle = '#ffffff'; context.globalAlpha *= 0.8;
        context.beginPath(); context.arc(0, 0, 2.2 / zoom, 0, Math.PI * 2); context.fill();
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
      context.save();
      context.globalAlpha = 1 - progress;
      context.strokeStyle = projectileColor(mark.kind);
      context.lineWidth = 3 / zoom;
      context.setLineDash([6 / zoom, 3 / zoom]);
      context.beginPath();
      const dimensions = tokenDimensions(token);
      context.rect(token.x - dimensions.width / 2 - 8 / zoom, token.y - dimensions.height / 2 - 8 / zoom, dimensions.width + 16 / zoom, dimensions.height + 16 / zoom);
      context.stroke();
      context.restore();
    }
    for (const impact of projectileImpacts) {
      const progress = Math.min(1, (now - impact.startedAt) / impact.duration);
      context.save();
      context.globalAlpha = 1 - progress;
      context.strokeStyle = projectileColor(impact.kind);
      context.lineWidth = 2 / zoom;
      context.beginPath();
      context.arc(impact.end.x, impact.end.y, impact.aoe * GRID + progress * 22 / zoom, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    for (const projectile of activeProjectiles) {
      drawProjectileEffect(projectile, projectile.progress);
    }
  }

  function animateProjectiles() {
    projectileFrame = null;
    const now = performance.now();
    projectileImpacts = projectileImpacts.filter(impact => now - impact.startedAt < impact.duration);
    projectileMarks = projectileMarks.filter(mark => now - mark.startedAt < mark.duration && state.tokens.some(token => token.id === mark.tokenId));
    render();
    if (projectileImpacts.length || projectileMarks.length) projectileFrame = requestAnimationFrame(animateProjectiles);
  }

  function projectileSettings() {
    const angleValue = document.querySelector('#projectileAngle').value;
    const aoe = Number(document.querySelector('#projectileAoe').value);
    const speed = Number(document.querySelector('#projectileSpeed').value);
    return {
      kind: document.querySelector('#projectileType').value,
      angle: angleValue === '' ? null : Number(angleValue),
      aoe: Number.isFinite(aoe) ? Math.max(0, Math.min(20, aoe)) : 0,
      speed: Number.isFinite(speed) ? Math.max(0.1, Math.min(20, speed)) : 1,
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
    projectileMarks.push({ tokenId: token.id, kind: projectile.kind, startedAt: performance.now(), duration: 1200 });
    if ((hostMode || !connections.has('host')) && projectile.damage > 0) {
      const character = state.health.characters.find(item => String(item.linkedTokenId || '') === String(token.id));
      if (character) {
        character.vitality = Math.max(0, Number(character.vitality ?? character.hp ?? 0) - projectile.damage);
        state.health.damageEffect = { id: `${projectile.id}:${token.id}`, damage: projectile.damage, emoji: state.health.damageEmoji || '💥' };
        broadcastState('projectile');
      }
    }
    if (projectileFrame === null) projectileFrame = requestAnimationFrame(animateProjectiles);
  }

  function moveProjectileTo(projectile, targetIndex) {
    const nextIndex = Math.min(projectile.path.length - 1, targetIndex);
    const firstNewCell = Math.floor(projectile.pathIndex) + 1;
    for (let index = firstNewCell; index <= Math.floor(nextIndex); index++) {
      const cell = projectile.path[index];
      const token = state.tokens.find(item => item.x === cell.x && item.y === cell.y);
      if (!token) continue;
      markProjectileToken(projectile, token);
      if (!projectile.pierce) {
        projectile.path = projectile.path.slice(0, index + 1);
        projectile.pathIndex = index;
        projectile.progress = 1;
        projectile.end = cell;
        return true;
      }
    }
    projectile.pathIndex = nextIndex;
    projectile.progress = projectile.path.length > 1 ? nextIndex / (projectile.path.length - 1) : 1;
    return nextIndex >= projectile.path.length - 1;
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
    projectileImpacts.push({ end: projectile.end, kind: projectile.kind, aoe: projectile.aoe, startedAt: performance.now(), duration: 360 });
    if (projectileFrame === null) projectileFrame = requestAnimationFrame(animateProjectiles);
  }

  function advanceProjectiles(id = crypto.randomUUID(), relay = true) {
    if (seenProjectileTurns.has(id)) return false;
    seenProjectileTurns.add(id);
    if (seenProjectileTurns.size > 256) seenProjectileTurns.delete(seenProjectileTurns.values().next().value);
    for (const projectile of activeProjectiles) {
      if (moveProjectileTo(projectile, projectile.pathIndex + projectile.speed)) addProjectileImpact(projectile);
    }
    activeProjectiles = activeProjectiles.filter(projectile => projectile.progress < 1);
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
    const boardPath = mapPath();
    context.fillStyle = '#111512c9';
    context.fillRect(visibleLeft, visibleTop, width / zoom, height / zoom);
    context.fillStyle = '#252b27';
    context.fill(boardPath);
    context.save();
    context.clip(boardPath);
    if (gridVisible) drawGrid(width, height);
    for (const tile of state.tiles) drawTile(tile);
    for (const shape of state.shapes) drawShape(shape);
    if (currentShape) drawShape(currentShape, true);
    if (linePreview) drawShape(linePreview, true);
    drawMovementRoute();
    for (const token of state.tokens) drawToken(token);
    if (currentToken) drawToken(currentToken, true);
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

  function render() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    drawMapScene(width, height);
    drawDragReadout();
    updateOpacityControl();
    updateMapControls();
    updateInitiativePanel();
    updateObjectCount();
    updateInspectorSelection();
    document.querySelector('#canvasHint').classList.toggle('hidden', state.tokens.length + state.tiles.length + state.shapes.length > 0);
    updateMagnifier();
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
    context.save();
    context.shadowColor = '#0009'; context.shadowBlur = 8; context.shadowOffsetY = 3;
    context.fillStyle = token.color || '#d87054'; context.globalAlpha = opacityOf(token) * (preview ? 0.65 : 1); context.fillRect(left, top, dimensions.width, dimensions.height); context.globalAlpha = 1;
    context.shadowColor = 'transparent'; context.shadowBlur = 0; context.shadowOffsetY = 0;
    context.lineWidth = 2 / zoom; context.strokeStyle = '#f0dfca'; context.strokeRect(left, top, dimensions.width, dimensions.height);
    context.strokeStyle = '#ffffff66'; context.lineWidth = 1 / zoom; context.strokeRect(left + inset, top + inset, dimensions.width - inset * 2, dimensions.height - inset * 2);
    context.fillStyle = '#fff4e9'; context.font = `700 ${Math.max(10, Math.min(dimensions.width, dimensions.height) * 0.28)}px Manrope, sans-serif`;
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(initials(token.name), token.x, token.y + 1);
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

  function setTool(nextTool) {
    if (nextTool !== 'straight-line') {
      pendingLineStart = null;
      linePreview = null;
      dragReadout = null;
    }
    if (nextTool !== 'projectile') { pendingProjectileStart = null; projectilePreview = null; }
    if (nextTool !== 'select') { pendingTokenMove = null; movementRoute = null; }
    tool = nextTool;
    document.querySelectorAll('.tool-button[data-tool]').forEach(button => button.classList.toggle('active', button.dataset.tool === tool));
    canvas.className = `tool-${tool}`;
    document.querySelector('#selectionOptions').hidden = tool !== 'select';
    document.querySelector('#selectionOptions').style.display = tool === 'select' ? 'flex' : 'none';
    document.querySelector('#colorOptions').hidden = !['line', 'straight-line', 'circle', 'square'].includes(tool);
    document.querySelector('#tokenOptions').hidden = tool !== 'token';
    document.querySelector('#locateOptions').hidden = tool !== 'locate';
    document.querySelector('#projectileOptions').hidden = tool !== 'projectile';
    document.querySelector('#tileOptions').hidden = tool !== 'tile';
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
    return {
      ...mapState,
      health: mapState.health && Array.isArray(mapState.health.characters) ? mapState.health : defaultHealthState(),
      gridVisible: mapState.gridVisible !== false,
      opacity: defaultOpacity,
      map: normalizeMapConfig(mapState.map),
      initiative: normalizeInitiative(mapState.initiative, mapState.tokens),
      tokens: mapState.tokens.map(token => ({ ...token, widthTiles: tokenTileCount(token.widthTiles, token.radius), heightTiles: tokenTileCount(token.heightTiles, token.radius), opacity: clampOpacity(token.opacity, defaultOpacity), x: snapCellCenter(coordinate(token.x)), y: snapCellCenter(coordinate(token.y)) })),
      tiles: mapState.tiles.map(tile => ({ ...tile, opacity: clampOpacity(tile.opacity, defaultOpacity), x: snapCellCenter(coordinate(tile.x)), y: snapCellCenter(coordinate(tile.y)) })),
      shapes: mapState.shapes.map(shape => {
        if (shape.kind === 'stroke') {
          const points = Array.isArray(shape.points) ? shape.points : [];
          return {
            ...shape,
            points: points.map(point => ({ x: snapCellCenter(coordinate(point.x)), y: snapCellCenter(coordinate(point.y)) })),
            opacity: clampOpacity(shape.opacity, defaultOpacity)
          };
        }
        const align = shape.kind === 'line' ? snapCellCenter : snap;
        return {
          ...shape,
          filled: shape.kind === 'circle' || shape.kind === 'square' ? true : shape.filled,
          opacity: clampOpacity(shape.opacity, defaultOpacity),
          x1: align(coordinate(shape.x1)), y1: align(coordinate(shape.y1)),
          x2: align(coordinate(shape.x2)), y2: align(coordinate(shape.y2))
        };
      })
    };
  }

  function normalizeInitiative(value, tokens) {
    const tokenIds = new Set(tokens.map(token => token.id));
    const seen = new Set();
    const combatants = (Array.isArray(value?.combatants) ? value.combatants : []).filter(combatant => {
      if (!tokenIds.has(combatant.tokenId) || seen.has(combatant.tokenId)) return false;
      seen.add(combatant.tokenId);
      return true;
    }).map(combatant => {
      const score = Number(combatant.initiative);
      return { tokenId: combatant.tokenId, initiative: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null };
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

  function paintTile(point) {
    const x = snapCellCenter(point.x), y = snapCellCenter(point.y);
    if (!pointInsideMap({ x, y })) return;
    const existing = state.tiles.findIndex(tile => tile.x === x && tile.y === y);
    if (tileType === 'erase') {
      if (existing >= 0) state.tiles.splice(existing, 1);
    } else {
      const tile = { id: existing >= 0 ? state.tiles[existing].id : crypto.randomUUID(), x, y, kind: tileType, opacity: state.opacity };
      if (existing >= 0) state.tiles[existing] = tile;
      else state.tiles.push(tile);
    }
    broadcastState();
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
        const line = { id: crypto.randomUUID(), kind: 'line', x1: pendingLineStart.x, y1: pendingLineStart.y, x2: endpoint.x, y2: endpoint.y, color: document.querySelector('#drawColor').value, width: GRID, opacity: state.opacity, ...drawingShapeMetadata() };
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
        if (constructionBlocksRoute(token, destination)) { showToast('Uma construção bloqueia essa rota.'); return; }
        token.x = destination.x;
        token.y = destination.y;
        setSelection([token.id], token.id);
      }
      pendingTokenMove = null;
      movementRoute = null;
      dragReadout = null;
      broadcastState();
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
        projectilePreview = { start: position, end: position, aimEnd: position, kind: document.querySelector('#projectileType').value };
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
    activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    if (tool === 'token') {
      const position = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
      if (!pointInsideMap(position)) return;
      if (constructionBlocksPoint(position)) { showToast('Não é possível posicionar um token dentro de uma construção.'); return; }
      currentToken = { id: crypto.randomUUID(), ...position, widthTiles: tokenTileCount(document.querySelector('#tokenWidth').value), heightTiles: tokenTileCount(document.querySelector('#tokenHeight').value), name: document.querySelector('#tokenName').value.trim() || 'Token', color: document.querySelector('#tokenColor').value, opacity: state.opacity };
      dragReadout = { x: screen.x, y: screen.y, startX: point.x, startY: point.y, text: '0 tiles' };
      render(); return;
    }
    if (tool === 'tile') { lastPaintCell = `${snapCellCenter(point.x)}:${snapCellCenter(point.y)}`; paintTile(point); return; }
    if (['line', 'circle', 'square'].includes(tool)) {
      const align = tool === 'line' ? snapCellCenter : snap;
      const x = align(point.x), y = align(point.y);
      if (!pointInsideMap({ x, y })) return;
      currentShape = tool === 'line'
        ? { id: crypto.randomUUID(), kind: 'stroke', points: [{ x, y }], color: document.querySelector('#drawColor').value, width: GRID, opacity: state.opacity, ...drawingShapeMetadata() }
        : { id: crypto.randomUUID(), kind: tool, x1: x, y1: y, x2: x, y2: y, color: document.querySelector('#drawColor').value, filled: true, opacity: state.opacity, ...drawingShapeMetadata() };
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
    if (shape) dragReadout = { x: screen.x, y: screen.y, text: '0 tiles' };
    render();
  }

  function onPointerMove(event) {
    const screen = interactionPointerPosition(event);
    magnifierPointer = screen;
    const point = screenToWorld(screen);
    aimWorld = aimPointFor(point);
    if (magnifierMode !== 0) updateMagnifier();
    document.querySelector('#coordinates').textContent = `X ${String(Math.round(point.x)).padStart(3, '0')} · Y ${String(Math.round(point.y)).padStart(3, '0')}`;
    if (panPointer && panPointer.id === event.pointerId) {
      panX = panPointer.panX + screen.x - panPointer.x;
      panY = panPointer.panY + screen.y - panPointer.y;
      render(); return;
    }
    if (selectionBox && activePointer === event.pointerId) {
      selectionBox.x = screen.x;
      selectionBox.y = screen.y;
      render(); return;
    }
    if (!pointInsideMap(point)) { render(); return; }
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
        projectilePreview = { start: { x: pendingProjectileStart.x, y: pendingProjectileStart.y }, end: endpoint, aimEnd: target, kind: settings.kind };
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
      render(); return;
    }
    if (tool === 'tile' && (event.buttons & 1)) {
      const cell = `${snapCellCenter(point.x)}:${snapCellCenter(point.y)}`;
      if (cell !== lastPaintCell) { lastPaintCell = cell; paintTile(point); }
      return;
    }
    if (currentShape) {
      if (currentShape.kind === 'stroke') {
        const endpoint = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
        if (!pointInsideMap(endpoint)) { render(); return; }
        const previous = currentShape.points[currentShape.points.length - 1];
        currentShape.points.push(...gridCellRoute(previous, endpoint).slice(1).filter(cell => pointInsideMap(cell)));
      } else {
        const endpoint = { x: snap(point.x), y: snap(point.y) };
        if (!pointInsideMap(endpoint)) { render(); return; }
        currentShape.x2 = endpoint.x; currentShape.y2 = endpoint.y;
      }
      dragReadout = { x: screen.x, y: screen.y, text: shapeTileReadout(currentShape) };
      render(); return;
    }
    if (currentToken) {
      const destination = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
      if (!pointInsideMap(destination)) { render(); return; }
      currentToken.x = destination.x;
      currentToken.y = destination.y;
      const movedX = Math.round((currentToken.x - snapCellCenter(dragReadout.startX)) / GRID);
      const movedY = Math.round((currentToken.y - snapCellCenter(dragReadout.startY)) / GRID);
      dragReadout = { ...dragReadout, x: screen.x, y: screen.y, text: `${movedX >= 0 ? '+' : ''}${movedX}, ${movedY >= 0 ? '+' : ''}${movedY} tiles` };
      render(); return;
    }
    if (dragToken && !dragToken.shape) {
      const token = state.tokens.find(item => item.id === dragToken.id);
      if (token) {
        const destination = { x: snapCellCenter(point.x - dragToken.offsetX), y: snapCellCenter(point.y - dragToken.offsetY) };
        if (!pointInsideMap(destination)) { render(); return; }
        if (constructionBlocksRoute({ x: dragToken.startX, y: dragToken.startY }, destination)) { render(); return; }
        token.x = destination.x; token.y = destination.y;
        dragToken.didMove = token.x !== dragToken.startX || token.y !== dragToken.startY;
        movementRoute.end = { x: token.x, y: token.y };
        const movedX = Math.round((token.x - dragToken.startX) / GRID);
        const movedY = Math.round((token.y - dragToken.startY) / GRID);
        dragReadout = { x: screen.x, y: screen.y, text: `${movedX >= 0 ? '+' : ''}${movedX}, ${movedY >= 0 ? '+' : ''}${movedY} tiles` };
        render();
      }
      return;
    }
    if (dragToken?.shape) {
      const shape = state.shapes.find(item => item.id === dragToken.id);
      if (shape) {
        const dx = snap(point.x - dragToken.offsetX), dy = snap(point.y - dragToken.offsetY);
        const movedShape = shape.kind === 'stroke'
          ? { ...shape, points: dragToken.points.map(cell => ({ x: cell.x + dx, y: cell.y + dy })) }
          : { ...shape, x1: dragToken.x1 + dx, x2: dragToken.x2 + dx, y1: dragToken.y1 + dy, y2: dragToken.y2 + dy };
        if (!shapeFitsMap(movedShape)) { render(); return; }
        if (shape.kind === 'stroke') shape.points = movedShape.points;
        else {
          shape.x1 = movedShape.x1; shape.x2 = movedShape.x2;
          shape.y1 = movedShape.y1; shape.y2 = movedShape.y2;
        }
        dragReadout = { x: screen.x, y: screen.y, text: `${dx >= 0 ? '+' : ''}${dx / GRID}, ${dy >= 0 ? '+' : ''}${dy / GRID} tiles` };
        render();
      }
    }
  }

  function onPointerUp(event) {
    if (event.type === 'pointercancel') {
      if (dragToken) {
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
          const token = state.tokens.find(item => item.id === dragToken.id);
          if (token) { token.x = dragToken.startX; token.y = dragToken.startY; }
        }
      }
      currentShape = null;
      currentToken = null;
      dragToken = null;
      selectionBox = null;
      pendingTokenMove = null;
      dragReadout = null;
      movementRoute = null;
      lastPaintCell = '';
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
      if (!dragToken.shape && !dragToken.didMove) {
        pendingTokenMove = { id: dragToken.id, x: dragToken.startX, y: dragToken.startY };
        movementRoute = { start: { x: dragToken.startX, y: dragToken.startY }, end: { x: dragToken.startX, y: dragToken.startY } };
        dragReadout = { x: pointerPosition(event).x, y: pointerPosition(event).y, text: '0, 0 tiles' };
        render();
      } else {
        dragReadout = null;
        movementRoute = null;
        broadcastState();
      }
    }
    dragToken = null;
    lastPaintCell = '';
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
    const count = state.tokens.length + state.tiles.length + state.shapes.length;
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
        <input class="initiative-score" type="number" min="0" max="100" value="${combatant.initiative ?? ''}" placeholder="—" aria-label="Iniciativa de ${escapeAttribute(token.name || 'token')}" data-action="score">
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
    for (const combatant of state.initiative.combatants) combatant.initiative = 1 + Math.floor(Math.random() * 20);
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
    if (!['arrow', 'fire', 'arcane'].includes(kind) || !Number.isFinite(start?.x) || !Number.isFinite(start?.y) || !Number.isFinite(end?.x) || !Number.isFinite(end?.y) || !pointInsideMap(start) || !pointInsideMap(end) || seenProjectiles.has(id)) return false;
    seenProjectiles.add(id);
    if (seenProjectiles.size > 256) seenProjectiles.delete(seenProjectiles.values().next().value);
    const aoe = Number.isFinite(Number(settings.aoe)) ? Math.max(0, Math.min(20, Number(settings.aoe))) : 0;
    const speed = Number.isFinite(Number(settings.speed)) ? Math.max(0.1, Math.min(20, Number(settings.speed))) : 1;
    const damage = Number.isFinite(Number(settings.damage)) ? Math.max(0, Math.min(1000, Number(settings.damage))) : 0;
    const pierce = Boolean(settings.pierce);
    const path = gridCellRoute(start, end);
    const projectile = {
      id, start: { ...start }, end: { ...end }, kind, aoe, speed, damage, pierce, path,
      pathIndex: 0, progress: 0, markedTokenIds: new Set()
    };
    if (settings.instant) {
      moveProjectileTo(projectile, path.length - 1);
      projectile.progress = 1;
      addProjectileImpact(projectile);
    } else activeProjectiles.push(projectile);
    if (relay) {
      const message = { type: 'projectile', projectile: { id, start, end, kind, aoe, speed, damage, pierce, instant: Boolean(settings.instant) } };
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
    const tokenSizeControl = state.tokens.includes(selected) ? `<div class="token-size-fields spacing-top"><label class="field-label" for="selectedTokenWidth">LARGURA (TILES)<input id="selectedTokenWidth" class="text-input map-number" type="number" min="1" step="1" value="${selectedWidth}"></label><label class="field-label" for="selectedTokenHeight">ALTURA (TILES)<input id="selectedTokenHeight" class="text-input map-number" type="number" min="1" step="1" value="${selectedHeight}"></label></div>` : '';
    const shapeControls = state.shapes.includes(selected) ? `<div class="selected-shape-mode"><label class="field-label" for="selectedShapeMode">MODO</label><select class="text-input" id="selectedShapeMode" data-shape-field="mode"><option value="free" ${selected.mode !== 'construction' && selected.mode !== 'alert' ? 'selected' : ''}>Livre</option><option value="construction" ${selected.mode === 'construction' ? 'selected' : ''}>Construção · bloqueia</option><option value="alert" ${selected.mode === 'alert' ? 'selected' : ''}>Alerta · dano após turnos</option></select>${selected.mode === 'alert' ? `<label class="field-label spacing-top" for="selectedAlertTurns">TURNOS RESTANTES</label><input class="text-input" id="selectedAlertTurns" type="number" min="1" max="99" value="${Math.max(1, selected.alertTurnsRemaining || selected.alertTurnsTotal || 1)}" data-shape-field="alertTurnsRemaining"><label class="field-label spacing-top" for="selectedAlertDamage">DANO</label><input class="text-input" id="selectedAlertDamage" type="number" min="0" max="1000" value="${Math.max(0, selected.alertDamage || 0)}" data-shape-field="alertDamage">` : ''}</div>` : '';
    details.innerHTML = `<div class="selected-object"><span class="selected-swatch" style="background:${escapeAttribute(selected.color || TILE_STYLES[selected.kind]?.fill || '#7a8279')}"></span><span>${escapeHTML(label)}</span><button class="delete-selected" type="button" aria-label="Excluir seleção" title="Excluir">×</button></div>${tokenSizeControl}${shapeControls}`;
    details.querySelector('.delete-selected').addEventListener('click', deleteSelected);
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
    const destination = { x: token.x + dx * GRID, y: token.y + dy * GRID };
    if (!pointInsideMap(destination) || constructionBlocksRoute(token, destination)) { showToast('Uma construção bloqueia essa rota.'); return true; }
    token.x = destination.x;
    token.y = destination.y;
    broadcastState();
    return true;
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
    disconnectPeer(); hostMode = true;
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
    peer.on('disconnected', () => setConnectionStatus('', 'Reconectando…'));
  }

  function joinRoom() {
    if (!window.Peer) { showToast('Não foi possível carregar a conexão multiplayer. Verifique sua internet.'); return; }
    const code = normalizeRoom(document.querySelector('#roomCode').value);
    if (!code) { showToast('Digite o código da sala.'); return; }
    roomId = code; hostMode = false; disconnectPeer();
    setConnectionStatus('connecting', 'Conectando…');
    peer = new Peer(undefined, { debug: 1 });
    peer.on('open', () => {
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
  }

  function registerConnection(connection) {
    const id = connection.peer;
    connections.set(id, connection);
    wireConnection(connection, id);
    updatePlayers();
    connection.on('open', () => connection.send({ type: 'state', state }));
  }

  function wireConnection(connection, id) {
    connection.on('data', message => {
      if (!message) return;
      if (message.type === 'dice-roll') { receiveDiceRoll(message.roll, 'peer'); return; }
      if (message.type === 'projectile' && message.projectile) {
        const projectile = message.projectile;
        const accepted = launchProjectile(projectile.start, projectile.end, projectile, projectile.id, false);
        if (accepted && hostMode) broadcast(message);
        return;
      }
      if (message.type === 'projectile-turn' && message.id) {
        const accepted = advanceProjectiles(message.id, false);
        if (accepted && hostMode) broadcast(message);
        return;
      }
      if (message.type !== 'state' || !message.state) return;
      if (!Array.isArray(message.state.tokens) || !Array.isArray(message.state.tiles) || !Array.isArray(message.state.shapes)) return;
      if (!hostMode && id === 'host') {
        state = alignStateToGrid(message.state); gridVisible = state.gridVisible !== false; syncHealthToTokens(); saveState(); render(); notifyStateSubscribers(); return;
      }
      if (hostMode) {
        state = alignStateToGrid(message.state); gridVisible = state.gridVisible !== false; syncHealthToTokens(); saveState(); render(); notifyStateSubscribers(); broadcast({ type: 'state', state });
      }
    });
    connection.on('close', () => { connections.delete(id); updatePlayers(); });
    connection.on('error', () => { connections.delete(id); updatePlayers(); });
  }

  function updatePlayers() {
    const remote = document.querySelector('#remotePlayers');
    remote.replaceChildren();
    let index = 0;
    for (const connection of connections.values()) {
      if (connection.peer === 'host') continue;
      const row = document.createElement('div');
      row.className = 'player-row';
      row.innerHTML = `<span class="avatar remote">${String.fromCharCode(65 + (index % 26))}</span><span class="player-name">Jogador ${index + 1}</span><span class="player-role">JOGADOR</span><span class="presence-dot"></span>`;
      remote.append(row); index++;
    }
    document.querySelector('#playerCount').textContent = String(index + 1);
  }

  function setWorkspace(view) {
    const showCharacters = view === 'characters';
    document.querySelector('#workspace').hidden = showCharacters;
    document.querySelector('#healthWorkspace').hidden = !showCharacters;
    document.querySelector('#mapViewButton').classList.toggle('active', !showCharacters);
    document.querySelector('#mapViewButton').setAttribute('aria-pressed', String(!showCharacters));
    document.querySelector('#charactersViewButton').classList.toggle('active', showCharacters);
    document.querySelector('#charactersViewButton').setAttribute('aria-pressed', String(showCharacters));
    if (!showCharacters) resizeCanvas();
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
    if (peer) { peer.destroy(); peer = null; }
    if (resetStatus) { hostMode = false; setConnectionStatus('', 'Local'); updatePlayers(); }
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
  window.StonePlateCharacters?.mount(window.StonePlate);
  document.querySelectorAll('.tool-button[data-tool]').forEach(button => button.addEventListener('click', () => setTool(button.dataset.tool)));
  document.querySelector('#tilePalette').addEventListener('click', event => {
    const button = event.target.closest('[data-tile]');
    if (!button) return;
    tileType = button.dataset.tile;
    document.querySelectorAll('.tile-swatch').forEach(swatch => swatch.classList.toggle('active', swatch === button));
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
    render();
  };
  document.querySelector('#projectileAngle').addEventListener('input', updateProjectilePreview);
  document.querySelector('#projectileType').addEventListener('change', updateProjectilePreview);
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
    combatant.initiative = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
    broadcastState();
  });
  document.querySelector('#createRoomButton').addEventListener('click', createRoom);
  document.querySelector('#joinRoomButton').addEventListener('click', joinRoom);
  document.querySelector('#shareButton').addEventListener('click', async () => {
    if (!roomId) { showToast('Crie ou entre em uma sala primeiro.'); return; }
    try { await navigator.clipboard.writeText(roomId); showToast('Código da sala copiado.'); }
    catch (error) { document.querySelector('#roomCode').select(); showToast(`Código da sala: ${roomId}`); }
  });
  document.querySelector('#gridToggle').addEventListener('click', event => { gridVisible = !gridVisible; state.gridVisible = gridVisible; event.currentTarget.classList.toggle('active', !gridVisible); broadcastState(); });
  document.querySelector('#clearButton').addEventListener('click', () => {
    if (!state.tokens.length && !state.tiles.length && !state.shapes.length) return;
    if (window.confirm('Remover todos os tokens, tiles e marcações deste mapa?')) { state = { ...defaultState(), map: state.map, opacity: state.opacity, health: state.health }; gridVisible = true; setSelection([]); broadcastState(); }
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
    if (event.key === 'Escape') { currentShape = null; pendingLineStart = null; linePreview = null; pendingProjectileStart = null; projectilePreview = null; pendingTokenMove = null; movementRoute = null; dragReadout = null; selectionBox = null; setSelection([]); render(); }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && selectedId) deleteSelected();
    }
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if (event.code === 'KeyM' && !event.repeat) {
      event.preventDefault();
      magnifierMode = (magnifierMode + 1) % 3;
      updateMagnifier();
      return;
    }
    const movement = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key];
    if (movement && moveSelectedToken(movement[0], movement[1])) { event.preventDefault(); return; }
    const shortcuts = { v: 'select', t: 'token', b: 'tile', l: 'line', r: 'straight-line', p: 'locate', j: 'projectile', c: 'circle', q: 'square' };
    if (shortcuts[event.key.toLowerCase()]) setTool(shortcuts[event.key.toLowerCase()]);
  });
  window.addEventListener('keyup', event => { if (event.code === 'Space') delete canvas.dataset.space; });
  document.querySelector('#roomCode').addEventListener('keydown', event => { if (event.key === 'Enter') joinRoom(); });

  ensureCharacterTokens(); syncHealthToTokens(); syncInitiativeFromHealth();
  setTool('select'); resizeCanvas(); updatePlayers(); saveState();
  if (new URLSearchParams(window.location.search).get('view') === 'characters') setWorkspace('characters');
})();