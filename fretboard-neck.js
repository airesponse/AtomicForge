// Both apps render the same ordered set of drawing operations.
// SVG keeps Fretboard Art diagrams editable and printable at any scale.
const ForgeNeck = (() => {
  function layout(frets=15, strings=6) {
    const left=50, top=30, cell=1000/15, spacing=32;
    const right=left+frets*cell, bottom=top+(strings-1)*spacing;
    return {left,top,cell,spacing,right,bottom,width:right+50,height:bottom+30};
  }

  function draw(p, g, labels, frets, start=1, leftHanded=false, range=null) {
    const {left,top,right,bottom,width,height,cell,spacing}=g;
    const edge=i=>leftHanded?right-i*cell:left+i*cell;
    p.rect(0,0,width,height,'#18181b');
    for(let y=top;y<bottom;y+=4)p.rect(left,y,right-left,1.5,'rgba(255,255,255,0.02)');
    if(range)range();
    if(start===1)p.rect(leftHanded?right:left-6,top-2,6,bottom-top+4,'#e2e8f0');
    for(let i=0;i<frets;i++){
      const fret=start+i, x=edge(i+.5);
      if(fret%12===0){
        for(const fraction of [.3,.7])p.dot(x,top+(bottom-top)*fraction,6,'#3f3f46');
      }else if([3,5,7,9].includes(fret%12))p.dot(x,(top+bottom)/2,6,'#3f3f46');
    }
    for(let i=0;i<=frets;i++){
      p.line(edge(i),top,edge(i),bottom,'#71717a',2);
      if(i)p.text(edge(i-.5),height-8,String(start+i-1),'#71717a',11,'center');
    }
    labels.forEach((name,i)=>{
      const y=top+i*spacing;
      p.line(left-(leftHanded?0:6),y,right+(leftHanded?6:0),y,'#a1a1aa',1+i*.4);
      p.text(edge(0)+(leftHanded?12:-12),y+4,name,'#a1a1aa',12,leftHanded?'left':'right');
    });
  }
  function canvas(ctx){
    return {
      rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(x,y,w,h)},
      dot(x,y,r,c){ctx.fillStyle=c;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()},
      line(x,y,u,v,c,w){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(u,v);ctx.stroke()},
      text(x,y,t,c,size,align){ctx.fillStyle=c;ctx.font='600 '+size+'px Inter';ctx.textAlign=align;ctx.fillText(t,x,y)}
    };
  }
  function svg(parts,escapeText){
    return {
      rect(x,y,w,h,c){parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`)},
      dot(x,y,r,c){parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`)},
      line(x,y,u,v,c,w){parts.push(`<line x1="${x}" x2="${u}" y1="${y}" y2="${v}" stroke="${c}" stroke-width="${w}"/>`)},
      text(x,y,t,c,size,align){const anchor={left:'start',right:'end',center:'middle'}[align];parts.push(`<text x="${x}" y="${y}" fill="${c}" font-family="Inter, sans-serif" font-size="${size}" font-weight="600" text-anchor="${anchor}">${escapeText(t)}</text>`)}
    };
  }
  return {layout,draw,canvas,svg};
})();
