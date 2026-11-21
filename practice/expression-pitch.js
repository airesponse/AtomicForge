'use strict';
// Average samples before reducing the rate. Use a fixed comparison window for every lag.
function expressionPitch(input, sampleRate) {
  const stride = Math.max(1, Math.floor(sampleRate / 12000));
  const rate = sampleRate / stride;
  const start = Math.max(0, input.length - Math.ceil(sampleRate * .042));
  const x = new Float32Array(Math.floor((input.length-start) / stride));
  let energy = 0;
  for (let i=0; i<x.length; i++) {
    for (let j=0; j<stride; j++) x[i] += input[start+i*stride+j]/stride;
    energy += x[i]*x[i];
  }
  if (energy/x.length < 0.000008) return null;
  const max = Math.min(Math.floor(rate/55), Math.floor(x.length/2)-1);
  const min = Math.max(2, Math.floor(rate/1950));
  const delta = new Float32Array(max+1);
  let sum = 0;
  for (let lag=1; lag<=max; lag++) {
    let diff = 0;
    for (let i=0; i<x.length-max; i++) diff += (x[i]-x[i+lag])**2;
    sum += diff;
    delta[lag] = sum ? diff*lag/sum : 1;
    const j = lag-1;
    if (j>=min && delta[j]<.16 && delta[j]<=delta[j-1] && delta[j]<=delta[lag]) {
      const curve = delta[j-1]-2*delta[j]+delta[lag];
      return rate/(j+(curve ? (delta[j-1]-delta[lag])/(2*curve) : 0));
    }
  }
  return null;
}
function vibratoStats(points) {
  if (points.length<12 || points.at(-1).t-points[0].t<.7) return null;
  const values=points.map(p=>p.c).sort((a,b)=>a-b);
  const low=values[Math.floor(values.length*.05)], high=values[Math.floor(values.length*.95)];
  const width=high-low, mid=(low+high)/2, crossings=[];
  if (width<9) return null;
  let armed=false;
  for (let i=1;i<points.length;i++) {
    const a=points[i-1], b=points[i];
    if (a.c<mid-width*.14) armed=true;
    if (armed && a.c<=mid && b.c>mid) {
      crossings.push(a.t+(b.t-a.t)*(mid-a.c)/(b.c-a.c));armed=false;
    }
  }
  if (crossings.length<3) return null;
  const periods=crossings.slice(1).map((t,i)=>t-crossings[i]).sort((a,b)=>a-b);
  const period=periods[Math.floor(periods.length/2)];
  if(period<.075 || period>.55) return null;
  return {width,rate:1/period,low};
}
