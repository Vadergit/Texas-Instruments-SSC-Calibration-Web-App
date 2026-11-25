import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
const server=spawn('python3',['-m','http.server','8766','--bind','127.0.0.1'],{stdio:'ignore'});
let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8766/')).ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 for(const preset of ['quick','tk0','tke','temperature','full']){
  await page.goto('http://127.0.0.1:8766/?model=pga300');
  await page.locator('[data-task="calibration"]').click();
  assert.equal(await page.locator('#hwWriteGate').isChecked(),false);
  await page.locator('#mode').selectOption('demo');await page.locator('#next').click();
  await page.locator('[data-preset="'+preset+'"]').click();await page.locator('#next').click();
  await page.locator('#next').click();await page.locator('#afeConfirmed').check();await page.locator('#next').click();
  await page.locator('#demo').click();await page.locator('#calculate').click();
  await page.locator('#fitResult').waitFor({state:'visible'});
  assert.match(await page.locator('#q14Result').textContent(),/programmingAllowed/);
  await page.locator('#next').click();await page.locator('#demoCheck').click();await page.locator('#runCheck').click();
  assert.match(await page.locator('#verification').textContent(),/Modellprüfung bestanden/);
  await page.locator('#guidedHomeTop').click();await page.locator('[data-task="archive"]').click();
  await page.locator('#archiveSave').click();await page.locator('#archiveList').getByText('Ansehen',{exact:true}).first().click();
  assert.match(await page.locator('#archiveDetail').textContent(),/pga300-offline-v1/);
  assert.deepEqual(errors,[]);
 }
 await page.locator('#guidedHomeTop').click();await page.locator('[data-task="inspect"]').click();
 await page.locator('#dumpFile').setInputFiles({name:'test.bin',mimeType:'application/octet-stream',buffer:Buffer.alloc(128)});
 await page.waitForFunction(()=>document.querySelectorAll('#registerRows tr').length===128);
 await page.locator('#registerSearch').fill('CRC8');assert.equal(await page.locator('#registerRows tr').count(),1);
 assert.deepEqual(errors,[]);console.log('Browser smoke tests passed');
}finally{await browser?.close();server.kill()}
