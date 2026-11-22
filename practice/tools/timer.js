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
function ring() {
  if (audio?.state !== 'running') return;
  const tone = audio.createOscillator();
  const volume = audio.createGain();
  tone.connect(volume).connect(audio.destination);
  volume.gain.setValueAtTime(0.12, audio.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.8);
  tone.frequency.value = 740;
  tone.start();
  tone.stop(audio.currentTime + 0.8);
}
function render() {
  if (deadline) {
    remaining = Math.max(0, deadline - Date.now());
    if (!remaining) { deadline = 0; state = 'Time’s up'; ring(); }
  }
  const total = Math.ceil(remaining / 1000);
  byId('minutes').textContent = String(Math.floor(total / 60)).padStart(2, '0');
  byId('seconds').textContent = String(total % 60).padStart(2, '0');
  dial.style.setProperty('--arc', (360 * remaining / duration) + 'deg');
  byId('toggle').textContent = deadline ? 'Pause' : state === 'Paused' ? 'Resume' : 'Start';
  byId('cancel').disabled = state === 'Ready';
  if (byId('status').textContent !== state) byId('status').textContent = state;
  for (const button of presets.children) button.setAttribute('aria-pressed', String(Number(button.value) === duration));
}
function start() {
  activateAudio();
  if (!remaining) remaining = duration;
  deadline = Date.now() + remaining;
  state = 'Counting down';
  render();
}
const storageKey = 'atomicForge.timer.presets.v1';
let secondsList = [60, 300, 600, 900, 1200, 1800];
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(saved) && saved.length === 6 &&
      saved.every(n => Number.isInteger(n) && n > 0 && n < 60000)) secondsList = saved;
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
  byId('edit').textContent = editing ? 'Done editing' : 'Edit presets';
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
    byId('save-note').textContent = 'Preset saved. Choose another or tap Done editing.';
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
byId('cancel').onclick = () => { deadline = 0; remaining = duration; state = 'Ready'; render(); };
document.addEventListener('visibilitychange', render);
render();
setInterval(render, 250);
