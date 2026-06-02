import React, { useRef, useEffect } from 'react';
import { MusicGenre } from '../types';

interface Props {
  analyser: AnalyserNode | null;
  isActive: boolean;
  status: string;
  genre: MusicGenre;
}

const BAR_COUNT = 32;

export const Visualizer: React.FC<Props> = ({ analyser, isActive, status, genre }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const simRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const barWidth = rect.width / BAR_COUNT;
    const barGap = 2;
    const drawWidth = barWidth - barGap;

    const draw = () => {
      const width = rect.width;
      const height = rect.height;
      ctx.clearRect(0, 0, width, height);

      let frequencies: number[] = [];

      if (analyser && isActive) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
        // Downsample to BAR_COUNT
        const step = Math.floor(bufferLength / BAR_COUNT);
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += dataArray[i * step + j];
          }
          frequencies.push(sum / step / 255); // normalize 0-1
        }
      } else if (isActive) {
        // Simulated genre-based visualization
        timeRef.current += 0.05;
        const t = timeRef.current;
        for (let i = 0; i < BAR_COUNT; i++) {
          let base = 0;
          switch (genre) {
            case 'lofi':
            case 'ambient':
              base = Math.sin(t * 0.5 + i * 0.2) * 0.3 + 0.3;
              break;
            case 'rock':
            case 'hiphop':
              base = Math.abs(Math.sin(t * 3 + i * 0.8)) * 0.7 + 0.2;
              break;
            case 'synthwave':
              base = Math.sin(t * 1.5 + i * 0.3) * 0.4 + 0.4;
              break;
            case 'jazz':
              base = Math.sin(t * 0.8 + i * 0.15) * 0.25 + 0.35 + Math.random() * 0.1;
              break;
            case 'classical':
              base = Math.sin(t * 0.3 + i * 0.1) * 0.2 + 0.3;
              break;
            default:
              base = Math.sin(t + i * 0.25) * 0.3 + 0.35;
          }
          // Smooth transition
          simRef.current[i] += (base - simRef.current[i]) * 0.15;
          frequencies.push(simRef.current[i]);
        }
      } else {
        // Idle: decay to zero
        for (let i = 0; i < BAR_COUNT; i++) {
          simRef.current[i] *= 0.9;
          frequencies.push(simRef.current[i]);
        }
      }

      // Draw bars
      for (let i = 0; i < BAR_COUNT; i++) {
        const value = frequencies[i];
        const barHeight = value * height * 0.9;
        const x = i * barWidth + barGap / 2;
        const y = height - barHeight;

        // Gradient based on height
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, 'rgba(255, 51, 51, 0.3)');
        gradient.addColorStop(0.5, 'rgba(255, 51, 51, 0.7)');
        gradient.addColorStop(1, 'rgba(255, 150, 50, 1)');

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, drawWidth, barHeight);

        // Top cap
        ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
        ctx.fillRect(x, y - 2, drawWidth, 2);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [analyser, isActive, genre]);

  if (status === 'generating_prompt' || status === 'generating_briefing' || status === 'generating_music') {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-radio-lit font-mono text-xs uppercase tracking-widest animate-pulse">
          <div className="w-2 h-2 rounded-full bg-radio-lit animate-ping" />
          Tuning...
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: 'block' }}
    />
  );
};
