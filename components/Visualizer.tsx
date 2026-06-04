import React, { useRef, useEffect } from 'react';
import { AppStatus, MusicGenre } from '../types';

interface Props {
  analyser: AnalyserNode | null;
  isActive: boolean;
  status: AppStatus;
  genre: MusicGenre;
}

const BAR_COUNT = 32;

export const Visualizer: React.FC<Props> = ({ analyser, isActive, status, genre }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const simRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const timeRef = useRef<number>(0);
  const dprRef = useRef<number>(1);
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const freqArrayRef = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      const rect = parent ? parent.getBoundingClientRect() : canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dprRef.current = dpr;
      sizeRef.current = { width: rect.width, height: rect.height };
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resize)
      : null;
    if (ro && canvas.parentElement) {
      ro.observe(canvas.parentElement);
    } else {
      window.addEventListener('resize', resize);
    }

    const barWidth = sizeRef.current.width / BAR_COUNT;
    const barGap = 2;
    const drawWidth = barWidth - barGap;

    const gradient = ctx.createLinearGradient(0, sizeRef.current.height, 0, 0);
    gradient.addColorStop(0, 'rgba(255, 51, 51, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 51, 51, 0.7)');
    gradient.addColorStop(1, 'rgba(255, 150, 50, 1)');

    const draw = () => {
      const width = sizeRef.current.width;
      const height = sizeRef.current.height;
      ctx.clearRect(0, 0, width, height);

      let frequencies: number[] = [];

      if (analyser && isActive) {
        const bufferLength = analyser.frequencyBinCount;
        if (!freqArrayRef.current || freqArrayRef.current.length !== bufferLength) {
          freqArrayRef.current = new Uint8Array(bufferLength);
        }
        analyser.getByteFrequencyData(freqArrayRef.current);
        const dataArray = freqArrayRef.current;
        const step = Math.floor(bufferLength / BAR_COUNT);
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += dataArray[i * step + j];
          }
          frequencies.push(sum / step / 255);
        }
      } else if (isActive) {
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
          simRef.current[i] += (base - simRef.current[i]) * 0.15;
          frequencies.push(simRef.current[i]);
        }
      } else {
        for (let i = 0; i < BAR_COUNT; i++) {
          simRef.current[i] *= 0.9;
          frequencies.push(simRef.current[i]);
        }
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        const value = frequencies[i];
        const barHeight = value * height * 0.9;
        const x = i * barWidth + barGap / 2;
        const y = height - barHeight;

        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, drawWidth, Math.max(0, barHeight));

        if (barHeight >= 2) {
          ctx.fillStyle = 'rgba(255, 200, 100, 0.9)';
          ctx.fillRect(x, y - 2, drawWidth, 2);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      if (ro && canvas.parentElement) {
        ro.disconnect();
      } else {
        window.removeEventListener('resize', resize);
      }
    };
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
