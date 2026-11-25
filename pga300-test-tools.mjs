// Numerical test candidates, not a silicon bit-exact emulator.
// SLDS204D eq. 4/5 and SLDU022 p.55 disagree on constant term scaling.
// Report both conventions. No automatic TC/NL programming authorization.
const keys=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>'hgnm'[i]+j)).flat();
const binom=(n,k)=>[[1],[1,1],[1,2,1],[1,3,3,1]][n][k];
export function q14Candidate(model,rows=[]){
 if(!model||!Number.isInteger(model.po)||model.po<1||model.po>3||!Number.isInteger(model.to)||model.to<0||model.to>3||!Number.isFinite(model.ps?.span)||model.ps.span<=0||!Number.isFinite(model.ts?.span)||model.ts.span<=0||model.coefficients?.length!==(model.po+1)*(model.to+1)||!model.coefficients.every(Number.isFinite))throw Error('Ungültiges Modell');
 const p=[-model.ps.center/model.ps.span,16384/model.ps.span],t=[-model.ts.center/model.ts.span,16384/model.ts.span],raw=Array(16).fill(0);
 for(let i=0;i<=model.po;i++)for(let j=0;j<=model.to;j++)for(let a=0;a<=i;a++)for(let b=0;b<=j;b++)raw[4*a+b]+=model.coefficients[i*(model.to+1)+j]*binom(i,a)*p[0]**(i-a)*p[1]**a*binom(j,b)*t[0]**(j-b)*t[1]**b;
 const rounded=raw.map(x=>Math.round(x)),representable=rounded.every(x=>Number.isInteger(x)&&x>=-32768&&x<=32767);
 const coeff=Object.fromEntries(keys.map((k,i)=>[k,rounded[i]]));
 const errors=rows.map(x=>evaluateCandidate(coeff,x.p,x.t)-x.target);
 return {convention:'SLDU022 normalized Q14 candidate; constant-term conflict with SLDS204D eq.5',coeff,representable,maxError:errors.length?Math.max(...errors.map(Math.abs)):null,errors,programmingAllowed:false};
}
export function evaluateCandidate(coeff,p,t){
 if(![p,t].every(x=>Number.isInteger(x)&&x>=-32768&&x<=32767)||keys.some(k=>!Number.isFinite(coeff[k])))throw Error('Ungültige ADC-/Koeffizientenwerte');
 return keys.reduce((s,k,i)=>s+coeff[k]*(p/16384)**Math.floor(i/4)*(t/16384)**(i%4),0);
}
export function compareReference(candidate,ref){
 if(!ref||keys.some(k=>!Number.isInteger(ref[k])||ref[k]<-32768||ref[k]>32767))throw Error('Alle 16 TI-Referenzwörter als signed 16-bit erforderlich.');
 const differences=keys.map(k=>({key:k,candidate:candidate.coeff[k],reference:ref[k],delta:candidate.coeff[k]-ref[k]}));
 return {differences,match:differences.every(x=>x.delta===0),programmingAllowed:false};
}
export function outputCalibration({code1,code2,actual1,actual2,desiredLow,desiredHigh}){
 if(![code1,code2].every(x=>Number.isInteger(x)&&x>=0&&x<=16383)||code2<=code1||![actual1,actual2,desiredLow,desiredHigh].every(Number.isFinite)||actual2<=actual1||desiredHigh<=desiredLow)throw Error('Zwei steigende DAC-Codes und reale Ausgangsmessungen erforderlich.');
 const slope=(actual2-actual1)/(code2-code1),offset=actual1-slope*code1;
 const low=Math.round((desiredLow-offset)/slope),high=Math.round((desiredHigh-offset)/slope);
 if(low<0||high>16383||low>=high)throw Error('Zielbereich nicht erreichbar.');
 return {low,high,slope,offset,lowError:offset+low*slope-desiredLow,highError:offset+high*slope-desiredHigh};
}
export function verifyAnalog(rows,tol){
 if(!Number.isFinite(tol)||tol<=0||!Array.isArray(rows)||rows.length<2||rows.some(x=>![x.reference,x.target,x.actual].every(Number.isFinite))||new Set(rows.map(x=>x.reference)).size<2)throw Error('Mindestens zwei unabhängige Referenzen mit Soll-/Istwert und positiver Toleranz erforderlich.');
 const checks=rows.map(x=>({...x,error:x.actual-x.target,pass:Math.abs(x.actual-x.target)<=tol}));return {checks,pass:checks.every(x=>x.pass),maxError:Math.max(...checks.map(x=>Math.abs(x.error)))};
}
export function decodeDiag(v){if(!Number.isInteger(v)||v<0||v>255)throw Error('Diagnosebyte ungültig');return ['INP_OV','INP_UV','INT_OV',null,'PGAIN_OV','PGAIN_UV','TGAIN_OV','TGAIN_UV'].filter((k,i)=>k&&(v&(1<<i)))}
