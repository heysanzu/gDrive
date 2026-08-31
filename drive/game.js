// ── AUTO-HIDE UI ──────────────────────────────────────────────
const uiEl = document.getElementById('ui');
let hideTimer = null;
let gameStarted = false;

function hideUI() {
    clearTimeout(hideTimer);
    uiEl.classList.add('hidden');
}

function showUI() {
    clearTimeout(hideTimer);
    uiEl.classList.remove('hidden');
}

// ── AUDIO ─────────────────────────────────────────────────────
let audioCtx = null;
let engineNode = null;
let engineGain = null;
let bgNode = null;
let bgGain = null;

function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Background ambient drone — two detuned sawtooth oscillators
    bgGain = audioCtx.createGain();
    bgGain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    bgGain.connect(audioCtx.destination);

    [55, 55.4].forEach(freq => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.connect(bgGain);
        osc.start();
    });

    // Engine hum — sine wave, pitch rises slightly with speed
    engineGain = audioCtx.createGain();
    engineGain.gain.setValueAtTime(0, audioCtx.currentTime);
    engineGain.connect(audioCtx.destination);

    engineNode = audioCtx.createOscillator();
    engineNode.type = 'sine';
    engineNode.frequency.value = 90;
    engineNode.connect(engineGain);
    engineNode.start();
}

function updateEngineSound(speed) {
    if (!audioCtx) return;
    const targetFreq = 80 + Math.abs(speed) * 18;
    engineNode.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.05);
    engineGain.gain.setTargetAtTime(0.09, audioCtx.currentTime, 0.1);
}

function stopEngineSound() {
    if (!engineGain) return;
    engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
}

function playBoostSound() {
    if (!audioCtx) return;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.25, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    g.connect(audioCtx.destination);

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.2);
    osc.connect(g);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
}

function playCrashSound() {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * 0.6;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.6, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

    source.connect(filter);
    filter.connect(g);
    g.connect(audioCtx.destination);
    source.start();
    source.stop(audioCtx.currentTime + 0.6);
}

// ── GAME VARIABLES ────────────────────────────────────────────
let score = 0;
let gameOver = false;
let carX = 0;
let velocityX = 0;
const SPEED = 0.6;
const STEER_SENSITIVITY = 0.12;
const ROAD_WIDTH = 20;
const boosts = [];
const rocks = [];
const stripes = [];
const BOOST_GAP = 250;
const ROCK_GAP = 200;
const STRIPE_SPACING = 20;

// ── THREE.JS SETUP ────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdddddd);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 15);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(10, 20, 10);
scene.add(dirLight);

const sunGeo = new THREE.SphereGeometry(8, 32, 32);
const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const sun = new THREE.Mesh(sunGeo, sunMat);
sun.position.set(40, 30, -200);
scene.add(sun);
const sunLight = new THREE.PointLight(0xffffff, 1.5, 500);
sunLight.position.copy(sun.position);
scene.add(sunLight);

const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, 10000);
const roadMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
const road = new THREE.Mesh(roadGeo, roadMat);
road.rotation.x = -Math.PI / 2;
road.position.y = -0.1;
scene.add(road);

const footpathWidth = 5;
const footpathGeo = new THREE.PlaneGeometry(footpathWidth, 10000);
const footpathMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

const leftFootpath = new THREE.Mesh(footpathGeo, footpathMat);
leftFootpath.rotation.x = -Math.PI / 2;
leftFootpath.position.set(-(ROAD_WIDTH / 2 + footpathWidth / 2), -0.5, 0);
scene.add(leftFootpath);

const rightFootpath = new THREE.Mesh(footpathGeo, footpathMat);
rightFootpath.rotation.x = -Math.PI / 2;
rightFootpath.position.set((ROAD_WIDTH / 2 + footpathWidth / 2), -0.5, 0);
scene.add(rightFootpath);

function createStripes() {
    const stripeGeo = new THREE.PlaneGeometry(0.5, 10);
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    for (let i = 0; i < 50; i++) {
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(0, 0.01, -i * STRIPE_SPACING);
        scene.add(stripe);
        stripes.push(stripe);
    }
}
createStripes();

const carGroup = new THREE.Group();
const carBodyGeo = new THREE.BoxGeometry(2, 1, 4);
const carBodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
const carBody = new THREE.Mesh(carBodyGeo, carBodyMat);
carGroup.add(carBody);

const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(
        (i % 2 ? -1 : 1) * 0.8,
        -0.5,
        (i < 2 ? 1 : -1) * 1.2
    );
    carGroup.add(wheel);
}

carGroup.position.set(0, 1, 0);
scene.add(carGroup);

// ── OBJECT CREATORS ───────────────────────────────────────────
function createBoost(z) {
    const greys = [0xffffff, 0xcccccc, 0x999999, 0x666666, 0x444444];
    const randomColor = greys[Math.floor(Math.random() * greys.length)];
    const geo = new THREE.SphereGeometry(1, 16, 16);
    const mat = new THREE.MeshLambertMaterial({ color: randomColor });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((Math.random() - 0.5) * (ROAD_WIDTH - 2), 1, z);
    scene.add(mesh);
    boosts.push({ mesh, z });
}

