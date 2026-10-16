import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const playwright = await import(pathToFileURL(createRequire(import.meta.url).resolve(process.env.PLAYWRIGHT_MODULE || 'playwright')).href);
const { chromium } = playwright.default ?? playwright;
const out=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../artifacts/local-projects');fs.mkdirSync(out,{recursive:true});
function hum(){const sr=16000,duration=4,buffer=Buffer.alloc(44+sr*duration*2);buffer.write('RIFF');buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVEfmt ',8);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(sr,24);buffer.writeUInt32LE(sr*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(buffer.length-44,40);for(let i=0;i<sr*duration;i++){const t=i/sr,local=t%.5,freq=[261.63,329.63,392,329.63][Math.floor(t/.5)%4];buffer.writeInt16LE(Math.round((t>.15&&local<.4?.3*Math.sin(2*Math.PI*freq*t)*Math.min(1,local/.02):0)*32767),44+i*2);}return buffer;}
let debugPage;
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:393,height:852}});const page=await context.newPage();debugPage=page;const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')console.log('Browser:',m.text())});
const saved=()=>page.getByText('Saved on this device',{exact:true}).waitFor({timeout:30000});
const library=()=>page.getByRole('button',{name:'My songs',exact:true}).last().click();
async function setRange(name,value){await page.getByRole('slider',{name,exact:true}).evaluate((el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(v));el.dispatchEvent(new Event('input',{bubbles:true}));},value);}
async function db(){return page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('hummly-projects',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});const tx=db.transaction(['projects','assets']);const [projects,assets]=await Promise.all(['projects','assets'].map(name=>new Promise(resolve=>{const r=tx.objectStore(name).getAll();r.onsuccess=()=>resolve(r.result)})));db.close();return {projects,assets:assets.map(a=>({id:a.id,projectId:a.projectId,length:a.pcm.channels[0].length,rate:a.pcm.sampleRate,hash:a.pcm.channels[0].reduce((sum,x,i)=>sum+(i%100===0?x:0),0)}))};});}
async function download(){const waiting=page.waitForEvent('download');await page.getByRole('button',{name:'Export WAV',exact:true}).click();return fs.readFileSync(await (await waiting).path());}
await page.goto(process.env.HUMMLY_BASE_URL || 'http://localhost:3000');await page.getByRole('button',{name:'Upload audio',exact:true}).waitFor();
await page.getByLabel('Choose an audio file').setInputFiles({name:'local-test.wav',mimeType:'audio/wav',buffer:hum()});
await page.getByRole('heading',{name:'Your melody, found.',exact:true}).waitFor({timeout:30000});await saved();
assert.equal((await db()).projects.length,1);console.log('Saved real uploaded recording and analysis.');
await page.reload();await page.getByRole('heading',{name:'My songs',exact:true}).waitFor();assert.equal(await page.getByText('Draft',{exact:true}).count(),1);
await page.getByRole('button',{name:'Open Untitled song',exact:true}).click();await page.getByRole('heading',{name:'Your melody, found.',exact:true}).waitFor();
await page.getByRole('button',{name:/Play with chords/}).click();
await page.locator('.progression-card-select').first().click();await page.getByRole('button',{name:/Continue to next/}).click();await page.getByRole('button',{name:/Keep the same chords/}).click();
await page.getByRole('button',{name:/Choose .* beat/}).first().click();await page.getByRole('button',{name:/Continue to Mix/}).click();
await page.getByRole('heading',{name:'Your song is ready!',exact:true}).waitFor({timeout:90000});await saved();
await page.getByRole('textbox',{name:'Song name',exact:true}).fill('Moonlight hum');await setRange('Your hum volume',.62);await setRange('Chords volume',.31);await page.getByRole('button',{name:'Mute Beat',exact:true}).click();
await page.getByRole('button',{name:'Fine-tune audio',exact:true}).click();await page.getByRole('button',{name:'Edit Chords track',exact:true}).click();
const canvas=await page.locator('dialog canvas').nth(1).boundingBox();await page.mouse.move(canvas.x+30,canvas.y+60);await page.mouse.down();await page.mouse.move(canvas.x+130,canvas.y+60,{steps:8});await page.mouse.up();await page.getByRole('button',{name:'Silence',exact:true}).click();
await page.getByRole('button',{name:'Back to your mix',exact:true}).click();await saved();
const draft=await db();assert.equal(draft.projects[0].stage,'draft');
await page.getByRole('button',{name:'Save to My songs',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal((await db()).projects[0].stage,'draft');
await page.getByRole('button',{name:'Save to My songs',exact:true}).click();
await page.evaluate(()=>{window.beforeConfirmPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='projects')throw new DOMException('Test quota exceeded','QuotaExceededError');return window.beforeConfirmPut.apply(this,args)}});
await page.getByRole('button',{name:'Save song',exact:true}).click();await page.getByText(/Couldn’t save your song on this device/).waitFor();assert.equal((await db()).projects[0].stage,'draft');assert.equal(await page.locator('dialog[open]').count(),1);
await page.evaluate(()=>{IDBObjectStore.prototype.put=window.beforeConfirmPut});await page.getByRole('button',{name:'Save song',exact:true}).click();await page.getByRole('button',{name:'Open Moonlight hum',exact:true}).waitFor();await page.getByRole('button',{name:'Open Moonlight hum',exact:true}).click();await page.getByRole('heading',{name:'Your song is ready!',exact:true}).waitFor();await saved();
const before=await db();assert.equal(before.projects[0].title,'Moonlight hum');assert.equal(before.projects[0].stage,'ready');assert.equal(before.projects[0].mix.volumes.voice,.62);assert.equal(before.projects[0].mix.mutes.drums,true);assert.equal(before.projects[0].mix.edited.chords,true);
assert.ok(before.assets.length>=4);const originalWav=await download();
await page.reload();await page.getByRole('heading',{name:'My songs',exact:true}).waitFor();await page.getByRole('button',{name:'Open Moonlight hum',exact:true}).click();await page.getByRole('heading',{name:'Your song is ready!',exact:true}).waitFor();
assert.equal(await page.getByRole('slider',{name:'Your hum volume',exact:true}).inputValue(),'0.62');assert.equal(await page.getByRole('slider',{name:'Chords volume',exact:true}).inputValue(),'0.31');assert.equal(await page.getByRole('button',{name:'Unmute Beat',exact:true}).count(),1);
const reopenedWav=await download();assert.ok(originalWav.equals(reopenedWav),'Reopened edited mix exports identical WAV bytes');console.log('Restored actual edited PCM, volumes/mutes and byte-identical WAV.');
await library();await page.getByRole('button',{name:'Rename Moonlight hum',exact:true}).click();await page.getByLabel('Song name',{exact:true}).fill('Moonlight v2');await page.getByRole('button',{name:'Save name',exact:true}).click();await page.getByRole('button',{name:'Open Moonlight v2',exact:true}).waitFor();
await page.getByRole('button',{name:'New song',exact:true}).click();await page.getByRole('button',{name:'Upload audio',exact:true}).waitFor();await page.getByLabel('Choose an audio file').setInputFiles({name:'second.wav',mimeType:'audio/wav',buffer:hum()});await page.getByRole('heading',{name:'Your melody, found.',exact:true}).waitFor();await saved();
await library();await page.getByRole('heading',{name:'My songs',exact:true}).waitFor();await page.waitForFunction(()=>document.querySelectorAll('.song-card').length===2);assert.equal(await page.locator('.song-card').count(),2);
for(const width of [375,393,1024]){await page.setViewportSize({width,height:852});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:out+`/my-songs-${width}.png`,fullPage:true});}
await page.getByRole('button',{name:'Open Moonlight v2',exact:true}).click();await page.getByRole('heading',{name:'Your song is ready!',exact:true}).waitFor();assert.equal(await page.getByRole('slider',{name:'Your hum volume',exact:true}).inputValue(),'0.62');await library();
page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Delete Moonlight v2',exact:true}).click();assert.equal(await page.locator('.song-card').count(),2);
const id=(await db()).projects.find(p=>p.title==='Moonlight v2').id;
page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete Moonlight v2',exact:true}).click();await page.getByRole('button',{name:'Open Moonlight v2',exact:true}).waitFor({state:'detached'});
let current=await db();assert.equal(current.projects.length,1);assert.equal(current.assets.some(asset=>asset.projectId===id),false);
// A thrown write must roll back new PCM and must not report Saved or leave the song.
await page.getByRole('button',{name:'Open Untitled song',exact:true}).click();await page.getByRole('heading',{name:'Your melody, found.',exact:true}).waitFor();await saved();
const previous=(await db()).projects[0].recipe.bpm;
await page.evaluate(()=>{window.originalProjectPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='projects')throw new DOMException('Test quota exceeded','QuotaExceededError');return window.originalProjectPut.apply(this,args)}});
await page.getByRole('button',{name:'Increase tempo',exact:true}).click();await page.getByText('Couldn’t save',{exact:true}).waitFor();await library();await page.getByText(/latest changes couldn’t be saved/).waitFor();assert.equal(await page.getByRole('heading',{name:'Your melody, found.',exact:true}).isVisible(),true);assert.equal((await db()).projects[0].recipe.bpm,previous);
await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalProjectPut});await page.getByRole('button',{name:'Retry saving',exact:true}).click();await saved();assert.equal((await db()).projects[0].recipe.bpm,previous+1);
await library();page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Delete Untitled song',exact:true}).click();await page.getByText('Your first song starts with a hum.',{exact:true}).waitFor();current=await db();assert.equal(current.projects.length,0);assert.equal(current.assets.length,0);
assert.deepEqual(errors,[]);await browser.close();console.log('Passed: first-run recording, drafts/reload, library resume, exact mix checkpoints and WAV, rename, multiple isolated projects, mobile layout, atomic deletion, failed-save rollback and retry.');
})().catch(async e=>{console.error(e);if(debugPage){console.error(await debugPage.locator('body').innerText());await debugPage.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});}process.exit(1)});
