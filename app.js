(() => {
  const canvas = document.querySelector('#boardCanvas');
  const context = canvas.getContext('2d');
  const canvasWrap = document.querySelector('#canvasWrap');
  const STORAGE_KEY = 'talus-board-v1';
  const GRID = 64;
  const MAX_MAP_TILES = 5000;
  const DEFAULT_OPACITY = 0.65;
  const DEFAULT_MAP = { shape: 'square', width: 50, height: 50 };
  const TILE_STYLES = {
    stone: { fill: '#67675d', stroke: '#8a897c' },
    water: { fill: '#477e83', stroke: '#86b8b6' },
    grass: { fill: '#66824e', stroke: '#9cb277' },
    lava: { fill: '#a84e3c', stroke: '#e99561' },
    wall: { fill: '#9d9a8c', stroke: '#d0cdbd' }
  };
  const defaultState = () => ({ tokens: [], tiles: [], shapes: [], opacity: DEFAULT_OPACITY, map: { ...DEFAULT_MAP }, initiative: { round: 1, activeTokenId: null, combatants: [] } });
  let state = loadState();
  let tool = 'select';
  let tileType = 'stone';
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let gridVisible = true;
  let selectedId = null;
  let activePointer = null;
  let currentShape = null;
  let currentToken = null;
  let pendingLineStart = null;
  let linePreview = null;
  let pendingProjectileStart = null;
  let projectilePreview = null;
  let activeProjectiles = [];
  let projectileImpacts = [];
  let projectileFrame = null;
  const seenProjectiles = new Set();
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

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.tokens) && Array.isArray(saved.tiles) && Array.isArray(saved.shapes)) return alignStateToGrid(saved);
    } catch (error) {
      console.warn('Não foi possível carregar o mapa salvo.', error);
    }
    return defaultState();
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { showToast('Não foi possível salvar. O mapa pode estar muito grande.'); }
  }

  function broadcastState() {
    saveState();
    render();
    if (hostMode) broadcast({ type: 'state', state });
    else if (peer && connections.has('host')) connections.get('host').send({ type: 'state', state });
  }

  function broadcast(message) {
    for (const connection of connections.values()) {
      if (connection.open) connection.send(message);
    }
  }

  function resizeCanvas() {
    const bounds = canvasWrap.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    canvas.style.width = `${bounds.width}px`;
    canvas.style.height = `${bounds.height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
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

  function mapWorldBounds(config = state.map) {
    const map = normalizeMapConfig(config);
    const left = -Math.floor(map.width / 2) * GRID;
    const top = -Math.floor(map.height / 2) * GRID;
    return { left, top, right: left + map.width * GRID, bottom: top + map.height * GRID, width: map.width * GRID, height: map.height * GRID, map };
  }

  function mapPath(config = state.map) {
    const bounds = mapWorldBounds(config);
    const path = new Path2D();
    if (bounds.map.shape === 'circle') {
      path.ellipse((bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2, bounds.width / 2, bounds.height / 2, 0, 0, Math.PI * 2);
    } else if (bounds.map.shape === 'triangle') {
      path.moveTo((bounds.left + bounds.right) / 2, bounds.top);
      path.lineTo(bounds.right, bounds.bottom);
      path.lineTo(bounds.left, bounds.bottom);
      path.closePath();
    } else path.rect(bounds.left, bounds.top, bounds.width, bounds.height);
    return path;
  }

  function pointInsideMap(point, config = state.map) {
    const bounds = mapWorldBounds(config);
    const column = Math.floor((point.x - bounds.left) / GRID);
    const row = Math.floor((point.y - bounds.top) / GRID);
    if (column < 0 || row < 0 || column >= bounds.map.width || row >= bounds.map.height) return false;
    const x = (column + 0.5) / bounds.map.width;
    const y = (row + 0.5) / bounds.map.height;
    if (bounds.map.shape === 'circle') return ((x - 0.5) / 0.5) ** 2 + ((y - 0.5) / 0.5) ** 2 <= 1;
    if (bounds.map.shape === 'triangle') return Math.abs(x - 0.5) <= y / 2;
    return true;
  }

  function countMapTiles(config = state.map) {
    const map = normalizeMapConfig(config);
    if (map.shape === 'rectangle' || map.shape === 'square') return map.width * map.height;
    let count = 0;
    for (let row = 0; row < map.height; row++) for (let column = 0; column < map.width; column++) {
      const x = (column + 0.5) / map.width, y = (row + 0.5) / map.height;
      if (map.shape === 'circle' ? ((x - 0.5) / 0.5) ** 2 + ((y - 0.5) / 0.5) ** 2 <= 1 : Math.abs(x - 0.5) <= y / 2) count++;
    }
    return count;
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
    const x = projectile.start.x + (projectile.end.x - projectile.start.x) * progress;
    const distance = Math.hypot(projectile.end.x - projectile.start.x, projectile.end.y - projectile.start.y);
    const arc = Math.min(90, distance * 0.18);
    const y = projectile.start.y + (projectile.end.y - projectile.start.y) * progress - Math.sin(Math.PI * progress) * arc;
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
    for (const impact of projectileImpacts) {
      const progress = Math.min(1, (now - impact.startedAt) / impact.duration);
      context.save();
      context.globalAlpha = 1 - progress;
      context.strokeStyle = projectileColor(impact.kind);
      context.lineWidth = 2 / zoom;
      context.beginPath();
      context.arc(impact.end.x, impact.end.y, (4 + progress * 22) / zoom, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
    for (const projectile of activeProjectiles) {
      const progress = Math.min(1, (now - projectile.startedAt) / projectile.duration);
      drawProjectileEffect(projectile, progress);
    }
  }

  function animateProjectiles() {
    projectileFrame = null;
    const now = performance.now();
    for (const projectile of activeProjectiles) {
      if (now - projectile.startedAt >= projectile.duration) projectileImpacts.push({ end: projectile.end, kind: projectile.kind, startedAt: now, duration: 240 });
    }
    activeProjectiles = activeProjectiles.filter(projectile => now - projectile.startedAt < projectile.duration);
    projectileImpacts = projectileImpacts.filter(impact => now - impact.startedAt < impact.duration);
    render();
    if (activeProjectiles.length || projectileImpacts.length) projectileFrame = requestAnimationFrame(animateProjectiles);
  }

  function drawLocatedTokenMarker() {
    if (!locatedTokenId) return;
    const token = state.tokens.find(item => item.id === locatedTokenId);
    if (!token) return;
    context.save();
    context.strokeStyle = '#f4c95d';
    context.lineWidth = 2 / zoom;
    context.setLineDash([5 / zoom, 3 / zoom]);
    context.beginPath();
    context.arc(token.x, token.y, (token.radius || 22) + 12 / zoom, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }

  function render() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
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
    context.stroke(boardPath);
    context.restore();
    drawDragReadout();
    updateOpacityControl();
    updateMapControls();
    updateInitiativePanel();
    updateObjectCount();
    updateInspectorSelection();
    document.querySelector('#canvasHint').classList.toggle('hidden', state.tokens.length + state.tiles.length + state.shapes.length > 0);
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
    if (selectedId === tile.id) drawSelection(tile.x, tile.y, GRID, GRID);
  }

  function drawShape(shape, preview = false) {
    context.save();
    context.strokeStyle = shape.color || '#f4c95d';
    context.fillStyle = shape.color || '#f4c95d';
    context.globalAlpha = opacityOf(shape) * (preview ? 0.72 : 1);
    if (shape.kind === 'stroke') {
      for (const cell of shape.points) context.fillRect(cell.x - GRID / 2, cell.y - GRID / 2, GRID, GRID);
    } else if (shape.kind === 'line') {
      for (const cell of pixelLineCells(shape)) context.fillRect(cell.x - GRID / 2, cell.y - GRID / 2, GRID, GRID);
    } else {
      context.lineWidth = (Number(shape.width) || 3) / zoom;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      const x = Math.min(shape.x1, shape.x2), y = Math.min(shape.y1, shape.y2);
      const w = Math.abs(shape.x2 - shape.x1), h = Math.abs(shape.y2 - shape.y1);
      context.beginPath();
      if (shape.kind === 'circle') context.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 1), Math.max(h / 2, 1), 0, 0, Math.PI * 2);
      else context.rect(x, y, w, h);
      context.fill();
      context.stroke();
    }
    if (selectedId === shape.id && !preview) {
      context.globalAlpha = 1;
      const bounds = shapeBounds(shape);
      drawSelection(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, bounds.width, bounds.height);
    }
    context.restore();
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
    return { x: Math.min(shape.x1, shape.x2), y: Math.min(shape.y1, shape.y2), width: Math.abs(shape.x2 - shape.x1), height: Math.abs(shape.y2 - shape.y1) };
  }

  function shapeFitsMap(shape, config = state.map) {
    if (shape.kind === 'stroke') return shape.points.every(point => pointInsideMap(point, config));
    if (shape.kind === 'line') return pixelLineCells(shape).every(point => pointInsideMap(point, config));
    const bounds = shapeBounds(shape);
    return [
      { x: bounds.x + GRID / 2, y: bounds.y + GRID / 2 },
      { x: bounds.x + bounds.width - GRID / 2, y: bounds.y + GRID / 2 },
      { x: bounds.x + GRID / 2, y: bounds.y + bounds.height - GRID / 2 },
      { x: bounds.x + bounds.width - GRID / 2, y: bounds.y + bounds.height - GRID / 2 }
    ].every(point => pointInsideMap(point, config));
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
    const columns = Math.max(1, Math.round(Math.abs(shape.x2 - shape.x1) / GRID));
    const rows = Math.max(1, Math.round(Math.abs(shape.y2 - shape.y1) / GRID));
    const total = columns * rows;
    return `${columns} × ${rows} tiles · ${total} total`;
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
    const radius = token.radius || 22;
    context.save();
    context.shadowColor = '#0009'; context.shadowBlur = 8; context.shadowOffsetY = 3;
    context.beginPath(); context.arc(token.x, token.y, radius, 0, Math.PI * 2);
    context.fillStyle = token.color || '#d87054'; context.globalAlpha = opacityOf(token) * (preview ? 0.65 : 1); context.fill(); context.globalAlpha = 1;
    context.shadowColor = 'transparent'; context.shadowBlur = 0; context.shadowOffsetY = 0;
    context.lineWidth = 2 / zoom; context.strokeStyle = '#f0dfca'; context.stroke();
    context.beginPath(); context.arc(token.x, token.y, radius - 4, 0, Math.PI * 2);
    context.strokeStyle = '#ffffff66'; context.lineWidth = 1 / zoom; context.stroke();
    context.fillStyle = '#fff4e9'; context.font = `700 ${Math.max(10, radius * 0.8)}px Manrope, sans-serif`;
    context.textAlign = 'center'; context.textBaseline = 'middle';
    context.fillText(initials(token.name), token.x, token.y + 1);
    context.restore();
    context.save();
    context.font = `600 ${11 / zoom}px Manrope, sans-serif`;
    context.textAlign = 'center'; context.textBaseline = 'top';
    const label = token.name || 'Token';
    const labelWidth = context.measureText(label).width;
    context.fillStyle = '#171a19dd';
    context.fillRect(token.x - labelWidth / 2 - 5 / zoom, token.y + radius + 5 / zoom, labelWidth + 10 / zoom, 18 / zoom);
    context.fillStyle = '#e5e7dc'; context.fillText(label, token.x, token.y + radius + 8 / zoom);
    context.restore();
    if (selectedId === token.id) {
      context.save(); context.setLineDash([4 / zoom, 4 / zoom]); context.strokeStyle = '#c1d48a'; context.lineWidth = 1.5 / zoom;
      context.beginPath(); context.arc(token.x, token.y, radius + 5 / zoom, 0, Math.PI * 2); context.stroke(); context.restore();
    }
    if (state.initiative?.activeTokenId === token.id) {
      context.save(); context.strokeStyle = '#f4c95d'; context.lineWidth = 2.5 / zoom;
      context.beginPath(); context.arc(token.x, token.y, radius + 9 / zoom, 0, Math.PI * 2); context.stroke(); context.restore();
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
    document.querySelector('label[for="lineWidth"]').hidden = ['line', 'straight-line'].includes(tool);
    document.querySelector('#lineWidth').hidden = ['line', 'straight-line'].includes(tool);
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
    let width = Math.max(1, Math.min(MAX_MAP_TILES, Math.floor(Number(config.width) || DEFAULT_MAP.width)));
    let height = Math.max(1, Math.min(MAX_MAP_TILES, Math.floor(Number(config.height) || DEFAULT_MAP.height)));
    if (shape === 'square' || shape === 'circle') height = width;
    if (width * height > MAX_MAP_TILES) {
      const scale = Math.sqrt(MAX_MAP_TILES / (width * height));
      width = Math.max(1, Math.floor(width * scale));
      height = Math.max(1, Math.floor(height * scale));
      while (width * height > MAX_MAP_TILES) {
        if (width >= height) width--;
        else height--;
      }
    }
    return { shape, width, height };
  }

  function clampOpacity(value, fallback = DEFAULT_OPACITY) {
    const opacity = Number(value);
    return Number.isFinite(opacity) ? Math.min(1, Math.max(0.2, opacity)) : fallback;
  }
  function opacityOf(item) { return clampOpacity(item.opacity); }

  function alignStateToGrid(mapState) {
    const coordinate = value => Number.isFinite(Number(value)) ? Number(value) : 0;
    const defaultOpacity = clampOpacity(mapState.opacity);
    return {
      ...mapState,
      opacity: defaultOpacity,
      map: normalizeMapConfig(mapState.map),
      initiative: normalizeInitiative(mapState.initiative, mapState.tokens),
      tokens: mapState.tokens.map(token => ({ ...token, opacity: clampOpacity(token.opacity, defaultOpacity), x: snapCellCenter(coordinate(token.x)), y: snapCellCenter(coordinate(token.y)) })),
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
      if (Math.hypot(point.x - token.x, point.y - token.y) <= (token.radius || 22) + 4) return token;
    }
    const cellX = snapCellCenter(point.x), cellY = snapCellCenter(point.y);
    for (let index = state.tokens.length - 1; index >= 0; index--) {
      const token = state.tokens[index];
      if (token.x === cellX && token.y === cellY) return token;
    }
    return null;
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
      } else if (shape.kind === 'square' || shape.filled) return shape;
      else {
        const rx = Math.max(bounds.width / 2, 1), ry = Math.max(bounds.height / 2, 1);
        const distance = ((point.x - (bounds.x + rx)) / rx) ** 2 + ((point.y - (bounds.y + ry)) / ry) ** 2;
        if (Math.abs(distance - 1) < 0.24) return shape;
      }
    }
    return null;
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
    if (canvas.dataset.space === 'true' || event.button === 1 || event.button === 2) {
      startPan(event); return;
    }
    if (event.button !== 0) return;
    const screen = pointerPosition(event);
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
        const line = { id: crypto.randomUUID(), kind: 'line', x1: pendingLineStart.x, y1: pendingLineStart.y, x2: endpoint.x, y2: endpoint.y, color: document.querySelector('#drawColor').value, width: GRID, opacity: state.opacity };
        state.shapes.push(line);
        selectedId = line.id;
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
        token.x = destination.x;
        token.y = destination.y;
        selectedId = token.id;
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
        selectedId = token.id;
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
        pendingProjectileStart = { ...position, kind: document.querySelector('#projectileType').value };
        projectilePreview = { start: position, end: position, kind: pendingProjectileStart.kind };
        render();
      } else {
        const start = { x: pendingProjectileStart.x, y: pendingProjectileStart.y };
        const kind = pendingProjectileStart.kind;
        pendingProjectileStart = null;
        projectilePreview = null;
        dragReadout = null;
        launchProjectile(start, position, kind);
      }
      return;
    }
    activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    if (tool === 'token') {
      const position = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
      if (!pointInsideMap(position)) return;
      currentToken = { id: crypto.randomUUID(), ...position, radius: 22, name: document.querySelector('#tokenName').value.trim() || 'Token', color: document.querySelector('#tokenColor').value, opacity: state.opacity };
      dragReadout = { x: screen.x, y: screen.y, startX: point.x, startY: point.y, text: '0 tiles' };
      render(); return;
    }
    if (tool === 'tile') { lastPaintCell = `${snapCellCenter(point.x)}:${snapCellCenter(point.y)}`; paintTile(point); return; }
    if (['line', 'circle', 'square'].includes(tool)) {
      const align = tool === 'line' ? snapCellCenter : snap;
      const x = align(point.x), y = align(point.y);
      if (!pointInsideMap({ x, y })) return;
      currentShape = tool === 'line'
        ? { id: crypto.randomUUID(), kind: 'stroke', points: [{ x, y }], color: document.querySelector('#drawColor').value, width: GRID, opacity: state.opacity }
        : { id: crypto.randomUUID(), kind: tool, x1: x, y1: y, x2: x, y2: y, color: document.querySelector('#drawColor').value, width: Number(document.querySelector('#lineWidth').value), filled: true, opacity: state.opacity };
      dragReadout = { x: screen.x, y: screen.y, text: shapeTileReadout(currentShape) };
      render(); return;
    }
    const found = findToken(point);
    if (found) {
      selectedId = found.id;
      dragToken = { id: found.id, offsetX: point.x - found.x, offsetY: point.y - found.y, startX: found.x, startY: found.y, didMove: false };
      movementRoute = { start: { x: found.x, y: found.y }, end: { x: found.x, y: found.y } };
      dragReadout = { x: screen.x, y: screen.y, text: '0 tiles' };
      render(); return;
    }
    const tile = findTile(point);
    const shape = findShape(point);
    selectedId = tile?.id || shape?.id || null;
    if (shape) dragToken = { id: shape.id, offsetX: point.x, offsetY: point.y, x1: shape.x1, y1: shape.y1, x2: shape.x2, y2: shape.y2, points: shape.kind === 'stroke' ? shape.points.map(cell => ({ ...cell })) : null, shape: true };
    if (shape) dragReadout = { x: screen.x, y: screen.y, text: '0 tiles' };
    render();
  }

  function onPointerMove(event) {
    const screen = pointerPosition(event);
    const point = screenToWorld(screen);
    aimWorld = aimPointFor(point);
    document.querySelector('#coordinates').textContent = `X ${String(Math.round(point.x)).padStart(3, '0')} · Y ${String(Math.round(point.y)).padStart(3, '0')}`;
    if (panPointer && panPointer.id === event.pointerId) {
      panX = panPointer.panX + screen.x - panPointer.x;
      panY = panPointer.panY + screen.y - panPointer.y;
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
        const endpoint = { x: snapCellCenter(point.x), y: snapCellCenter(point.y) };
        projectilePreview = { start: { x: pendingProjectileStart.x, y: pendingProjectileStart.y }, end: endpoint, kind: pendingProjectileStart.kind };
        const tiles = Math.ceil(Math.hypot(endpoint.x - pendingProjectileStart.x, endpoint.y - pendingProjectileStart.y) / GRID);
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
    if (currentToken) {
      state.tokens.push(currentToken);
      selectedId = currentToken.id;
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
      if (shape.kind === 'stroke' || Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1) > 5) { state.shapes.push(shape); selectedId = shape.id; broadcastState(); }
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
    document.querySelector('#mapWidth').max = String(Math.floor(MAX_MAP_TILES / map.height));
    document.querySelector('#mapHeight').max = String(Math.floor(MAX_MAP_TILES / map.width));
    document.querySelector('#mapCapacity').textContent = `${countMapTiles(map).toLocaleString('pt-BR')} / ${MAX_MAP_TILES.toLocaleString('pt-BR')} tiles`;
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
    broadcastState();
    focusToken(state.initiative.activeTokenId);
  }

  function focusToken(tokenId) {
    const token = state.tokens.find(item => item.id === tokenId);
    if (!token) return;
    selectedId = token.id;
    locatedTokenId = token.id;
    panX = -token.x * zoom;
    panY = -token.y * zoom;
    window.clearTimeout(locateTimer);
    locateTimer = window.setTimeout(() => { locatedTokenId = null; render(); }, 1800);
    render();
  }

  function launchProjectile(start, end, kind, id = crypto.randomUUID(), duration = null, relay = true) {
    if (!['arrow', 'fire', 'arcane'].includes(kind) || !Number.isFinite(start?.x) || !Number.isFinite(start?.y) || !Number.isFinite(end?.x) || !Number.isFinite(end?.y) || !pointInsideMap(start) || !pointInsideMap(end) || seenProjectiles.has(id)) return false;
    seenProjectiles.add(id);
    if (seenProjectiles.size > 256) seenProjectiles.delete(seenProjectiles.values().next().value);
    const flightDuration = Math.max(360, Math.min(1400, duration || 420 + Math.hypot(end.x - start.x, end.y - start.y) * 0.22));
    const projectile = { id, start, end, kind, duration: flightDuration, startedAt: performance.now() };
    activeProjectiles.push(projectile);
    if (relay) {
      const message = { type: 'projectile', projectile: { id, start, end, kind, duration: flightDuration } };
      if (hostMode) broadcast(message);
      else if (connections.has('host')) connections.get('host').send(message);
    }
    if (projectileFrame === null) projectileFrame = requestAnimationFrame(animateProjectiles);
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
    const selected = [...state.tokens, ...state.tiles, ...state.shapes].find(item => item.id === selectedId);
    const section = document.querySelector('#selectedSection');
    section.hidden = !selected;
    const details = document.querySelector('#selectedDetails');
    if (!selected) { details.replaceChildren(); return; }
    const label = selected.name || ({ line: 'Linha', circle: 'Círculo', square: 'Quadrado' }[selected.kind] || 'Tile');
    details.innerHTML = `<div class="selected-object"><span class="selected-swatch" style="background:${escapeAttribute(selected.color || TILE_STYLES[selected.kind]?.fill || '#7a8279')}"></span><span>${escapeHTML(label)}</span><button class="delete-selected" type="button" aria-label="Excluir seleção" title="Excluir">×</button></div>`;
    details.querySelector('.delete-selected').addEventListener('click', deleteSelected);
  }

  function escapeHTML(value) { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  function escapeAttribute(value) { return String(value).replace(/[&"<>]/g, char => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[char])); }

  function deleteSelected() {
    for (const collection of [state.tokens, state.tiles, state.shapes]) {
      const index = collection.findIndex(item => item.id === selectedId);
      if (index >= 0) collection.splice(index, 1);
    }
    state.initiative.combatants = state.initiative.combatants.filter(combatant => combatant.tokenId !== selectedId);
    if (state.initiative.activeTokenId === selectedId) state.initiative.activeTokenId = null;
    selectedId = null; broadcastState();
  }

  function moveSelectedToken(dx, dy) {
    const token = state.tokens.find(item => item.id === selectedId);
    if (!token) return false;
    token.x += dx * GRID;
    token.y += dy * GRID;
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
    peer = new Peer(`talus-${roomId}`, { debug: 1 });
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
      const connection = peer.connect(`talus-${roomId}`, { reliable: true });
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
      if (message.type === 'projectile' && message.projectile) {
        const projectile = message.projectile;
        const accepted = launchProjectile(projectile.start, projectile.end, projectile.kind, projectile.id, projectile.duration, false);
        if (accepted && hostMode) broadcast(message);
        return;
      }
      if (message.type !== 'state' || !message.state) return;
      if (!Array.isArray(message.state.tokens) || !Array.isArray(message.state.tiles) || !Array.isArray(message.state.shapes)) return;
      if (!hostMode && id === 'host') {
        state = alignStateToGrid(message.state); saveState(); render(); return;
      }
      if (hostMode) {
        state = alignStateToGrid(message.state); saveState(); render(); broadcast({ type: 'state', state });
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

  function disconnectPeer(resetStatus = true) {
    for (const connection of connections.values()) connection.close();
    connections.clear();
    if (peer) { peer.destroy(); peer = null; }
    if (resetStatus) { hostMode = false; setConnectionStatus('', 'Local'); updatePlayers(); }
  }

  function exportMap() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'talus-mapa.json'; link.click();
    URL.revokeObjectURL(link.href);
  }

  function importMap(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported.tokens) || !Array.isArray(imported.tiles) || !Array.isArray(imported.shapes)) throw new Error('Formato inválido');
        state = alignStateToGrid(imported); selectedId = null; broadcastState(); showToast('Mapa importado.');
      } catch (error) { showToast('Arquivo de mapa inválido.'); }
    };
    reader.readAsText(file);
  }

  document.querySelectorAll('.tool-button[data-tool]').forEach(button => button.addEventListener('click', () => setTool(button.dataset.tool)));
  document.querySelector('#tilePalette').addEventListener('click', event => {
    const button = event.target.closest('[data-tile]');
    if (!button) return;
    tileType = button.dataset.tile;
    document.querySelectorAll('.tile-swatch').forEach(swatch => swatch.classList.toggle('active', swatch === button));
  });
  document.querySelector('#drawColor').addEventListener('input', event => document.querySelector('#drawColorValue').textContent = event.target.value.toUpperCase());
  document.querySelector('#tokenColor').addEventListener('input', event => document.querySelector('#tokenColorValue').textContent = event.target.value.toUpperCase());
  document.querySelector('#lineWidth').addEventListener('input', event => document.querySelector('#lineWidthValue').textContent = event.target.value);
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
  document.querySelector('#gridToggle').addEventListener('click', event => { gridVisible = !gridVisible; event.currentTarget.classList.toggle('active', !gridVisible); render(); });
  document.querySelector('#clearButton').addEventListener('click', () => {
    if (!state.tokens.length && !state.tiles.length && !state.shapes.length) return;
    if (window.confirm('Remover todos os tokens, tiles e marcações deste mapa?')) { state = { ...defaultState(), map: state.map, opacity: state.opacity }; selectedId = null; broadcastState(); }
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
    const position = pointerPosition(event);
    zoomAt(zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08), position);
  }, { passive: false });
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('keydown', event => {
    if (event.code === 'Space' && !event.repeat && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); canvas.dataset.space = 'true'; }
    if (event.key === 'Escape') { currentShape = null; pendingLineStart = null; linePreview = null; pendingProjectileStart = null; projectilePreview = null; pendingTokenMove = null; movementRoute = null; dragReadout = null; selectedId = null; render(); }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && selectedId) deleteSelected();
    }
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    const movement = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[event.key];
    if (movement && moveSelectedToken(movement[0], movement[1])) { event.preventDefault(); return; }
    const shortcuts = { v: 'select', t: 'token', b: 'tile', l: 'line', r: 'straight-line', p: 'locate', j: 'projectile', c: 'circle', q: 'square' };
    if (shortcuts[event.key.toLowerCase()]) setTool(shortcuts[event.key.toLowerCase()]);
  });
  window.addEventListener('keyup', event => { if (event.code === 'Space') delete canvas.dataset.space; });
  document.querySelector('#roomCode').addEventListener('keydown', event => { if (event.key === 'Enter') joinRoom(); });

  setTool('select'); resizeCanvas(); updatePlayers();
})();