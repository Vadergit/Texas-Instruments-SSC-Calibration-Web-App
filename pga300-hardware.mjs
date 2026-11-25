// TI SLDS204D §§6.5, 7.2, 7.3. Transport: USB CDC ASCII bridge v1.
export const PGA_GAINS=[5,5.48,5.97,6.56,7.02,8,9.09,10,10.53,11.11,12.5,13.33,14.29,16,17.39,18.18,19.05,20,22.22,25,30.77,36.36,40,44.44,50,57.14,66.67,80,100,133.33,200,400];
export const TGAINS=[1.33,2,5,20];
export const COEFF={h0:0,g0:2,n0:4,h1:6,g1:8,n1:10,h2:12,g2:14,n2:16,h3:54,g3:56,n3:58,m0:60,m1:62,m2:64,m3:66};
export const hex=n=>n.toString(16).padStart(2,'0').toUpperCase();
export const signed=(lo,hi)=>((lo|(hi<<8))<<16)>>16;
export function crc8(bytes){let c=255;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=((c<<1)^((c&128)?7:0))&255}return c}
export function decodeEEPROM(bytes){
 if(bytes.length!==128)throw Error('128 EEPROM-Bytes erforderlich.');
 const word=i=>signed(bytes[i],bytes[i+1]),dac=i=>bytes[i]|((bytes[i+1]&63)<<8);
 return {coefficients:Object.fromEntries(Object.entries(COEFF).map(([k,i])=>[k,word(i)])),pressureGain:PGA_GAINS[bytes[35]&31],temperatureGain:TGAINS[bytes[36]&3],pressureInverted:!!(bytes[35]&128),temperatureInverted:!!(bytes[36]&128),bridgeCode:(bytes[34]>>1)&3,output:bytes[33],ratiometric:!!(bytes[32]&1),normalLow:dac(42),normalHigh:dac(44),lowClamp:dac(46),highClamp:dac(48),pDigitalGain:word(50),pDigitalOffset:word(52),tDigitalGain:word(76),tDigitalOffset:word(78),diagEnabled:!!(bytes[68]&1),locked:!!(bytes[69]&1),faultDAC:dac(74),serial:Array.from(bytes.slice(80,84),hex).join(''),storedCRC:bytes[127],computedCRC:crc8(bytes.slice(0,127))};
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const equal=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
export class SerialBridge{
 constructor(port){this.port=port;this.queue=Promise.resolve();this.seq=0;this.buffer='';this.closed=false}
 static async open(){if(!navigator.serial)throw Error('Web Serial erfordert Chrome/Edge und HTTPS.');const p=await navigator.serial.requestPort();await p.open({baudRate:115200});return new SerialBridge(p)}
 async close(){this.closed=true;try{await this.reader?.cancel()}catch{}try{await this.queue}catch{}await this.port.close()}
 request(command){const run=()=>this.exchange(command);const p=this.queue.then(run);this.queue=p.catch(()=>{});return p}
 async exchange(command){
  if(this.closed)throw Error('USB getrennt.');const id=++this.seq,w=this.port.writable.getWriter();
  try{await w.write(new TextEncoder().encode(id+' '+command+'\n'))}finally{w.releaseLock()}
  const reader=this.port.readable.getReader();this.reader=reader;const dec=new TextDecoder();let timer;
  try{
   timer=setTimeout(()=>{this.closed=true;reader.cancel().catch(()=>{})},2500);
   for(;;){let ix;while((ix=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,ix).trim();this.buffer=this.buffer.slice(ix+1);const m=line.match(/^(\d+) (OK|ERR)(?: (.*))?$/);if(m&&+m[1]===id){if(m[2]==='ERR')throw Error(m[3]||'Bridge-Fehler');return m[3]||''}}
    const {value,done}=await reader.read();if(done){this.closed=true;throw Error('USB-Timeout / Verbindung beendet. Neu verbinden.');}this.buffer+=dec.decode(value,{stream:true});if(this.buffer.length>4096){this.closed=true;throw Error('Ungültiger USB-Datenstrom.')}
   }
  }finally{clearTimeout(timer);reader.releaseLock();this.reader=null}
 }
}
export class PGA300{
 constructor(transport){this.io=transport;this.active=false;this.backup=null;this.chipCRC=null;this.writeFault=false}
 async read(page,addr){if(![0,2,5].includes(page)||!Number.isInteger(addr)||addr<0||addr>255)throw Error('Registeradresse ungültig');const v=await this.io.request('R '+hex(page)+' '+hex(addr));if(!/^[0-9A-Fa-f]{2}$/.test(v))throw Error('Ungültige Registerantwort');return parseInt(v,16)}
 async write(page,addr,value){if(![0,2,5].includes(page)||!Number.isInteger(addr)||addr<0||addr>255||!Number.isInteger(value)||value<0||value>255)throw Error('Ungültiger Registerwert');await this.io.request('W '+hex(page)+' '+hex(addr)+' '+hex(value))}
 async connect(){const hello=await this.io.request('HELLO');if(hello!=='PGA300-BRIDGE 2 9600')throw Error('PGA300 Bridge v2 (9600 Baud OWI) erforderlich. Alte Firmware aktualisieren.');await this.io.request('ACT');try{await this.write(0,12,3);this.active=true;if(await this.read(0,12)!==3)throw Error('Keine bestätigte Konfigurationsantwort');return await this.readEEPROM()}catch(e){try{await this.exit()}catch{}this.active=false;this.backup=null;throw e}}
 async exit(){try{if(this.active){await this.write(0,12,0)}}finally{this.active=false;this.backup=null;this.chipCRC=null}}
 require(){if(!this.active)throw Error('Sensor nicht im Konfigurationsmodus')}
 async readEEPROM(){this.require();this.backup=null;this.chipCRC=null;await this.waitIdle(0x8b,7);const b=[];for(let i=0;i<128;i++)b.push(await this.read(5,i));const mode=await this.read(0,12);if(mode!==3)throw Error('Konfigurationsmodus verloren');await this.waitIdle(0x8c,1);await this.write(5,0x8a,1);await this.waitIdle(0x8c,1);const status=await this.read(5,0x8c),calculated=await this.read(5,0x8d);const bytes=Uint8Array.from(b);if(status&1||calculated!==crc8(bytes.slice(0,127)))throw Error('EEPROM-Übertragungsfehler: Host- und Chip-CRC weichen ab.');this.backup=bytes;this.chipCRC={good:!!(status&2)&&calculated===bytes[127],busy:false,calculated};return {bytes:bytes.slice(),decoded:decodeEEPROM(bytes),chipCRC:this.chipCRC}}
 async word(lo){for(let i=0;i<5;i++){const h1=await this.read(2,lo+1),l=await this.read(2,lo),h2=await this.read(2,lo+1);if(h1===h2)return signed(l,h1)}throw Error('ADC-Wert instabil')}
 async sample(count=1){this.require();if(!Number.isInteger(count)||count<1||count>100)throw Error('1–100 Samples');let p=0,t=0,min=32767,max=-32768;for(let i=0;i<count;i++){const a=await this.word(0x20),b=await this.word(0x24);p+=a;t+=b;min=Math.min(min,a);max=Math.max(max,a)}return {p:Math.round(p/count),t:Math.round(t/count),min,max,diag:await this.read(2,0x5a),count}}
 async readAFE(){this.require();const o={};for(const [k,a] of Object.entries({bridge:0x46,pGain:0x47,tGain:0x48,temp:0x4c,dacConfig:0x39,output:0x3b,test:0x67}))o[k]=await this.read(2,a);return o}
 async setAFE({pGain,tGain,bridge,temp,test}){this.require();for(const [addr,value,mask] of [[0x47,pGain,0x9f],[0x48,tGain,0x83],[0x46,bridge,7],[0x4c,temp,0x7f],[0x67,test,9]]){if(value===undefined)continue;if(!Number.isInteger(value)||value<0||(value&mask)!==value)throw Error('Reservierte AFE-Bits');await this.write(2,addr,value);if(await this.read(2,addr)!==value)throw Error('AFE-Rücklesen fehlgeschlagen: '+hex(addr))}return this.readAFE()}
 async writeChecked(page,addr,value){await this.write(page,addr,value);if(await this.read(page,addr)!==value)throw Error('Register-Readback falsch: '+hex(addr))}
 async setOutput({stage,ratiometric}){this.require();if(![0,1].includes(ratiometric)||!Number.isInteger(stage)||stage<0||stage>31||((stage&8)?(stage&7)!==0||ratiometric!==0:![1,2,4,6].includes(stage&7)))throw Error('Ungültige Ausgangskonfiguration.');const test=await this.read(2,0x67);await this.writeChecked(2,0x67,test&8);await this.writeChecked(2,0x3b,stage);await this.writeChecked(2,0x39,ratiometric);return this.readAFE()}
 async testDAC(code){this.require();if(!Number.isInteger(code)||code<0||code>16383)throw Error('14-bit DAC Code erforderlich.');const test=await this.read(2,0x67);await this.writeChecked(2,0x67,test&8);await this.writeChecked(2,0x30,code&255);await this.writeChecked(2,0x31,code>>8);await this.writeChecked(2,0x67,(test&8)|1);return code}
 async stopDAC(){this.require();await this.writeChecked(2,0x67,(await this.read(2,0x67))&8)}
 async waitIdle(addr,mask){for(let i=0;i<100;i++){if(!((await this.read(5,addr))&mask))return;await delay(10)}throw Error('EEPROM Busy Timeout')}
 async programImage(original,desired,confirmation,progress=()=>{}){
  this.require();if(this.writeFault)throw Error('Vorheriger Schreibfehler. Kein weiterer Schreibvorgang in dieser Sitzung.');if(confirmation!=='PGA300 TESTCHIP PROGRAMMIEREN')throw Error('Explizite Freigabe fehlt.');
  if(original.length!==128||desired.length!==128||original[69]&1)throw Error('EEPROM gesperrt / ungültig.');
  const allowed=new Set([...Object.values(COEFF).flatMap(a=>[a,a+1]),32,33,34,35,36,37,40,42,43,44,45,46,47,48,49,50,51,52,53,68,70,71,74,75,76,77,78,79,127]);
  for(let i=0;i<128;i++)if(original[i]!==desired[i]&&!allowed.has(i))throw Error('Geschütztes Byte '+hex(i));
  const masks={32:1,33:31,34:6,35:159,36:131,37:127,40:1,43:63,45:63,47:63,49:63,68:1,70:127,71:247,75:63};
  for(const [a,m] of Object.entries(masks))if(((original[a]^desired[a])&~m)!==0)throw Error('Reservierte Bits geändert: '+hex(+a));
  if(desired[127]!==crc8(desired.slice(0,127)))throw Error('Ziel-CRC falsch');
  const fresh=await this.readEEPROM();if(!equal(fresh.bytes,original))throw Error('Sensorinhalt seit Backup geändert.');
  if(fresh.chipCRC.busy||fresh.chipCRC.calculated!==crc8(original.slice(0,127)))throw Error('Host-/Chip-CRC nicht übereinstimmend.');
  const pages=Array.from({length:16},(_,i)=>i).filter(i=>!equal(original.slice(i*8,i*8+8),desired.slice(i*8,i*8+8)));
  try{for(const page of pages){progress('Programmiere Seite '+page);await this.waitIdle(0x8b,7);await this.write(5,0x88,page);if(await this.read(5,0x88)!==page)throw Error('Seitenauswahl falsch');for(let j=0;j<8;j++)await this.write(5,0x80+j,desired[page*8+j]);for(let j=0;j<8;j++)if(await this.read(5,0x80+j)!==desired[page*8+j])throw Error('Cache-Readback falsch');await this.write(5,0x89,4);await delay(20);await this.waitIdle(0x8b,7);for(let j=0;j<8;j++)if(await this.read(5,page*8+j)!==desired[page*8+j])throw Error('EEPROM-Readback falsch; nicht weiterprogrammieren');}
  await this.write(5,0x8a,1);await this.waitIdle(0x8c,1);const result=await this.readEEPROM();if(!equal(result.bytes,desired)||!result.chipCRC.good||result.chipCRC.calculated!==desired[127])throw Error('Abschlussprüfung fehlgeschlagen.');return result}catch(e){this.writeFault=true;this.backup=null;throw Error('EEPROM-Schreibvorgang gestoppt: '+e.message+' · Originalbackup behalten, keine automatische Wiederholung.')}
 }
}
export function prepareLinear(original,candidate,afe,limits){
 if(!candidate?.representable||![candidate.h0,candidate.g0].every(v=>Number.isInteger(v)&&v>=-32768&&v<=32767)||original.length!==128)throw Error('Nur linearer Fit mit darstellbaren Koeffizienten.');
 const a=Uint8Array.from(original),word=(i,v)=>{a[i]=v&255;a[i+1]=(v>>8)&255};
 for(const [k,i] of Object.entries(COEFF))word(i,k==='h0'?candidate.h0:k==='g0'?candidate.g0:0);
 word(50,1);word(52,0);
 if(afe){a[34]=(a[34]&~6)|(afe.bridge&6);a[35]=(a[35]&~159)|(afe.pGain&159);a[36]=(a[36]&~131)|(afe.tGain&131);a[37]=(a[37]&~127)|(afe.temp&127);a[40]=(a[40]&~1)|((afe.test>>3)&1)}
 const vals=[limits.clow,limits.low,limits.high,limits.chigh];if(vals.some(x=>!Number.isInteger(x)||x<0||x>16383)||vals.some((x,i)=>i&&x<vals[i-1])||limits.low===limits.high)throw Error('DAC-Grenzen ungültig');
 for(const [i,v] of [[42,limits.low],[44,limits.high],[46,limits.clow],[48,limits.chigh]]){a[i]=v&255;a[i+1]=(a[i+1]&192)|(v>>8)}
 a[127]=crc8(a.slice(0,127));return a
}

export function recommendGain(low,high,currentCode,target=25000){
 if(![low,high,target].every(Number.isFinite)||!Number.isInteger(currentCode)||currentCode<0||currentCode>31||Math.max(Math.abs(low),Math.abs(high))>=32760||target<=0||target>30000||low===high)throw Error('Gültige ungesättigte Endpunktmessungen erforderlich.');
 const peak=Math.max(Math.abs(low),Math.abs(high));const current=PGA_GAINS[currentCode],limit=target*current/peak;
 const code=PGA_GAINS.reduce((best,g,i)=>g<=limit?i:best,-1);if(code<0)throw Error('Auch kleinster P Gain überschreitet Zielreserve.');return {code,gain:PGA_GAINS[code],predictedPeak:peak*PGA_GAINS[code]/current,invert:high<low};
}
export function prepareSettings(original,{stage,ratiometric,normalLow,normalHigh,lowClamp,highClamp,diagEnabled,faultDAC,diagMask}){
 if(original.length!==128)throw Error('Original-EEPROM erforderlich.');const a=Uint8Array.from(original);
 const set=(i,v,m)=>{if(!Number.isInteger(v)||v<0||(v&m)!==v)throw Error('Ungültiger Registerwert '+hex(i));a[i]=(a[i]&~m)|v};
 if(stage!==undefined){if(!Number.isInteger(stage)||stage<0||stage>31||![0,1].includes(ratiometric)||((stage&8)?(stage&7)!==0||ratiometric!==0:![1,2,4,6].includes(stage&7)))throw Error('Ausgangskonfiguration ungültig.');set(33,stage,31);set(32,ratiometric,1);
 const values=[lowClamp,normalLow,normalHigh,highClamp];if(values.some(x=>!Number.isInteger(x)||x<0||x>16383)||values.some((x,i)=>i&&x<values[i-1])||normalLow===normalHigh)throw Error('DAC-Grenzen ungültig.');for(const [i,v] of [[42,normalLow],[44,normalHigh],[46,lowClamp],[48,highClamp]]){set(i,v&255,255);set(i+1,v>>8,63)}}
 if(diagEnabled!==undefined){set(68,diagEnabled,1);if(!Number.isInteger(faultDAC)||faultDAC<0||faultDAC>16383)throw Error('Fault-DAC ungültig.');set(74,faultDAC&255,255);set(75,faultDAC>>8,63);set(71,diagMask,247)}
 a[127]=crc8(a.slice(0,127));return a
}
