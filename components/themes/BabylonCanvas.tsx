import { useEffect, useRef, useState } from 'react';
import { Engine, Scene } from '@babylonjs/core';
import type { AppStatus, VisualSettings } from '../../types';
import type { CircadianSnapshot } from '../../services/visualSettings';
import { getThemeDefinition } from './registry';
import { renderScale, type SceneRuntime } from './scenes/sceneTypes';
interface BabylonCanvasProps { theme: string; fftData?: Float32Array; settings: VisualSettings; reducedMotion: boolean; circadian: CircadianSnapshot; status: AppStatus; }
const sceneLoaders: Record<string, () => Promise<(engine: Engine, fftData?: Float32Array) => Scene>> = { vaporwave: () => import('./scenes/vaporwave').then(module => module.buildVaporwaveScene), space: () => import('./scenes/space').then(module => module.buildSpaceScene), submarine: () => import('./scenes/submarine').then(module => module.buildSubmarineScene) };
export const BabylonCanvas = ({ theme, fftData, settings, reducedMotion, circadian, status }: BabylonCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null); const engineRef = useRef<Engine | null>(null); const sceneRef = useRef<Scene | null>(null);
  const rafRef = useRef<number>(0); const needsRenderRef = useRef(true); const latestRef = useRef<SceneRuntime>({ settings, reducedMotion, circadian, status });
  const fftRef = useRef(fftData); const [fallback, setFallback] = useState(false); const fallbackRef = useRef(false);
  const sceneType = getThemeDefinition(theme).scene; const isWebGL = sceneType !== 'css';
  latestRef.current = { settings, reducedMotion, circadian, status }; fallbackRef.current = fallback; fftRef.current = fftData;
  useEffect(() => {
    needsRenderRef.current = true; const runtime = latestRef.current;
    if (sceneRef.current) sceneRef.current.metadata = { ...(sceneRef.current.metadata || {}), aether: runtime };
    const engine = engineRef.current;
    if (engine) { const qualityScale = renderScale(runtime.settings.quality); const deviceScale = runtime.settings.quality === 'auto' && (navigator.hardwareConcurrency || 4) <= 4 ? 1.35 : 1; engine.setHardwareScalingLevel(qualityScale * deviceScale); }
  }, [settings, reducedMotion, circadian, status]);
  useEffect(() => { if (sceneRef.current) (sceneRef.current as any).fftData = fftData; needsRenderRef.current = true; }, [fftData]);
  useEffect(() => {
    setFallback(false); if (!isWebGL || !canvasRef.current) return;
    const canvas = canvasRef.current; let disposed = false; let engine: Engine | null = null; let scene: Scene | null = null; let lastFrame = 0; let renderPressure = 0; let adaptiveScale = 1;
    const onContextLost = (event: Event) => { event.preventDefault(); if (!disposed) setFallback(true); }; const onResize = () => engine?.resize();
    canvas.addEventListener('webglcontextlost', onContextLost); window.addEventListener('resize', onResize);
    const init = async () => {
      try {
        engine = new Engine(canvas, true, { preserveDrawingBuffer: false, antialias: settings.quality !== 'saver', adaptToDeviceRatio: false, failIfMajorPerformanceCaveat: false });
        if (disposed) { engine.dispose(); return; } engineRef.current = engine; engine.setHardwareScalingLevel(renderScale(latestRef.current.settings.quality));
        const loader = sceneLoaders[sceneType]; if (!loader) throw new Error(`No scene loader for ${sceneType}`); const buildScene = await loader();
        if (disposed) { engine.dispose(); return; } scene = buildScene(engine, fftRef.current); scene.metadata = { ...(scene.metadata || {}), aether: latestRef.current }; sceneRef.current = scene;
        const renderLoop = (time: number) => {
          if (disposed) return; rafRef.current = requestAnimationFrame(renderLoop);
          if (document.hidden || fallbackRef.current || !scene || scene.isDisposed) return;
          const runtime = latestRef.current; const fps = runtime.settings.quality === 'saver' ? 24 : runtime.settings.quality === 'balanced' ? 40 : 60;
          if (time - lastFrame < 1000 / fps) return;
          if (runtime.settings.quality === 'auto' && lastFrame > 0) { const frameTime = time - lastFrame; renderPressure = frameTime > 34 ? renderPressure + 1 : Math.max(0, renderPressure - 1); if (renderPressure > 45 && adaptiveScale === 1) { adaptiveScale = 1.45; engine?.setHardwareScalingLevel(renderScale('auto') * adaptiveScale); renderPressure = 0; } }
          if (runtime.reducedMotion && !needsRenderRef.current) return;
          scene.metadata = { ...(scene.metadata || {}), aether: runtime }; scene.render(); needsRenderRef.current = false; lastFrame = time;
        };
        rafRef.current = requestAnimationFrame(renderLoop);
      } catch (error) { console.warn('[AetherClock] WebGL atmosphere unavailable; using CSS scene.', error); if (!disposed) setFallback(true); }
    };
    void init();
    return () => { disposed = true; cancelAnimationFrame(rafRef.current); canvas.removeEventListener('webglcontextlost', onContextLost); window.removeEventListener('resize', onResize); sceneRef.current = null; engineRef.current = null; scene?.dispose(); engine?.dispose(); };
  }, [theme, sceneType, isWebGL]);
  if (!isWebGL) return null;
  return <><canvas ref={canvasRef} className={`babylon-atmosphere ${fallback ? 'is-fallback' : ''}`} aria-hidden="true" />{fallback && <span className="scene-fallback-status" role="status">WebGL unavailable · CSS atmosphere active</span>}</>;
};
