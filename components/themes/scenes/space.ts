import {
  Engine, Scene, Color4, Vector3, Color3, ArcRotateCamera,
  HemisphericLight, PointLight, MeshBuilder, StandardMaterial,
  ParticleSystem, Texture, DefaultRenderingPipeline, 
} from '@babylonjs/core';

// Pre-load shaders so Vite bundles them (ParticleSystem needs these)
import '@babylonjs/core/Shaders/particles.vertex';
import '@babylonjs/core/Shaders/particles.fragment';

export function buildSpaceScene(engine: Engine, fftData?: Float32Array): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.01, 0.01, 0.03, 1);

  // Camera
  const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2.5, 20, Vector3.Zero(), scene);
  camera.lowerRadiusLimit = 15;
  camera.upperRadiusLimit = 40;

  // Lighting
  new HemisphericLight('hemi', new Vector3(0, 1, 0), scene).intensity = 0.1;
  const nebulaLight = new PointLight('nebula', new Vector3(-10, 5, -10), scene);
  nebulaLight.diffuse = new Color3(0.4, 0.1, 0.8);
  nebulaLight.intensity = 2;

  // Starfield particles
  const starSystem = new ParticleSystem('stars', 3000, scene);
  starSystem.particleTexture = new Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', scene);
  starSystem.emitter = new Vector3(0, 0, 0);
  starSystem.minEmitBox = new Vector3(-50, -50, -50);
  starSystem.maxEmitBox = new Vector3(50, 50, 50);
  starSystem.color1 = new Color4(1, 1, 1, 0.8);
  starSystem.color2 = new Color4(0.8, 0.9, 1, 0.5);
  starSystem.colorDead = new Color4(0, 0, 0, 0);
  starSystem.minSize = 0.05;
  starSystem.maxSize = 0.3;
  starSystem.minLifeTime = 9999;
  starSystem.maxLifeTime = 9999;
  starSystem.emitRate = 3000;
  starSystem.blendMode = ParticleSystem.BLENDMODE_ONEONE;
  starSystem.start();

  // Orbital ring
  const ring = MeshBuilder.CreateTorus('ring', { diameter: 8, thickness: 0.05 }, scene);
  const ringMat = new StandardMaterial('ringMat', scene);
  ringMat.emissiveColor = new Color3(0, 0.8, 1);
  ringMat.disableLighting = true;
  ring.material = ringMat;
  ring.rotation.x = Math.PI / 3;

  // Planet
  const planet = MeshBuilder.CreateSphere('planet', { diameter: 3, segments: 32 }, scene);
  const planetMat = new StandardMaterial('planetMat', scene);
  planetMat.diffuseColor = new Color3(0.1, 0.05, 0.3);
  planetMat.emissiveColor = new Color3(0.05, 0.02, 0.15);
  planet.material = planetMat;
  planet.position = new Vector3(5, -2, -5);

  // Post-processing
  const pipeline = new DefaultRenderingPipeline('post', true, scene, [camera]) as any;
  pipeline.bloomEnabled = true;
  pipeline.bloomWeight = 1.2;
  pipeline.bloomThreshold = 0.5;
  pipeline.bloomKernel = 128;
  pipeline.vignetteEnabled = true;
  pipeline.vignetteWeight = 1.5;
  pipeline.vignetteColor = new Color3(0, 0, 0);
  pipeline.vignetteBlendMode = 0; // MULTIPLY
  pipeline.fxaaEnabled = true;
  pipeline.grainEnabled = true;
  pipeline.grainIntensity = 8;

  // Animation
  let t = 0;
  scene.onBeforeRenderObservable.add(() => {
    t += engine.getDeltaTime() * 0.001;
    ring.rotation.y = t * 0.2;
    ring.rotation.z = Math.sin(t * 0.1) * 0.1;
    planet.rotation.y = t * 0.05;
    camera.alpha = -Math.PI / 2 + Math.sin(t * 0.05) * 0.1;

    const data = (scene as any).fftData as Float32Array | undefined;
    if (data && data.length > 0) {
      const treble = data.slice(24, 32).reduce((a, b) => a + b, 0) / 8;
      starSystem.emitRate = 3000 + treble * 5000;
      pipeline.bloomWeight = 1.0 + treble * 1.5;
    }
  });

  return scene;
}
