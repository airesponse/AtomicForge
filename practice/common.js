'use strict';
const el=id=>document.getElementById(id);
const number=(id,lo,hi)=>Math.max(lo,Math.min(hi,Number(el(id).value)||lo));
let audioContext;
function sound(){audioContext??=new AudioContext();if(audioContext.state==='suspended')audioContext.resume();return audioContext}
function tone(ctx,start,hz,length,volume,type='sine',out=ctx.destination,endHz=hz){
  const osc=ctx.createOscillator(),env=ctx.createGain();
  osc.type=type;osc.frequency.setValueAtTime(hz,start);osc.frequency.exponentialRampToValueAtTime(endHz,start+length);
  env.gain.setValueAtTime(.0001,start);env.gain.exponentialRampToValueAtTime(volume,start+.003);env.gain.exponentialRampToValueAtTime(.0001,start+length);
  osc.connect(env).connect(out);osc.start(start);osc.stop(start+length+.01);
}
function readSetting(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function saveSetting(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
const wave=el('wave'),picker=el('waveColour'),waveCtx=wave.getContext('2d'),waveKey=document.title+'.wave',motion=matchMedia('(prefers-reduced-motion: reduce)');
picker.value=readSetting(waveKey,'#82e1c1');
function waveFrame(t){const w=wave.width,h=wave.height;waveCtx.clearRect(0,0,w,h);waveCtx.beginPath();for(let x=0;x<=w;x+=2){const y=h/2+Math.sin(x*.012+t*.003)*4;if(x)waveCtx.lineTo(x,y);else waveCtx.moveTo(x,y)}waveCtx.strokeStyle=picker.value;waveCtx.lineWidth=2;waveCtx.stroke()}
let frame;
function animate(t){waveFrame(t);if(!motion.matches)frame=requestAnimationFrame(animate)}
function resize(){cancelAnimationFrame(frame);wave.width=wave.clientWidth;wave.height=wave.clientHeight;animate(0)}
picker.oninput=()=>{saveSetting(waveKey,picker.value);waveFrame(0)};motion.addEventListener('change',resize);window.addEventListener('resize',resize);resize();
