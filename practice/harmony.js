'use strict';
const ForgeHarmony=(()=>{
  const names=['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
  const types={'':[0,4,7],m:[0,3,7],'7':[0,4,7,10],maj7:[0,4,7,11],m7:[0,3,7,10],m7b5:[0,3,6,10],dim:[0,3,6],dim7:[0,3,6,9],aug:[0,4,8],sus2:[0,2,7],sus4:[0,5,7],'6':[0,4,7,9],m6:[0,3,7,9],add9:[0,4,7,14],'9':[0,4,7,10,14],m9:[0,3,7,10,14],maj9:[0,4,7,11,14],'7b9':[0,4,7,10,13],'7#9':[0,4,7,10,15],'13':[0,4,7,10,21],'5':[0,7]};
  const standard=[40,45,50,55,59,64];
  function pc(s){const m=/^([A-G])([b#]?)$/i.exec(s);return m?({C:0,D:2,E:4,F:5,G:7,A:9,B:11}[m[1].toUpperCase()]+(m[2]==='#'?1:m[2]==='b'?-1:0)+12)%12:null}
  function chord(s){const m=/^([A-G][#b]?)([^/]*)(?:\/([A-G][#b]?))?$/i.exec(s);if(!m||!Object.hasOwn(types,m[2]))throw Error('Unknown chord: '+s);
    return {name:s,root:pc(m[1]),quality:m[2],tones:types[m[2]].map(n=>(pc(m[1])+n)%12),bass:m[3]?pc(m[3]):null}}
  function note(n){return names[n%12]+(Math.floor(n/12)-1)}
  function tuning(str){const parsed=str.trim().split(/[ ,]+/).map(t=>{const m=/^([A-G][#b]?)([0-8])$/i.exec(t);if(!m)throw Error('Use pitches with octaves, for example E2 A2 D3 G3 B3 E4.');return pc(m[1])+(Number(m[2])+1)*12});if(parsed.length!==6)throw Error('Enter six open-string pitches, low string first.');return parsed}
  function shapes(c,tune,options){
    const {low,high,span,open,strings,minNotes,maxNotes,shell=false,top=null,bottom=null}=options;
    const required=new Set(c.tones);
    if(shell&&c.tones.length>=4){required.delete(c.root);if(types[c.quality].includes(7))required.delete((c.root+7)%12)}
    const allow=new Set(c.tones);if(c.bass!==null)allow.add(c.bass);
    const found=[],frets=Array(6).fill(-1),pitches=[];
    function visit(i,min,max){
      if(i===6){
        if(pitches.length<minNotes||pitches.length>maxNotes)return;
        const pcs=new Set(pitches.map(p=>p%12));
        if([...required].some(p=>!pcs.has(p))||shell&&pcs.size<Math.min(pitches.length,allow.size))return;
        const bass=Math.min(...pitches)%12,soprano=Math.max(...pitches)%12;
        if(c.bass!==null&&bass!==c.bass||bottom!==null&&bass!==bottom||top!==null&&soprano!==top)return;
        const spanUsed=max>min?max-min:0;
        found.push({frets:[...frets],pitches:[...pitches],rank:(max||0)*.42+spanUsed*2+(6-pitches.length)*.45+(bass===c.root?0:1.5)});return;
      }
      if(!strings.includes(i)){visit(i+1,min,max);return}
      if(!shell){frets[i]=-1;visit(i+1,min,max)}
      for(let f=low;f<=high;f++){
        const n=tune[i]+f;if((!open&&!f)||!allow.has(n%12)||pitches.length>=maxNotes)continue;
        const l=f?Math.min(min,f):min,h=f?Math.max(max,f):max;if(h-l>span)continue;
        frets[i]=f;pitches.push(n);visit(i+1,l,h);pitches.pop();
      }
      frets[i]=-1;
    }
    visit(0,Infinity,0);return found.sort((a,b)=>a.rank-b.rank);
  }
  function diagram(shape,tune){
    const fs=shape.frets,held=fs.filter(f=>f>0),first=Math.max(...held,0)<=5?1:Math.min(...held),rows=Math.max(5,...held.map(f=>f-first+1));
    const height=46+rows*19;
    const parts=[`<svg viewBox="0 0 152 ${height}" role="img" aria-label="Frets low to high ${fs.map(f=>f<0?'muted':f).join(', ')}">`];
    for(let j=0;j<=rows;j++)parts.push(`<path d="M24 ${28+19*j}h105" stroke="#8496a9" stroke-width="${!j&&first===1?4:1}"/>`);
    for(let i=0;i<6;i++){const x=24+21*i,f=fs[i];parts.push(`<path d="M${x} 28v${rows*19}" stroke="#8496a9"/>`);
      if(f<=0)parts.push(`<text x="${x}" y="20" text-anchor="middle" fill="#ced7e2">${f<0?'×':'○'}</text>`);
      else parts.push(`<circle cx="${x}" cy="${28+(f-first+.5)*19}" r="8" fill="#83ddbd"/>`);
    }
    if(first>1)parts.push(`<text x="0" y="42" font-size="12" fill="#ced7e2">${first}</text>`);
    return parts.join('')+'</svg>';
  }
  let ctx,amp;
  function silence(){amp?.disconnect();amp=null}
  function audition(chords,spacing=.75){
    silence();ctx??=new AudioContext();ctx.resume();amp=ctx.createGain();amp.connect(ctx.destination);
    chords.forEach((notes,k)=>notes.forEach((m,i)=>{
      const t=ctx.currentTime+.025+k*spacing+i*.024,osc=ctx.createOscillator(),env=ctx.createGain();
      osc.type='triangle';osc.frequency.value=440*2**((m-69)/12);env.gain.setValueAtTime(.0001,t);env.gain.exponentialRampToValueAtTime(.12,t+.01);env.gain.exponentialRampToValueAtTime(.0001,t+spacing*.93);
      osc.connect(env).connect(amp);osc.start(t);osc.stop(t+spacing);
    }));
  }
  return {names,types,standard,pc,chord,note,tuning,shapes,diagram,audition,silence};
})();
