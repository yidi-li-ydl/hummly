export interface RecorderHandle {
  analyserNode: AnalyserNode;
  audioContext: AudioContext;
  startRecording: () => void;
  stopRecording: () => Promise<Blob>;
  cleanup: () => void;
}

export async function createRecorder(): Promise<RecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);

  // Analyser for pitch detection
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 2048;
  source.connect(analyserNode);

  // MediaRecorder for capturing audio blob
  const mediaRecorder = new MediaRecorder(stream);
  const chunks: BlobPart[] = [];

  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  function startRecording() {
    chunks.length = 0;
    mediaRecorder.start();
  }

  function stopRecording(): Promise<Blob> {
    return new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        resolve(blob);
      };
      mediaRecorder.stop();
    });
  }

  function cleanup() {
    stream.getTracks().forEach((t) => t.stop());
    if (audioContext.state !== "closed") {
      audioContext.close();
    }
  }

  return { analyserNode, audioContext, startRecording, stopRecording, cleanup };
}
