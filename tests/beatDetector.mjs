import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const api = {};
new Function('exports', ts.transpileModule(fs.readFileSync('lib/audio/beatDetector.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(api);

// Real PCM attacks, not just the grid-fitting inputs.
for (const bpm of [60, 72, 100, 120, 150]) {
  const sampleRate = 16000, samples = new Float32Array(sampleRate * 12), offset = .23;
  for (let t = offset; t < 12; t += 60 / bpm) {
    for (let i = 0; i < sampleRate * .16 && Math.round(t * sampleRate) + i < samples.length; i++) {
      samples[Math.round(t * sampleRate) + i] = .5 * Math.sin(2 * Math.PI * 220 * i / sampleRate) * Math.min(1, i / 80) * Math.exp(-i / (sampleRate * .04));
    }
  }
  const result = api.analyzeAudioBeats({ channels: [samples], sampleRate });
  assert.ok(Math.abs(result.bpm - bpm) <= 1, `${bpm} BPM detected as ${result.bpm}`);
  assert.ok(Math.abs(result.offset - offset) < .05);
}
const silence = api.analyzeAudioBeats({ channels: [new Float32Array(16000)], sampleRate: 16000 });
assert.equal(silence.confidence, 0);
assert.equal(silence.onsets.length, 0);

console.log('Passed: PCM tempo and phase at 60–150 BPM, and silence.');
