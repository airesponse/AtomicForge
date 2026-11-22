const nav = document.querySelector('.tool-nav');
const trigger = nav.querySelector('button');
const panel = nav.querySelector('div');
let pinned = false;
function showMenu(open) {
  panel.hidden = !open;
  trigger.setAttribute('aria-expanded', String(open));
  if (!open) pinned = false;
}
trigger.onclick = () => { pinned = !pinned; showMenu(pinned); };
nav.onpointerenter = event => { if (event.pointerType === 'mouse') showMenu(true); };
nav.onpointerleave = () => { if (!pinned && !panel.contains(document.activeElement)) showMenu(false); };
nav.onfocusout = event => { if (!nav.contains(event.relatedTarget)) showMenu(false); };
document.addEventListener('pointerdown', event => { if (!nav.contains(event.target)) showMenu(false); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !panel.hidden) { showMenu(false); trigger.focus(); }
});
