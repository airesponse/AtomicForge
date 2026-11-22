const byId = id => document.getElementById(id);
const presets = document.querySelector('.presets');
const dial = document.querySelector('.dial');
let duration = 300000;
let remaining = duration;
let deadline = 0;
let state = 'Ready';
let audio;
function activateAudio() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
  } catch {}
}
const ringer = byId('ringer');
const notice = byId('sound-note');
const melodies = { beacon: [440, 660, 880], crystal: [784, 988, 1175], arcade: [523, 659, 784, 1047] };
let customBuffer;
let playing = [];
function silence() {
  for (const node of playing) { try { node.stop(); } catch {} }
  playing = [];
}
function ring() {
  silence();
  if (audio?.state !== 'running') return;
  const now = audio.currentTime;
  if (ringer.value === 'file' && customBuffer) {
    const source = audio.createBufferSource();
    source.buffer = customBuffer;
    source.connect(audio.destination);
    source.start(now, 0, Math.min(15, customBuffer.duration));
    playing.push(source);
    return;
  }
  melodies[ringer.value].forEach((hz, index) => {
    const tone = audio.createOscillator();
    const volume = audio.createGain();
    const startAt = now + index * 0.22;
    tone.type = ringer.value === 'arcade' ? 'triangle' : 'sine';
    tone.frequency.value = hz;
    tone.connect(volume).connect(audio.destination);
    volume.gain.setValueAtTime(0.001, startAt);
    volume.gain.exponentialRampToValueAtTime(0.15, startAt + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.001, startAt + 0.65);
    tone.start(startAt);
    tone.stop(startAt + 0.66);
    playing.push(tone);
  });
}
try {
  const saved = localStorage.getItem('atomicForge.ringer');
  if (Object.hasOwn(melodies, saved)) ringer.value = saved;
} catch {}
ringer.onchange = () => {
  silence();
  try { if (ringer.value !== 'file') localStorage.setItem('atomicForge.ringer', ringer.value); } catch {}
};
byId('track').onchange = async event => {
  const file = event.target.files[0];
  if (!file) return;
  activateAudio();
  try {
    const decoded = await audio.decodeAudioData(await file.arrayBuffer());
    if (byId('track').files[0] !== file) return;
    customBuffer = decoded;
    if (!ringer.querySelector('[value="file"]')) ringer.add(new Option('', 'file'));
    ringer.querySelector('[value="file"]').textContent = file.name;
    ringer.value = 'file';
    silence();
    notice.textContent = 'Selected ' + file.name;
  } catch { notice.textContent = 'Could not read that audio file. Try an MP3 or unprotected M4A.'; }
};
byId('preview').onclick = async () => {
  activateAudio();
  try { await audio.resume(); ring(); } catch { notice.textContent = 'Sound playback unavailable.'; }
};
const worker = 'serviceWorker' in navigator
  ? navigator.serviceWorker.register('timer-worker.js').then(() => navigator.serviceWorker.ready).catch(() => null)
  : Promise.resolve(null);
