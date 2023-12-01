import { io } from "socket.io-client";
import {
  ArcRotateCamera,
  // Color3,
  Engine,
  HavokPlugin,
  HemisphericLight,
  MeshBuilder,
  PhysicsAggregate,
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeMesh,
  PhysicsShapeType,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import type { Socket } from "socket.io-client";

const groundSize = 100;

const canvas = document.getElementById(
  "canvasForTheServer"
) as HTMLCanvasElement;
const engine = new Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true,
  disableWebGL2Support: false,
});

function createHeightmap({ scene }: { scene: Scene }) {
  const ground = MeshBuilder.CreateGroundFromHeightMap(
    "ground",
    "assets/heightmap.png",
    {
      width: groundSize,
      height: groundSize,
      subdivisions: 100,
      maxHeight: 10,
    },
    scene
  );
}

const createScene = async function () {
  // This creates a basic Babylon Scene object (non-mesh)
  const scene = new Scene(engine);

  // This creates and positions a free camera (non-mesh)
  const camera = new ArcRotateCamera(
    "camera1",
    -Math.PI / 2,
    0.8,
    200,
    new Vector3(0, 0, 0)
  );

  // This targets the camera to scene origin
  camera.setTarget(Vector3.Zero());

  // This attaches the camera to the canvas
  camera.attachControl(canvas, true);

  // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);

  // Default intensity is 1. Let's dim the light a small amount
  light.intensity = 0.7;

  // Our built-in 'sphere' shape.
  const sphere = MeshBuilder.CreateSphere(
    "sphere",
    { diameter: 2, segments: 32 },
    scene
  );

  // Move the sphere upward at 4 units
  sphere.position.y = 60;

  createHeightmap({
    scene,
  });

  return {
    scene,
    sphere,
  };
};

createScene().then(({ scene, sphere }) => {
  engine.runRenderLoop(function () {
    if (scene) {
      scene.render();
    }
  });

  const socket = io(window.location.host);

  socket.on("server:sent sphere position", (sphereFromTheServer) => {
    sphere.position = sphereFromTheServer.position;
  });
});
// Resize
window.addEventListener("resize", function () {
  engine.resize();
});
