import {
  Engine, Scene, Color4, Vector3, Color3, ArcRotateCamera,
  HemisphericLight, PointLight, MeshBuilder, StandardMaterial,
  ParticleSystem, Texture, DefaultRenderingPipeline, 
} from '@babylonjs/core';

// Pre-load shaders so Vite bundles them (ParticleSystem needs these)
import '@babylonjs/core/Shaders/particles.vertex';
import '@babylonjs/core/Shaders/particles.fragment';

export function buildSubmarineScene(engine: Engine, fftData?: Float32Array): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.02, 0.06, 0.08, 1);
  scene.fogMode = Scene.FOGMODE_EXP;
  scene.fogDensity = 0.03;
  scene.fogColor = new Color3(0.02, 0.08, 0.06);

  // Camera
  const camera = new ArcRotateCamera('cam', -Math.PI / 2, Math.PI / 2.6, 12, new Vector3(0, 0, 0), scene);
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 20;

  // Lighting
  new HemisphericLight('hemi', new Vector3(0, 1, 0), scene).intensity = 0.15;
  const sonarLight = new PointLight('sonar', new Vector3(0, 0, 0), scene);
  sonarLight.diffuse = new Color3(0.1, 1, 0.3);
  sonarLight.intensity = 1.5;

  // Sonar grid floor
  const grid = MeshBuilder.CreateGround('grid', { width: 60, height: 60, subdivisions: 20 }, scene);
  const gridMat = new StandardMaterial('gridMat', scene);
  gridMat.emissiveColor = new Color3(0.1, 0.6, 0.3);
  gridMat.wireframe = true;
  gridMat.alpha = 0.2;
  grid.material = gridMat;

  // Bubble particles
  const bubbleSystem = new ParticleSystem('bubbles', 500, scene);
  bubbleSystem.particleTexture = new Texture('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', scene);
  bubbleSystem.emitter = new Vector3(0, -5, 0);
  bubbleSystem.minEmitBox = new Vector3(-10, 0, -10);
  bubbleSystem.maxEmitBox = new Vector3(10, 0, 10);
  bubbleSystem.color1 = new Color4(0.2, 0.9, 0.5, 0.4);
  bubbleSystem.color2 = new Color4(0.1, 0.7, 0.4, 0.2);
  bubbleSystem.colorDead = new Color4(0, 0, 0, 0);
  bubbleSystem.minSize = 0.05;
  bubbleSystem.maxSize = 0.2;
  bubbleSystem.minLifeTime = 2;
  bubbleSystem.maxLifeTime = 5;
  bubbleSystem.emitRate = 80;
  bubbleSystem.gravity = new Vector3(0, 0.5, 0);
  bubbleSystem.direction1 = new Vector3(-0.5, 1, -0.5);
  bubbleSystem.direction2 = new Vector3(0.5, 1.5, 0.5);
  bubbleSystem.blendMode = ParticleSystem.BLENDMODE_ONEONE;
  bubbleSystem.start();

  // Sonar ping ring (torus that scales)
  const pingRing = MeshBuilder.CreateTorus('ping', { diameter: 4, thickness: 0.03 }, scene);
  const pingMat = new StandardMaterial('pingMat', scene);
  pingMat.emissiveColor = new Color3(0.2, 1, 0.4);
  pingMat.disableLighting = true;
  pingMat.alpha = 0.6;
  pingRing.material = pingMat;
  pingRing.position.y = 0.5;
  pingRing.scaling.setAll(0.1);

  // Post-processing
  const pipeline = new DefaultRenderingPipeline('post', true, scene, [camera]) as any;
  pipeline.bloomEnabled = true;
  pipeline.bloomWeight = 1.0;
  pipeline.bloomThreshold = 0.4;
  pipeline.bloomKernel = 64;
  pipeline.vignetteEnabled = true;
  pipeline.vignetteWeight = 1.3;
  pipeline.vignetteColor = new Color3(0, 0.05, 0.02);
  pipeline.vignetteBlendMode = 0; // MULTIPLY
  pipeline.fxaaEnabled = true;

  // Animation
  let t = 0;
  scene.onBeforeRenderObservable.add(() => {
    const dt = engine.getDeltaTime() * 0.001;
    t += dt;

    // Sonar ping
    const pingCycle = (t % 3); // 3 second ping cycle
    if (pingCycle < 2) {
      const pingScale = 0.1 + (pingCycle / 2) * 4;
      pingRing.scaling.setAll(pingScale);
      pingMat.alpha = 0.6 * (1 - pingCycle / 2);
    } else {
      pingRing.scaling.setAll(0.1);
      pingMat.alpha = 0;
    }

    camera.alpha = -Math.PI / 2 + Math.sin(t * 0.08) * 0.05;
    grid.rotation.y = t * 0.02;

    const data = (scene as any).fftData as Float32Array | undefined;
    if (data && data.length > 0) {
      const bass = data.slice(0, 8).reduce((a, b) => a + b, 0) / 8;
      sonarLight.intensity = 1 + bass * 4;
      bubbleSystem.emitRate = 80 + bass * 400;
      scene.fogDensity = 0.02 + bass * 0.02;
    }
  });

  return scene;
}
