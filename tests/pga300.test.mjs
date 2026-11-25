import test from 'node:test';
import assert from 'node:assert/strict';
import {matrix,solve,predict,verify,linearCandidate} from '../pga300-core.mjs';
const spec={min:0,max:100,pCount:4,temperatures:[-20,20,60,100],dacLow:1000,dacHigh:13000};
test('4P4T matrix',()=>assert.equal(matrix(spec).length,16));
test('recover cubic tensor model',()=>{const rows=matrix(spec).map((x,i)=>{const p=(i%4)*1000,t=Math.floor(i/4)*1000;return {...x,p,t,target:1000+p*2+t*.5+p*p*t/1e7+p**3/1e8+t**3/1e9}});const f=solve(rows,3,3);assert.ok(f.maxError<1e-7);assert.ok(Math.abs(predict(f,1500,1500)-(1000+3000+750+1500**3/1e7+1500**3/1e8+1500**3/1e9))<1e-7)});
test('reject duplicate and incomplete',()=>{assert.throws(()=>solve([{p:1,t:2,target:0},{p:1,t:2,target:10}],1,0));assert.throws(()=>solve(matrix(spec),3,3))});
test('TI linear example and independent verification',()=>{const rows=[{p:0,t:0,target:0},{p:30000,t:0,target:15000}];const f=solve(rows,1,0);assert.equal(linearCandidate(f).g0,8192);assert.equal(linearCandidate(f).h0,0);assert.equal(verify(f,rows,[{p:10000,t:0,target:5000}],1).pass,true);assert.equal(verify(f,rows,[{p:10000,t:0,target:5100}],1).pass,false);assert.throws(()=>verify(f,rows,[rows[0]],1));assert.equal(verify(f,rows,[{p:-1,t:0,target:0}],1).pass,false)});
test('invalid ranges',()=>assert.throws(()=>matrix({...spec,dacHigh:16384})));
