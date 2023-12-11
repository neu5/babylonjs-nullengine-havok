import { fileURLToPath } from "url";
import { resolve } from "path";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import {
  ArcRotateCamera,
  HavokPlugin,
  MeshBuilder,
  NullEngine,
  PhysicsAggregate,
  PhysicsBody,
  PhysicsMotionType,
  PhysicsShapeMesh,
  PhysicsShapeType,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";

import type { Engine } from "@babylonjs/core";

import * as path from "path";
import * as fs from "fs";

const getDirname = (meta: { url: string }) => fileURLToPath(meta.url);
const rootDir = getDirname(import.meta);
const distDir = resolve(rootDir, "../../../", "client/dist");

const app = express();
const httpServer = createServer(app);

const io = new Server<any>(httpServer);

const wasm = path.join(
  rootDir,
  "../../../../",
  "node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm"
);

const mapPath = path.join(rootDir, "../../", "src/assets/heightmap.png");

const groundSize = 100;
let groundPhysicsMaterial = { friction: 0.2, restitution: 0.3 };

const FRAME_IN_MS = 1000 / 30; // 30 FPS

// eslint-disable-next-line
let loop = setInterval(() => {}, FRAME_IN_MS);

const createHeightmap = ({
  scene,
  mapInBase64,
  material,
}: {
  scene: Scene;
  mapInBase64: string;
  material: StandardMaterial;
}) => {
  const ground = MeshBuilder.CreateGroundFromHeightMap(
    "groundHeightmap",
    mapInBase64,
    {
      width: groundSize,
      height: groundSize,
      subdivisions: 100,
      maxHeight: 10,
      onReady: (mesh) => {
        mesh.material = new StandardMaterial("heightmapMaterial");

        const groundShape = new PhysicsShapeMesh(ground, scene);

        const body = new PhysicsBody(
          ground,
          PhysicsMotionType.STATIC,
          false,
          scene
        );

        groundShape.material = material;
        body.shape = groundShape;
        body.setMassProperties({
          mass: 0,
        });
      },
    },
    scene
  );
};

const getInitializedHavok = async () => {
  try {
    const binary = fs.readFileSync(wasm);
    return await HavokPhysics({ wasmBinary: binary });
  } catch (e) {
    return e;
  }
};

const getMap = () => {
  const map = fs.readFileSync(mapPath);

  return "data:image/png;base64,".concat(Buffer.from(map).toString("base64"));
};

const createScene = async (engine: Engine) => {
  // This creates a basic Babylon Scene object (non-mesh)
  const scene = new Scene(engine);

  // This creates and positions a free camera (non-mesh)
  // eslint-disable-next-line
  const camera = new ArcRotateCamera(
    "camera1",
    -Math.PI / 2,
    0.8,
    200,
    new Vector3(0, 0, 0)
  );

  // initialize plugin
  const havokInstance = await getInitializedHavok();

  // pass the engine to the plugin
  const hk = new HavokPlugin(true, havokInstance);
  // enable physics in the scene with a gravity
  scene.enablePhysics(new Vector3(0, -9.8, 0), hk);

  return scene;
};

io.on("connection", async (socket) => {
  const engine = new NullEngine();

  const scene = await createScene(engine);

  const ground = MeshBuilder.CreateGround(
    "ground",
    { width: groundSize, height: groundSize },
    scene
  );

  const sphere = MeshBuilder.CreateSphere(
    "sphere",
    { diameter: 2, segments: 32 },
    scene
  );

  // Move the sphere upward at 4 units
  sphere.position.y = 20;

  const camera = new ArcRotateCamera( // eslint-disable-line
    "camera",
    -Math.PI / 2,
    Math.PI / 3.5,
    130,
    Vector3.Zero()
  );

  // eslint-disable-next-line
  const sphereAggregate = new PhysicsAggregate(
    sphere,
    PhysicsShapeType.SPHERE,
    { mass: 1, restitution: 0.75 },
    scene
  );

  // Create a static box shape.
  // eslint-disable-next-line
  const groundAggregate = new PhysicsAggregate(
    ground,
    PhysicsShapeType.BOX,
    { mass: 0 },
    scene
  );

  const mapInBase64 = await getMap();

  createHeightmap({
    scene,
    mapInBase64,
    material: groundPhysicsMaterial,
  });

  engine.runRenderLoop(() => {
    scene.render();
  });

  loop = setInterval(() => {
    socket.emit("server:sent sphere position", {
      position: sphere.position,
    });
  }, FRAME_IN_MS);

  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
});

app.use(express.static(distDir));

app.get("/", (req, res) => {
  res.sendFile("index.html", { root: distDir });
});

export const server = httpServer.listen(process.env.PORT || 5000);
