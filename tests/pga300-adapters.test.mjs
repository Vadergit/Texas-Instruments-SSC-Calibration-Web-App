import test from 'node:test';
import assert from 'node:assert/strict';
import {identifyAdapter} from '../pga300-hardware.mjs';
import {EvmBridge} from '../pga300-evm.mjs';
test('all three programmer identities',async()=>{for(const [selected,actual] of Object.entries({esp32:'ESP32-C3',promicro:'PRO-MICRO',evm:'TI-USB2ANY'})){let calls=[];const t={async request(s){calls.push(s);return actual}};assert.equal(await identifyAdapter(t,selected),actual);assert.equal(calls.join(','),'INFO')}});
test('wrong board rejected before ACT',async()=>{let calls=[];const t={async request(s){calls.push(s);return 'PRO-MICRO'}};await assert.rejects(identifyAdapter(t,'esp32'));assert.equal(calls.join(','),'INFO')});
test('local EVM transport serializes commands and includes token',async()=>{const old=globalThis.fetch;const calls=[];globalThis.fetch=async (url,opts)=>{const c=JSON.parse(opts.body).command;calls.push(c);assert.equal(url,'/api/usb2any/command');assert.equal(opts.headers['X-PGA-Token'],'test-token');return {ok:true,async json(){return {ok:true,data:c==='INFO'?'TI-USB2ANY':''}}}};try{const t=new EvmBridge('test-token');const [id]=await Promise.all([t.request('INFO'),t.request('HELLO'),t.request('ACT')]);assert.equal(id,'TI-USB2ANY');await t.close();assert.equal(calls.join(','),'INFO,HELLO,ACT,CLOSE');await assert.rejects(t.request('R 00 0C'))}finally{globalThis.fetch=old}});
