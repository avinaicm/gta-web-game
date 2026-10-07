import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);
scene.fog = new THREE.Fog(0x0b1020, 35, 180);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 5, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const keys = {};
const state = {
  x: 0,
  z: 0,
  rot: 0,
  speed: 0,
  brake: false,
};

const world = new THREE.Group();
scene.add(world);

const ambient = new THREE.HemisphereLight(0xbfe3ff, 0x101820, 1.4);
scene.add(ambient);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.3);
mainLight.position.set(20, 30, 10);
scene.add(mainLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 220),
  new THREE.MeshStandardMaterial({ color: 0x1b2e1a, roughness: 0.95, metalness: 0.05 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
world.add(ground);

const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x30363d, roughness: 0.8, metalness: 0.2 });
const laneMaterial = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, emissive: 0x111111, roughness: 0.6 });

function addRoad(x, z, width, depth) {
  const road = new THREE.Mesh(new THREE.BoxGeometry(width, 0.1, depth), roadMaterial);
  road.position.set(x, 0.02, z);
  world.add(road);

  const laneLine = new THREE.Mesh(new THREE.BoxGeometry(width * 0.02, 0.04, depth * 0.9), laneMaterial);
  laneLine.position.set(x, 0.08, z);
  world.add(laneLine);
}

for (let i = -8; i <= 8; i += 4) {
  addRoad(i * 8, 0, 6, 200);
  addRoad(0, i * 8, 200, 6);
}

function addBuilding(x, z, width, depth, height, color) {
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.25 })
  );
  building.position.set(x, height / 2, z);
  world.add(building);

  const roofGlow = new THREE.Mesh(
    new THREE.BoxGeometry(width * 0.7, 0.2, depth * 0.7),
    new THREE.MeshStandardMaterial({ color: 0xffd166, emissive: 0xffb703, emissiveIntensity: 0.7 })
  );
  roofGlow.position.set(x, height + 0.25, z);
  world.add(roofGlow);
}

function buildCity() {
  const palettes = [0x4ecdc4, 0x45aaf2, 0xff6b6b, 0xb8e994, 0xf7b801, 0x9b5de5, 0xfc6e51, 0x00bbf9];

  for (let x = -80; x <= 80; x += 18) {
    for (let z = -80; z <= 80; z += 18) {
      if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;
      if (Math.abs(x) % 36 === 0 && Math.abs(z) % 36 === 0) {
        const width = 8 + Math.random() * 8;
        const depth = 8 + Math.random() * 8;
        const height = 12 + Math.random() * 30;
        addBuilding(x + (Math.random() - 0.5) * 4, z + (Math.random() - 0.5) * 4, width, depth, height, palettes[Math.floor(Math.random() * palettes.length)]);
      }
    }
  }
}
buildCity();

function createCar(color = 0x00ff88) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.8, 4.2),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.6 })
  );
  body.position.y = 0.7;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.7, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.4, metalness: 0.5 })
  );
  cabin.position.set(0, 1.18, -0.15);
  group.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 16);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const wheelOffsets = [
    [-1.2, 0.3, 1.3],
    [1.2, 0.3, 1.3],
    [-1.2, 0.3, -1.3],
    [1.2, 0.3, -1.3],
  ];

  wheelOffsets.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    group.add(wheel);
  });

  const headlightMaterial = new THREE.MeshStandardMaterial({ color: 0xfdf9db, emissive: 0xf4f4a4, emissiveIntensity: 1.0 });
  const leftLight = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.2), headlightMaterial);
  const rightLight = leftLight.clone();
  leftLight.position.set(-0.7, 0.9, 2.1);
  rightLight.position.set(0.7, 0.9, 2.1);
  group.add(leftLight, rightLight);

  return group;
}

const playerCar = createCar(0x14f195);
playerCar.position.set(0, 0, 0);
scene.add(playerCar);

const remoteCars = new Map();
const socket = new WebSocket(`ws://${window.location.hostname}:3000`);
let playerId = null;

