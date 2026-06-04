import {
  Engine, Scene, Color4, Vector3, Color3, ArcRotateCamera,
  HemisphericLight, PointLight, MeshBuilder, StandardMaterial,
  DefaultRenderingPipeline, 
} from '@babylonjs/core';

export function buildVaporwaveScene(engine: Engine, fftData?: Float32Array): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.05, 0.02, 0.12, 1);

  // Camera
  const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2.8, 15, new Vector3(0, 1, 0), scene);
  camera.lowerRadiusLimit = 10;
  camera.upperRadiusLimit = 25;

  // Lighting
  new HemisphericLight('hemi', new Vector3(0, 1, 0), scene).intensity = 0.2;
  const sunLight = new PointLight('sunLight', new Vector3(0, 5, -30), scene);
  sunLight.diffuse = new Color3(1, 0.2, 0.6);
  sunLight.intensity = 3;

  // Retro Sun
  const sun = MeshBuilder.CreateDisc('sun', { radius: 4 }, scene);
  sun.position = new Vector3(0, 3, -35);
  const sunMat = new StandardMaterial('sunMat', scene);
  sunMat.emissiveColor = new Color3(1, 0.1, 0.5);
  sunMat.disableLighting = true;
  sun.material = sunMat;

  // Grid Floor
  const grid = MeshBuilder.CreateGround('grid', { width: 100, height: 100, subdivisions: 1 }, scene);
  const gridMat = new StandardMaterial('gridMat', scene);
  gridMat.emissiveColor = new Color3(0.8, 0.2, 0.8);
  gridMat.wireframe = true;
  gridMat.alpha = 0.25;
  grid.material = gridMat;

  // Post-processing
  const pipeline = new DefaultRenderingPipeline('post', true, scene, [camera]);
  pipeline.bloomEnabled = true;
  pipeline.bloomWeight = 1.5;
  pipeline.bloomThreshold = 0.6;
  pipeline.bloomKernel = 64;
  pipeline.bloomScale = 0.5;
  pipeline.vignetteEnabled = true;
  pipeline.vignetteWeight = 1.2;
  pipeline.vignetteColor = new Color3(0.1, 0, 0.2);
  pipeline.vignetteBlendMode = 0; // MULTIPLY
  pipeline.fxaaEnabled = true;
  pipeline.grainEnabled = true;
  pipeline.grainIntensity = 12;
  pipeline.chromaticAberrationEnabled = true;
  pipeline.chromaticAberrationAberrationAmount = 8;

  // Animation loop
  let t = 0;
  scene.onBeforeRenderObservable.add(() => {
    t += engine.getDeltaTime() * 0.001;
    sun.rotation.z = t * 0.05;
    camera.alpha = -Math.PI / 2 + Math.sin(t * 0.1) * 0.05;

    // FFT reactivity
    const data = (scene as any).fftData as Float32Array | undefined;
    if (data && data.length > 0) {
      const bass = data.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
      grid.scaling.y = 1 + bass * 0.8;
      sunLight.intensity = 2 + bass * 3;
      pipeline.bloomWeight = 1.2 + bass * 1.5;
    }
  });

  return scene;
}
