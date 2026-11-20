(()=>{
 const H=ForgeHarmony,g=id=>document.getElementById('guide'+id);
 let routes=[],current=0,layers=[],chords=[];
 function build(pin=false){
  try{
   const tokens=g('Chords').value.trim().split(/[\s,|]+/);if(tokens.length<2||tokens.length>16)throw Error('Enter 2–16 chord symbols.');
   chords=tokens.map(H.chord);const strings=g('Strings').value.split('').map(n=>6-Number(n)).sort((a,b)=>a-b);
   const top=g('Top').value.trim().split(/[\s,]+/),bass=g('Bass').value.trim().split(/[\s,]+/);
   function line(arr,i){if(!arr[0])return null;if(arr.length!==1&&arr.length!==chords.length)throw Error('Enter one pitch for all chords or one per chord. Use * for a free voice.');const n=arr.length===1?arr[0]:arr[i];if(n==='*')return null;const v=H.pc(n);if(v===null)throw Error('Use note names such as F, Bb, or *.');return v}
   layers=chords.map((c,i)=>H.shapes(c,H.standard,{low:+g('Low').value,high:+g('High').value,span:+g('Span').value,open:true,strings,minNotes:strings.length,maxNotes:strings.length,shell:true,top:line(top,i),bottom:line(bass,i)}));
   const missing=layers.findIndex(a=>!a.length);if(missing>=0)throw Error('No voicing fits '+tokens[missing]+'. Widen the fret range or relax the voice limits.');
   const starting=pin?g('Start').value:'';
   g('Start').replaceChildren(new Option('Automatic',''),...layers[0].map((s,i)=>new Option(s.frets.map(f=>f<0?'×':f).join(' '),i)));g('Start').value=starting;
   let paths=layers[0].map((shape,i)=>({shape,path:[shape],cost:shape.rank*.05})).filter((_,i)=>!starting||i===+starting);
   for(const next of layers.slice(1)){
    const candidates=[];
    for(const shape of next){
      const endings=[];
      for(const prev of paths){
        if(g('Common').checked&&prev.shape.pitches.some((p,i)=>shape.pitches.includes(p)&&shape.pitches[i]!==p))continue;
        const moves=shape.pitches.map((p,i)=>Math.abs(p-prev.shape.pitches[i]));
        endings.push({shape,path:[...prev.path,shape],cost:prev.cost+moves.reduce((a,b)=>a+b,0)+Math.max(...moves)*.3});
      }
      endings.sort((a,b)=>a.cost-b.cost);candidates.push(...endings.slice(0,3));
    }
    paths=candidates;
   }
   routes=paths.sort((a,b)=>a.cost-b.cost).slice(0,12);
   if(!routes.length)throw Error('No connected route fits those common-tone constraints.');
   current=0;show();
  }catch(e){routes=[];g('Cards').replaceChildren();g('Status').textContent=e.message;g('Play').disabled=g('Next').disabled=true}
 }
 function show(){const path=routes[current].path;g('Play').disabled=false;g('Next').disabled=routes.length<2;
   g('Status').textContent='Route '+(current+1)+' of '+routes.length+' · motion shown in semitones, low voice first.';
   g('Cards').replaceChildren(...path.map((shape,i)=>{const card=document.createElement('div');card.className='lab-shape';
     const label=document.createElement('strong');label.textContent=chords[i].name;card.append(label);
     card.insertAdjacentHTML('beforeend',H.diagram(shape,H.standard));
     const notes=document.createElement('div');notes.textContent=shape.pitches.map(H.note).join(' · ');card.append(notes);
     if(i){const motion=document.createElement('small');motion.textContent=shape.pitches.map((p,j)=>{const d=p-path[i-1].pitches[j];return d>0?'+'+d:String(d)}).join(' / ');card.append(motion)}
     return card}));
 }
 g('Build').onclick=()=>build(false);g('Start').onchange=()=>build(true);
 g('Next').onclick=()=>{current=(current+1)%routes.length;show()};g('Play').onclick=()=>H.audition(routes[current].path.map(s=>s.pitches),60/Math.max(30,Math.min(240,+g('Bpm').value||80))*2);
 g('Stop').onclick=H.silence;
 for(const id of ['Chords','Top','Bass','Strings','Low','High','Span','Common'])g(id).onchange=()=>build(false);
 build();
})();
