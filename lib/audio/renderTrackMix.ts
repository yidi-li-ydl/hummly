import toWav from "audiobuffer-to-wav";

/** Mix the already rendered/edited tracks with the same gains used by playback. */
export async function renderTrackMix(tracks: { buffer: AudioBuffer; volume: number }[]): Promise<string> {
  const duration = Math.max(...tracks.map(track => track.buffer.duration));
  const sampleRate = 44100;
  const context = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * sampleRate)), sampleRate);
  for (const { buffer, volume } of tracks) {
    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(gain);
    gain.connect(context.destination);
    source.start();
  }
  const buffer = await context.startRendering();
  return URL.createObjectURL(new Blob([toWav(buffer)], { type: "audio/wav" }));
}
