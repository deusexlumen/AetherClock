import { Engine, Scene, Color4, Vector3, Color3, ArcRotateCamera, HemisphericLight, PointLight, MeshBuilder, StandardMaterial, DefaultRenderingPipeline } from '@babylonjs/core';
import { bloomAmount, getSceneRuntime, motionAmount } from './sceneTypes';
export function buildVaporwaveScene(engine: Engine, fftData?: Float32Array): Scene {
  const scene = new Scene(engine); scene.clearColor = new Color4(0.05, 0.02, 0.12, 1);
  const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2.8, 15, new Vector3(0, 1, 0), scene); camera.lowerRadiusLimit = 10; camera.upperRadiusLimit = 25;
  new HemisphericLight('hemi', new Vector3(0, 1, 0), scene).intensity = 0.2;
  const sunLight = new PointLight('sunLight', new Vector3(0, 5, -30), scene); sunLight.diffuse = new Color3(1, 0.2, 0.6); sunLight.intensity = 3;
  const sun = MeshBuilder.CreateDisc('sun', { radius: 4 }, scene); sun.position = new Vector3(0, 3, -35); const sunMat = new StandardMaterial('sunMat', scene); sunMat.emissiveColor = new Color3(1, 0.1, 0.5); sunMat.disableLighting = true; sun.material = sunMat;
  const sunHalo = MeshBuilder.CreateTorus('sunHalo', { diameter: 9.4, thickness: 0.035 }, scene); sunHalo.position = sun.position.clone(); const haloMat = new StandardMaterial('haloMat', scene); haloMat.emissiveColor = new Color3(0.1, 0.75, 1); haloMat.disableLighting = true; haloMat.alpha = 0.55; sunHalo.material = haloMat;
  const grid = MeshBuilder.CreateGround('grid', { width: 100, height: 100, subdivisions: 1 }, scene); const gridMat = new StandardMaterial('gridMat', scene); gridMat.emissiveColor = new Color3(0.8, 0.2, 0.8); gridMat.wireframe = true; gridMat.alpha = 0.25; grid.material = gridMat;
  const pipeline = new DefaultRenderingPipeline('post', true, scene, [camera]) as any; pipeline.bloomEnabled = true; pipeline.bloomWeight = 1.5; pipeline.bloomThreshold = 0.6; pipeline.bloomKernel = 64; pipeline.bloomScale = 0.5; pipeline.vignetteEnabled = true; pipeline.vignetteWeight = 1.2; pipeline.vignetteColor = new Color3(0.1, 0, 0.2); pipeline.vignetteBlendMode = 0; pipeline.fxaaEnabled = true; pipeline.grainEnabled = true; pipeline.grainIntensity = 12; pipeline.chromaticAberrationEnabled = true; pipeline.chromaticAberrationAberrationAmount = 8;
  let t = 0; scene.onBeforeRenderObservable.add(() => {
    const runtime = getSceneRuntime(scene); const motion = motionAmount(runtime); t += engine.getDeltaTime() * 0.001 * motion * runtime.settings.motionSpeed;
    sun.rotation.z = t * 0.05; sunHalo.rotation.y = t * 0.08; sunHalo.rotation.x = Math.sin(t * 0.06) * 0.15; camera.alpha = -Math.PI / 2 + Math.sin(t * 0.1) * 0.05 * motion;
    pipeline.bloomEnabled = runtime.settings.quality !== 'saver' && runtime.settings.glowIntensity > 0; pipeline.bloomWeight = bloomAmount(runtime, 1.2); pipeline.grainEnabled = !runtime.reducedMotion && runtime.settings.quality !== 'saver'; sunLight.intensity = 1.6 + runtime.circadian.daylight * 0.8;
    const data = (scene as any).fftData as Float32Array | undefined;
    if (data && data.length > 0 && runtime.settings.audioReactivity > 0) { const response = runtime.settings.audioReactivity / 100; const bass = data.slice(0, 8).reduce((a, b) => a + b, 0) / 8 * response; grid.scaling.y = 1 + bass * 0.8; sunLight.intensity += bass * 3; pipeline.bloomWeight += bass * 1.5; } else grid.scaling.y = 1;
  }); return scene;
}
