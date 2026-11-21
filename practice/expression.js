'use strict';
const pitches=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
pitches.forEach((n,i)=>el('note').add(new Option(n,i)));
const defaults={note:'7',octave:'3',interval:'200',hold:'.5',tolerance:'15',width:'50',rate:'5'};
const settings=readSetting('forge.expression',{})||{};
for(const [key,fallback] of Object.entries(defaults)){
  const field=el(key);field.value=settings[key]??fallback;if(field.selectedIndex<0)field.value=fallback;
}
let mode=settings.mode==='vibrato'?'vibrato':'bend', source='idle', stream, inputNode, analyser, buffer, animation;
let generation=0, history=[], lastTime=0, armed=false, holding=null, completed=false, since=0, ignoreUntil=0;
const baseMidi=()=>12*(1+Number(el('octave').value))+Number(el('note').value);
const frequency=midi=>440*2**((midi-69)/12);
const noteName=midi=>pitches[midi%12]+(Math.floor(midi/12)-1);
const centsText=n=>(Math.round(n)>0?'+':'')+Math.round(n);
function reset(){
  history=[];armed=false;holding=null;completed=false;lastTime=0;since=performance.now()/1000;
  for(const id of ['detected','measure','second'])el(id).textContent='—';
  el('feedback').textContent='';draw(since);
}
function setup(){
  const bend=mode==='bend', base=baseMidi(), interval=Number(el('interval').value);
  el('bend').setAttribute('aria-pressed',bend);el('vibrato').setAttribute('aria-pressed',!bend);
  document.querySelectorAll('.bend-field').forEach(n=>n.hidden=!bend);
  document.querySelectorAll('.vib-field').forEach(n=>n.hidden=bend);
  const target=interval%100?noteName(base)+' +50 cents':noteName(base+interval/100);
  el('goal').textContent=bend?noteName(base)+' → '+target:noteName(base)+' vibrato';
  el('instruction').textContent=bend?'Play the starting note, bend up to the target and hold it steady.':'Start on the selected note. Bend up and release in an even pulse. Width is measured from trough to peak.';
  el('measureLabel').textContent=bend?'Distance from target':'Width · peak to peak';
  el('secondLabel').textContent=bend?'Hold time':'Rate';
  reset();
}
function save(){
  const data={mode};for(const id of Object.keys(defaults))data[id]=el(id).value;
  saveSetting('forge.expression',data);setup();
}
for(const id of Object.keys(defaults))el(id).onchange=save;
for(const id of ['bend','vibrato'])el(id).onclick=()=>{mode=id;save()};
function draw(now){
  const canvas=el('trace'), ratio=window.devicePixelRatio||1,w=canvas.clientWidth,h=canvas.clientHeight;
  if(!w||!h)return;
  if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio)}
  const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
  const bend=mode==='bend',goal=Number(el(bend?'interval':'width').value),margin=Math.max(28,goal*.28);
  const y=c=>h-10-(c+margin)*(h-20)/(goal+2*margin);
  if(bend){const tol=Number(el('tolerance').value);ctx.fillStyle='#284139';ctx.fillRect(0,y(goal+tol),w,y(goal-tol)-y(goal+tol))}
  for(const n of [0,goal]){
    ctx.strokeStyle='#627483';ctx.beginPath();ctx.moveTo(0,y(n));ctx.lineTo(w,y(n));ctx.stroke();
    ctx.fillStyle='#dae1e9';ctx.font='12px system-ui';ctx.fillText(n+' ¢',5,y(n)-4);
  }
  ctx.strokeStyle='#c4a1ff';ctx.lineWidth=2;ctx.beginPath();
  let last=null;
  for(const p of history){const x=w*(1-(now-p.t)/4);if(p.c===null){last=null;continue}
    if(!last||p.t-last.t>.12)ctx.moveTo(x,y(p.c));else ctx.lineTo(x,y(p.c));last=p}
  ctx.stroke();ctx.lineWidth=1;
}
function processPitch(t,hz){
  const cents=hz?1200*Math.log2(hz/frequency(baseMidi())):null;
  history.push({t,c:cents});while(history.length&&history[0].t<t-4)history.shift();
  if(cents===null||t-lastTime>.14){holding=null;armed=false}
  lastTime=t;
  if(cents===null){
    for(const id of ['detected','measure','second'])el(id).textContent='—';
    el('feedback').textContent=completed?'Bend landed. Play the starting note to try again.':'Play one clear note.';
  }else{
    el('detected').textContent=noteName(Math.max(0,Math.round(baseMidi()+cents/100)));
    if(mode==='bend'){
      const error=cents-Number(el('interval').value), tol=Number(el('tolerance').value);
      if(Math.abs(cents)<=Math.min(30,Number(el('interval').value)/3)){armed=true;completed=false}
      if(armed&&Math.abs(error)<=tol)holding??=t;else holding=null;
      const elapsed=holding===null?0:t-holding;
      if(elapsed>=Number(el('hold').value)){completed=true;armed=false}
      el('measure').textContent=centsText(error)+' ¢';
      el('second').textContent=completed?Number(el('hold').value)+' s ✓':elapsed.toFixed(2)+' s';
      el('feedback').textContent=completed?'Bend landed. Release to the starting note.':!armed?'Play the starting note first.':holding!==null?'On target · hold steady':error<0?'Bend higher':'Ease the bend down';
    }else{
      let start=history.length-1;
      while(start>0 && t-history[start-1].t<1.6 && history[start-1].c!==null && history[start].t-history[start-1].t<.12)start--;
      const stats=vibratoStats(history.slice(start)), width=Number(el('width').value),rate=Number(el('rate').value);
      el('measure').textContent=stats?Math.round(stats.width)+' ¢':'—';
      el('second').textContent=stats?stats.rate.toFixed(1)+' Hz':'—';
      el('feedback').textContent=!stats?'Keep a few even cycles going.':Math.abs(stats.low)>30?'Return to the starting pitch.':Math.abs(stats.width-width)>Math.max(7,width*.16)?(stats.width<width?'Widen the vibrato.':'Narrow the vibrato.'):Math.abs(stats.rate-rate)>.5?(stats.rate<rate?'Increase the rate.':'Slow the rate.'): 'Width and rate on target.';
    }
  }
  draw(t);
}
function tick(ms){
  const t=ms/1000;
  if(t-lastTime>=.018){
    let hz=null;
    if(source==='demo'){
      const phase=(t-since)%3, bend=Number(el('interval').value);
      const cents=mode==='bend'?bend*Math.min(1,Math.max(0,(phase-.45)/.55),Math.max(0,(2.7-phase)/.55)):Number(el('width').value)*(1-Math.cos((t-since)*2*Math.PI*Number(el('rate').value)))/2;
      hz=frequency(baseMidi()+cents/100);
    }else if(source==='mic'&&t>=ignoreUntil){analyser.getFloatTimeDomainData(buffer);hz=expressionPitch(buffer,audioContext.sampleRate)}
    processPitch(t,hz);
  }
  animation=requestAnimationFrame(tick);
}
function stop(){
  generation++;cancelAnimationFrame(animation);inputNode?.disconnect();inputNode=null;
  stream?.getTracks().forEach(track=>{track.onended=null;track.stop()});stream=null;analyser=null;
  source='idle';el('listen').textContent='Start listening';el('demo').textContent='Try demo';reset();
  el('status').textContent='Ready.';
}
async function listen(){
  if(source==='mic'||source==='pending'){stop();return}
  stop();const token=generation;source='pending';el('listen').textContent='Cancel';el('status').textContent='Waiting for audio input permission…';
  try{
    const ctx=sound();await ctx.resume();
    if(token!==generation)return;
    if(!navigator.mediaDevices?.getUserMedia)throw Error('Audio input is unavailable in this browser.');
    const capture=await navigator.mediaDevices.getUserMedia({audio:{...(el('device').value?{deviceId:{exact:el('device').value}}:{}),echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
    if(token!==generation){capture.getTracks().forEach(tr=>tr.stop());return}
    stream=capture;
    navigator.mediaDevices.enumerateDevices().then(devices=>{
      if(token!==generation)return;
      const menu=el('device'),selected=menu.value;
      menu.replaceChildren(new Option('System default',''));
      for(const device of devices.filter(d=>d.kind==='audioinput'&&d.deviceId&&d.deviceId!=='default'))menu.add(new Option(device.label||'Input '+menu.options.length,device.deviceId));
      menu.value=selected;
    }).catch(()=>{});
    analyser=ctx.createAnalyser();analyser.fftSize=4096;buffer=new Float32Array(analyser.fftSize);
    inputNode=ctx.createMediaStreamSource(stream);inputNode.connect(analyser);
    stream.getAudioTracks()[0].onended=()=>{stop();el('status').textContent='Audio input disconnected.'};
    source='mic';el('listen').textContent='Stop listening';el('status').textContent='Listening · '+(stream.getAudioTracks()[0].label||'audio input');animation=requestAnimationFrame(tick);
  }catch(error){if(token===generation){stop();el('status').textContent=error.name==='NotAllowedError'?'Microphone access was denied. Allow it for this site or use Try demo.':error.message}}
}
el('listen').onclick=listen;
el('device').onchange=()=>{if(source==='mic'){stop();listen()}};
el('demo').onclick=()=>{const running=source==='demo';stop();if(running)return;source='demo';el('demo').textContent='Stop demo';el('status').textContent='Demo · simulated guitar pitch';animation=requestAnimationFrame(tick)};
el('reference').onclick=()=>{
  const ctx=sound(), t=ctx.currentTime+.04,hz=frequency(baseMidi());ignoreUntil=performance.now()/1000+2.05;
  if(mode==='bend'){tone(ctx,t,hz,.6,.14,'triangle');tone(ctx,t+.72,hz*2**(Number(el('interval').value)/1200),1,.14,'triangle')}
  else{
    const osc=ctx.createOscillator(),env=ctx.createGain(),width=Number(el('width').value),rate=Number(el('rate').value);
    osc.type='triangle';osc.frequency.value=hz;
    for(let i=0;i<=360;i++)osc.detune.setValueAtTime(width*(1-Math.cos(2*Math.PI*rate*i/200))/2,t+i/200);
    env.gain.setValueAtTime(.001,t);env.gain.linearRampToValueAtTime(.14,t+.02);env.gain.exponentialRampToValueAtTime(.001,t+1.8);
    osc.connect(env).connect(ctx.destination);osc.start(t);osc.stop(t+1.81);
  }
};
window.addEventListener('resize',()=>draw(performance.now()/1000));window.addEventListener('pagehide',stop);setup();
