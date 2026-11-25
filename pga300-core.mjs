// PGA300 floating-point planning model, TI SLDS204D eq. 4.
// Normalized ADC inputs are NOT the chip's fixed-point register representation.
export const presets={quick:[2,1],temperature:[2,3],nonlinear:[3,3],full:[4,4]};
export function matrix({min,max,pCount,temperatures,dacLow,dacHigh}){
 if(![min,max,dacLow,dacHigh].every(Number.isFinite)||max<=min||dacLow<0||dacHigh>16383||dacHigh<=dacLow||!Number.isInteger(pCount)||pCount<2||pCount>5||!Array.isArray(temperatures)||temperatures.length<1||temperatures.length>4||temperatures.some((t,i)=>!Number.isFinite(t)||t< -40||t>150||(i>0&&t<=temperatures[i-1])))throw Error('Ungültiger Druck-, Temperatur- oder DAC-Bereich.');
 return temperatures.flatMap((temperature,j)=>Array.from({length:pCount},(_,i)=>({id:j+'-'+i,temperature,pressure:min+(max-min)*i/(pCount-1),target:dacLow+(dacHigh-dacLow)*i/(pCount-1),p:null,t:null})));
}
export function validADC(v){return Number.isInteger(v)&&v>=-32768&&v<=32767}
const finite=Number.isFinite;
function basis(p,t,po,to){return Array.from({length:po+1},(_,i)=>Array.from({length:to+1},(_,j)=>p**i*t**j)).flat()}
function scale(values,used){const min=Math.min(...values),max=Math.max(...values);if(used&&max===min)throw Error('ADC-Werte sind nicht unabhängig.');return {center:(min+max)/2,span:used?(max-min)/2:1}}
export function predict(model,p,t){
 if(!validADC(p)||!validADC(t))throw Error('PADC und TADC als signed 16-bit Dezimalwerte eingeben.');
 const b=basis((p-model.ps.center)/model.ps.span,(t-model.ts.center)/model.ts.span,model.po,model.to);
 return b.reduce((s,v,i)=>s+v*model.coefficients[i],0)
}
export function solve(points,po,to){
 if(!Number.isInteger(po)||po<1||po>3||!Number.isInteger(to)||to<0||to>3)throw Error('Ungültige Polynomordnung.');
 const n=(po+1)*(to+1);
 if(points.length<n||points.some(x=>!validADC(x.p)||!validADC(x.t)||!finite(x.target)||x.target<0||x.target>16383))throw Error('Alle Messpunkte vollständig und gültig erfassen.');
 const ps=scale(points.map(x=>x.p),true),ts=scale(points.map(x=>x.t),to>0);
 const A=points.map(x=>basis((x.p-ps.center)/ps.span,(x.t-ts.center)/ts.span,po,to));
 // Modified Gram-Schmidt with reorthogonalization, no normal equations.
 const Q=[],R=Array.from({length:n},()=>Array(n).fill(0)),dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 for(let j=0;j<n;j++){
   let v=A.map(row=>row[j]);
   for(let pass=0;pass<2;pass++)for(let i=0;i<j;i++){const z=dot(Q[i],v);R[i][j]+=z;v=v.map((x,k)=>x-z*Q[i][k])}
   R[j][j]=Math.hypot(...v);if(R[j][j]<1e-8*Math.sqrt(points.length))throw Error('Messmatrix singulär oder schlecht konditioniert.');
   Q.push(v.map(x=>x/R[j][j]));
 }
 const y=points.map(x=>x.target),z=Q.map(q=>dot(q,y)),coefficients=Array(n).fill(0);
 for(let j=n-1;j>=0;j--)coefficients[j]=(z[j]-R[j].slice(j+1).reduce((s,x,k)=>s+x*coefficients[j+1+k],0))/R[j][j];
 const model={po,to,ps,ts,coefficients};
 const residuals=points.map(x=>predict(model,x.p,x.t)-x.target);
 if(![...coefficients,...residuals].every(finite))throw Error('Nicht endliches Rechenergebnis.');
 return {...model,residuals,maxError:Math.max(...residuals.map(Math.abs)),rms:Math.hypot(...residuals)/Math.sqrt(residuals.length)};
}
export function verify(model,cal,rows,tolerance){
 if(!finite(tolerance)||tolerance<=0||!rows.length)throw Error('Positive Toleranz und Prüfpunkte erforderlich.');
 const checks=rows.map(x=>{
  if(!validADC(x.p)||!validADC(x.t)||!finite(x.target)||x.target<0||x.target>16383)throw Error('Prüfpunkt unvollständig.');
  if(cal.some(c=>c.p===x.p&&(model.to===0||c.t===x.t)))throw Error('Prüfpunkt muss unabhängig von den Fit-Punkten sein.');
  const predicted=predict(model,x.p,x.t),error=predicted-x.target;
  const inRange=Math.abs(x.p-model.ps.center)<=model.ps.span&&(model.to===0||Math.abs(x.t-model.ts.center)<=model.ts.span);
  return {...x,predicted,error,inRange,pass:inRange&&predicted>=0&&predicted<=16383&&Math.abs(error)<=tolerance};
 });
 return {checks,pass:checks.every(x=>x.pass),tolerance};
}
export function linearCandidate(model){
 if(model.po!==1||model.to!==0)return null;
 const gain=model.coefficients[1]/model.ps.span,offset=model.coefficients[0]-gain*model.ps.center;
 const h0=Math.round(offset/4),g0=Math.round(gain*16384);
 return {gain,offset,h0,g0,representable:[h0,g0].every(x=>Number.isInteger(x)&&x>=-32768&&x<=32767),assumption:'Identity digital gain/offset; Eq. 5 only; not a programming image'};
}
