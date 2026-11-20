(()=>{
 const H=ForgeHarmony,d=id=>document.getElementById('dict'+id);
 const tunings={'Standard':'E2 A2 D3 G3 B3 E4','Drop D':'D2 A2 D3 G3 B3 E4','DADGAD':'D2 A2 D3 G3 A3 D4','Open G':'D2 G2 D3 G3 B3 D4','Open D':'D2 A2 D3 F#3 A3 D4'};
 let tune=H.standard,results=[],index=0,selected=Array(6).fill(-1),symbol='';
 let saved=[];try{saved=JSON.parse(localStorage.getItem('forge.fingerings')||'[]')}catch{}
 function savedMenu(){d('Saved').replaceChildren(new Option('Saved fingerings',''),...saved.map((s,i)=>new Option(s.name+' · '+s.frets.map(f=>f<0?'×':f).join(' '),i)))}
 function message(t){d('Status').textContent=t}
 for(const [i,n] of H.names.entries()){d('Root').add(new Option(n,i));d('Bass').add(new Option(n,i))}
 for(const q of Object.keys(H.types))d('Quality').add(new Option(q||'Major',q));d('Quality').value='';
 Object.keys(tunings).forEach(k=>d('Tune').add(new Option(k,k)));d('Tune').add(new Option('Custom','Custom'));
 function applyTune(value){
   tune=H.tuning(value);d('Custom').value=tune.map(H.note).join(' ');
   // Scale Explorer uses the same six open pitches as the dictionary.
   guitarStrings.forEach((str,i)=>{const pitch=tune[5-i];str.note=H.names[pitch%12];str.octave=Math.floor(pitch/12)-1});
   selected.fill(-1);drawNeck();
 }
 function search(){
   try{
     const bass=d('Bass').value,root=Number(d('Root').value),quality=d('Quality').value;
     symbol=H.names[root]+quality+(bass===''?'':'/'+H.names[+bass]);const c=H.chord(symbol);
     results=H.shapes(c,tune,{low:+d('Low').value,high:+d('High').value,span:+d('Span').value,open:d('Open').checked,strings:[0,1,2,3,4,5],minNotes:+d('Min').value,maxNotes:6});
     index=0;show();
   }catch(e){message(e.message)}
 }
 function show(){
    d('Cards').replaceChildren();for(const id of ['Hear','Save','Add','Prev','Next'])d(id).disabled=!results.length;
    if(!results.length){message('No fingering meets these limits. Try a wider span or fewer required strings.');return}
    const shape=results[index],first=Math.floor(index/6)*6;
    results.slice(first,first+6).forEach((variant,offset)=>{
      const card=document.createElement('button');card.type='button';card.className='lab-shape';
      card.setAttribute('aria-pressed',String(first+offset===index));
      const heading=document.createElement('strong');heading.textContent=symbol;card.append(heading);
      card.insertAdjacentHTML('beforeend',H.diagram(variant,tune));
      const notes=document.createElement('p');notes.textContent=variant.pitches.map(H.note).join(' · ');card.append(notes);
      card.onclick=()=>{index=first+offset;show();d('Cards').children[offset].focus()};d('Cards').append(card);
    });
    message('Fingering '+(index+1)+' of '+results.length+' · low to high: '+shape.frets.map(n=>n<0?'×':n).join(' '));
 }
 function drawNeck(){
    const neck=d('Neck');neck.replaceChildren();
    for(let i=5;i>=0;i--){const row=document.createElement('div');for(let f=0;f<=15;f++){
      const b=document.createElement('button');b.type='button';b.textContent=f===0?H.note(tune[i]):String(f);b.setAttribute('aria-label','String '+(6-i)+', fret '+f+', '+H.note(tune[i]+f));b.setAttribute('aria-pressed',String(selected[i]===f));b.onclick=()=>{selected[i]=selected[i]===f?-1:f;drawNeck()};row.append(b)
    }neck.append(row)}
    const pitches=tune.flatMap((p,i)=>selected[i]<0?[]:[p+selected[i]]),pcs=[...new Set(pitches.map(p=>p%12))];
    const matches=d('Matches');matches.replaceChildren();if(!pcs.length){matches.textContent='Tap the strings you play. Tap a selected position again to mute it.';return}
    const bass=Math.min(...pitches)%12,ranked=[];
    const formulas=d('Reverse').value==='scales'?{' major':[0,2,4,5,7,9,11],' Dorian':[0,2,3,5,7,9,10],' Mixolydian':[0,2,4,5,7,9,10],' natural minor':[0,2,3,5,7,8,10],' major pentatonic':[0,2,4,7,9],' minor pentatonic':[0,3,5,7,10],' blues':[0,3,5,6,7,10]}:H.types;
    for(let r=0;r<12;r++)for(const [q,steps] of Object.entries(formulas)){const tones=steps.map(s=>(r+s)%12);if(!pcs.every(p=>tones.includes(p)))continue;
      ranked.push({r,q,missing:tones.length-pcs.length,bass:r===bass?0:1})}
    ranked.sort((a,b)=>a.missing-b.missing||a.bass-b.bass);
    for(const m of ranked.slice(0,10)){const text=H.names[m.r]+m.q+(m.missing?' (+'+m.missing+' tones)':'');if(d('Reverse').value==='scales'){const item=document.createElement('span');item.textContent=text;matches.append(item);continue}
      const b=document.createElement('button');b.textContent=text;b.onclick=()=>{d('Root').value=m.r;d('Quality').value=m.q;d('Bass').value=m.r===bass?'':bass;search()};matches.append(b)}
    if(!ranked.length)matches.textContent='No matching formula in this dictionary.';
 }
 d('Tune').onchange=()=>{d('Custom').disabled=d('Tune').value!=='Custom';if(!d('Custom').disabled){d('Custom').focus();return}applyTune(tunings[d('Tune').value]);search()};
 d('Custom').onchange=()=>{try{applyTune(d('Custom').value);search()}catch(e){message(e.message)}};
 for(const id of ['Root','Quality','Bass','Low','High','Min','Open','Span'])d(id).onchange=search;
 d('Prev').onclick=()=>{index=(index+results.length-1)%results.length;show()};d('Next').onclick=()=>{index=(index+1)%results.length;show()};
 d('Hear').onclick=()=>H.audition([results[index].pitches],1.45);
 d('HearReverse').onclick=()=>{const pitches=tune.flatMap((n,i)=>selected[i]<0?[]:[n+selected[i]]);if(pitches.length)H.audition([pitches],1.45)};
 d('Clear').onclick=()=>{selected.fill(-1);drawNeck()};d('Reverse').onchange=drawNeck;
 d('Save').onclick=()=>{const entry={name:symbol,tune:[...tune],frets:results[index].frets};if(!saved.some(s=>JSON.stringify(s)===JSON.stringify(entry)))saved.push(entry);
   try{localStorage.setItem('forge.fingerings',JSON.stringify(saved));savedMenu();message('Saved '+symbol+' with its tuning and exact fingering.')}catch{message('Storage unavailable.')}};
 d('Saved').onchange=()=>{if(d('Saved').value==='')return;const s=saved[+d('Saved').value];const c=H.chord(s.name);d('Root').value=c.root;d('Quality').value=c.quality;d('Bass').value=c.bass??'';
   d('Tune').value=Object.keys(tunings).find(k=>H.tuning(tunings[k]).join()===s.tune.join())||'Custom';d('Custom').disabled=d('Tune').value!=='Custom';applyTune(s.tune.map(H.note).join(' '));
   symbol=s.name;index=0;results=[{frets:s.frets,pitches:s.frets.flatMap((f,i)=>f<0?[]:[tune[i]+f])}];show()};
 d('Add').onclick=()=>{getUserData().customProgression.push({name:symbol,notes:results[index].pitches.map(H.note)});saveStorage();renderProgressionCanvas();message('Added this voicing to the progression in Chord Playground.')};
 savedMenu();applyTune(tunings.Standard);search();
})();
