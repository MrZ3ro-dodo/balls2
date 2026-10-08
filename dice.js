(() => {
  const CHANNEL_NAME = 'stone-plate-state-v1';
  const SIDES = [2, 4, 6, 8, 10, 12, 20, 30, 60, 100];
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
  const seenRolls = new Set();
  let selectedSides = 20;
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
        <div class="dice-type-grid" role="group" aria-label="Tipo de dado">
          ${SIDES.map(sides => `<button class="dice-type-button" type="button" data-die-sides="${sides}" aria-pressed="${sides === selectedSides}">${sides === 2 ? 'Moeda' : `d${sides}`}</button>`).join('')}
        </div>
        <label class="dice-label" for="diceExpression" style="margin-top:15px">QUANTIDADE</label>
        <div class="dice-expression-row">
          <input class="dice-expression" id="diceExpression" type="number" inputmode="numeric" min="1" max="999" step="1" value="1" placeholder="_" autocomplete="off" aria-describedby="diceExpressionError">
          <span class="dice-expression-suffix" id="diceNotation">d20</span>
          <span class="dice-expression-note">ATÉ 999</span>
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
  const notation = document.querySelector('#diceNotation');

  function setPanelOpen(isOpen) {
    panel.hidden = !isOpen;
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Fechar rolagem de dados' : 'Abrir rolagem de dados');
    if (isOpen) expression.focus();
  }

  function parseExpression() {
    const quantity = Number(expression.value);
    const valid = expression.value !== '' && Number.isInteger(quantity) && quantity >= 1 && quantity <= 999;
    expression.setAttribute('aria-invalid', String(!valid));
    error.textContent = valid ? '' : 'Informe uma quantidade de 1 a 999.';
    rollButton.disabled = !valid;
    document.querySelectorAll('[data-die-sides]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.dieSides) === selectedSides)));
    return valid ? { quantity, sides: selectedSides } : null;
  }

  function randomFace(sides) {
    const limit = Math.floor(0x100000000 / sides) * sides;
    const value = new Uint32Array(1);
    do { crypto.getRandomValues(value); } while (value[0] >= limit);
    return value[0] % sides + 1;
  }

  function isValidRoll(roll) {
    return Boolean(roll && typeof roll.id === 'string' && roll.id.length <= 80 && SIDES.includes(roll.sides) &&
      Number.isInteger(roll.quantity) && roll.quantity >= 1 && roll.quantity <= 999 &&
      Array.isArray(roll.values) && roll.values.length === roll.quantity &&
      roll.values.every(value => Number.isInteger(value) && value >= 1 && value <= roll.sides));
  }

  function rememberRoll(id) {
    if (seenRolls.has(id)) return false;
    seenRolls.add(id);
    if (seenRolls.size > 200) seenRolls.delete(seenRolls.values().next().value);
    return true;
  }

  function renderRoll(roll, animate = true) {
    if (!isValidRoll(roll) || !rememberRoll(roll.id)) return;
    setPanelOpen(true);
    selectedSides = roll.sides;
    expression.value = String(roll.quantity);
    notation.textContent = roll.sides === 2 ? 'moeda' : `d${roll.sides}`;
    parseExpression();
    rollButton.disabled = animate;
    rollButton.textContent = animate ? 'Rolando…' : 'Rolar dados';
    const total = roll.values.reduce((sum, value) => sum + value, 0);
    const coinHeads = roll.values.filter(value => value === 1).length;
    const shownTotal = roll.sides === 2 ? `${coinHeads} caras · ${roll.quantity - coinHeads} coroas` : `Total ${total}`;
    const header = `<div class="dice-result-heading"><span class="dice-result-expression">${roll.quantity} × ${roll.sides === 2 ? 'moeda' : `d${roll.sides}`}</span><strong class="dice-result-total">${shownTotal}</strong></div>`;
    const stage = animate
      ? `<div class="dice-roll-stage" aria-label="Dados rolando">${roll.values.map((_, index) => `<div class="rolling-die" style="--roll-delay:${Math.min(index * 14, 280)}ms"><span>·</span></div>`).join('')}</div>`
      : '';
    results.innerHTML = `${header}${stage}`;
    window.clearTimeout(rollTimer);
    if (animate) {
      rollTimer = window.setTimeout(() => {
        const stageElement = results.querySelector('.dice-roll-stage');
        if (stageElement) stageElement.innerHTML = roll.values.map(value => {
          const face = roll.sides === 2 ? (value === 1 ? 'C' : 'K') : value;
          return `<div class="rolling-die is-settled"><span>${face}</span></div>`;
        }).join('');
        rollButton.disabled = false;
        rollButton.textContent = 'Rolar novamente';
      }, 1350);
    }
  }

  function rollDice() {
    const parsed = parseExpression();
    if (!parsed) { expression.focus(); return; }
    const roll = {
      id: crypto.randomUUID(),
      sides: parsed.sides,
      quantity: parsed.quantity,
      values: Array.from({ length: parsed.quantity }, () => randomFace(parsed.sides)),
      timestamp: Date.now()
    };
    if (window.StonePlate?.broadcastDiceRoll) window.StonePlate.broadcastDiceRoll(roll);
    else channel?.postMessage({ type: 'dice-roll', roll });
    renderRoll(roll);
  }

  toggle.addEventListener('click', () => setPanelOpen(panel.hidden));
  document.querySelector('#diceClose').addEventListener('click', () => setPanelOpen(false));
  expression.addEventListener('input', parseExpression);
  expression.addEventListener('keydown', event => { if (event.key === 'Enter') rollDice(); });
  document.querySelectorAll('[data-die-sides]').forEach(button => button.addEventListener('click', () => {
    selectedSides = Number(button.dataset.dieSides);
    notation.textContent = selectedSides === 2 ? 'moeda' : `d${selectedSides}`;
    parseExpression();
    expression.focus();
  }));
  rollButton.addEventListener('click', rollDice);
  channel?.addEventListener('message', event => {
    if (event.data?.type === 'dice-roll') renderRoll(event.data.roll);
  });
})();