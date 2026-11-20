'use strict';
const audio=el('audio'), speed=el('speed');
for(let pct=25;pct<=150;pct+=5)speed.add(new Option(pct+'%',pct));
speed.value='100';audio.preservesPitch=true;audio.webkitPreservesPitch=true;
let source=null,url='',phase='stopped',timer,serial=0,loadId=0,midi,learning=false;
const phaseText=t=>el('status').textContent=t;
const stamps=t=>Math.floor(t/60)+':'+(t%60).toFixed(2).padStart(5,'0');
function ready(){return Number.isFinite(audio.duration)&&audio.duration>.12}
function limits(){return [Number(el('a').value),Number(el('b').value)]}
function stop(){serial++;clearTimeout(timer);audio.pause();phase='stopped';el('play').textContent='Play'}
function setRate(pct){
  pct=Math.min(150,Math.round(pct));
  if(![...speed.options].some(o=>Number(o.value)===pct))speed.add(new Option(pct+'%',pct));
  speed.value=String(pct);audio.playbackRate=pct/100;
}
speed.onchange=()=>setRate(Number(speed.value));
function positions(){
  const t=audio.currentTime||0;el('position').textContent=stamps(t);el('seek').value=t;
}
audio.ontimeupdate=positions;
el('seek').oninput=()=>{if(ready()){stop();audio.currentTime=Number(el('seek').value);positions();phaseText('Position the playhead, then set A or B.')}};
function setBounds(a,b){
  if(!ready())return;
  a=Math.min(audio.duration-.1,Math.max(0,a));b=Math.min(audio.duration,Math.max(a+.1,b));
  el('a').value=a.toFixed(2);el('b').value=b.toFixed(2);
}
for(const id of ['a','b'])el(id).onchange=()=>{stop();setBounds(...limits());phaseText('Loop updated.')};
el('setA').onclick=()=>{if(ready()){const t=audio.currentTime;setBounds(t,limits()[1]>t+.1?limits()[1]:audio.duration);phaseText('A set at '+stamps(limits()[0]))}};
el('setB').onclick=()=>{if(ready()){if(audio.currentTime<=limits()[0]+.1){phaseText('Place B after A.');return}setBounds(limits()[0],audio.currentTime);phaseText('B set at '+stamps(limits()[1]))}};
async function listen(id,seek){
  if(id!==serial)return;
  phase='listen';if(seek)audio.currentTime=limits()[0];
  try{await audio.play();if(id!==serial)return;phaseText('Listen');watch(id)}
  catch{if(id===serial){stop();phaseText('Playback could not start. Press Play or choose another recording.')}}
}
function watch(id){
  clearTimeout(timer);
  if(id!==serial||phase!=='listen')return;
  const [a,b]=limits();positions();
  if(audio.ended||audio.currentTime>=b-.012){
    audio.pause();phase='boundary';
    const delay=el('mode').value==='reply'?(b-a)*1000/audio.playbackRate*Number(el('reply').value):0;
    if(delay){phase='reply';phaseText('My turn')}
    timer=setTimeout(()=>{if(id!==serial)return;setRate(Number(speed.value)+Number(el('step').value));listen(id,true)},delay);return;
  }
  timer=setTimeout(()=>watch(id),20);
}
audio.onended=()=>watch(serial);
function start(rewind){
  if(!ready()){phaseText('Choose a recording first.');return}
  stop();const id=serial,[a,b]=limits(),beats=number('count',0,8),interval=60000/number('bpm',30,300);
  el('play').textContent='Pause';const fromA=rewind||audio.currentTime<a||audio.currentTime>=b-.02;
  if(!beats){listen(id,fromA);return}
  phase='count';const ctx=sound();
  function count(n){if(id!==serial)return;if(n===0){listen(id,fromA);return}phaseText('Count in · '+n);tone(ctx,ctx.currentTime+.005,900,.045,.22);timer=setTimeout(()=>count(n-1),interval)}
  count(beats);
}
el('play').onclick=()=>{if(phase==='stopped')start(false);else{stop();phaseText('Paused')}};
el('restart').onclick=()=>start(true);
function load(file,settings={}){
  stop();loadId++;source=file;if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(file);
  el('track').textContent=file.name||settings.filename||'Recording';el('seek').disabled=true;
  audio.onloadedmetadata=()=>{
    if(!ready()){phaseText('This recording has no usable duration.');return}
    el('seek').max=audio.duration;el('seek').disabled=false;
    setBounds(settings.a??0,settings.b??audio.duration);
    for(const k of ['notes','name','mode','reply','step','count','bpm'])if(k in settings)el(k).value=settings[k];
    setRate(settings.speed??100);audio.currentTime=limits()[0];positions();phaseText('Ready · '+stamps(limits()[0])+' to '+stamps(limits()[1]));
  };
  audio.onerror=()=>{stop();phaseText('This browser could not decode the file. Try WAV or MP3.')};
  audio.src=url;
}
el('file').onchange=e=>{const f=e.target.files[0];if(f){el('library').value='';load(f,{name:f.name.replace(/\.[^.]+$/,''),notes:''})}};
const db=new Promise((resolve,reject)=>{const req=indexedDB.open('AtomicForge.TimeMachine',1);req.onupgradeneeded=()=>req.result.createObjectStore('phrases',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});
async function store(method,arg){const d=await db;return new Promise((resolve,reject)=>{const tx=d.transaction('phrases',method==='put'?'readwrite':'readonly');const req=tx.objectStore('phrases')[method](...(arg===undefined?[]:[arg]));tx.oncomplete=()=>resolve(req.result);tx.onabort=tx.onerror=()=>reject(tx.error)})}
async function refresh(selected=''){const list=el('library');list.replaceChildren(new Option('Choose a phrase',''));for(const key of await store('getAllKeys'))list.add(new Option(key,key));list.value=selected}
refresh().catch(()=>phaseText('Phrase storage unavailable in this browser.'));
el('save').onclick=async()=>{
  if(!ready()||!source)return phaseText('Choose a recording first.');
  const name=el('name').value.trim();if(!name)return phaseText('Name the phrase first.');
  if([...el('library').options].some(o=>o.value===name)&&el('library').value!==name&&!confirm('Replace the saved phrase with this name?'))return;
  const [a,b]=limits(),item={id:name,name,a,b,file:source,filename:el('track').textContent};
  for(const k of ['mode','reply','count','bpm','step','speed','notes'])item[k]=el(k).value;
  try{await store('put',item);await refresh(name);phaseText('Phrase and recording saved.')}catch{phaseText('Could not save the recording. Check browser storage space.')}
};
el('library').onchange=async e=>{const id=e.target.value;if(!id)return;const token=++loadId;try{const v=await store('get',id);if(v&&token===loadId)load(v.file,v)}catch{phaseText('Could not open this phrase.')}};
const bindings=readSetting('timeMachine.midi',{});
function midiMessage(e){const [status,n,v]=e.data,type=status>>4;if(!(type===12||((type===9||type===11)&&v>0)))return;
  const key=status+'-'+n;if(learning){bindings[key]=el('action').value;saveSetting('timeMachine.midi',bindings);learning=false;el('midiStatus').textContent='Assigned '+bindings[key];return}
  const action=bindings[key];if(action==='mode'){el('mode').value=el('mode').value==='loop'?'reply':'loop'}else if(['play','restart','setA','setB'].includes(action))el(action).click();
}
function connect(){for(const input of midi.inputs.values())input.onmidimessage=midiMessage}
async function enableMidi(learn){try{midi??=await navigator.requestMIDIAccess();connect();midi.onstatechange=connect;learning=learn;el('midiStatus').textContent=learn?'Press the footswitch to assign.':'Footswitches connected.'}catch{el('midiStatus').textContent='MIDI unavailable. Check browser support and controller permission.'}}
el('learn').onclick=()=>enableMidi(true);
el('connectMidi').onclick=()=>enableMidi(false);
window.addEventListener('pagehide',stop);