byId('alerts').onclick = async () => {
  if (!('Notification' in window)) {
    notice.textContent = 'On iPhone, add Timer to your Home Screen, then open it there.';
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    notice.textContent = permission === 'granted' && await worker ? 'Timer notifications enabled.' : 'Notifications unavailable. Check notification settings.';
  } catch { notice.textContent = 'Notification permission unavailable.'; }
};
async function notifyFinished() {
  if (window.Notification?.permission !== 'granted') return;
  try { await (await worker)?.showNotification('Atomic Forge Timer', { body: 'Time’s up.', tag: 'atomic-forge-timer' }); } catch {}
}
function render() {
  if (deadline) {
    remaining = Math.max(0, deadline - Date.now());
    if (!remaining) { deadline = 0; state = 'Time’s up'; ring(); notifyFinished(); }
  }
  const total = Math.ceil(remaining / 1000);
  byId('minutes').textContent = String(Math.floor(total / 60)).padStart(2, '0');
  byId('seconds').textContent = String(total % 60).padStart(2, '0');
  dial.style.setProperty('--arc', (360 * remaining / duration) + 'deg');
  dial.style.setProperty('--hue', String(10 + 30 * remaining / duration));
  dial.classList.toggle('urgent', Boolean(deadline && remaining / duration <= 0.2));
  byId('toggle').textContent = deadline ? 'Pause' : state === 'Paused' ? 'Resume' : 'Start';
  byId('cancel').disabled = state === 'Ready';
  if (byId('status').textContent !== state) byId('status').textContent = state;
  for (const button of presets.children) button.setAttribute('aria-pressed', String(Number(button.value) === duration));
}
function start() {
  silence();
  activateAudio();
  if (!remaining) remaining = duration;
  deadline = Date.now() + remaining;
  state = 'Counting down';
  render();
}
const storageKey = 'atomicForge.timer.presets.v1';
let secondsList = [60, 300, 600, 900];
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(saved) && [4, 6].includes(saved.length) &&
      saved.every(n => Number.isInteger(n) && n > 0 && n < 60000)) secondsList = saved.slice(0, 4);
} catch {}
duration = remaining = secondsList[1] * 1000;
let editing = false;
let slot = 0;
function drawPresets() {
  presets.replaceChildren();
  secondsList.forEach((seconds, index) => {
    const button = document.createElement('button');
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    button.textContent = [mins && mins + ' min', secs && secs + ' sec'].filter(Boolean).join(' ');
    button.value = seconds * 1000;
    button.onclick = () => {
      if (editing) {
        slot = index;
        byId('edit-title').textContent = 'Edit preset ' + (index + 1);
        byId('preset-min').value = mins;
        byId('preset-sec').value = secs;
        byId('preset-sec').setCustomValidity('');
        byId('editor').showModal();
      } else {
        duration = remaining = Number(button.value);
        start();
      }
    };
    presets.append(button);
  });
}
drawPresets();
byId('edit').onclick = () => {
  editing = !editing;
  byId('edit').setAttribute('aria-pressed', String(editing));
  byId('save-note').textContent = editing ? 'Choose a preset to edit.' : '';
};
byId('dismiss').onclick = () => byId('editor').close();
byId('preset-form').oninput = () => byId('preset-sec').setCustomValidity('');
byId('preset-form').onsubmit = event => {
  event.preventDefault();
  const seconds = byId('preset-min').valueAsNumber * 60 + byId('preset-sec').valueAsNumber;
  if (!seconds) {
    byId('preset-sec').setCustomValidity('Enter at least one second.');
    byId('preset-sec').reportValidity();
    return;
  }
  secondsList[slot] = seconds;
  try {
    localStorage.setItem(storageKey, JSON.stringify(secondsList));
    byId('save-note').textContent = 'Preset saved. Choose another or tap the pencil.';
  } catch { byId('save-note').textContent = 'Preset updated for this visit. Browser storage is unavailable.'; }
  byId('editor').close();
  drawPresets();
  presets.children[slot].focus();
  render();
};

let watchStart = null;
let accumulated = 0;
function renderWatch() {
  const elapsed = accumulated + (watchStart === null ? 0 : performance.now() - watchStart);
  const tenths = Math.floor(elapsed / 100);
  byId('elapsed-min').textContent = String(Math.floor(tenths / 600)).padStart(2, '0');
  byId('elapsed-sec').textContent = String(Math.floor(tenths / 10) % 60).padStart(2, '0') + '.' + tenths % 10;
  byId('watch-toggle').textContent = watchStart !== null ? 'Pause' : accumulated ? 'Resume' : 'Start';
  byId('watch-reset').disabled = watchStart === null && accumulated === 0;
}
byId('watch-toggle').onclick = () => {
  if (watchStart === null) watchStart = performance.now();
  else { accumulated += performance.now() - watchStart; watchStart = null; }
  renderWatch();
};
byId('watch-reset').onclick = () => { watchStart = null; accumulated = 0; renderWatch(); };
function switchMode(watch) {
  byId('countdown').hidden = watch;
  byId('stopwatch').hidden = !watch;
  byId('mode-title').textContent = watch ? 'Stopwatch' : 'Timer';
  byId('timer-tab').setAttribute('aria-pressed', String(!watch));
  byId('watch-tab').setAttribute('aria-pressed', String(watch));
  renderWatch();
}
byId('timer-tab').onclick = () => switchMode(false);
byId('watch-tab').onclick = () => switchMode(true);
setInterval(() => { if (watchStart !== null && !byId('stopwatch').hidden) renderWatch(); }, 100);
byId('toggle').onclick = () => {
  render();
  if (!deadline) return start();
  deadline = 0;
  state = 'Paused';
  render();
};
byId('cancel').onclick = () => { silence(); deadline = 0; remaining = duration; state = 'Ready'; render(); };
document.addEventListener('visibilitychange', render);
render();
setInterval(render, 250);
