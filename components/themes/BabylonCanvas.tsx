import { useRef, useEffect } from 'react';
import { Engine, Scene } from '@babylonjs/core';

interface BabylonCanvasProps {
  theme: string;
  fftData?: Float32Array;
}

// Lazy load scene builders to keep bundle lean
const sceneLoaders: Record<string, () => Promise<any>> = {
  vaporwave: () => import('./scenes/vaporwave').then(m => m.buildVaporwaveScene),
  space: () => import('./scenes/space').then(m => m.buildSpaceScene),
  submarine: () => import('./scenes/submarine').then(m => m.buildSubmarineScene),
};

export const BabylonCanvas = ({ theme, fftData }: BabylonCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const rafRef = useRef<number>(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;

    let disposed = false;

    const init = async () => {
      // WebGL renderer (WebGPU-ready architecture — switch to WebGPUEngine when Babylon.js stabilizes)
      const engine = new Engine(canvas, true, {
        preserveDrawingBuffer: false,
        antialias: true,
        adaptToDeviceRatio: true,
      });
      if (disposed) { engine.dispose(); return; }
      engineRef.current = engine;

      const loader = sceneLoaders[theme] || sceneLoaders.vaporwave;
      const buildScene = await loader();
      if (disposed) { engine.dispose(); return; }

      const scene = buildScene(engine, fftData);
      if (disposed) { scene.dispose(); engine.dispose(); return; }
      sceneRef.current = scene;

      // Manual RAF loop — bypasses Babylon.js internal binding issues
      const renderLoop = () => {
        if (scene && typeof scene.render === 'function') {
          scene.render();
        }
        rafRef.current = requestAnimationFrame(renderLoop);
      };
      rafRef.current = requestAnimationFrame(renderLoop);

      const onResize = () => engine.resize();
      window.addEventListener('resize', onResize);

      cleanupRef.current = () => {
        cancelAnimationFrame(rafRef.current);
        window.removeEventListener('resize', onResize);
      };
    };

    init();

    return () => {
      disposed = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (sceneRef.current) {
        sceneRef.current.dispose();
        sceneRef.current = null;
      }
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [theme]);

  // Feed FFT updates into the running scene
  useEffect(() => {
    if (!sceneRef.current || !fftData) return;
    (sceneRef.current as any).fftData = fftData;
  }, [fftData]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
};
