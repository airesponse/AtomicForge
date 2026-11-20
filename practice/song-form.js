'use strict';

function expandSong(sections) {
  const bars = [];
  sections.forEach((section, index) => {
    const name = section.name.trim() || 'Section ' + (index + 1);
    const repeat = Number(section.repeat);
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > 16) throw Error(name + ' needs 1–16 repeats.');
    const chart = section.chart.trim().replace(/^\||\|$/g, '').split('|').map((text, bar) => {
      const tokens = text.trim().split(/\s+/);
      if (!text.trim() || ![1, 2, 4].includes(tokens.length)) throw Error(name + ', bar ' + (bar + 1) + ' needs 1, 2 or 4 chords.');
      try { return tokens.map(ForgeHarmony.chord); }
      catch (error) { throw Error(name + ', bar ' + (bar + 1) + ' · ' + error.message); }
    });
    if (bars.length + chart.length * repeat > 256) throw Error('The song exceeds 256 bars. Shorten a chart or reduce its repeats.');
    for (let pass = 1; pass <= repeat; pass++) {
      chart.forEach((chords, bar) => bars.push({name, index, pass, bar:bar + 1, chords}));
    }
  });
  return bars;
}

function createSongForm(changed, captureBand, restoreBand) {
  const $ = id => document.getElementById(id);
  const seed = () => [
    {name:'Verse', chart:'Am | F | C | G', repeat:2},
    {name:'Chorus', chart:'C | G/B | Am | F G', repeat:2}
  ];
  let sections = seed();
  const storageKey = 'grooveMachine.songForm.1';
  try {
    const draft = JSON.parse(localStorage.getItem(storageKey));
    if (draft && Array.isArray(draft.sections) && draft.sections.length && draft.sections.every(s => typeof s.chart === 'string' && typeof s.name === 'string')) {
      sections = draft.sections;
      $('formTitle').value = draft.title || '';
      $('formMode').value = draft.mode === 'quick' ? 'quick' : 'song';
    }
  } catch {}
  function enabled() { return $('formMode').value === 'song'; }
  function refresh() {
    const scope = $('formScope');
    const selected = scope.value;
    scope.replaceChildren(new Option('Full song','all'), ...sections.map((s,i) => new Option(s.name || 'Section ' + (i+1), i)));
    scope.value = [...scope.options].some(o => o.value === selected) ? selected : 'all';
    $('formEditor').hidden = !enabled();
    $('barsSelect').disabled = $('progressionSelect').disabled = $('keySelect').disabled = enabled();
    try {
      const bars = expandSong(sections);
      const seconds = Math.round(bars.length * 240 / Number($('bpm').value));
      $('formSummary').textContent = bars.length + ' bars · ' + Math.floor(seconds/60) + ':' + String(seconds%60).padStart(2,'0') + ' at ' + $('bpm').value + ' BPM';
    } catch (error) { $('formSummary').textContent = error.message; }
  }
  function edited() {
    changed();
    refresh();
    try { localStorage.setItem(storageKey, JSON.stringify({sections, title:$('formTitle').value, mode:$('formMode').value})); }
    catch { $('formSummary').textContent += ' · Browser could not save this draft.'; }
  }
  function render() {
    const rows = $('formRows');
    rows.replaceChildren();
    sections.forEach((section,i) => {
      const row = $('formRow').content.firstElementChild.cloneNode(true);
      for (const key of ['name','chart','repeat']) {
        const field = row.querySelector('[name="'+key+'"]');
        field.value = section[key];
        field.oninput = () => { section[key] = field.value; edited(); };
      }
      for (const button of row.querySelectorAll('button')) {
        const action = button.dataset.action;
        button.disabled = action === 'up' && !i || action === 'down' && i === sections.length-1 || action === 'delete' && sections.length === 1;
        button.onclick = () => {
          if (action === 'copy') sections.splice(i+1,0,{...section});
          if (action === 'delete') sections.splice(i,1);
          if (action === 'up' || action === 'down') {
            const dest = action === 'up' ? i-1 : i+1;
            [sections[i],sections[dest]] = [sections[dest],sections[i]];
          }
          $('formScope').value='all';
          render(); edited();
        };
      }
      rows.append(row);
    });
    refresh();
  }
  const templates = {
    verse:['Verse','Am | F | C | G'], chorus:['Chorus','C | G/B | Am | F G'],
    bridge:['Bridge','Dm7 | Am | F | G'], outro:['Outro','F | G | C | C'],
    blues:['12-bar blues','A7 | A7 | A7 | A7 | D7 | D7 | A7 | A7 | E7 | D7 | A7 | E7'],
    jazz:['Turnaround','Dm7 | G7 | Cmaj7 | Am7']
  };
  $('formAdd').onclick = () => { const [name,chart]=templates[$('formTemplate').value]; sections.push({name,chart,repeat:1}); render(); edited(); $('formRows').lastElementChild.querySelector('input').focus(); };
  $('formMode').onchange = edited;
  $('formScope').onchange = changed;
  $('formTitle').oninput = edited;
  for (const step of [-1,1]) $(step<0?'formDown':'formUp').onclick = () => {
    try {
      expandSong(sections);
      const shift = n => ForgeHarmony.names[(n+step+12)%12];
      sections = sections.map(s => ({...s, chart:s.chart.replace(/[^\s|]+/g,token => {
        const c = ForgeHarmony.chord(token);
        return shift(c.root)+c.quality+(c.bass===null?'':'/'+shift(c.bass));
      })}));
      render(); edited();
    } catch (error) { $('formSummary').textContent = error.message; }
  };
  const libraryKey = 'grooveMachine.savedSongs.1';
  function library() { return JSON.parse(localStorage.getItem(libraryKey) || '[]'); }
  function listSongs(selected='') {
    const menu = $('formSaved');
    try {
      menu.replaceChildren(new Option('Saved songs…',''), ...library().map(s=>new Option(s.title,s.title)));
      menu.value = selected;
    } catch { $('formSummary').textContent = 'Saved songs are unavailable in this browser.'; }
  }
  $('formSave').onclick = () => {
    try {
      expandSong(sections);
      const title = $('formTitle').value.trim();
      if (!title) { $('formTitle').focus(); throw Error('Enter a song title before saving.'); }
      const songs = library();
      const index = songs.findIndex(s=>s.title===title);
      if (index>=0 && !confirm('Update the saved song “'+title+'”?')) return;
      const entry = {title, sections, band:captureBand()};
      if (index<0) songs.push(entry); else songs[index]=entry;
      localStorage.setItem(libraryKey, JSON.stringify(songs));
      listSongs(title); $('formSummary').textContent = 'Saved “'+title+'” in this browser.';
    } catch(error) { $('formSummary').textContent=error.message; }
  };
  $('formLoad').onclick = () => {
    try {
      const entry=library().find(s=>s.title===$('formSaved').value);
      if (!entry) throw Error('Choose a saved song.');
      expandSong(entry.sections);
      changed(); sections=entry.sections; $('formTitle').value=entry.title;
      restoreBand(entry.band); $('formScope').value='all'; render(); edited();
    } catch(error) { $('formSummary').textContent=error.message; }
  };
  listSongs();
  render();
  return {enabled, refresh, bars(full) {
    const bars = expandSong(sections);
    return full || $('formScope').value==='all' ? bars : bars.filter(b => b.index===Number($('formScope').value));
  }};
}
