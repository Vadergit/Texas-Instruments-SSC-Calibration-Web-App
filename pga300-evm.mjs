// Local TI SDK transport. Same origin only; never contact an arbitrary remote host.
export class EvmBridge {
 constructor(token){this.token=token;this.queue=Promise.resolve();this.closed=false}
 static async open(){
  if(location.hostname!=='127.0.0.1'||location.port!=='8765')throw Error('TI USB2ANY: lokalen Windows-Adapter starten und http://127.0.0.1:8765/?model=pga300 öffnen.');
  const response=await fetch('/api/usb2any/session',{cache:'no-store'});if(!response.ok)throw Error('USB2ANY-Bridge nicht verfügbar.');const x=await response.json();if(typeof x.token!=='string')throw Error('Ungültige SDK-Sitzung.');return new EvmBridge(x.token)
 }
 request(command){const p=this.queue.then(async()=>{if(this.closed)throw Error('TI-Adapter getrennt.');const r=await fetch('/api/usb2any/command',{method:'POST',headers:{'Content-Type':'application/json','X-PGA-Token':this.token},body:JSON.stringify({command}),signal:AbortSignal.timeout(5000)});const x=await r.json();if(!r.ok||!x.ok)throw Error(x.error||'USB2ANY-Fehler');return x.data||''});this.queue=p.catch(()=>{});return p}
 async close(){try{await this.request('CLOSE')}finally{this.closed=true}}
}
