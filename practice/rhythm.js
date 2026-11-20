'use strict';
const fields=['bpm','meter','swing','on','off','click','keepKick','keepSnare','keepHat','keepClick','visual'];
const settings=readSetting('rhythmMagic.settings',{});
for(const k of fields){const node=el(k);if(k in settings){if(node.type==='checkbox')node.checked=!!settings[k];else node.value=settings[k]}}
let clock=null,output,bar=0,beat=0,next=0,flashes=[],taps=[];
function indicators(){el('beats').replaceChildren();for(let i=1;i<=Number(el('meter').value);i++){const b=document.createElement('span');b.textContent=i;el('beats').append(b)}}
function persist(){for(const k of fields)settings[k]=el(k).type==='checkbox'?el(k).checked:el(k).value;saveSetting('rhythmMagic.settings',settings)}
function stop(){clearInterval(clock);clock=null;flashes.forEach(clearTimeout);flashes=[];output?.disconnect();output=null;el('play').textContent='Start';el('phase').textContent='Ready';indicators()}
function tick(){
 const ctx=audioContext;
 while(next<ctx.currentTime+.12){
  const meter=number('meter',2,7),on=number('on',1,32),off=number('off',0,32),b=beat,cycle=bar%(on+off),gap=cycle>=on,sec=60/number('bpm',30,300),t=next;
  const plays=k=>!gap||el('keep'+k).checked;
  if(plays('Kick')&&(b===0||b===2))tone(ctx,t,139,.18,.48,'sine',output,45);
  if(plays('Snare')&&b%2===1)noise(ctx,t,.13,.24,1200);
  if(plays('Hat')){noise(ctx,t,.045,.13,6700);noise(ctx,t+sec*Number(el('swing').value),.033,.08,7700)}
  const click=el('click').value;
  if(plays('Click')&&(click==='all'||click==='back'&&(b===1||b===3)||click==='last'&&b===meter-1))tone(ctx,t,b?900:1400,.04,.17,'sine',output);
  const flash=setTimeout(()=>{flashes=flashes.filter(id=>id!==flash);[...el('beats').children].forEach((n,i)=>n.classList.toggle('on',i===b&&(!gap||el('visual').checked)));if(!b)el('phase').textContent=gap?'Dropout':'Band · bar '+(cycle+1)+' of '+on},Math.max(0,(t-ctx.currentTime)*1000));
  flashes.push(flash);next+=sec;if(++beat>=meter){beat=0;bar++}
 }
}
let sample;
function noise(ctx,t,duration,volume,hz){
 if(!sample){sample=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*.18),ctx.sampleRate);const a=sample.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=2*Math.random()-1}
 const src=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),env=ctx.createGain();
 src.buffer=sample;filter.type='highpass';filter.frequency.value=hz;env.gain.setValueAtTime(volume,t);env.gain.exponentialRampToValueAtTime(.0001,t+duration);
 src.connect(filter).connect(env).connect(output);src.start(t);src.stop(t+duration);
}
function start(){stop();const ctx=sound();output=ctx.createGain();output.connect(ctx.destination);bar=beat=0;next=ctx.currentTime+.035;el('play').textContent='Stop';tick();clock=setInterval(tick,25)}
el('play').onclick=()=>clock?stop():start();
for(const k of fields)el(k).onchange=()=>{if(el(k).type==='number')el(k).value=Math.round(number(k,+el(k).min,+el(k).max));persist();if(k==='meter'){if(clock)start();else indicators()}};
el('tap').onclick=()=>{const now=performance.now();if(now-taps.at(-1)>2200)taps=[];taps.push(now);taps=taps.slice(-6);if(taps.length>1){el('bpm').value=Math.max(30,Math.min(300,Math.round(60000*(taps.length-1)/(now-taps[0]))));persist()}};
indicators();window.addEventListener('pagehide',stop);