socket.addEventListener('message', (event) => {
  try {
    const payload = JSON.parse(event.data);

    if (payload.type === 'welcome') {
      playerId = payload.id;
      return;
    }

    if (payload.type !== 'snapshot') return;

    const currentEntries = new Map();
    payload.players.forEach((player) => {
      if (player.id === playerId) return;
      currentEntries.set(player.id, player);
    });

    remoteCars.forEach((car, id) => {
      if (!currentEntries.has(id)) {
        scene.remove(car);
        remoteCars.delete(id);
      }
    });

    currentEntries.forEach((player, id) => {
      let car = remoteCars.get(id);
      if (!car) {
        car = createCar(player.color || 0xff7f50);
        remoteCars.set(id, car);
        scene.add(car);
      }

      car.position.set(player.x, 0, player.z);
      car.rotation.y = player.rot;
    });
  } catch (error) {
    console.error('WebSocket packet parse error:', error);
  }
});

window.addEventListener('keydown', (event) => {
  keys[event.code] = true;
});

window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function vibrateController(strength = 0.5, duration = 90) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = Array.from(pads).find((gamepad) => gamepad && gamepad.connected);

  if (!pad || !pad.vibrationActuator) return;

  try {
    pad.vibrationActuator.playEffect('dual-rumble', {
      startDelay: 0,
      duration,
      weakMagnitude: clamp(strength * 0.6, 0, 1),
      strongMagnitude: clamp(strength, 0, 1),
    });
  } catch (error) {
    // Some browsers can throw if the actuator isn't supported.
  }
}

function getControllerInput() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = Array.from(pads).find((gamepad) => gamepad && gamepad.connected);

  if (!pad) {
    return { steer: 0, throttle: 0, brake: false };
  }

  const steer = pad.axes[0] || 0;
  const vertical = pad.axes[1] || 0;
  const triggerLeft = pad.buttons[6]?.value || 0;
  const triggerRight = pad.buttons[7]?.value || 0;

  let throttle = 0;
  if (vertical < -0.2) throttle = -vertical;
  if (triggerRight > 0.1) throttle = Math.max(throttle, triggerRight);
  if (vertical > 0.2) throttle = -vertical * 0.35;
  if (triggerLeft > 0.1 && throttle <= 0.01) throttle = -triggerLeft * 0.4;

  const brake = Boolean(pad.buttons[0]?.pressed) || Boolean(pad.buttons[1]?.pressed);

  return { steer, throttle, brake };
}

function updateVehicle(dt) {
  const steerInput = (keys.KeyA || keys.ArrowLeft ? -1 : 0) + (keys.KeyD || keys.ArrowRight ? 1 : 0);
  const throttleInput = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const brakeInput = keys.Space || keys.KeyX;

  const controller = getControllerInput();
  const targetSteer = steerInput !== 0 ? steerInput : controller.steer;
  const targetThrottle = throttleInput !== 0 ? throttleInput : controller.throttle;
  const targetBrake = brakeInput || controller.brake;

  const throttleValue = targetThrottle * 18;
  const steerRate = 2.3;

  state.rot += targetSteer * steerRate * dt * (0.8 + Math.abs(state.speed) * 0.04);

  if (targetBrake) {
    state.speed *= 0.92;
    vibrateController(0.12, 35);
  } else {
    state.speed += throttleValue * dt;
  }

  state.speed *= 0.985;
  state.speed = clamp(state.speed, -12, 22);

  state.x += Math.sin(state.rot) * state.speed * dt;
  state.z += Math.cos(state.rot) * state.speed * dt;

  playerCar.position.set(state.x, 0, state.z);
  playerCar.rotation.y = state.rot;

  if (Math.abs(state.speed) > 8) {
    vibrateController(Math.min(1, Math.abs(state.speed) / 30), 30);
  }
}

function updateCamera(dt) {
  const cameraHeight = 6;
  const lookAhead = 8;
  const desiredPosition = new THREE.Vector3(
    state.x - Math.sin(state.rot) * lookAhead,
    cameraHeight,
    state.z - Math.cos(state.rot) * lookAhead
  );

  camera.position.lerp(desiredPosition, 1 - Math.exp(-dt * 4));
  const lookTarget = new THREE.Vector3(state.x + Math.sin(state.rot) * 20, 1.7, state.z + Math.cos(state.rot) * 20);
  camera.lookAt(lookTarget);
}

function sendNetworkState() {
  if (!playerId || !socket || socket.readyState !== WebSocket.OPEN) return;

  const payload = {
    type: 'state',
    player: {
      id: playerId,
      x: state.x,
      z: state.z,
      rot: state.rot,
      speed: state.speed,
      color: '#14f195',
    },
  };

  socket.send(JSON.stringify(payload));
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.033);

  updateVehicle(dt);
  updateCamera(dt);
  sendNetworkState();

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
