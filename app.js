document.addEventListener('DOMContentLoaded', () => {

  const timersEl = document.getElementById('timers');
  const addTimerBtn = document.getElementById('addTimerBtn');

  let nextId = 1;
  const timers = new Map(); // id -> timerObj

  // --- Alarm-ljud (Web Audio) ---
  // Skapas först när användaren klickar (för att undvika att webbläsaren blockerar ljud).
  let audioCtx = null;

  function initAudio() {
    if (audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }

  function playAlarmOnce() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now); // 880 Hz

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.60);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.65);
  }

  function startAlarm(id) {
    const t = timers.get(id);
    if (!t) return;
    initAudio();
    stopAlarm(id);

    t.alarmOn = true;
    playAlarmOnce();
    t.alarmIntervalId = setInterval(() => playAlarmOnce(), 1200);

    updateUI(id);
  }

  function stopAlarm(id) {
    const t = timers.get(id);
    if (!t) return;

    if (t.alarmIntervalId) {
      clearInterval(t.alarmIntervalId);
      t.alarmIntervalId = null;
    }
    t.alarmOn = false;

    const card = timersEl.querySelector(`[data-id="${id}"]`);
    if (card) updateUI(id);
  }

  function acknowledgeEnd(id) {
    const t = timers.get(id);
    if (!t) return;
    stopAlarm(id);
    // återställ till den tid som är inställd (initialMs)
    t.remainingMs = t.initialMs;
    const card = timersEl.querySelector(`[data-id="${id}"]`);
    if (card) updateUI(id);
  }

  function resetToDefault(id) {
    const t = timers.get(id);
    if (!t) return;

    // stoppa ev. timer och larm
    if (t.intervalId) clearInterval(t.intervalId);
    t.intervalId = null;
    t.isRunning = false;
    stopAlarm(id);

    // tillbaka till standardtid (defaultMs)
    t.initialMs = t.defaultMs;
    t.remainingMs = t.defaultMs;

    const card = timersEl.querySelector(`[data-id="${id}"]`);
    if (card) {
      setDurationInputs(card, t.defaultMs);
      updateUI(id);
    }
  }

  function formatTime(ms) {
    ms = Math.max(0, ms);
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function toMs(h, m, s) {
    const hh = Number(h) || 0;
    const mm = Number(m) || 0;
    const ss = Number(s) || 0;
    return (hh * 3600 + mm * 60 + ss) * 1000;
  }

  function fromMs(ms) {
    ms = Math.max(0, ms);
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return { h, m, s };
  }

  function setDurationInputs(card, ms) {
    const { h, m, s } = fromMs(ms);
    card.querySelector('.h').value = h;
    card.querySelector('.m').value = m;
    card.querySelector('.s').value = s;
  }

  function createTimer(defaultMinutes = 5) {
    const id = nextId++;
    const initial = defaultMinutes * 60 * 1000;

    timers.set(id, {
      id,
      name: '',
      defaultMs: initial,          // standardtid (t.ex. 5 min) som timern skapades med
      initialMs: initial,          // nuvarande inställda tid
      remainingMs: initial,
      isRunning: false,
      intervalId: null,
      lastTick: 0,
      alarmOn: false,
      alarmIntervalId: null
    });

    render();
  }

  function removeTimer(id) {
    const t = timers.get(id);
    if (!t) return;
    if (t.intervalId) clearInterval(t.intervalId);
    stopAlarm(id);
    timers.delete(id);
    render();
  }

  function startTimer(id) {
    const t = timers.get(id);
    if (!t || t.isRunning || t.remainingMs <= 0) return;

    // initAudio här gör att "första click" låser upp ljudet i browsern
    initAudio();

    t.isRunning = true;
    t.lastTick = Date.now();
    t.intervalId = setInterval(() => tick(id), 200);
    updateUI(id);
  }

  function pauseTimer(id) {
    const t = timers.get(id);
    if (!t || !t.isRunning) return;

    const now = Date.now();
    t.remainingMs -= (now - t.lastTick);
    t.remainingMs = Math.max(0, t.remainingMs);

    t.isRunning = false;
    clearInterval(t.intervalId);
    t.intervalId = null;
    updateUI(id);
  }

  function resetTimer(id) {
    const t = timers.get(id);
    if (!t) return;

    if (t.intervalId) clearInterval(t.intervalId);
    t.intervalId = null;
    t.isRunning = false;

    stopAlarm(id);

    t.remainingMs = t.initialMs;
    updateUI(id);
  }

  function tick(id) {
    const t = timers.get(id);
    if (!t || !t.isRunning) return;

    const now = Date.now();
    t.remainingMs -= (now - t.lastTick);
    t.lastTick = now;

    if (t.remainingMs <= 0) {
      t.remainingMs = 0;
      t.isRunning = false;
      clearInterval(t.intervalId);
      t.intervalId = null;

      // Larma tills man stoppar
      startAlarm(id);
    }

    updateUI(id);
  }

  function updateTimerDurationFromInputs(id) {
    const t = timers.get(id);
    if (!t || t.isRunning) return;

    const card = timersEl.querySelector(`[data-id="${id}"]`);
    if (!card) return;

    const h = card.querySelector('.h').value;
    const m = card.querySelector('.m').value;
    const s = card.querySelector('.s').value;

    stopAlarm(id);

    const ms = toMs(h, m, s);
    t.initialMs = ms;
    t.remainingMs = ms;
    updateUI(id);
  }

  function updateTimerNameFromInput(id) {
    const t = timers.get(id);
    if (!t) return;

    const card = timersEl.querySelector(`[data-id="${id}"]`);
    if (!card) return;

    // Tillåt tomt namn
    t.name = card.querySelector('.name').value;
  }

  function updateUI(id) {
    const t = timers.get(id);
    const card = timersEl.querySelector(`[data-id="${id}"]`);
    if (!t || !card) return;

    card.querySelector('.display').textContent = formatTime(t.remainingMs);

    const pct = t.initialMs > 0 ? (t.remainingMs / t.initialMs) * 100 : 0;
    card.querySelector('.bar').style.width = `${Math.max(0, Math.min(100, pct))}%`;

    card.querySelectorAll('.duration input').forEach(inp => inp.disabled = t.isRunning);

    const sp = card.querySelector('.startPause');
    sp.textContent = t.isRunning ? 'Pause' : 'Start';
    sp.classList.toggle('start', !t.isRunning);
    sp.classList.toggle('pause', t.isRunning);

    // Om larm går: man ska stoppa larm eller återställa, inte starta igen direkt
    const baseDisabled = (!t.isRunning && t.remainingMs <= 0);
    sp.disabled = t.alarmOn ? true : baseDisabled;

    card.querySelector('.reset').disabled = t.isRunning;

    const stopBtn = card.querySelector('.stopAlarm');
    if (stopBtn) {
      stopBtn.disabled = !t.alarmOn;
      stopBtn.style.display = t.alarmOn ? 'inline-block' : 'none';
      // Knapptext när tiden är slut (tydligt i retro)
      stopBtn.textContent = t.alarmOn ? 'Time is up - Silent alarm' : 'Silent alarm';
    }

    if (t.alarmOn) {
      card.style.outline = '2px solid var(--danger)';
      card.style.outlineOffset = '-2px';
    } else {
      card.style.outline = 'none';
      card.style.outlineOffset = '0';
    }
  }

  function render() {
    timersEl.innerHTML = '';

    for (const t of timers.values()) {
      const { h, m, s } = fromMs(t.initialMs);

      const card = document.createElement('div');
      card.className = 'timer';
      card.dataset.id = t.id;

      card.innerHTML = `
        <div class="top">
          <input class="name" type="text" value="${escapeHtml(t.name)}" placeholder="Enter a subject (optional)" aria-label="Timer-subject">
          <button class="remove" type="button" title="Remove">×</button>
        </div>

        <div class="duration">
          <input class="h" type="number" min="0" max="99" value="${h}">
          <label>h</label>
          <input class="m" type="number" min="0" max="59" value="${m}">
          <label>m</label>
          <input class="s" type="number" min="0" max="59" value="${s}">
          <label>s</label>
        </div>

        <div class="display">${formatTime(t.remainingMs)}</div>

        <div class="barWrap"><div class="bar"></div></div>

        <div class="controls">
          <button class="btn startPause ${t.isRunning ? 'pause' : 'start'}" type="button">${t.isRunning ? 'Pause' : 'Start'}</button>
          <button class="btn reset" type="button">Reset default time</button>
          <button class="btn stopAlarm" type="button">Time is up - Silent alarm</button>
        </div>
      `;

      card.querySelector('.remove').addEventListener('click', () => removeTimer(t.id));
      card.querySelector('.name').addEventListener('input', () => updateTimerNameFromInput(t.id));

      ['.h', '.m', '.s'].forEach(sel => {
        card.querySelector(sel).addEventListener('change', () => updateTimerDurationFromInputs(t.id));
      });

      card.querySelector('.startPause').addEventListener('click', () => {
        const curr = timers.get(t.id);
        if (!curr) return;
        curr.isRunning ? pauseTimer(t.id) : startTimer(t.id);
      });

      // Återställ standardtid även om du har ändrat tiden manuellt
      card.querySelector('.reset').addEventListener('click', () => resetToDefault(t.id));
      // När tiden är slut: tysta larm + återställ (till inställd tid)
      card.querySelector('.stopAlarm').addEventListener('click', () => acknowledgeEnd(t.id));

      timersEl.appendChild(card);
      updateUI(t.id);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  // Startläge: 2 timers (men du kan lägga till/ta bort)
  createTimer(1);
  createTimer(2);

  addTimerBtn.addEventListener('click', () => createTimer(2));
});
