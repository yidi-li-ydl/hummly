"use client";

import { useRef, useEffect, useCallback } from "react";

interface Props {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
}

export default function WaveformVisualizer({ analyserNode, isActive }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserNode.fftSize;
    const dataArray = new Float32Array(bufferLength);
    analyserNode.getFloatTimeDomainData(dataArray);

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw waveform
    ctx.lineWidth = 2;
    ctx.strokeStyle = isActive ? "#a855f7" : "#4a4a6a";
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i];
      const y = (v + 1) / 2 * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();

    // Glow effect when active
    if (isActive) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#a855f7";
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    animationRef.current = requestAnimationFrame(draw);
  }, [analyserNode, isActive]);

  useEffect(() => {
    if (analyserNode && isActive) {
      animationRef.current = requestAnimationFrame(draw);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyserNode, isActive, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={120}
      className="w-full h-[120px] rounded-lg bg-surface-secondary border border-surface-card"
    />
  );
}
