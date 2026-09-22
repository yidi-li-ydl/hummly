import type { VoicePcm } from "../types";

export interface RecorderHandle {
  analyserNode: AnalyserNode;
  audioContext: AudioContext;
  startRecording: () => void;
  stopRecording: () => VoicePcm;
  cleanup: () => void;
}

export async function createRecorder(): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  });
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);

  // Analyser for pitch detection
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 2048;
  source.connect(analyserNode);

  // Raw PCM capture via ScriptProcessorNode — records uncompressed samples
  // directly, avoiding the lossy WebM encode/decode roundtrip.
  const bufferSize = 4096;
  const scriptNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
  let chunks: Float32Array[] = [];
  let isCapturing = false;

  scriptNode.onaudioprocess = (e) => {
    if (!isCapturing) return;
    const input = e.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input)); // copy the buffer
  };

  source.connect(scriptNode);
  // ScriptProcessorNode must reach destination to fire callbacks.
  // Route through a silent gain so mic audio doesn't play through speakers.
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;
  scriptNode.connect(silentGain);
  silentGain.connect(audioContext.destination);

  function startRecording() {
    chunks = [];
    isCapturing = true;
  }

  function stopRecording(): VoicePcm {
    isCapturing = false;
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return { channels: [merged], sampleRate: audioContext.sampleRate };
  }

  function cleanup() {
    isCapturing = false;
    try { scriptNode.disconnect(); } catch { /* */ }
    try { silentGain.disconnect(); } catch { /* */ }
    stream.getTracks().forEach((t) => t.stop());
    if (audioContext.state !== "closed") {
      audioContext.close();
    }
  }

  return { analyserNode, audioContext, startRecording, stopRecording, cleanup };
}
