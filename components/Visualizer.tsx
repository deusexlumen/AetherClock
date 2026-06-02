import React, { useEffect, useState, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  status: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isActive, status }) => {
  const [heights, setHeights] = useState<number[]>(new Array(16).fill(0));
  const currentHeights = useRef<number[]>(new Array(16).fill(0));
  const animationRef = useRef<number>(0);
  
  const isPlaying = status === 'playing';
  const isGenerating = status === 'generating_music' || status === 'generating_prompt';
  
  // Calculate if we should be visible
  const shouldBeVisible = isActive || isGenerating || heights.some(h => h > 0);

  useEffect(() => {
    let lastTime = 0;
    const fps = 30;
    const interval = 1000 / fps;

    const animate = (timestamp: number) => {
      if (timestamp - lastTime >= interval) {
        lastTime = timestamp;

        if (isPlaying) {
          const time = Date.now() / 150;
          const targetHeights = Array.from({ length: 16 }, (_, i) => {
             let val = Math.random() * 20;
             val += Math.sin(time + i * 0.4) * 20;
             if (i < 4) {
                const beat = Math.sin(time * 2) > 0.7 ? 50 : 0;
                val += beat;
             }
             val += 20;
             if (i > 10) val += Math.random() * 30;
             return Math.max(5, Math.min(100, val));
          });

          currentHeights.current = currentHeights.current.map((curr, i) => {
             return curr + (targetHeights[i] - curr) * 0.4;
          });
          setHeights([...currentHeights.current]);

        } else if (isGenerating) {
          const t = Date.now() / 150;
          const generated = Array.from({ length: 16 }, (_, i) => {
             return Math.sin(t + i * 0.5) * 40 + 40;
          });
          setHeights(generated);
          currentHeights.current = generated;

        } else {
          // Idle - decay
          const allZero = currentHeights.current.every(h => h < 0.1);
          if (!allZero) {
             currentHeights.current = currentHeights.current.map((curr) => {
                return Math.max(0, curr * 0.8);
             });
             setHeights([...currentHeights.current]);
          }
        }
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, isGenerating]);

  return (
    <div className={`w-full bg-black/40 border border-white/5 rounded p-3 transition-opacity duration-1000 ${shouldBeVisible ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-end justify-between h-16 sm:h-20 gap-[2px] sm:gap-1">
        {heights.map((h, i) => {
            return (
                <div key={i} className="flex flex-col gap-[1px] w-full h-full justify-end group">
                   {[...Array(16)].map((_, j) => {
                       const totalSegments = 16;
                       const segmentThreshold = (j + 1) * (100 / totalSegments); 
                       const isLit = h >= segmentThreshold;
                       
                       return (
                           <div 
                             key={j}
                             className={`w-full h-full rounded-[0.5px] transition-all duration-75 ${
                                 isLit 
                                 ? 'bg-radio-lit shadow-[0_0_8px_rgba(255,51,51,0.6)] opacity-100' 
                                 : 'bg-white/5 opacity-20' 
                             }`}
                           ></div>
                       );
                   })}
                </div>
            );
        })}
        </div>
        <div className="flex justify-between mt-2 px-1 border-t border-white/5 pt-1">
             <span className="text-[8px] font-mono text-radio-dim uppercase tracking-wider">Lo</span>
             <span className="text-[8px] font-mono text-radio-dim uppercase tracking-wider">Mid</span>
             <span className="text-[8px] font-mono text-radio-dim uppercase tracking-wider">Hi</span>
        </div>
    </div>
  );
};