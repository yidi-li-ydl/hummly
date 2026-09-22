/**
 * Synthesized chord instruments: guitar, strings, synth-pad.
 * Each function schedules a full chord into a BaseAudioContext,
 * connecting to dry + reverb buses (same interface as playPianoNote in mixer.ts).
 */

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// ---------------------------------------------------------------------------
//  Acoustic Guitar — subtractive strum synthesis
//  Short noise pick transient + pitched harmonics + filter sweep down
// ---------------------------------------------------------------------------

export function playGuitarChord(
  ctx: BaseAudioContext,
  midiNotes: number[],
  time: number,
  duration: number,
  dryDest: AudioNode,
  reverbDest: AudioNode,
  volume = 0.25
) {
  // Strum direction alternates implicitly; low-to-high with ~20ms per string
  midiNotes.forEach((midi, noteIndex) => {
    const freq = midiToFreq(midi);
    const strumDelay = noteIndex * 0.02;
    const noteTime = time + strumDelay;
    const perNoteVol = volume / Math.sqrt(midiNotes.length);

    // --- Pick transient: very short bandpass-filtered noise burst ---
    const noiseLen = Math.ceil(ctx.sampleRate * 0.008); // 8ms
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      nd[i] = (Math.random() * 2 - 1) * (1 - i / noiseLen); // decaying noise
    }
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const noiseBpf = ctx.createBiquadFilter();
    noiseBpf.type = "bandpass";
    noiseBpf.frequency.value = Math.min(freq * 3, 6000);
    noiseBpf.Q.value = 1.0;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(perNoteVol * 0.8, noteTime);

    noiseSrc.connect(noiseBpf);
    noiseBpf.connect(noiseGain);
    noiseGain.connect(dryDest);
    noiseGain.connect(reverbDest);
    noiseSrc.start(noteTime);
    noiseSrc.stop(noteTime + 0.01);

    // --- Pitched component: fundamental + harmonics (triangle-ish partials) ---
    const harmonics = [
      { ratio: 1, amp: 1.0 },
      { ratio: 2, amp: 0.5 },
      { ratio: 3, amp: 0.25 },
      { ratio: 4, amp: 0.1 },
    ];

    // Shared lowpass that sweeps from bright → mellow (guitar body character)
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.setValueAtTime(5000, noteTime);
    lpf.frequency.exponentialRampToValueAtTime(1200, noteTime + duration * 0.6);
    lpf.Q.value = 0.7;

    // Body resonance — slight bump around 200Hz
    const bodyEq = ctx.createBiquadFilter();
    bodyEq.type = "peaking";
    bodyEq.frequency.value = 220;
    bodyEq.Q.value = 0.8;
    bodyEq.gain.value = 2;

    // Amplitude envelope: instant attack, exponential decay
    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(perNoteVol, noteTime);
    envGain.gain.exponentialRampToValueAtTime(perNoteVol * 0.4, noteTime + duration * 0.3);
    envGain.gain.exponentialRampToValueAtTime(0.001, noteTime + duration + 0.2);

    lpf.connect(bodyEq);
    bodyEq.connect(envGain);
    envGain.connect(dryDest);
    envGain.connect(reverbDest);

    for (const h of harmonics) {
      const hFreq = freq * h.ratio;
      if (hFreq > 10000) continue; // skip inaudible overtones

      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = hFreq;
      // Slight random detune for natural feel (±3 cents)
      osc.detune.value = (Math.random() - 0.5) * 6;

      const hGain = ctx.createGain();
      hGain.gain.value = h.amp;

      osc.connect(hGain);
      hGain.connect(lpf);

      osc.start(noteTime);
      osc.stop(noteTime + duration + 0.25);
    }
  });
}

// ---------------------------------------------------------------------------
//  Strings — sawtooth oscillators + lowpass filter + slow attack
// ---------------------------------------------------------------------------

export function playStringsChord(
  ctx: BaseAudioContext,
  midiNotes: number[],
  time: number,
  duration: number,
  dryDest: AudioNode,
  reverbDest: AudioNode,
  volume = 0.18
) {
  for (const midi of midiNotes) {
    const freq = midiToFreq(midi);

    // Two detuned sawtooth oscillators per note for richness
    for (const detuneCents of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = detuneCents;

      const lpf = ctx.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = 3000;
      lpf.Q.value = 0.7;

      const envGain = ctx.createGain();
      // Slow attack (~0.15s), sustain, then release (~0.3s)
      envGain.gain.setValueAtTime(0.001, time);
      envGain.gain.exponentialRampToValueAtTime(volume, time + 0.15);
      const releaseStart = Math.max(time + duration - 0.3, time + 0.2);
      envGain.gain.setValueAtTime(volume, releaseStart);
      envGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(lpf);
      lpf.connect(envGain);
      envGain.connect(dryDest);
      envGain.connect(reverbDest);

      osc.start(time);
      osc.stop(time + duration + 0.05);
    }
  }
}

// ---------------------------------------------------------------------------
//  Synth Pad — detuned triangle oscillators + filter + soft attack
// ---------------------------------------------------------------------------

export function playSynthPadChord(
  ctx: BaseAudioContext,
  midiNotes: number[],
  time: number,
  duration: number,
  dryDest: AudioNode,
  reverbDest: AudioNode,
  volume = 0.2
) {
  for (const midi of midiNotes) {
    const freq = midiToFreq(midi);

    // Two triangle oscillators detuned ±5 cents
    for (const detuneCents of [-5, 5]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = freq;
      osc.detune.value = detuneCents;

      const lpf = ctx.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = 2000;
      lpf.Q.value = 0.5;

      const envGain = ctx.createGain();
      // Soft attack (~0.2s), sustain, gentle release
      envGain.gain.setValueAtTime(0.001, time);
      envGain.gain.exponentialRampToValueAtTime(volume, time + 0.2);
      const releaseStart = Math.max(time + duration - 0.35, time + 0.25);
      envGain.gain.setValueAtTime(volume, releaseStart);
      envGain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(lpf);
      lpf.connect(envGain);
      envGain.connect(dryDest);
      envGain.connect(reverbDest);

      osc.start(time);
      osc.stop(time + duration + 0.05);
    }
  }
}
