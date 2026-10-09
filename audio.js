(() => {
  const root = document.querySelector('#audioManager');
  if (!root) return;

  const defaults = { speed: 1, pitch: 0, loop: false, reverb: 0, echo: 0, echoTime: 0.28, feedback: 0.24 };
  let settings;
  try { settings = { ...defaults, ...JSON.parse(localStorage.getItem('stonePlateAudioSettings') || '{}') }; }
  catch { settings = { ...defaults }; }
  let database;
  let tracks = [];
  let selectedId = '';
  let audioContext;
  let buffer;
  let source;
  let masterGain;
  let convolver;
  let reverbGain;
  let delay;
  let echoGain;
  let feedbackGain;
  let isPlaying = false;
  let offset = 0;
  let startedAt = 0;
  let pauseAfterLoop = false;
  let pauseAt = null;
  let lastPosition = 0;
  let ticker;
  let loadGeneration = 0;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const formatTime = seconds => {
    const value = Math.max(0, Number(seconds) || 0);
    const minutes = Math.floor(value / 60);
    const remainder = Math.floor(value % 60).toString().padStart(2, '0');
    return `${minutes}:${remainder}`;
  };

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('stonePlateAudio', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('tracks', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function storeTrack(track) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('tracks', 'readwrite');
      transaction.objectStore('tracks').put(track);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function deleteTrack(id) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('tracks', 'readwrite');
      transaction.objectStore('tracks').delete(id);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  function listTracks() {
    return new Promise((resolve, reject) => {
      const request = database.transaction('tracks').objectStore('tracks').getAll();
      request.onsuccess = () => resolve(request.result.sort((first, second) => first.name.localeCompare(second.name, 'pt-BR')));
      request.onerror = () => reject(request.error);
    });
  }

  function renderLibrary() {
    const list = root.querySelector('[data-track-list]');
    if (!list) return;
    list.innerHTML = tracks.length ? tracks.map(track => `<li class="audio-track${track.id === selectedId ? ' is-selected' : ''}" data-track-row="${escape(track.id)}">
      <button class="audio-track-select" type="button" data-select-track="${escape(track.id)}" title="Selecionar faixa">
        <span class="audio-track-mark" aria-hidden="true">${track.id === selectedId && isPlaying ? 'Ⅱ' : '♫'}</span>
        <span class="audio-track-name">${escape(track.name)}</span>
        <span class="audio-track-duration">${formatTime(track.duration || 0)}</span>
      </button>
      <button class="audio-remove-track" type="button" data-remove-track="${escape(track.id)}" aria-label="Remover ${escape(track.name)}" title="Remover faixa">×</button>
    </li>`).join('') : '<li class="audio-empty">Nenhuma faixa importada.</li>';
  }

  function saveSettings() {
    try { localStorage.setItem('stonePlateAudioSettings', JSON.stringify(settings)); }
    catch { setStatus('Não foi possível salvar as preferências.'); }
  }

  function setStatus(message) {
    const status = root.querySelector('[data-audio-status]');
    if (status) status.textContent = message;
  }

  function initializeAudio() {
    if (audioContext) return;
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextType) throw new Error('Este navegador não oferece suporte a áudio Web Audio.');
    audioContext = new AudioContextType();
    masterGain = audioContext.createGain();
    convolver = audioContext.createConvolver();
    reverbGain = audioContext.createGain();
    delay = audioContext.createDelay(2);
    echoGain = audioContext.createGain();
    feedbackGain = audioContext.createGain();
    const impulse = audioContext.createBuffer(2, Math.floor(audioContext.sampleRate * 2.2), audioContext.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
      const samples = impulse.getChannelData(channel);
      for (let index = 0; index < samples.length; index++) {
        samples[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / samples.length, 2.4);
      }
    }
    convolver.buffer = impulse;
    convolver.connect(reverbGain).connect(masterGain);
    delay.connect(echoGain).connect(masterGain);
    delay.connect(feedbackGain).connect(delay);
    masterGain.connect(audioContext.destination);
    applyEffects();
  }

  function applyEffects() {
    if (!audioContext) return;
    const now = audioContext.currentTime;
    reverbGain.gain.setTargetAtTime(Number(settings.reverb) / 100, now, 0.025);
    echoGain.gain.setTargetAtTime(Number(settings.echo) / 100, now, 0.025);
    delay.delayTime.setTargetAtTime(Number(settings.echoTime), now, 0.025);
    feedbackGain.gain.setTargetAtTime(Number(settings.feedback), now, 0.025);
  }

  function currentPosition() {
    if (!buffer) return 0;
    if (!isPlaying || !source) return Math.min(offset, buffer.duration);
    const effectiveRate = source.playbackRate.value * Math.pow(2, source.detune.value / 1200);
    const position = offset + (audioContext.currentTime - startedAt) * effectiveRate;
    if (source.loop && buffer.duration > 0) return position % buffer.duration;
    return Math.min(position, buffer.duration);
  }

  function connectSource(nextSource) {
    nextSource.connect(masterGain);
    nextSource.connect(convolver);
    nextSource.connect(delay);
  }

  function stopSource() {
    if (!source) return;
    source.onended = null;
    try { source.stop(); } catch { /* Source may already have ended. */ }
    source.disconnect();
    source = null;
  }

  function pausePlayback() {
    if (!buffer) return;
    offset = currentPosition();
    isPlaying = false;
    stopSource();
    pauseAt = null;
    pauseAfterLoop = false;
    const pauseAtButton = root.querySelector('[data-arm-pause]');
    if (pauseAtButton) pauseAtButton.textContent = 'Definir pausa';
    const pauseLoopToggle = root.querySelector('[data-pause-after-loop]');
    if (pauseLoopToggle) pauseLoopToggle.checked = false;
    renderLibrary();
    updateTransport();
  }

  function startPlayback() {
    if (!buffer) return;
    initializeAudio();
    audioContext.resume();
    if (offset >= buffer.duration) offset = 0;
    const nextSource = audioContext.createBufferSource();
    nextSource.buffer = buffer;
    nextSource.loop = root.querySelector('[data-loop]').checked;
    nextSource.playbackRate.value = Number(settings.speed);
    nextSource.detune.value = Number(settings.pitch);
    connectSource(nextSource);
    source = nextSource;
    isPlaying = true;
    startedAt = audioContext.currentTime;
    lastPosition = offset;
    nextSource.onended = () => {
      if (source !== nextSource) return;
      offset = buffer.duration;
      isPlaying = false;
      source = null;
      updateTransport();
      renderLibrary();
    };
    nextSource.start(0, offset);
    if (!ticker) ticker = window.setInterval(updateTransport, 80);
    renderLibrary();
    updateTransport();
  }

  function seekTo(position) {
    if (!buffer) return;
    const wasPlaying = isPlaying;
    stopSource();
    offset = Math.max(0, Math.min(buffer.duration, Number(position) || 0));
    isPlaying = false;
    if (wasPlaying) startPlayback();
    else updateTransport();
  }

  function updateTransport() {
    if (!buffer) return;
    const position = currentPosition();
    if (isPlaying && pauseAfterLoop && position < lastPosition) {
      pausePlayback();
      setStatus('Pausado no fim do loop.');
      return;
    }
    if (isPlaying && pauseAt !== null && position >= pauseAt) {
      pausePlayback();
      setStatus('Pausado no tempo definido.');
      return;
    }
    lastPosition = position;
    const seek = root.querySelector('[data-seek]');
    if (seek && document.activeElement !== seek) seek.value = String(position);
    const current = root.querySelector('[data-current-time]');
    const duration = root.querySelector('[data-duration]');
    if (current) current.textContent = formatTime(position);
    if (duration) duration.textContent = formatTime(buffer.duration);
    const button = root.querySelector('[data-play-toggle]');
    if (button) {
      button.textContent = isPlaying ? 'Ⅱ' : '▶';
      button.setAttribute('aria-label', isPlaying ? 'Pausar' : 'Reproduzir');
      button.title = isPlaying ? 'Pausar' : 'Reproduzir';
    }
  }

  async function loadTrack(id, autoplay = false) {
    const track = tracks.find(item => item.id === id);
    if (!track) return;
    const generation = ++loadGeneration;
    stopSource();
    isPlaying = false;
    offset = 0;
    buffer = null;
    selectedId = id;
    pauseAt = null;
    pauseAfterLoop = false;
    const pauseAtButton = root.querySelector('[data-arm-pause]');
    if (pauseAtButton) pauseAtButton.textContent = 'Definir pausa';
    const pauseLoopToggle = root.querySelector('[data-pause-after-loop]');
    if (pauseLoopToggle) pauseLoopToggle.checked = false;
    root.querySelector('[data-track-title]').textContent = track.name;
    root.querySelector('[data-seek]').value = '0';
    renderLibrary();
    setStatus('Preparando áudio…');
    try {
      initializeAudio();
      const decoded = await audioContext.decodeAudioData(await track.file.arrayBuffer());
      if (generation !== loadGeneration) return;
      buffer = decoded;
      track.duration = decoded.duration;
      await storeTrack(track);
      root.querySelector('[data-seek]').max = String(decoded.duration);
      root.querySelector('[data-seek]').step = String(Math.max(0.01, decoded.duration / 1000));
      setStatus('Faixa pronta.');
      updateTransport();
      renderLibrary();
      if (autoplay) startPlayback();
    } catch (error) {
      if (generation === loadGeneration) setStatus(error.message || 'Não foi possível abrir esta faixa.');
    }
  }

  root.innerHTML = `<section class="audio-desk" aria-labelledby="audioDeskTitle">
    <header class="audio-desk-header">
      <div><span class="sp-manager-eyebrow">CONFIGURAÇÕES · ÁUDIO</span><h1 id="audioDeskTitle">Mesa de música</h1><p>Biblioteca e efeitos de áudio locais para esta mesa.</p></div>
      <label class="audio-import-button" title="Adicionar arquivos de áudio">＋ Adicionar MP3<input type="file" accept="audio/mpeg,.mp3,audio/*" multiple data-audio-files hidden></label>
    </header>
    <div class="audio-desk-layout">
      <section class="audio-library" aria-label="Biblioteca de áudio"><div class="audio-panel-heading"><h2>Biblioteca</h2><span data-track-count>0 faixas</span></div><ul class="audio-track-list" data-track-list></ul><p class="audio-storage-note">Os arquivos ficam salvos neste navegador.</p></section>
      <section class="audio-console" aria-label="Controles de reprodução">
        <div class="audio-now-playing"><span class="audio-live-dot" aria-hidden="true"></span><div><span class="audio-overline">EM REPRODUÇÃO</span><h2 data-track-title>Nenhuma faixa selecionada</h2></div></div>
        <div class="audio-transport"><button class="audio-play-button" type="button" data-play-toggle aria-label="Reproduzir" title="Reproduzir">▶</button><button class="audio-stop-button" type="button" data-stop title="Parar" aria-label="Parar">■</button><label class="audio-loop-toggle"><input type="checkbox" data-loop ${settings.loop ? 'checked' : ''}><span>Loop</span></label></div>
        <div class="audio-timeline"><span data-current-time>0:00</span><input type="range" min="0" max="1" step="0.01" value="0" data-seek aria-label="Posição da faixa"><span data-duration>0:00</span></div>
        <div class="audio-control-grid">
          <label class="audio-control"><span>VELOCIDADE <output data-speed-value>${Number(settings.speed).toFixed(2)}×</output></span><input type="range" min="0.5" max="2" step="0.01" value="${escape(settings.speed)}" data-setting="speed"><small>0,5× a 2×</small></label>
          <label class="audio-control"><span>AFINAÇÃO <output data-pitch-value>${Number(settings.pitch)} ct</output></span><input type="range" min="-1200" max="1200" step="1" value="${escape(settings.pitch)}" data-setting="pitch"><small>−12 a +12 semitons</small></label>
          <label class="audio-control"><span>REVERBERAÇÃO <output data-reverb-value>${Number(settings.reverb)}%</output></span><input type="range" min="0" max="100" step="1" value="${escape(settings.reverb)}" data-setting="reverb"><small>Ambiência de sala</small></label>
          <label class="audio-control"><span>ECO <output data-echo-value>${Number(settings.echo)}%</output></span><input type="range" min="0" max="100" step="1" value="${escape(settings.echo)}" data-setting="echo"><small>Repetições com retorno</small></label>
          <label class="audio-control audio-compact-control"><span>INTERVALO DO ECO <output data-echoTime-value>${Number(settings.echoTime).toFixed(2)} s</output></span><input type="range" min="0.08" max="0.8" step="0.01" value="${escape(settings.echoTime)}" data-setting="echoTime"></label>
          <label class="audio-control audio-compact-control"><span>RETORNO DO ECO <output data-feedback-value>${Math.round(Number(settings.feedback) * 100)}%</output></span><input type="range" min="0" max="0.75" step="0.01" value="${escape(settings.feedback)}" data-setting="feedback"></label>
        </div>
        <div class="audio-pause-options"><label class="audio-check-option"><input type="checkbox" data-pause-after-loop><span>Pausar após o próximo loop</span></label><div class="audio-time-pause"><label for="audioPauseTime">Pausar em (segundos)</label><input id="audioPauseTime" type="number" min="0" step="0.1" value="30" data-pause-time><button type="button" data-arm-pause>Definir pausa</button></div></div>
        <p class="audio-status" data-audio-status role="status" aria-live="polite">Adicione uma faixa para começar.</p>
      </section>
    </div>
  </section>`;

  root.addEventListener('click', async event => {
    const playButton = event.target.closest('[data-play-toggle]');
    const stopButton = event.target.closest('[data-stop]');
    const selectButton = event.target.closest('[data-select-track]');
    const removeButton = event.target.closest('[data-remove-track]');
    const armPauseButton = event.target.closest('[data-arm-pause]');
    if (playButton) {
      if (!buffer && tracks[0]) await loadTrack(selectedId || tracks[0].id, true);
      else if (isPlaying) pausePlayback();
      else startPlayback();
    }
    if (stopButton && buffer) { pausePlayback(); offset = 0; updateTransport(); }
    if (selectButton) await loadTrack(selectButton.dataset.selectTrack);
    if (removeButton) {
      const id = removeButton.dataset.removeTrack;
      await deleteTrack(id);
      tracks = tracks.filter(track => track.id !== id);
      if (selectedId === id) {
        loadGeneration++;
        stopSource();
        buffer = null;
        isPlaying = false;
        offset = 0;
        selectedId = '';
        pauseAt = null;
        root.querySelector('[data-track-title]').textContent = 'Nenhuma faixa selecionada';
        updateTransport();
      }
      renderLibrary();
      setStatus('Faixa removida.');
    }
    if (armPauseButton && buffer) {
      if (pauseAt !== null) {
        pauseAt = null;
        armPauseButton.textContent = 'Definir pausa';
        setStatus('Pausa programada cancelada.');
      } else {
        pauseAt = Math.max(0, Number(root.querySelector('[data-pause-time]').value) || 0);
        armPauseButton.textContent = 'Cancelar pausa';
        setStatus(`Pausa definida para ${formatTime(pauseAt)}.`);
        if (isPlaying && currentPosition() >= pauseAt) pausePlayback();
      }
    }
  });

  root.addEventListener('input', event => {
    const control = event.target;
    if (control.matches('[data-setting]')) {
      const name = control.dataset.setting;
      settings[name] = Number(control.value);
      const output = root.querySelector(`[data-${name}-value]`);
      if (output) {
        if (name === 'speed') output.textContent = `${settings[name].toFixed(2)}×`;
        else if (name === 'pitch') output.textContent = `${settings[name]} ct`;
        else if (name === 'echoTime') output.textContent = `${settings[name].toFixed(2)} s`;
        else if (name === 'feedback') output.textContent = `${Math.round(settings[name] * 100)}%`;
        else output.textContent = `${settings[name]}%`;
      }
      if (name === 'speed' || name === 'pitch') {
        if (isPlaying) {
          offset = currentPosition();
          startedAt = audioContext.currentTime;
          if (name === 'speed') source.playbackRate.setTargetAtTime(settings.speed, audioContext.currentTime, 0.015);
          else source.detune.setTargetAtTime(settings.pitch, audioContext.currentTime, 0.015);
        }
      } else {
        initializeAudio();
        applyEffects();
      }
      saveSettings();
      return;
    }
    if (control.matches('[data-seek]') && buffer) {
      const current = root.querySelector('[data-current-time]');
      if (current) current.textContent = formatTime(control.value);
    }
  });

  root.addEventListener('change', async event => {
    const control = event.target;
    if (control.matches('[data-loop]')) {
      settings.loop = control.checked;
      if (source) source.loop = control.checked;
      saveSettings();
    }
    if (control.matches('[data-pause-after-loop]')) pauseAfterLoop = control.checked && root.querySelector('[data-loop]').checked;
    if (control.matches('[data-loop]') && !control.checked) {
      pauseAfterLoop = false;
      root.querySelector('[data-pause-after-loop]').checked = false;
    }
    if (control.matches('[data-seek]')) seekTo(control.value);
    if (control.matches('[data-audio-files]') && control.files?.length) {
      const files = [...control.files];
      control.value = '';
      setStatus(`Importando ${files.length} arquivo(s)…`);
      try {
        for (const file of files) {
          if (!file.type.startsWith('audio/') && !file.name.toLowerCase().endsWith('.mp3')) continue;
          await storeTrack({ id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, ''), file, duration: 0 });
        }
        tracks = await listTracks();
        root.querySelector('[data-track-count]').textContent = `${tracks.length} ${tracks.length === 1 ? 'faixa' : 'faixas'}`;
        renderLibrary();
        setStatus('Importação concluída.');
        if (!selectedId && tracks.length) await loadTrack(tracks[0].id);
      } catch (error) { setStatus(error.message || 'Falha ao salvar os arquivos.'); }
    }
  });

  root.querySelector('[data-seek]').addEventListener('pointerup', event => {
    if (buffer) seekTo(event.currentTarget.value);
  });

  (async () => {
    try {
      database = await openDatabase();
      tracks = await listTracks();
      root.querySelector('[data-track-count]').textContent = `${tracks.length} ${tracks.length === 1 ? 'faixa' : 'faixas'}`;
      renderLibrary();
      if (tracks.length) await loadTrack(tracks[0].id);
    } catch (error) { setStatus(error.message || 'Armazenamento local indisponível.'); }
  })();
})();