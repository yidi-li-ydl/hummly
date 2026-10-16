import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const api = {};
new Function('exports', ts.transpileModule(fs.readFileSync('lib/projects/model.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(api);
const pcm = {channels:[new Float32Array([.1,-.2,.3,-.4])],sampleRate:2};
const edited = {channels:[new Float32Array([0,0,.3,-.4])],sampleRate:2};
const snapshot={tracks:{voice:pcm,chords:edited,drums:null},editedVoicePcm:null,edited:{chords:true,drums:false},volumes:{voice:.7,chords:.3,drums:1},mutes:{voice:false,chords:false,drums:true}};
const state={step:'mix',bpm:120,beatsPerBar:4,beatOffset:.25,voicePcm:pcm,pitchReadings:[],notes:[],detectedKey:{key:'C',mode:'major',correlation:1},chordOptions:[],selectedChords:null,selectedChordsB:null,chordInstrument:'piano',melodyVoice:'real',drumKit:'acoustic-kit',drumOptions:[],selectedDrums:null,mixBuffer:{transient:true},mixSnapshot:snapshot,chordPattern:null,mixUrl:'blob:expired',error:'temporary'};
const project={id:'test-song',title:'  A little song  ',createdAt:'2026-10-16T00:00:00Z',completedAt:'2026-10-16T00:01:00Z',state};
const manifest=api.createManifest(project);
assert.equal(api.createManifest({...project,completedAt:undefined}).stage,'draft');
assert.equal(manifest.title,'A little song');assert.equal(manifest.stage,'ready');assert.equal(manifest.duration,2);
for(const key of ['voicePcm','mixSnapshot','mixBuffer','mixUrl','error'])assert.equal(key in manifest.recipe,false);
const audio=api.projectAssets(project);assert.deepEqual(Object.keys(audio).sort(),['chords','recording','voice']);
const restored=api.restoreProject(structuredClone(manifest),new Map(Object.entries(audio).map(([slot,data])=>[`test-song/${slot}`,structuredClone(data)])));
assert.deepEqual(restored.state.mixSnapshot,snapshot);assert.deepEqual(restored.state.voicePcm,pcm);assert.equal(restored.completedAt,project.completedAt);assert.equal(api.restoreProject({...manifest,completedAt:undefined},new Map(Object.entries(audio).map(([slot,data])=>[`test-song/${slot}`,data]))).completedAt,manifest.updatedAt);assert.equal(restored.state.mixUrl,null);assert.equal(restored.state.error,null);
assert.throws(()=>api.restoreProject({...manifest,schemaVersion:2},new Map()),/newer version/);
assert.throws(()=>api.restoreProject(manifest,new Map()),/audio/);
assert.equal(api.createManifest({...project,title:' ',state:{...state,step:'review',mixSnapshot:null}}).stage,'draft');
assert.equal(api.createManifest({...project,title:' '}).title,'Untitled song');
console.log('Passed: versioned project manifests, exact PCM and mix restoration, draft status, title normalization, missing assets and newer schema rejection.');