function createRock(z) {
    const isStone = Math.random() > 0.5;
    const size = isStone ? 1.5 : 2.5;
    const geo = new THREE.DodecahedronGeometry(size, 0);
    const mat = new THREE.MeshLambertMaterial({ color: isStone ? 0x888888 : 0x333333 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
        (Math.random() - 0.5) * (ROAD_WIDTH - 4),
        size,
        z
    );
    scene.add(mesh);
    rocks.push({ mesh, z, size });
}

createBoost(-50);
createRock(-100);

// ── MEDIAPIPE HANDS ───────────────────────────────────────────
const video = document.createElement('video');
let handTilt = 0;
let lastHandTime = performance.now();
const HAND_TIMEOUT = 1000;

function onResults(results) {
    document.getElementById('loading').style.display = 'none';
    const now = performance.now();

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        if (!gameStarted && !gameOver) {
            gameStarted = true;
            initAudio();
            hideUI();
        }
        lastHandTime = now;
        const lm = results.multiHandLandmarks[0];
        const wristX = lm[0].x;
        const middleMCPX = lm[9].x;
        const targetTilt = -(middleMCPX - wristX) * 7;
        handTilt += (targetTilt - handTilt) * 0.4;
    } else if (now - lastHandTime < HAND_TIMEOUT) {
        handTilt += (0 - handTilt) * 0.05;
    } else {
        handTilt = 0;
    }
}

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.85,
    minTrackingConfidence: 0.85
});
hands.onResults(onResults);

const cameraUtils = new Camera(video, {
    onFrame: async () => await hands.send({ image: video }),
    width: 480,
    height: 360
});
cameraUtils.start();

// ── GAME LOGIC ────────────────────────────────────────────────
function updateScoreChip() {
    document.getElementById('score-chip').innerText = `Score: ${score}`;
}

function restartGame() {
    score = 0;
    gameOver = false;
    gameStarted = false;
    carX = 0;
    velocityX = 0;
    handTilt = 0;

    updateScoreChip();

    boosts.forEach(({ mesh }) => scene.remove(mesh));
    rocks.forEach(({ mesh }) => scene.remove(mesh));
    boosts.length = 0;
    rocks.length = 0;
    createBoost(-50);
    createRock(-100);

    stripes.forEach((stripe, i) => {
        stripe.position.z = -i * STRIPE_SPACING;
    });

    uiEl.innerHTML = `
        <h1>Drive</h1>
        <p class="hint">🖐 Tilt hand → STEER</p>
        <p class="hint">Keep your hand visible to drive!</p>
        <p class="hint">Collect boosts, avoid rocks!</p>
        <button id="restart" onclick="restartGame()">Restart</button>
        <a class="gh-link" href="https://github.com/heysanzu/gameDrive" target="_blank" rel="noopener">GitHub ↗</a>
    `;
    document.getElementById('restart').style.display = 'none';

    showUI();
    animate();
}

// ── ANIMATION LOOP ────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
    if (gameOver) return;
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    velocityX += handTilt * STEER_SENSITIVITY * delta * 60;
    velocityX *= 0.8;
    carX += velocityX * delta * 60;
    carX = Math.max(-ROAD_WIDTH / 2 + 1, Math.min(ROAD_WIDTH / 2 - 1, carX));
    carGroup.position.x = carX;

    const forwardSpeed = SPEED * delta * 60;

    if (gameStarted) updateEngineSound(velocityX);

    stripes.forEach(stripe => {
        stripe.position.z += forwardSpeed;
        if (stripe.position.z > 10) stripe.position.z -= stripes.length * STRIPE_SPACING;
    });

    let i = 0;
    while (i < boosts.length) {
        const boost = boosts[i];
        boost.z += forwardSpeed;
        boost.mesh.position.z = boost.z;
        if (boost.z > 10) { scene.remove(boost.mesh); boosts.splice(i, 1); continue; }
        if (Math.abs(boost.mesh.position.x - carX) < 2 && Math.abs(boost.z) < 2) {
            scene.remove(boost.mesh);
            boosts.splice(i, 1);
            score += 10;
            updateScoreChip();
            playBoostSound();
            continue;
        }
        i++;
    }

    i = 0;
    while (i < rocks.length) {
        const rock = rocks[i];
        rock.z += forwardSpeed;
        rock.mesh.position.z = rock.z;
        if (rock.z > 10) { scene.remove(rock.mesh); rocks.splice(i, 1); continue; }
        if (Math.abs(rock.mesh.position.x - carX) < 2 && Math.abs(rock.z) < 2) {
            gameOver = true;
            stopEngineSound();
            playCrashSound();
            showUI();
            document.getElementById('restart').style.display = 'block';
            uiEl.innerHTML += '<p class="gameover-title">GAME OVER!</p>';
            uiEl.innerHTML += '<p class="gameover-sub">by Sanzu</p>';
            return;
        }
        i++;
    }

    if (boosts.length === 0) {
        createBoost(-50);
    } else if (boosts[boosts.length - 1].z > -500) {
        createBoost(boosts[boosts.length - 1].z - BOOST_GAP);
    }
    if (rocks.length === 0) {
        createRock(-100);
    } else if (rocks[rocks.length - 1].z > -500) {
        createRock(rocks[rocks.length - 1].z - ROCK_GAP);
    }

    camera.position.z = carGroup.position.z + 15;
    camera.position.x = carGroup.position.x * 0.5;
    camera.lookAt(carGroup.position.x * 0.5, 1, carGroup.position.z);

    renderer.render(scene, camera);
}

animate();

// ── RESIZE ───────────────────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
