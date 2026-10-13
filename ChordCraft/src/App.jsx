import React, { useEffect, useMemo, useRef, useState } from 'react';
import Soundfont from 'soundfont-player';
import { chordMidiVoicing, strumSchedule, velocityForString } from './audioEngine.js';
import {
  Guitar, Music2, Play, Square, Save, Download, Plus, Minus, Trash2, RotateCcw,
  Sparkles, SlidersHorizontal, ChevronDown, Info, CircleHelp, Bookmark, AudioLines,
  Headphones, Dices, WandSparkles, Copy, ArrowLeftRight, Piano, Layers3, Music,
  Check, Guitar as GuitarIcon, Repeat
} from 'lucide-react';

const NOTES = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const SHARP_NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const PC = Object.fromEntries(NOTES.map((n,i)=>[n,i]));
const FLAT = {'D♭':1,'E♭':3,'G♭':6,'A♭':8,'B♭':10};
const pcOf = n => PC[n] ?? FLAT[n] ?? SHARP_NOTES.indexOf(n);
const noteName = n => NOTES[((n%12)+12)%12];
const sharpName = n => SHARP_NOTES[((n%12)+12)%12];
const MAJ=[0,2,4,5,7,9,11], MIN=[0,2,3,5,7,8,10];
const ROMAJ=['I','ii','iii','IV','V','vi','vii°'], ROMIN=['i','ii°','III','iv','v','VI','VII'];
const QUALMAJ=['','m','m','','','m','dim'], QUALMIN=['m','dim','','m','m','',''];
const INSTRUMENTS=[
  ['acoustic_grand_piano','Grand piano','Keys'],['electric_piano_1','Electric piano','Keys'],
  ['acoustic_guitar_nylon','Nylon guitar','Guitar'],['acoustic_guitar_steel','Steel-string guitar','Guitar'],
  ['electric_guitar_clean','Clean electric guitar','Guitar'],['overdriven_guitar','Overdriven guitar','Guitar'],
  ['string_ensemble_1','String ensemble','Orchestral'],['fingered_bass','Fingered bass','Bass'],
  ['synth_strings_1','Synth strings','Synth']
];
const PRESETS=[
 {name:'Anthemic lift',degrees:[0,4,5,3],feel:'Uplifting',desc:'Big, familiar, emotionally direct.'},
 {name:'Reflective',degrees:[5,3,0,4],feel:'Wistful',desc:'A wistful opening that grows toward resolution.'},
 {name:'Classic pop',degrees:[0,5,3,4],feel:'Classic',desc:'A timeless pop and early-rock movement.'},
 {name:'Jazz turnaround',degrees:[1,4,0],feel:'Jazzy',desc:'Strong harmonic pull back home.'},
 {name:'Classic rock',degrees:[0,6,3,0],feel:'Roots rock',desc:'Open, rootsy movement with a classic-rock feel.'},
 {name:'Dark cinematic',degrees:[0,3,6,5],feel:'Moody',desc:'Minor-key movement with a dramatic lift.'},
 {name:'Hopeful chorus',degrees:[0,3,5,4],feel:'Hopeful',desc:'A lift-and-release pattern for a chorus.'},
 {name:'Power-chord drive',degrees:[0,6,3,6],feel:'Driving',desc:'A compact rock loop with a strong riff feel.'},
 {name:'Soulful descent',degrees:[0,5,4,3],feel:'Soulful',desc:'A descending, soulful change of colour.'}
];
const SECTIONS=['Verse','Pre-chorus','Chorus','Bridge','Intro','Outro'];
const STRUMS=[
 {id:'down',label:'Downstrokes',pattern:[0,1,2,3],desc:'Steady quarter-note strums'},
 {id:'pop',label:'Pop / rock',pattern:[0,2,3,5],desc:'Down, down-up, up-down-up'},
 {id:'folk',label:'Folk eighths',pattern:[0,2,4,6],desc:'Alternating down-up feel'},
 {id:'half',label:'Half-time',pattern:[0,4],desc:'Open space between changes'},
 {id:'arpeggio',label:'Arpeggiated',pattern:[0,1,2,3],desc:'Notes picked one after another'}
];
const FRET_SHAPES={
  'C':{frets:[-1,3,2,0,1,0],fingers:[0,3,2,0,1,0]},
  'D':{frets:[-1,-1,0,2,3,2],fingers:[0,0,0,1,3,2]},
  'E':{frets:[0,2,2,1,0,0],fingers:[0,2,3,1,0,0]},
  'G':{frets:[3,2,0,0,0,3],fingers:[2,1,0,0,0,3]},
  'A':{frets:[-1,0,2,2,2,0],fingers:[0,0,1,2,3,0]},
  'Am':{frets:[-1,0,2,2,1,0],fingers:[0,0,2,3,1,0]},
  'Em':{frets:[0,2,2,0,0,0],fingers:[0,2,3,0,0,0]},
  'Dm':{frets:[-1,-1,0,2,3,1],fingers:[0,0,0,2,3,1]},
  'D7':{frets:[-1,-1,0,2,1,2],fingers:[0,0,0,2,1,3]},
  'E7':{frets:[0,2,0,1,0,0],fingers:[0,2,0,1,0,0]},
  'A7':{frets:[-1,0,2,0,2,0],fingers:[0,0,2,0,3,0]},
  'Cmaj7':{frets:[-1,3,2,0,0,0],fingers:[0,3,2,0,0,0]},
  'Am7':{frets:[-1,0,2,0,1,0],fingers:[0,0,2,0,1,0]}
};
const VOICINGS=['Open / cowboy','Barre shape','Triad','Power chord'];
const BASE_SECTIONS=[
 {id:'verse',name:'Verse',progression:null},
 {id:'chorus',name:'Chorus',progression:null}
];

