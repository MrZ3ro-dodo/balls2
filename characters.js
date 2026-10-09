(() => {
  const root = document.querySelector('#charactersManager');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const percent = (current, maximum) => Math.max(0, Math.min(100, (Number(current) || 0) / Math.max(1, Number(maximum) || 1) * 100));
  const avatarDataUrl = (name, index) => {
    const colors = ['#2563eb', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444', '#10b981'];
    const initial = escape(String(name || 'P').trim().charAt(0) || 'P');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" fill="${colors[index % colors.length]}"/><circle cx="48" cy="36" r="20" fill="#ffffff55"/><text x="48" y="84" text-anchor="middle" font-family="sans-serif" font-size="36" font-weight="700" fill="white">${initial}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
  };
  const characterEntryId = character => `character-${character.id}`;
  let api;

  function turnEntries(health) {
    const entries = [
      ...health.characters.map((character, index) => ({ id: characterEntryId(character), name: character.name || `Personagem ${index + 1}`, character })),
      { id: 'boss', name: health.bossName || 'Boss', character: null }
    ];
    const ordered = [];
    const seen = new Set();
    for (const saved of Array.isArray(health.turnOrder) ? health.turnOrder : []) {
      const entry = entries.find(item => item.id === saved.id);
      if (entry && !seen.has(entry.id)) { ordered.push(entry); seen.add(entry.id); }
    }
    return [...ordered, ...entries.filter(entry => !seen.has(entry.id))];
  }

  function render() {
    if (!api || !root) return;
    const state = api.getState();
    const health = state.health;
    const characters = Array.isArray(health.characters) ? health.characters : [];
    const tokens = Array.isArray(state.tokens) ? state.tokens : [];
    const entries = turnEntries(health);
    health.activeTurnIndex = Math.max(0, Math.min(entries.length - 1, Number(health.activeTurnIndex) || 0));
    const activeEntry = entries[health.activeTurnIndex];
    const characterCards = characters.map((character, index) => {
      const vitality = Number(character.vitality ?? character.hp ?? 0);
      const vitalityMax = Number(character.vitalityMax ?? 100);
      const lucidity = Number(character.lucidity ?? character.sanity ?? 0);
      const lucidityMax = Number(character.lucidityMax ?? 100);
      const tokenOptions = tokens.map(token => `<option value="${escape(token.id)}" ${String(character.linkedTokenId ?? '') === String(token.id) ? 'selected' : ''}>${escape(token.name || 'Token')}</option>`).join('');
      const avatar = character.imageDataUrl || avatarDataUrl(character.name || `Personagem ${index + 1}`, index);
      return `<article class="sp-character-card${activeEntry?.id === characterEntryId(character) ? ' is-active' : ''}" data-character-id="${escape(character.id)}">
        <label class="sp-character-image" title="Selecionar imagem do personagem">
          <img src="${escape(avatar)}" alt="${escape(character.name || `Personagem ${index + 1}`)}">
          <input type="file" accept="image/*" data-character-image hidden>
        </label>
        <div class="sp-character-fields">
          <label>Nome<input type="text" maxlength="24" value="${escape(character.name || '')}" data-character-field="name"></label>
          <label>Token do mapa<select data-character-field="linkedTokenId"><option value="">Sem vínculo</option>${tokenOptions}</select></label>
          <div class="sp-stat-block"><div class="sp-stat-heading"><span>Vitalidade</span><span>${vitality} / ${vitalityMax}</span></div><div class="sp-stat-track"><i class="hp" style="width:${percent(vitality, vitalityMax)}%"></i></div><div class="sp-stat-values"><label>Atual<input type="number" min="0" max="1000" value="${vitality}" data-character-field="vitality"></label><label>Máximo<input type="number" min="1" max="1000" value="${vitalityMax}" data-character-field="vitalityMax"></label></div></div>
          <div class="sp-stat-block"><div class="sp-stat-heading"><span>Lucidez</span><span>${lucidity} / ${lucidityMax}</span></div><div class="sp-stat-track"><i class="sanity" style="width:${percent(lucidity, lucidityMax)}%"></i></div><div class="sp-stat-values"><label>Atual<input type="number" min="0" max="1000" value="${lucidity}" data-character-field="lucidity"></label><label>Máximo<input type="number" min="1" max="1000" value="${lucidityMax}" data-character-field="lucidityMax"></label></div></div>
          <div class="sp-character-effects"><label class="sp-check"><input type="checkbox" data-character-field="emojiAuraEnabled" ${character.emojiAuraEnabled ? 'checked' : ''}> Emanar emoji</label><select data-character-field="emojiAuraEmoji" aria-label="Emoji da aura">${['💥','🔥','⚡','🗡️','☠️','🐉','👻','🩸','💀','🌪️','❄️','🛡️','🌙'].map(emoji => `<option ${emoji === (character.emojiAuraEmoji || '💥') ? 'selected' : ''}>${emoji}</option>`).join('')}</select><button type="button" data-action="remove-character" aria-label="Remover ${escape(character.name)}" title="Remover personagem">×</button></div>
        </div>
      </article>`;
    }).join('');
    const orderMarkup = entries.map((entry, index) => `<li class="sp-turn-entry ${index === health.activeTurnIndex ? 'active' : ''}" draggable="true" data-turn-id="${escape(entry.id)}"><span class="sp-turn-index">${index + 1}</span><span class="sp-turn-name">${escape(entry.name)}</span><button type="button" data-action="move-up" ${index === 0 ? 'disabled' : ''} aria-label="Mover ${escape(entry.name)} para cima">↑</button><button type="button" data-action="move-down" ${index === entries.length - 1 ? 'disabled' : ''} aria-label="Mover ${escape(entry.name)} para baixo">↓</button></li>`).join('');

    root.innerHTML = `<div class="sp-manager-shell">
      <header class="sp-manager-header"><div><span class="sp-manager-eyebrow">STONE PLATE · MESTRE</span><h1>Personagens e combate</h1><p>Estado dos jogadores conectado aos tokens do mapa.</p></div><button class="sp-primary-action" type="button" data-action="open-display">Abrir tela dos jogadores ↗</button></header>
      <section class="sp-overview"><div class="sp-overview-title"><div><span class="sp-manager-eyebrow">BARRA GERAL</span><h2>Vida da sessão</h2></div><div class="sp-hp-preview"><i style="width:${percent(health.currentHp, health.maxHp)}%;background:${escape(health.color || '#22c55e')}"></i><span>${escape(health.label || 'HP')} · ${health.currentHp} / ${health.maxHp}</span></div></div><div class="sp-global-fields"><label>Atual<input type="number" min="0" max="1000" value="${Number(health.currentHp) || 0}" data-health-field="currentHp"></label><label>Máximo<input type="number" min="1" max="1000" value="${Number(health.maxHp) || 100}" data-health-field="maxHp"></label><label>Rótulo<input type="text" maxlength="20" value="${escape(health.label || 'HP')}" data-health-field="label"></label><label>Cor<input type="color" value="${escape(health.color || '#22c55e')}" data-health-field="color"></label><label>Modo<select data-health-field="displayMode"><option value="values" ${health.displayMode === 'values' ? 'selected' : ''}>Valores</option><option value="hidden" ${health.displayMode === 'hidden' ? 'selected' : ''}>Só barra</option><option value="damage" ${health.displayMode === 'damage' ? 'selected' : ''}>Dano</option></select></label></div></section>
      <section class="sp-section"><div class="sp-section-heading"><div><span class="sp-manager-eyebrow">FICHA</span><h2>Personagens</h2></div><button type="button" class="sp-secondary-action" data-action="add-character" ${characters.length >= 10 ? 'disabled' : ''}>＋ Adicionar personagem</button></div><div class="sp-character-grid">${characterCards || '<p class="sp-empty-state">Nenhum personagem cadastrado.</p>'}</div></section>
      <section class="sp-section sp-boss-section"><div class="sp-section-heading"><div><span class="sp-manager-eyebrow">ENCONTRO</span><h2>Boss e efeitos</h2></div></div><div class="sp-boss-fields"><label>Nome do boss<input type="text" maxlength="24" value="${escape(health.bossName || 'Boss')}" data-health-field="bossName"></label><label>Movimento<select data-health-field="bossMovement"><option value="none" ${health.bossMovement === 'none' ? 'selected' : ''}>Nenhum</option><option value="rotating" ${health.bossMovement === 'rotating' ? 'selected' : ''}>Giratório</option><option value="lateral" ${health.bossMovement === 'lateral' ? 'selected' : ''}>Lateral</option><option value="bugged" ${health.bossMovement === 'bugged' ? 'selected' : ''}>Instável</option></select></label><label>After image<select data-health-field="bossAfterImageMode"><option value="none">Nenhuma</option><option value="bruta">Bruta</option><option value="devanecida">Devanecida</option><option value="leve">Leve</option><option value="forte">Forte</option><option value="colorida">Colorida</option><option value="arco-íris">Arco-íris</option></select></label><label>Cor do efeito<input type="color" value="${escape(health.bossAfterImageColor || '#ff4d4d')}" data-health-field="bossAfterImageColor"></label><label class="sp-file-field">Imagem do boss<input type="file" accept="image/*" data-health-field="imageDataUrl"></label></div>${health.imageDataUrl ? '' : '<p class="sp-boss-effect-note">Carregue uma imagem do boss para visualizar os movimentos e after-images na tela dos jogadores.</p>'}</section>
      <section class="sp-section sp-turn-section"><div class="sp-section-heading"><div><span class="sp-manager-eyebrow">INICIATIVA</span><h2>Ordem de turno</h2></div><div class="sp-turn-actions"><span>Rodada ${Math.max(1, Number(health.round) || 1)}</span><button type="button" class="sp-secondary-action" data-action="next-turn">Próximo turno ⏭</button></div></div><ol class="sp-turn-list">${orderMarkup}</ol></section>
      <section class="sp-section sp-global-damage"><div class="sp-section-heading"><div><span class="sp-manager-eyebrow">AJUSTE RÁPIDO</span><h2>Aplicar dano à barra geral</h2></div></div><div class="sp-global-fields"><label>Dano<input type="number" min="0" max="1000" value="0" data-damage-input></label><label>Emoji<select data-damage-emoji>${['💥','🔥','⚡','💣','🗡️','☠️','🐉','👻','🩸','💀'].map(emoji => `<option>${emoji}</option>`).join('')}</select></label><button type="button" class="sp-secondary-action" data-action="apply-global-damage">Aplicar dano</button></div></section>
    </div>`;
    const afterImageSelect = root.querySelector('[data-health-field="bossAfterImageMode"]');
    if (afterImageSelect) {
      const modes = ['bruta', 'devanecida', 'leve', 'forte', 'colorida', 'arco-íris'];
      const selectedModes = new Set(Array.isArray(health.bossAfterImageModes) ? health.bossAfterImageModes : health.bossAfterImageMode && health.bossAfterImageMode !== 'none' ? [health.bossAfterImageMode] : []);
      const controls = document.createElement('div');
      controls.className = 'sp-after-image-options';
      controls.setAttribute('aria-label', 'After-images do boss');
      controls.innerHTML = modes.map(mode => `<label><input type="checkbox" data-boss-afterimage value="${escape(mode)}" ${selectedModes.has(mode) ? 'checked' : ''}> ${escape(mode)}</label>`).join('');
      afterImageSelect.replaceWith(controls);
    }
  }

  function update(mutator) {
    api.updateHealth(mutator);
    render();
  }

  function moveEntry(id, offset) {
    const entries = turnEntries(api.getState().health);
    const from = entries.findIndex(entry => entry.id === id);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= entries.length) return;
    const [entry] = entries.splice(from, 1);
    entries.splice(to, 0, entry);
    update(health => { health.turnOrder = entries.map(item => ({ id: item.id })); });
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const card = button.closest('[data-character-id]');
    const id = card?.dataset.characterId;
    if (button.dataset.action === 'open-display') window.open('players.html', 'stone-plate-player-display');
    if (button.dataset.action === 'add-character') update(health => {
      if (health.characters.length >= 10) return;
      const index = health.characters.length;
      const name = `Personagem ${index + 1}`;
      api.addCharacter({ id: crypto.randomUUID(), name, vitality: 80, vitalityMax: 100, lucidity: 70, lucidityMax: 100, linkedTokenId: null, imageDataUrl: avatarDataUrl(name, index), emojiAuraEnabled: false, emojiAuraEmoji: '💥' });
    });
    if (button.dataset.action === 'remove-character') update(health => {
      health.characters = health.characters.filter(character => String(character.id) !== String(id));
      health.turnOrder = (health.turnOrder || []).filter(entry => entry.id !== characterEntryId({ id }));
      health.activeTurnIndex = Math.min(health.activeTurnIndex || 0, Math.max(0, health.characters.length));
    });
    if (button.dataset.action === 'move-up') moveEntry(button.closest('[data-turn-id]').dataset.turnId, -1);
    if (button.dataset.action === 'move-down') moveEntry(button.closest('[data-turn-id]').dataset.turnId, 1);
    if (button.dataset.action === 'next-turn') api.advanceTurn();
    if (button.dataset.action === 'apply-global-damage') {
      const damage = Math.max(0, Number(root.querySelector('[data-damage-input]').value) || 0);
      const emoji = root.querySelector('[data-damage-emoji]').value;
      update(health => { health.currentHp = Math.max(0, health.currentHp - damage); health.damageEmoji = emoji; health.damageEffect = { id: crypto.randomUUID(), damage, emoji }; });
    }
  });

  root.addEventListener('change', event => {
    const input = event.target;
    const card = input.closest('[data-character-id]');
    if (input.matches('[data-boss-afterimage]')) {
      update(health => {
        const selectedModes = new Set(Array.isArray(health.bossAfterImageModes) ? health.bossAfterImageModes : []);
        if (input.checked) selectedModes.add(input.value);
        else selectedModes.delete(input.value);
        health.bossAfterImageModes = [...selectedModes];
        health.bossAfterImageMode = health.bossAfterImageModes[0] || 'none';
      });
      return;
    }
    if (input.matches('[data-damage-emoji]')) {
      update(health => { health.damageEmoji = input.value; });
      return;
    }
    if (input.matches('[data-character-image]') && card && input.files?.[0]) {
      const reader = new FileReader();
      reader.onload = () => update(health => {
        const character = health.characters.find(item => String(item.id) === card.dataset.characterId);
        if (character) character.imageDataUrl = String(reader.result || '');
      });
      reader.readAsDataURL(input.files[0]);
      return;
    }
    if (input.matches('[data-health-field="imageDataUrl"]') && input.files?.[0]) {
      const reader = new FileReader();
      reader.onload = () => update(health => { health.imageDataUrl = String(reader.result || ''); });
      reader.readAsDataURL(input.files[0]);
      return;
    }
    if (card && input.dataset.characterField) {
      const id = card.dataset.characterId;
      const field = input.dataset.characterField;
      const value = input.type === 'checkbox' ? input.checked : input.value;
      update(health => {
        const character = health.characters.find(item => String(item.id) === String(id));
        if (!character) return;
        if (field === 'linkedTokenId') character[field] = value || null;
        else if (field === 'vitality' || field === 'lucidity') character[field] = Math.max(0, Number(value) || 0);
        else if (field === 'vitalityMax' || field === 'lucidityMax') character[field] = Math.max(1, Number(value) || 1);
        else character[field] = value;
      });
      return;
    }
    if (input.dataset.healthField) {
      const field = input.dataset.healthField;
      const value = input.value;
      update(health => {
        if (field === 'currentHp') health[field] = Math.max(0, Math.min(Number(value) || 0, health.maxHp));
        else if (field === 'maxHp') { health[field] = Math.max(1, Number(value) || 1); health.currentHp = Math.min(health.currentHp, health.maxHp); }
        else health[field] = value;
        if (field === 'bossAfterImageMode') health.bossAfterImageModes = value === 'none' ? [] : [value];
      });
    }
  });

  window.StonePlateCharacters = {
    mount(stonePlateApi) {
      api = stonePlateApi;
      api.subscribe(render);
      render();
    }
  };
})();
