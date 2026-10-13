"use client";

import { useRef, useEffect } from "react";

interface Props { analyserNode: AnalyserNode | null; isActive: boolean; }

export default function WaveformVisualizer({ analyserNode, isActive }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode || !isActive) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const styles = getComputedStyle(canvas);
    const ink = styles.getPropertyValue("--ink").trim();
    const lime = styles.getPropertyValue("--lime").trim();
    const neutral = styles.getPropertyValue("--border").trim();
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const samples = new Float32Array(analyserNode.fftSize);
    let frame = 0;
    let lastDraw = 0;
    let energy = 0;
    function draw(now: number) {
      if (!canvas || !ctx || !analyserNode) return;
      // Reduced motion retains a quiet, audio-driven level meter at 5fps.
      if (now - lastDraw >= (motion.matches ? 200 : 33)) {
        lastDraw = now;
        analyserNode.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
        energy += (Math.min(1, rms * 5) - energy) * .3;
        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = ink;
        ctx.fillStyle = ink;
        ctx.lineWidth = 5;
        ctx.lineCap = "round";
        if (motion.matches) {
          ctx.fillStyle = neutral;
          ctx.fillRect(0, height / 2 - 5, width, 10);
          ctx.fillStyle = ink;
          ctx.fillRect(0, height / 2 - 5, Math.max(3, energy * width), 10);
        } else {
          ctx.beginPath();
          for (let x = 0; x <= width; x += 3) {
            const sample = samples[Math.min(samples.length - 1, Math.floor(x / width * samples.length))];
            const y = height / 2 + Math.max(-1, Math.min(1, sample * 2.5)) * height * .4;
            if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.fillStyle = lime;
          ctx.fillRect(0, height - 5, energy * width, 4);
        }
      }
      frame = requestAnimationFrame(draw);
    }
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [analyserNode, isActive]);
  return <canvas ref={canvasRef} width={600} height={120} className="live-waveform" role="img" aria-label="Live microphone waveform; responds to your voice" />;
}
