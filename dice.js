(() => {
  const CHANNEL_NAME = 'stone-plate-state-v1';
  const SIDES = [2, 4, 6, 8, 10, 12, 20, 30, 60, 100];
  const CRITICAL_THRESHOLDS = {
    2: [2, 2, 2, 2, 2],
    4: [4, 4, 3, 3, 2],
    6: [6, 6, 5, 5, 4],
    8: [8, 8, 7, 7, 6],
    10: [10, 9, 8, 7, 6],
    12: [12, 11, 10, 9, 8],
    20: [20, 19, 18, 17, 16],
    30: [30, 29, 28, 27, 26],
    60: [60, 59, 58, 57, 56],
    100: [100, 99, 98, 97, 96]
  };
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  const seenRolls = new Set();
  let selectedSides = 20;
  let selectedCriticalRate = 1;
  let rollTimer = 0;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="dice-widget">
      <button class="dice-toggle" id="diceToggle" type="button" aria-label="Abrir rolagem de dados" aria-expanded="false" aria-controls="dicePanel" title="Rolar dados">
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <polygon class="dice-mark" points="20,2 35,10 39,26 28,38 11,36 2,22 7,7" />
          <path class="dice-mark-lines" d="M7 7 20 15 35 10M20 15 11 36M20 15 28 38M20 15 39 26M2 22 20 15" />
          <text class="dice-mark-number" x="20" y="25">20</text>
        </svg>
      </button>
      <section class="dice-panel" id="dicePanel" aria-labelledby="diceHeading" hidden>
        <header class="dice-panel-header">
          <div><h2 id="diceHeading">Rolagem de dados</h2><span>TESTES DA MESA</span></div>
          <button class="dice-close" id="diceClose" type="button" aria-label="Fechar rolagem de dados" title="Fechar">×</button>
        </header>
        <label class="dice-label">TIPO DE DADO</label>
        <div class="dice-type-grid" role="group" aria-label="Selecionar tipo de dado; Shift para combinar tipos">
          ${SIDES.map(sides => `<button class="dice-type-button" type="button" data-die-sides="${sides}" aria-pressed="${sides === selectedSides}" aria-label="Selecionar ${sides === 2 ? 'moeda' : `d${sides}`}; Shift+clique para combinar" title="Selecionar; Shift+clique para combinar">${sides === 2 ? 'Moeda' : `d${sides}`}</button>`).join('')}
        </div>
        <label class="dice-label dice-critical-label">TAXA DE CRÍTICO</label>
        <div class="dice-critical-grid" role="group" aria-label="Selecionar taxa de crítico">
          ${[1, 2, 3, 4, 5].map(rate => `<button class="dice-critical-button" type="button" data-critical-rate="${rate}" aria-pressed="${rate === selectedCriticalRate}" aria-label="Taxa de crítico ${rate}">${rate}</button>`).join('')}
        </div>
        <p class="dice-critical-range" id="diceCriticalRange" aria-live="polite"></p>
        <label class="dice-label" for="diceExpression">EXPRESSÃO DE ROLAGEM</label>
        <div class="dice-expression-row">
          <input class="dice-expression" id="diceExpression" type="text" inputmode="text" value="1d20" placeholder="2d6+1d20+4" autocomplete="off" aria-describedby="diceExpressionError">
          <span class="dice-expression-note">ex.: 1d20+4</span>
        </div>
        <p class="dice-expression-error" id="diceExpressionError" aria-live="polite"></p>
        <button class="dice-roll-button" id="diceRollButton" type="button">Rolar dados</button>
        <div class="dice-results" id="diceResults" aria-live="polite" aria-atomic="true"></div>
      </section>
    </div>`);

  const toggle = document.querySelector('#diceToggle');
  const panel = document.querySelector('#dicePanel');
  const expression = document.querySelector('#diceExpression');
  const error = document.querySelector('#diceExpressionError');
  const rollButton = document.querySelector('#diceRollButton');
  const results = document.querySelector('#diceResults');
  const criticalRange = document.querySelector('#diceCriticalRange');

  function setPanelOpen(isOpen) {
    panel.hidden = !isOpen;
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Fechar rolagem de dados' : 'Abrir rolagem de dados');
    if (isOpen) expression.focus();
  }

  function parseExpression() {
    const source = expression.value.replace(/\s+/g, '').toLowerCase();
    const terms = [...source.matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/g)];
    const validSyntax = source.length > 0 && terms.length > 0 && terms.map(term => term[0]).join('') === source;
    const groups = [];
    let modifier = 0;
    let quantity = 0;
    if (validSyntax) {
      for (const [index, term] of terms.entries()) {
        if (index > 0 && !term[1]) { quantity = 1000; break; }
        const sign = term[1] === '-' ? -1 : 1;
        if (term[3] !== undefined) {
          const count = Number(term[2] || 1);
          const sides = Number(term[3]);
          quantity += count;
          if (!SIDES.includes(sides) || !Number.isInteger(count) || count < 1 || count > 999) {
            quantity = 1000;
            break;
          }
          const group = groups.find(item => item.sides === sides);
          if (sign < 0) { quantity = 1000; break; }
          if (group) group.quantity += count;
          else groups.push({ sides, quantity: count });
        } else modifier += sign * Number(term[4]);
      }
    }
    const valid = validSyntax && groups.length > 0 && groups.length <= 20 && quantity <= 999 &&
      Number.isSafeInteger(modifier) && Math.abs(modifier) <= 100000;
    if (valid) selectedSides = groups[groups.length - 1].sides;
    document.querySelectorAll('[data-die-sides]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.dieSides) === selectedSides));
    });
    expression.setAttribute('aria-invalid', String(!valid));
    error.textContent = valid ? '' : 'Use dados válidos, como 2d6+1d20+4 (até 999 dados).';
    updateCriticalRange(valid ? groups : []);
    rollButton.disabled = !valid;
    return valid ? { groups, modifier, quantity, expression: source } : null;
  }

  function criticalThreshold(sides, rate = selectedCriticalRate) {
    return CRITICAL_THRESHOLDS[sides][rate - 1];
  }

  function updateCriticalRange(groups) {
    const ranges = [...new Set(groups.map(group => group.sides))].map(sides => {
      const threshold = criticalThreshold(sides);
      return `d${sides} ${threshold}${threshold < sides ? `–${sides}` : ''}`;
    });
    criticalRange.textContent = ranges.length ? `Crítico ${selectedCriticalRate}: ${ranges.join(' · ')}` : '';
  }

  function randomFace(sides) {
    const limit = Math.floor(0x100000000 / sides) * sides;
    const value = new Uint32Array(1);
    do { crypto.getRandomValues(value); } while (value[0] >= limit);
    return value[0] % sides + 1;
  }

  function isValidRoll(roll) {
    return Boolean(roll && typeof roll.id === 'string' && roll.id.length <= 80 &&
      Number.isInteger(roll.criticalRate) && roll.criticalRate >= 1 && roll.criticalRate <= 5 &&
      typeof roll.expression === 'string' && roll.expression.length <= 100 &&
      /^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/i.test(roll.expression) &&
      Number.isSafeInteger(roll.modifier) && Math.abs(roll.modifier) <= 100000 &&
      Array.isArray(roll.groups) && roll.groups.length > 0 && roll.groups.length <= 20 &&
      roll.groups.every(group => group && typeof group === 'object' && SIDES.includes(group.sides) && Array.isArray(group.values) &&
        group.values.length > 0 && group.values.length <= 999 &&
        group.values.every(value => Number.isInteger(value) && value >= 1 && value <= group.sides)) &&
      roll.groups.reduce((sum, group) => sum + group.values.length, 0) <= 999);
  }

  function rememberRoll(id) {
    if (seenRolls.has(id)) return false;
    seenRolls.add(id);
    if (seenRolls.size > 200) seenRolls.delete(seenRolls.values().next().value);
    return true;
  }

  let coinFaceCounter = 0;

  function renderCoinFace(value) {
    const isHeads = value === 1;
    const isCritical = value === 2;
    const label = isHeads ? 'cara' : 'coroa';
    const coinFaceId = `coin-face-${++coinFaceCounter}`;
    const svg = isHeads ? `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <linearGradient id="${coinFaceId}-gold" x1="0" x2="1">
            <stop offset="0%" stop-color="#fdf0b5" />
            <stop offset="45%" stop-color="#e8bf55" />
            <stop offset="100%" stop-color="#b9781a" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="20" fill="url(#${coinFaceId}-gold)" stroke="#86560f" stroke-width="2" />
        <circle cx="24" cy="24" r="10" fill="#fff6d6" opacity="0.9" />
        <path d="M17 28c3-3.2 11-3.2 14 0" stroke="#8b5813" stroke-width="2.2" stroke-linecap="round" fill="none" />
        <circle cx="20" cy="20" r="2.1" fill="#8b5813" />
        <circle cx="28" cy="20" r="2.1" fill="#8b5813" />
      </svg>
    ` : `
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <defs>
          <linearGradient id="${coinFaceId}-silver" x1="0" x2="1">
            <stop offset="0%" stop-color="#f2f8ff" />
            <stop offset="45%" stop-color="#b9d4ea" />
            <stop offset="100%" stop-color="#6a8aa5" />
          </linearGradient>
          <linearGradient id="${coinFaceId}-gold" x1="0" x2="1">
            <stop offset="0%" stop-color="#fff0a8" />
            <stop offset="50%" stop-color="#efc761" />
            <stop offset="100%" stop-color="#b57a1d" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="20" fill="url(#${coinFaceId}-silver)" stroke="#4b5e74" stroke-width="2" />
        <path d="M14 30.5L18 17.5L23 25.5L24 14.5L25 25.5L30 17.5L34 30.5H14Z" fill="url(#${coinFaceId}-gold)" stroke="#925d1e" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M18 30.5H30V32.8H18Z" fill="#fff4c7" opacity="0.9"/>
        <circle cx="18" cy="17.5" r="2.1" fill="#fff9e6" stroke="#9d6d22" stroke-width="1.2" />
        <circle cx="24" cy="14.5" r="2.3" fill="#fff9e6" stroke="#9d6d22" stroke-width="1.2" />
        <circle cx="30" cy="17.5" r="2.1" fill="#fff9e6" stroke="#9d6d22" stroke-width="1.2" />
        <path d="M20.5 27.5H27.5V29.2H20.5Z" fill="#b57a1d" opacity="0.7"/>
        <circle cx="24" cy="23.6" r="3.2" fill="#fff8de" stroke="#8c611d" stroke-width="1.2"/>
      </svg>
    `;
    const sparks = isCritical ? '<i class="gold-spark spark-one"></i><i class="gold-spark spark-two"></i><i class="gold-spark spark-three"></i><i class="gold-spark spark-four"></i>' : '';
    return `<div class="rolling-die is-settled coin-face coin-face-${isHeads ? 'heads' : 'tails'}${isCritical ? ' is-critical' : ''}" aria-label="${label}" title="${label}"><span>${svg}</span>${sparks}</div>`;
  }

  function renderDie(value, sides, animate = false, index = 0) {
    if (sides === 2) {
      if (!animate) return renderCoinFace(value);
      return `<div class="rolling-die coin-face coin-rolling" style="--roll-delay:${Math.min(index * 14, 280)}ms"><span>·</span></div>`;
    }
    const critical = value >= criticalThreshold(sides);
    return `<div class="rolling-die${animate ? '' : ' is-settled'}${critical ? ' is-critical' : ''}"${animate ? ` style="--roll-delay:${Math.min(index * 14, 280)}ms"` : ''}><span>${animate ? '·' : value}</span>${critical ? '<i class="gold-spark spark-one"></i><i class="gold-spark spark-two"></i><i class="gold-spark spark-three"></i><i class="gold-spark spark-four"></i>' : ''}</div>`;
  }

  function renderRoll(roll, animate = true) {
    if (!isValidRoll(roll) || !rememberRoll(roll.id)) return;
    setPanelOpen(true);
    selectedCriticalRate = roll.criticalRate;
    document.querySelectorAll('[data-critical-rate]').forEach(button => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.criticalRate) === selectedCriticalRate));
    });
    expression.value = roll.expression;
    parseExpression();
    rollButton.disabled = animate;
    rollButton.textContent = animate ? 'Rolando…' : 'Rolar dados';
    const total = roll.groups.reduce((sum, group) => sum + group.values.reduce((groupSum, value) => groupSum + value, 0), roll.modifier);
    const coinGroup = roll.groups.find(group => group.sides === 2);
    const coinHeads = coinGroup ? coinGroup.values.filter(value => value === 1).length : 0;
    const coinCount = coinGroup?.values.length || 0;
    const detail = coinCount ? `<span class="dice-coin-detail">${coinHeads} caras · ${coinCount - coinHeads} coroas</span>` : '';
    const modifier = roll.modifier ? ` ${roll.modifier > 0 ? '+' : '−'} ${Math.abs(roll.modifier)}` : '';
    const header = `<div class="dice-result-heading"><span class="dice-result-expression">${roll.expression}</span><strong class="dice-result-total">Total ${total}</strong></div>${detail}`;
    const stage = animate
      ? `<div class="dice-roll-stage" aria-label="Dados rolando">${roll.groups.flatMap(group => group.values.map((_, index) => renderDie(0, group.sides, true, index))).join('')}</div>`
      : '';
    results.innerHTML = `${header}${modifier ? `<div class="dice-result-modifier">Modificador${modifier}</div>` : ''}${stage}`;
    window.clearTimeout(rollTimer);
    if (animate) {
      rollTimer = window.setTimeout(() => {
        const stageElement = results.querySelector('.dice-roll-stage');
        if (stageElement) stageElement.innerHTML = roll.groups.flatMap(group => group.values.map(value => renderDie(value, group.sides))).join('');
        rollButton.disabled = false;
        rollButton.textContent = 'Rolar novamente';
      }, 1350);
    }
  }

  function rollDice() {
    const parsed = parseExpression();
    if (!parsed) { expression.focus(); return; }
    const groups = parsed.groups.map(group => ({
      sides: group.sides,
      values: Array.from({ length: group.quantity }, () => randomFace(group.sides))
    }));
    const roll = {
      id: crypto.randomUUID(),
      expression: parsed.expression,
      modifier: parsed.modifier,
      criticalRate: selectedCriticalRate,
      groups,
      timestamp: Date.now()
    };
    if (window.StonePlate?.broadcastDiceRoll) window.StonePlate.broadcastDiceRoll(roll);
    else channel?.postMessage({ type: 'dice-roll', roll });
    renderRoll(roll);
    return roll;
  }

  window.StonePlateDice = {
    rollExpression(source) {
      setPanelOpen(true);
      expression.value = String(source || '').trim();
      if (!parseExpression()) return false;
      return rollDice();
    }
  };

  toggle.addEventListener('click', () => setPanelOpen(panel.hidden));
  document.querySelector('#diceClose').addEventListener('click', () => setPanelOpen(false));
  document.querySelectorAll('[data-critical-rate]').forEach(button => button.addEventListener('click', () => {
    selectedCriticalRate = Number(button.dataset.criticalRate);
    document.querySelectorAll('[data-critical-rate]').forEach(option => {
      option.setAttribute('aria-pressed', String(Number(option.dataset.criticalRate) === selectedCriticalRate));
    });
    parseExpression();
  }));
  expression.addEventListener('input', parseExpression);
  expression.addEventListener('keydown', event => { if (event.key === 'Enter') rollDice(); });
  document.querySelectorAll('[data-die-sides]').forEach(button => button.addEventListener('click', event => {
    const sides = Number(button.dataset.dieSides);
    const parsed = parseExpression();
    if (parsed && (event.shiftKey || sides === selectedSides)) {
      const terms = [...expression.value.replace(/\s+/g, '').toLowerCase().matchAll(/([+-]?)(?:(\d*)d(\d+)|(\d+))/g)];
      let merged = false;
      expression.value = terms.map(term => {
        if (term[3] !== undefined && Number(term[3]) === sides) {
          if (merged) return '';
          merged = true;
          return `${term[1]}${Number(term[2] || 1) + 1}d${sides}`;
        }
        return term[0];
      }).filter(Boolean).join('');
      if (!merged) expression.value = `${expression.value}+1d${sides}`;
    } else {
      const modifier = parsed?.modifier || 0;
      expression.value = `1d${sides}${modifier ? `${modifier > 0 ? '+' : ''}${modifier}` : ''}`;
    }
    parseExpression();
    expression.focus();
  }));
  rollButton.addEventListener('click', rollDice);
  parseExpression();
  channel?.addEventListener('message', event => {
    if (event.data?.type === 'dice-roll') renderRoll(event.data.roll);
  });
})();