function scaleFor(key,mode){const root=pcOf(key);return (mode==='Major'?MAJ:MIN).map(x=>(root+x)%12)}
function chordFor(degree,key,mode,suffix){
 const scale=scaleFor(key,mode), d=((degree%7)+7)%7, root=scale[d];
 const q=suffix===undefined?(mode==='Major'?QUALMAJ:QUALMIN)[d]:suffix;
 let intervals=q==='m'?[0,3,7]:q==='dim'?[0,3,6]:q==='aug'?[0,4,8]:q==='7'?[0,4,7,10]:q==='maj7'?[0,4,7,11]:q==='m7'?[0,3,7,10]:q==='sus2'?[0,2,7]:q==='sus4'?[0,5,7]:q==='add9'?[0,4,7,14]:[0,4,7];
 const roman=(mode==='Major'?ROMAJ:ROMIN)[d];
 return {root,notes:intervals.map(x=>(root+x)%12),name:`${noteName(root)}${q==='m'?'m':q==='dim'?'°':q==='aug'?'+':q}`,roman,quality:q};
}
function voicingFor(chord,shape,capo){ return chordMidiVoicing(chord,shape,capo); }
function midiBytes(n){const a=[];do{let b=n&127;n>>=7;if(n)a.unshift(b|128);else a.unshift(b)}while(n);return a}
function exportMidi(project){
 const ppq=480, tempo=Math.round(60000000/project.bpm);
 const bytes=[]; const push=(...x)=>bytes.push(...x);
 const vlq=n=>push(...midiBytes(n));
 const ev=[];
 const add=(tick,order,data)=>ev.push({tick,order,data});
 const addTrack=(prog,channel,events)=>{
  const e=[{tick:0,order:0,data:[0xC0|channel,prog]}];
  let tick=0;
  events.forEach(x=>e.push(x));
  e.sort((a,b)=>a.tick-b.tick||a.order-b.order);
  const out=[];let last=0;
  for(const x of e){out.push(...midiBytes(x.tick-last),...x.data);last=x.tick}
  out.push(0,0xff,0x2f,0);
  return [0x4d,0x54,0x72,0x6b,(out.length>>>24)&255,(out.length>>>16)&255,(out.length>>>8)&255,out.length&255,...out];
 };
 let tick=0;const evs=[];
 project.progression.forEach((c,i)=>{
  const chord=chordFor(c.degree,project.key,project.mode,c.suffix), dur=(c.bars||1)*ppq*4;
  const pitches=chord.notes.map((n,j)=>Math.max(36,Math.min(84,n+48+(j>1?12:0))));
  pitches.forEach((p,j)=>{evs.push({tick:tick+j*4,order:1,data:[0x90,p,88]});evs.push({tick:tick+dur-10+j*2,order:0,data:[0x80,p,0]})});
  tick+=dur;
 });
 const track=addTrack(0,0,evs);
 const header=[0x4d,0x54,0x68,0x64,0,0,0,6,0,1,0,2,1,0xe0];
 const tempoTrack=[0,0xff,0x51,3,(tempo>>16)&255,(tempo>>8)&255,tempo&255,0,0xff,0x2f,0];
 const t1=[0x4d,0x54,0x72,0x6b,0,0,0,tempoTrack.length,...tempoTrack];
 const all=[...header,...t1,...track];
 return new Blob([new Uint8Array(all)],{type:'audio/midi'});
}
function saveBlob(name,blob){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function downloadText(name,text,type='text/plain'){saveBlob(name,new Blob([text],{type}))}
function cleanName(n){return (n||'chordcraft-project').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}

function ChordDiagram({chord,capo,shape}){
 const base=chord.name.replace('°','').replace('+','');
 const data=FRET_SHAPES[base]||FRET_SHAPES[base.replace('m7','m')]||FRET_SHAPES[base.replace('maj7','')]||FRET_SHAPES['E'];
 const frets=shape==='Power chord'?[ -1, -1, 1, 3, 3, -1 ]:data.frets;
 return <div className="diagram-wrap">
  <svg viewBox="0 0 116 112" role="img" aria-label={`${chord.name} guitar chord diagram`}>
   <text x="58" y="10" fill="#a9b7a5" textAnchor="middle" fontSize="8">{shape==='Open / cowboy'?'OPEN SHAPE':shape.toUpperCase()}</text>
   {Array.from({length:6},(_,i)=><line key={'v'+i} x1={20+i*15} y1="25" x2={20+i*15} y2="91" stroke="#596a56" strokeWidth="1"/>)}
   {Array.from({length:5},(_,i)=><line key={'h'+i} x1="20" y1={26+i*16} x2="95" y2={26+i*16} stroke={i===0?'#b6c5b0':'#596a56'} strokeWidth={i===0?'2':'1'}/>)}
   {frets.map((f,i)=><g key={i}>{f<0?<text x={20+i*15} y="21" fill="#c6d1c1" textAnchor="middle" fontSize="10">×</text>:f===0?<circle cx={20+i*15} cy="17" r="3" stroke="#b8c6b3" fill="none"/>:<circle cx={20+i*15} cy={26+(Math.min(4,f)-.5)*16} r="4.5" fill={i===0?'#c5f36a':'#b3c1ad'}/>}</g>)}
   <text x="58" y="106" fill="#879687" textAnchor="middle" fontSize="8">{capo?`CAPO ${capo}`:'STANDARD TUNING'}</text>
  </svg>
 </div>
}

export default function App(){
 const [key,setKey]=useState('E'),[mode,setMode]=useState('Major'),[bpm,setBpm]=useState(92);
 const [instrument,setInstrument]=useState('acoustic_guitar_steel');
 const [soundfontBank,setSoundfontBank]=useState('FluidR3_GM'),[room,setRoom]=useState(14);
 const [progression,setProgression]=useState([{degree:0,bars:1},{degree:4,bars:1},{degree:5,bars:1},{degree:3,bars:1}]);
 const [projectName,setProjectName]=useState('New song idea'),[sectionName,setSectionName]=useState('Verse');
 const [strumId,setStrumId]=useState('pop'),[voicing,setVoicing]=useState('Open / cowboy'),[capo,setCapo]=useState(0);
 const [feel,setFeel]=useState('Straight'),[bassOn,setBassOn]=useState(false),[showTheory,setShowTheory]=useState(true);
 const [activeIndex,setActiveIndex]=useState(-1),[playing,setPlaying]=useState(false),[loading,setLoading]=useState(false),[loopPlayback,setLoopPlayback]=useState(false);
 const [saved,setSaved]=useState(()=>{try{return JSON.parse(localStorage.getItem('chordcraft-saved')||'[]')}catch{return[]}});
 const [sections,setSections]=useState(()=>{try{return JSON.parse(localStorage.getItem('chordcraft-sections')||'[]')}catch{return[]}});
 const [compare,setCompare]=useState(null),[toast,setToast]=useState('');
 const audioRef=useRef(null),instrumentRef=useRef(null),timerRef=useRef(null),stopRef=useRef(false),playToken=useRef(0),mixRef=useRef(null),loopRef=useRef(false),soundRequestRef=useRef(0),activeIndexRef=useRef(activeIndex);
 const scale=useMemo(()=>scaleFor(key,mode),[key,mode]);
 const chords=useMemo(()=>progression.map(c=>chordFor(c.degree,key,mode,c.suffix)),[progression,key,mode]);
 const selectedInstrument=INSTRUMENTS.find(i=>i[0]===instrument)||INSTRUMENTS[0];
 const playbackSettingsRef=useRef(null);
 activeIndexRef.current=activeIndex;
 playbackSettingsRef.current={progression,key,mode,bpm,feel,bassOn,instrument,soundfontBank,room,strumId,voicing,capo};

 useEffect(()=>()=>{stopRef.current=true;clearTimeout(timerRef.current);try{instrumentRef.current?.stop?.()}catch{}},[]);
 useEffect(()=>{
  if(!playing||activeIndexRef.current<0)return;
  const requestId=++soundRequestRef.current;
  try{instrumentRef.current?.stop?.()}catch{}
  soundChord(activeIndexRef.current,{...playbackSettingsRef.current,requestId});
  return()=>{soundRequestRef.current++};
 },[instrument,soundfontBank,strumId,voicing,capo,bassOn,room,key,mode,progression,bpm,feel]);
 const notify=msg=>{setToast(msg);setTimeout(()=>setToast(''),2400)};
 async function ensureAudio(opts={}){
  const currentInstrument=opts.instrument??instrument,currentBank=opts.soundfontBank??soundfontBank,currentRoom=opts.room??room;
  if(!audioRef.current){
   const AC=window.AudioContext||window.webkitAudioContext;audioRef.current=new AC();
   const ctx=audioRef.current, bus=ctx.createGain(), dry=ctx.createGain(), wet=ctx.createGain(), convolver=ctx.createConvolver(), master=ctx.createGain(), comp=ctx.createDynamicsCompressor();
   const impulse=ctx.createBuffer(2,Math.floor(ctx.sampleRate*1.35),ctx.sampleRate);
   for(let ch=0;ch<2;ch++){const data=impulse.getChannelData(ch);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.pow(1-i/data.length,3.4)}
   convolver.buffer=impulse;bus.connect(dry);dry.connect(master);bus.connect(convolver);convolver.connect(wet);wet.connect(master);master.connect(comp);comp.connect(ctx.destination);
   dry.gain.value=0.92;wet.gain.value=currentRoom/100*0.34;master.gain.value=0.82;comp.threshold.value=-12;comp.knee.value=18;comp.ratio.value=3;comp.attack.value=0.006;comp.release.value=0.22;
   mixRef.current={bus,dry,wet,master,comp};
  }
  if(audioRef.current.state==='suspended')await audioRef.current.resume();
  if(mixRef.current)mixRef.current.wet.gain.setTargetAtTime(currentRoom/100*0.34,audioRef.current.currentTime,0.06);
  const id=`${currentBank}:${currentInstrument}`;
  if(!instrumentRef.current||instrumentRef.current.__id!==id){
   const previous=instrumentRef.current;try{previous?.stop?.()}catch{};setLoading(true);try{const next=await Soundfont.instrument(audioRef.current,currentInstrument,{soundfont:currentBank,destination:mixRef.current.bus,gain:currentInstrument.includes('guitar')?.86:.92});next.__id=id;if(opts.requestId==null||opts.requestId===soundRequestRef.current)instrumentRef.current=next;else try{next.stop?.()}catch{}}
   finally{setLoading(false)}
  }return instrumentRef.current;
 }
 async function soundChord(index,opts={}){
  const activeProgression=opts.progression??progression,activeKey=opts.key??key,activeMode=opts.mode??mode,activeInstrument=opts.instrument??instrument,activeStyle=opts.strumId??strumId,activeVoicing=opts.voicing??voicing,activeCapo=opts.capo??capo,activeBpm=opts.bpm??bpm,activeBass=opts.bassOn??bassOn;
  const c=activeProgression[index];if(!c)return;
  try{
   const inst=await ensureAudio(opts);if(opts.requestId!=null&&opts.requestId!==soundRequestRef.current)return;
   const chord=chordFor(c.degree,activeKey,activeMode,c.suffix),now=audioRef.current.currentTime+.025;
   const notes=voicingFor(chord,activeVoicing,activeCapo);
   const instrumentId=activeInstrument,style=activeStyle;
   const beatSeconds=60/activeBpm,offsets=strumSchedule(notes.length,style,beatSeconds);
   if(instrumentId==='fingered_bass'){inst.play(`${sharpName(chord.root)}2`,now,{duration:1.1,gain:.68});return}
   if(instrumentId.includes('guitar')){
    notes.slice(0,6).forEach((n,i)=>inst.play(n,now+(offsets[i]||0),{duration:style==='arpeggio'?Math.max(0.55,beatSeconds*.82):Math.max(.45,beatSeconds*1.7),gain:velocityForString(i,Math.min(6,notes.length),style)}));
   }else if(style==='arpeggio'){
    notes.slice(0,5).forEach((n,i)=>inst.play(n,now+(offsets[i]||i*.1),{duration:Math.max(.55,beatSeconds*1.4),gain:velocityForString(i,Math.min(5,notes.length),style)}));
   }else notes.slice(0,5).forEach((n,i)=>inst.play(n,now,{duration:Math.max(.6,beatSeconds*1.8),gain:.72-i*.035}));
   if(activeBass)inst.play(`${sharpName(chord.root)}2`,now,{duration:Math.max(.5,beatSeconds*2),gain:.38});
  }catch(e){console.error(e);notify('Instrument audio could not load. Check your connection and try again.')}
 }
 function stop(){stopRef.current=true;playToken.current++;soundRequestRef.current++;clearTimeout(timerRef.current);try{instrumentRef.current?.stop?.()}catch{};setPlaying(false);setActiveIndex(-1)}
 async function start(){
  if(!playbackSettingsRef.current.progression.length)return;stopRef.current=false;setPlaying(true);const token=++playToken.current;++soundRequestRef.current;
  let i=0;
  const step=async()=>{
   if(stopRef.current||token!==playToken.current)return;
   const settings=playbackSettingsRef.current;if(i>=settings.progression.length)i=0;
   setActiveIndex(i);await soundChord(i,{...settings,requestId:soundRequestRef.current});
   if(stopRef.current||token!==playToken.current)return;
   const latest=playbackSettingsRef.current,bars=latest.progression[i]?.bars||1,beat=60000/latest.bpm;
   const mult=latest.feel==='Half-time'?1.5:latest.feel==='Double-time'?.5:1;
   const delay=beat*4*bars*mult;
   i++;
   if(i>=latest.progression.length){
    if(loopRef.current)i=0;
    else{timerRef.current=setTimeout(()=>{if(token!==playToken.current)return;if(loopRef.current){i=0;step();return}stopRef.current=true;setPlaying(false);setActiveIndex(-1)},delay);return}
   }
   timerRef.current=setTimeout(step,delay);
  };step();
 }
 function update(i,patch){setProgression(p=>p.map((c,j)=>j===i?{...c,...patch}:c))}
 function add(degree=(progression.at(-1)?.degree??6)+1){if(progression.length>=12){notify('Maximum 12 chord slots');return}setProgression(p=>[...p,{degree:((degree%7)+7)%7,bars:1}])}
 function move(i,delta){setProgression(p=>{const n=[...p],j=i+delta;if(j<0||j>=n.length)return p;[n[i],n[j]]=[n[j],n[i]];return n})}
 function loadPreset(p){stop();setProgression(p.degrees.map(degree=>({degree,bars:1})));notify(`${p.name} loaded`)}
 function randomize(){const p=PRESETS[Math.floor(Math.random()*PRESETS.length)];loadPreset(p)}
 function snapshot(){return {name:projectName,key,mode,bpm,instrument,soundfontBank,room,progression:structuredClone(progression),sectionName,feel,strumId,voicing,capo,bassOn}}
 function save(){
  const s={...snapshot(),id:Date.now(),savedAt:new Date().toISOString()};
  const next=[s,...saved.filter(x=>x.name!==s.name)].slice(0,30);setSaved(next);localStorage.setItem('chordcraft-saved',JSON.stringify(next));notify('Song idea saved');
 }
 function loadSaved(s){stop();setProjectName(s.name);setKey(s.key);setMode(s.mode);setBpm(s.bpm);setInstrument(s.instrument);setSoundfontBank(s.soundfontBank||'FluidR3_GM');setRoom(s.room??14);instrumentRef.current=null;setProgression(s.progression);setSectionName(s.sectionName||'Verse');setFeel(s.feel||'Straight');setStrumId(s.strumId||'pop');setVoicing(s.voicing||'Open / cowboy');setCapo(s.capo||0);setBassOn(!!s.bassOn);notify(`Loaded ${s.name}`)}
 function saveSection(){const entry={...snapshot(),id:Date.now(),sectionName};const next=[entry,...sections].slice(0,40);setSections(next);localStorage.setItem('chordcraft-sections',JSON.stringify(next));notify(`${sectionName} saved to song sections`)}
 function exportProject(){saveBlob(`${cleanName(projectName)}.json`,new Blob([JSON.stringify({app:'ChordCraft',version:3,...snapshot(),sections},null,2)],{type:'application/json'}))}
 function exportText(){const lines=progression.map((c,i)=>{const x=chordFor(c.degree,key,mode,c.suffix);return `${i+1}. ${x.name} (${x.roman}) — ${c.bars||1} bar${c.bars>1?'s':''}`});downloadText(`${cleanName(projectName)}-chords.txt`,`${projectName}\n${sectionName} · ${key} ${mode} · ${bpm} BPM\n\n${lines.join('\n')}\n`)}
 function exportMidiFile(){const blob=exportMidi({key,mode,bpm,progression});saveBlob(`${cleanName(projectName)}.mid`,blob);notify('MIDI file exported')}
 function compareCurrent(){const snap=snapshot();setCompare(old=>old?{...old,b:snap}:{a:snap,b:null});notify(compare?.b?'Comparison reset':'Current progression saved as A')}
 function setCompareB(){setCompare(old=>({...old,b:snapshot()}));notify('Current progression saved as B')}
 function loadCompare(s){if(!s)return;loadSaved({...s,id:Date.now()})}
 function changeKey(newKey){setKey(newKey)}
 const roman=mode==='Major'?ROMAJ:ROMIN;

 return <div className="app-shell">
  <header className="topbar"><a className="brand" href="#"><span className="brand-mark"><Guitar size={20}/></span><span><strong>chordcraft</strong><small>SONGWRITING STUDIO</small></span></a><div className="topbar-right"><span className="autosave"><i className="status-dot"/> Local workspace</span><button className="icon-button" onClick={exportProject} title="Export project"><Download size={17}/></button><button className="save-top" onClick={save}><Save size={16}/> Save idea</button></div></header>
  <main className="workspace">
   <section className="welcome-row"><div><div className="eyebrow"><Sparkles size={14}/> YOUR NEXT SONG STARTS HERE</div><h1>Find the feeling.<br/><em>Build the progression.</em></h1><p className="intro">Explore chords, hear how they move, and turn the ideas worth keeping into a song.</p></div><div className="project-field"><label>WORKING TITLE</label><input value={projectName} onChange={e=>setProjectName(e.target.value)} maxLength={70}/><span className="field-hint"><Music2 size={13}/> Saved ideas stay in this browser.</span></div></section>

   <section className="control-panel"><div className="panel-heading"><span className="section-icon"><SlidersHorizontal size={16}/></span><div><h2>Set your foundation</h2><p>Start with a key, tempo, and section. Change anything while you experiment.</p></div></div>
    <div className="controls-grid">
     <div className="control-group"><label>KEY</label><div className="select-wrap"><select value={key} onChange={e=>changeKey(e.target.value)}>{NOTES.map(n=><option key={n}>{n}</option>)}</select><ChevronDown size={15}/></div></div>
     <div className="control-group"><label>MODE</label><div className="segmented"><button className={mode==='Major'?'selected':''} onClick={()=>setMode('Major')}>Major</button><button className={mode==='Minor'?'selected':''} onClick={()=>setMode('Minor')}>Minor</button></div></div>
     <div className="control-group tempo-group"><label>TEMPO <span className="muted-label">BPM</span></label><div className="tempo-control"><button onClick={()=>setBpm(v=>Math.max(40,v-1))}><Minus size={14}/></button><strong>{bpm}</strong><button onClick={()=>setBpm(v=>Math.min(220,v+1))}><Plus size={14}/></button><input aria-label="Tempo" type="range" min="40" max="220" value={bpm} onChange={e=>setBpm(+e.target.value)}/></div></div>
     <div className="control-group"><label>SONG SECTION</label><div className="select-wrap"><select value={sectionName} onChange={e=>setSectionName(e.target.value)}>{SECTIONS.map(s=><option key={s}>{s}</option>)}</select><ChevronDown size={15}/></div></div>
    </div>
    <div className="scale-row"><span className="scale-label">IN THIS KEY</span>{scale.map((n,i)=><span key={i} className={`scale-note ${i===0?'tonic':''}`}>{noteName(n)}</span>)}<span className="scale-name">{key} {mode.toLowerCase()} scale</span></div>
   </section>

   <div className="main-grid"><section className="progression-section">
    <div className="section-title-row"><div><div className="eyebrow">01 / CREATE</div><h2>Your progression</h2><p>Tap a chord to hear it. Reorder, replace, or add chords as your idea evolves.</p></div><button className="outline-button" onClick={randomize}><Dices size={16}/> Surprise me</button></div>
    <div className="progression-board"><div className="board-top"><span><i className="live-dot"/> {progression.length} CHORDS · {sectionName.toUpperCase()}</span><span className="board-key">{key} {mode}</span></div>
     <div className="chord-list">{progression.map((item,index)=>{const chord=chords[index];return <article key={index} className={`chord-card ${activeIndex===index?'is-playing':''}`}>
      <div className="chord-card-head"><span className="chord-index">{String(index+1).padStart(2,'0')}</span><div className="card-actions"><button title="Move left" disabled={index===0} onClick={()=>move(index,-1)}>←</button><button title="Move right" disabled={index===progression.length-1} onClick={()=>move(index,1)}>→</button><button title="Remove chord" onClick={()=>{setProgression(p=>p.filter((_,i)=>i!==index));if(activeIndex===index)stop()}}><Trash2 size={13}/></button></div></div>
      <button className="chord-play" onClick={()=>{setActiveIndex(index);soundChord(index)}}><span className="chord-name">{chord.name}</span><span className="roman">{chord.roman}</span><span className="mini-piano">{chord.notes.map((n,i)=><i key={i} className={i===0?'root-key':''}/>)}</span><span className="play-hint"><Play size={12} fill="currentColor"/> PLAY CHORD</span></button>
      <div className="chord-card-bottom"><label>CHORD / COLOUR</label><select value={`${item.degree}:${item.suffix===undefined?'auto':item.suffix}`} onChange={e=>{const [d,s]=e.target.value.split(':');update(index,{degree:+d,suffix:s==='auto'?undefined:s})}}>{Array.from({length:7},(_,d)=><optgroup key={d} label={`${roman[d]} · ${chordFor(d,key,mode).name}`}>{['auto','','m','7','maj7','m7','dim','aug','sus2','sus4','add9'].map(s=>{const suffix=s==='auto'?undefined:s;const c=chordFor(d,key,mode,suffix);return <option key={s} value={`${d}:${s==='auto'?'auto':s}`}>{s==='auto'?`${c.name} · diatonic`:c.name}</option>})}</optgroup>)}</select></div>
      <div className="bars-row"><span>Length</span><div className="bar-stepper"><button onClick={()=>update(index,{bars:Math.max(1,(item.bars||1)-1)})}>−</button><b>{item.bars||1} bar{item.bars>1?'s':''}</b><button onClick={()=>update(index,{bars:Math.min(8,(item.bars||1)+1)})}>+</button></div></div>
     </article>})}
     {progression.length<12&&<button className="add-chord" onClick={()=>add()}><span><Plus size={20}/></span><b>Add chord</b><small>Keep the idea moving</small></button>}</div>
     <div className="board-footer"><span><Info size={14}/> Try changing one chord at a time to hear the difference.</span><button onClick={()=>{stop();setProgression([{degree:0,bars:1},{degree:4,bars:1},{degree:5,bars:1},{degree:3,bars:1}])}}><RotateCcw size={13}/> Reset</button></div>
    </div>
    <div className="playback-bar"><button className={`main-play ${playing?'playing':''}`} onClick={()=>playing?stop():start()} disabled={(loading&&!playing)||!progression.length}>{playing?<><Square size={15} fill="currentColor"/> Stop</>:<><Play size={16} fill="currentColor"/> Play progression</>}</button><button type="button" className={`loop-toggle ${loopPlayback?'enabled':''}`} aria-pressed={loopPlayback} onClick={()=>{const next=!loopRef.current;loopRef.current=next;setLoopPlayback(next)}}><Repeat size={15}/><span>Loop</span><span className="loop-state">{loopPlayback?'On':'Off'}</span></button><div className="playback-meta"><span className="equalizer"><i/><i/><i/><i/><i/></span><span>{playing?`Playing chord ${activeIndex+1} of ${progression.length}`:loading?'Loading instrument…':'Ready when you are'}</span></div><button className="text-button" onClick={exportMidiFile}><Music size={15}/> Export MIDI</button><button className="text-button" onClick={exportText}><Download size={15}/> Chord sheet</button></div>

    <section className="theory-panel"><button className="theory-toggle" onClick={()=>setShowTheory(v=>!v)}><span className="section-icon small"><CircleHelp size={16}/></span><span><b>Understand the movement</b><small>Helpful theory, only when you want it.</small></span><ChevronDown className={showTheory?'rotated':''} size={17}/></button>{showTheory&&<div className="theory-content"><div className="theory-item"><span className="theory-number">01</span><div><b>Key centre</b><p><strong>{key} {mode.toLowerCase()}</strong> is your tonal home. The first chord often feels settled, but you don't have to begin or end there.</p></div></div><div className="theory-item"><span className="theory-number">02</span><div><b>Harmonic motion</b><p>{chords.map(c=>c.name).join(' → ')}. Listen for tension before each change and how strongly the next chord feels like a resolution.</p></div></div><div className="theory-item"><span className="theory-number">03</span><div><b>Borrowed chord experiment</b><p>Switch a chord to a minor, seventh, sus, or add9 colour. In a major key, try borrowing ♭VII or iv from the parallel minor for a classic-rock or cinematic shift.</p></div></div></div>}</section>

    <section className="compare-panel"><div className="compare-head"><span className="section-icon"><ArrowLeftRight size={16}/></span><div><h2>Compare ideas A / B</h2><p>Keep one version safe while you try a different direction.</p></div></div><div className="compare-actions"><button onClick={()=>{setCompare({a:snapshot(),b:null});notify('Saved current progression as A')}}><span className="compare-letter">A</span> Set A to current</button><button onClick={()=>{if(!compare?.a){setCompare({a:snapshot(),b:null});notify('Set A first, then make a variation')}else setCompare(old=>({...old,b:snapshot()}))}}><span className="compare-letter b">B</span> Set B to current</button></div>{compare&&<div className="compare-results"><div><b>A · {compare.a?.name}</b><small>{compare.a?.progression.map(c=>chordFor(c.degree,compare.a.key,compare.a.mode,c.suffix).name).join(' · ')}</small><button onClick={()=>loadCompare(compare.a)}>Load A</button></div><div><b>B · {compare.b?.name||'Not set yet'}</b><small>{compare.b?compare.b.progression.map(c=>chordFor(c.degree,compare.b.key,compare.b.mode,c.suffix).name).join(' · '):'Make a variation and save it as B.'}</small>{compare.b&&<button onClick={()=>loadCompare(compare.b)}>Load B</button>}</div></div>}</section>

   </section><aside className="right-column">
    <section className="sound-panel"><div className="eyebrow">02 / LISTEN</div><h2>Find your sound</h2><p>Try the same harmony with a different instrument or playing feel.</p>
     <label className="form-label">PLAYBACK INSTRUMENT</label><div className="instrument-select select-wrap"><select value={instrument} onChange={e=>setInstrument(e.target.value)}>{INSTRUMENTS.map(i=><option key={i[0]} value={i[0]}>{i[1]}</option>)}</select><ChevronDown size={15}/></div>
     <div className="instrument-visual"><div className="instrument-orb"><AudioLines size={27}/></div><div><strong>{selectedInstrument[1]}</strong><span>{selectedInstrument[2]} · {soundfontBank==='MusyngKite'?'MusyngKite samples':'FluidR3 GM samples'}</span></div><button className="preview-button" onClick={()=>soundChord(Math.max(0,activeIndex))}><Play size={14} fill="currentColor"/></button></div>
     <label className="form-label">SAMPLE LIBRARY</label><div className="select-wrap"><select value={soundfontBank} onChange={e=>setSoundfontBank(e.target.value)}><option value="FluidR3_GM">FluidR3 GM · balanced / faster load</option><option value="MusyngKite">MusyngKite · alternate sample set</option></select><ChevronDown size={15}/></div><div className="strum-description">The first use downloads samples. The alternate bank may take longer and uses more data.</div>
     <label className="form-label">PLAYING STYLE</label><div className="select-wrap"><select value={strumId} onChange={e=>setStrumId(e.target.value)}>{STRUMS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select><ChevronDown size={15}/></div><div className="strum-description">{STRUMS.find(s=>s.id===strumId)?.desc}</div>
     <label className="form-label">ROOM AMBIENCE <span className="inline-value">{room}%</span></label><div className="setup-row room-row"><div><span>Dry</span><b>{room===0?'Off':room<25?'Subtle':room<60?'Room':'Wide'}</b></div><input aria-label="Room ambience" type="range" min="0" max="80" step="1" value={room} onChange={e=>setRoom(+e.target.value)}/></div>
     <label className="form-label capo-label">GUITAR SETUP</label><div className="setup-row"><div><span>Capo fret</span><b>{capo===0?'Open':capo}</b></div><input type="range" min="0" max="12" value={capo} onChange={e=>setCapo(+e.target.value)}/></div>
     <div className="select-wrap voicing-select"><select value={voicing} onChange={e=>setVoicing(e.target.value)}>{VOICINGS.map(v=><option key={v}>{v}</option>)}</select><ChevronDown size={15}/></div>
     <div className="diagram-card"><div className="diagram-head"><span>CHORD SHAPE</span><span>{chords[Math.max(0,activeIndex)]?.name||chords[0]?.name||'—'}</span></div>{chords.length>0&&<ChordDiagram chord={chords[Math.max(0,activeIndex)]||chords[0]} capo={capo} shape={voicing}/>}<p>Diagram is a shape guide; verify fingerings for alternate chord colours.</p></div>
     <label className="check-row"><input type="checkbox" checked={bassOn} onChange={e=>setBassOn(e.target.checked)}/><span className="custom-check"/> Add root-note bass support</label>
     <div className="sound-note"><Headphones size={15}/><span>Sampled playback loads on first use. Headphones or an audio interface will give the clearest preview.</span></div>
    </section>

    <section className="inspiration-panel"><div className="panel-heading compact"><span className="section-icon"><WandSparkles size={16}/></span><div><h2>Start with a feeling</h2><p>Choose a shape, then make it yours.</p></div></div><div className="preset-list">{PRESETS.slice(0,7).map((p,i)=><button key={p.name} className="preset-row" onClick={()=>loadPreset(p)}><span className={`preset-symbol symbol-${i%6}`}>{['↗','◒','✳','⌁','◐','⌇','♬'][i]}</span><span className="preset-copy"><b>{p.name}</b><small>{p.feel} · {p.desc}</small></span><span className="preset-arrow">↗</span></button>)}</div><button className="all-presets" onClick={randomize}>Explore another progression <span>↗</span></button></section>

    <section className="saved-panel"><div className="saved-heading"><div><div className="eyebrow">YOUR LIBRARY</div><h2><Bookmark size={17}/> Saved ideas</h2></div><span className="saved-count">{saved.length}</span></div>
     {saved.length===0?<div className="empty-saved"><div className="empty-icon"><Bookmark size={18}/></div><b>Your next favourite might be here.</b><p>Save a progression to keep it in this browser.</p><button onClick={save}><Plus size={14}/> Save current idea</button></div>:<div className="saved-list">{saved.map(s=><div className="saved-item" key={s.id}><button className="saved-load" onClick={()=>loadSaved(s)}><b>{s.name}</b><span>{s.key} {s.mode} · {s.bpm} BPM · {s.sectionName}</span><small>{s.progression.map(c=>chordFor(c.degree,s.key,s.mode,c.suffix).name).join(' · ')}</small></button><button className="delete-saved" onClick={()=>{const n=saved.filter(x=>x.id!==s.id);setSaved(n);localStorage.setItem('chordcraft-saved',JSON.stringify(n))}} title="Delete saved idea"><Trash2 size={14}/></button></div>)}</div>}
     <div className="library-foot"><span><Save size={13}/> Stored on this device</span><button onClick={exportProject}>Backup <Download size={12}/></button></div>
    </section>
    <section className="sections-panel"><div className="panel-heading compact"><span className="section-icon"><Layers3 size={16}/></span><div><h2>Build your song</h2><p>Save separate verse, chorus, bridge, and intro ideas.</p></div></div><button className="save-section" onClick={saveSection}><Plus size={15}/> Save current as {sectionName}</button>{sections.length>0&&<div className="section-saved-list">{sections.map(s=><button key={s.id} onClick={()=>loadSaved(s)}><span>{s.sectionName}</span><small>{s.key} {s.mode} · {s.progression.map(c=>chordFor(c.degree,s.key,s.mode,c.suffix).name).join(' · ')}</small></button>)}</div>}</section>
   </aside></div>
   <footer className="footer"><span className="brand-mini"><Guitar size={15}/> chordcraft</span><span>Made for the moment an idea starts to take shape.</span><button onClick={()=>notify('Open-source starter app. See README for setup and roadmap.')}><Info size={13}/> About</button></footer>
  </main>{toast&&<div className="toast"><i className="toast-dot"/> {toast}</div>}
 </div>
}
