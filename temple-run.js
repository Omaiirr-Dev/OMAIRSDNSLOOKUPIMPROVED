// Three.js aliases - will be initialized when THREE is loaded
let Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight, HemisphereLight, PointLight;
let Mesh, Group, BoxGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, OctahedronGeometry, TetrahedronGeometry;
let MeshPhongMaterial, MeshStandardMaterial, MeshBasicMaterial;
let Fog, Color, Box3, Vector3, Clock;

// Game state
let scene, camera, renderer, clock;
let player, playerMesh;
let groundSegments = [];
let obstacles = [];
let coins = [];
let powerups = [];
let particles = [];
let trailParticles = [];
let decorations = [];

// Game variables
let gameState = 'menu';
let score = 0;
let coinsCollected = 0;
let totalCoinsEver = parseInt(localStorage.getItem('totalCoins')) || 0;
let distance = 0;
let combo = 0;
let speed = 0.08; // Slower base speed
let baseSpeed = 0.08;
let maxSpeed = 0.3;
let speedIncrement = 0.00005;

// Player state
let currentLane = 0;
let targetLane = 0;
let isJumping = false;
let isSliding = false;
let jumpVelocity = 0;
let gravity = 0.015;
let jumpPower = 0.35;
let playerY = 0;
let playerRotation = 0;

// Active powerup
let activePowerup = null;
let powerupDuration = 0;
let isInvincible = false;

// Camera state
let cameraShake = 0;
let cameraOffset = new Vector3(0, 5, 5);

// Constants
const LANE_WIDTH = 2.5;
const SEGMENT_LENGTH = 15;
const SEGMENTS_VISIBLE = 25;
const PLAYER_Z = -8;

// Settings
let settings = {
    darkMode: true,
    scanlines: true,
    particles: true,
    cameraShake: true,
    sfx: true,
    music: true,
    speed: 100,
    difficulty: 2,
    character: 'cube',
    biome: 'cybercity'
};

// Biome configurations
const biomes = {
    cybercity: {
        name: 'Cyber City',
        fogColor: 0x1e3c72,
        bgColor: 0x0a0a0f,
        groundColor: 0x8338ec,
        wallColor: 0x5f27cd,
        accentColor: 0xff006e,
        lightColor: 0x06ffa5
    },
    neonforest: {
        name: 'Neon Forest',
        fogColor: 0x0d3b34,
        bgColor: 0x05150f,
        groundColor: 0x00d9a3,
        wallColor: 0x00a878,
        accentColor: 0xff6b9d,
        lightColor: 0x00ffcc
    },
    spacestation: {
        name: 'Space Station',
        fogColor: 0x0a0a1a,
        bgColor: 0x000005,
        groundColor: 0x4a5568,
        wallColor: 0x2d3748,
        accentColor: 0x38bdf8,
        lightColor: 0xa78bfa
    },
    sunset: {
        name: 'Sunset Drive',
        fogColor: 0xff6b9d,
        bgColor: 0x1a0a1f,
        groundColor: 0xf72585,
        wallColor: 0x7209b7,
        accentColor: 0xffbe0b,
        lightColor: 0xff9e00
    }
};

let currentBiome = biomes[settings.biome];
let biomeDistance = 0;
let nextBiomeChange = 500;

// Best score
let bestScore = parseInt(localStorage.getItem('templeRunBestScore')) || 0;

// Keys
let keys = {};

// Initialize game
function init() {
    // Initialize Three.js classes
    if (typeof THREE !== 'undefined') {
        ({ Scene, PerspectiveCamera, WebGLRenderer, AmbientLight, DirectionalLight, HemisphereLight, PointLight,
            Mesh, Group, BoxGeometry, SphereGeometry, CylinderGeometry, TorusGeometry, OctahedronGeometry, TetrahedronGeometry,
            MeshPhongMaterial, MeshStandardMaterial, MeshBasicMaterial,
            Fog, Color, Box3, Vector3, Clock } = THREE);
    } else {
        console.error('THREE.js failed to load!');
        return;
    }

    // Hide loading screen
    setTimeout(() => {
        document.getElementById('loadingScreen').classList.add('hidden');
    }, 2000);

    // Create scene
    scene = new Scene();
    updateBiome(currentBiome);

    // Create camera
    camera = new PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 5, PLAYER_Z + 5);
    camera.lookAt(0, 2, PLAYER_Z - 15);

    // Create renderer
    const canvas = document.getElementById('gameCanvas');
    renderer = new WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Clock for smooth animations
    clock = new Clock();

    // Lighting setup
    setupLighting();

    // Create player
    createPlayer();

    // Create initial ground
    for (let i = 0; i < SEGMENTS_VISIBLE; i++) {
        createGroundSegment(-i * SEGMENT_LENGTH);
    }

    // Event listeners
    setupEventListeners();

    // Update UI
    updateAllUI();

    // Start animation loop
    animate();
}

// Setup lighting
function setupLighting() {
    // Ambient light
    const ambientLight = new AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Main directional light
    const directionalLight = new DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -30;
    directionalLight.shadow.camera.right = 30;
    directionalLight.shadow.camera.top = 30;
    directionalLight.shadow.camera.bottom = -30;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Hemisphere light
    const hemiLight = new HemisphereLight(currentBiome.lightColor, currentBiome.accentColor, 0.6);
    scene.add(hemiLight);

    // Accent point lights
    const pointLight1 = new PointLight(currentBiome.accentColor, 1, 50);
    pointLight1.position.set(-5, 3, PLAYER_Z - 10);
    scene.add(pointLight1);

    const pointLight2 = new PointLight(currentBiome.lightColor, 1, 50);
    pointLight2.position.set(5, 3, PLAYER_Z - 10);
    scene.add(pointLight2);
}

// Create player based on selected character
function createPlayer() {
    const characterType = settings.character;
    let geometry;

    switch (characterType) {
        case 'sphere':
            geometry = new SphereGeometry(0.8, 32, 32);
            break;
        case 'pyramid':
            geometry = new TetrahedronGeometry(1);
            break;
        case 'star':
            geometry = new OctahedronGeometry(0.8);
            break;
        case 'crystal':
            geometry = new OctahedronGeometry(1, 0);
            break;
        case 'neon':
            geometry = new TorusGeometry(0.6, 0.3, 16, 32);
            break;
        default: // cube
            geometry = new BoxGeometry(0.9, 1.7, 0.9);
    }

    const material = new MeshPhongMaterial({
        color: currentBiome.accentColor,
        emissive: currentBiome.accentColor,
        emissiveIntensity: 0.3,
        shininess: 100,
        specular: 0xffffff
    });

    playerMesh = new Mesh(geometry, material);
    playerMesh.castShadow = true;
    playerMesh.receiveShadow = true;
    playerMesh.position.set(0, 0.85, PLAYER_Z);

    // Add glow effect
    const glowGeometry = geometry.clone();
    const glowMaterial = new MeshBasicMaterial({
        color: currentBiome.accentColor,
        transparent: true,
        opacity: 0.4
    });
    const glowMesh = new Mesh(glowGeometry, glowMaterial);
    glowMesh.scale.set(1.3, 1.3, 1.3);
    playerMesh.add(glowMesh);

    scene.add(playerMesh);
}

// Create ground segment
function createGroundSegment(zPosition) {
    const segment = new Group();
    segment.userData.zPosition = zPosition;

    // Main track with gradient effect
    const trackGeometry = new BoxGeometry(9, 0.6, SEGMENT_LENGTH);
    const trackMaterial = new MeshStandardMaterial({
        color: currentBiome.groundColor,
        emissive: currentBiome.groundColor,
        emissiveIntensity: 0.2,
        metalness: 0.7,
        roughness: 0.3
    });
    const track = new Mesh(trackGeometry, trackMaterial);
    track.position.y = -0.3;
    track.receiveShadow = true;
    track.castShadow = true;
    segment.add(track);

    // Animated track lines
    for (let i = -1; i <= 1; i++) {
        if (i !== 0) {
            const lineGeometry = new BoxGeometry(0.15, 0.7, SEGMENT_LENGTH);
            const lineMaterial = new MeshPhongMaterial({
                color: 0xffffff,
                emissive: currentBiome.lightColor,
                emissiveIntensity: 0.8,
                transparent: true,
                opacity: 0.9
            });
            const line = new Mesh(lineGeometry, lineMaterial);
            line.position.set(i * LANE_WIDTH, 0.05, 0);
            segment.add(line);
        }
    }

    // Enhanced walls with lights
    const wallHeight = 4;
    const wallGeometry = new BoxGeometry(0.4, wallHeight, SEGMENT_LENGTH);

    // Left wall
    const leftWallMaterial = new MeshStandardMaterial({
        color: currentBiome.wallColor,
        emissive: currentBiome.accentColor,
        emissiveIntensity: 0.3,
        metalness: 0.8,
        roughness: 0.2
    });
    const leftWall = new Mesh(wallGeometry, leftWallMaterial);
    leftWall.position.set(-5, wallHeight / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    segment.add(leftWall);

    // Right wall
    const rightWallMaterial = leftWallMaterial.clone();
    const rightWall = new Mesh(wallGeometry, rightWallMaterial);
    rightWall.position.set(5, wallHeight / 2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    segment.add(rightWall);

    // Add decorative elements
    if (Math.random() > 0.6) {
        addDecorations(segment, zPosition);
    }

    segment.position.z = zPosition;
    scene.add(segment);
    groundSegments.push(segment);

    // Add obstacles
    if (zPosition < 0 && Math.random() > 0.5 - (settings.difficulty * 0.1)) {
        createObstacle(zPosition);
    }

    // Add coins
    if (zPosition < 0 && Math.random() > 0.4) {
        createCoins(zPosition);
    }

    // Add powerups occasionally
    if (zPosition < 0 && Math.random() > 0.95) {
        createPowerup(zPosition);
    }
}

// Add decorative elements
function addDecorations(segment, zPosition) {
    const numDecorations = Math.floor(Math.random() * 3) + 1;

    for (let i = 0; i < numDecorations; i++) {
        const decorType = Math.random();
        let decoration;

        if (decorType < 0.3) {
            // Pillars
            const pillarGeometry = new CylinderGeometry(0.3, 0.5, 6, 8);
            const pillarMaterial = new MeshStandardMaterial({
                color: currentBiome.wallColor,
                emissive: currentBiome.lightColor,
                emissiveIntensity: 0.2,
                metalness: 0.9,
                roughness: 0.1
            });
            decoration = new Mesh(pillarGeometry, pillarMaterial);
            decoration.position.set(
                Math.random() > 0.5 ? -5.5 : 5.5,
                3,
                Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2
            );
        } else if (decorType < 0.6) {
            // Floating cubes
            const cubeGeometry = new BoxGeometry(0.5, 0.5, 0.5);
            const cubeMaterial = new MeshPhongMaterial({
                color: currentBiome.accentColor,
                emissive: currentBiome.accentColor,
                emissiveIntensity: 0.5,
                transparent: true,
                opacity: 0.7
            });
            decoration = new Mesh(cubeGeometry, cubeMaterial);
            decoration.position.set(
                Math.random() > 0.5 ? -6 : 6,
                2 + Math.random() * 2,
                Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2
            );
            decoration.userData.rotate = true;
        } else {
            // Light orbs
            const orbGeometry = new SphereGeometry(0.3, 16, 16);
            const orbMaterial = new MeshBasicMaterial({
                color: currentBiome.lightColor,
                transparent: true,
                opacity: 0.8
            });
            decoration = new Mesh(orbGeometry, orbMaterial);
            decoration.position.set(
                Math.random() > 0.5 ? -6 : 6,
                1.5 + Math.random() * 2,
                Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2
            );
            decoration.userData.pulse = true;
        }

        decoration.castShadow = true;
        segment.add(decoration);
        decorations.push(decoration);
    }
}

// Create obstacle
function createObstacle(zPosition) {
    const lane = Math.floor(Math.random() * 3) - 1;
    const obstacleType = Math.random();

    let obstacle;

    if (obstacleType < 0.4) {
        // Box barrier
        const geometry = new BoxGeometry(1.6, 1.6, 1.6);
        const material = new MeshStandardMaterial({
            color: 0xe74c3c,
            emissive: 0xe74c3c,
            emissiveIntensity: 0.4,
            metalness: 0.8,
            roughness: 0.2
        });
        obstacle = new Mesh(geometry, material);
        obstacle.position.set(lane * LANE_WIDTH, 0.8, zPosition - Math.random() * (SEGMENT_LENGTH - 5));
        obstacle.rotation.y = Math.random() * Math.PI;
        obstacle.userData.rotationSpeed = (Math.random() - 0.5) * 0.05;
    } else if (obstacleType < 0.7) {
        // High barrier (slide under)
        const geometry = new BoxGeometry(2.0, 1.2, 1.2);
        const material = new MeshStandardMaterial({
            color: 0xf39c12,
            emissive: 0xf39c12,
            emissiveIntensity: 0.3,
            metalness: 0.7,
            roughness: 0.3
        });
        obstacle = new Mesh(geometry, material);
        obstacle.position.set(lane * LANE_WIDTH, 2.2, zPosition - Math.random() * (SEGMENT_LENGTH - 5));
        obstacle.userData.needsSlide = true;

        // Warning stripes
        for (let i = 0; i < 3; i++) {
            const stripeGeo = new BoxGeometry(2.1, 0.2, 1.3);
            const stripeMat = new MeshBasicMaterial({ color: 0x000000 });
            const stripe = new Mesh(stripeGeo, stripeMat);
            stripe.position.y = -0.4 + i * 0.4;
            obstacle.add(stripe);
        }
    } else {
        // Pyramid obstacle
        const geometry = new TetrahedronGeometry(1.2);
        const material = new MeshStandardMaterial({
            color: 0x9b59b6,
            emissive: 0x9b59b6,
            emissiveIntensity: 0.4,
            metalness: 0.8,
            roughness: 0.2
        });
        obstacle = new Mesh(geometry, material);
        obstacle.position.set(lane * LANE_WIDTH, 0.8, zPosition - Math.random() * (SEGMENT_LENGTH - 5));
        obstacle.userData.rotationSpeed = 0.03;
    }

    obstacle.castShadow = true;
    obstacle.receiveShadow = true;
    obstacle.userData.lane = lane;

    // Add glow
    const glowGeo = obstacle.geometry.clone();
    const glowMat = new MeshBasicMaterial({
        color: obstacle.material.color,
        transparent: true,
        opacity: 0.3
    });
    const glow = new Mesh(glowGeo, glowMat);
    glow.scale.set(1.2, 1.2, 1.2);
    obstacle.add(glow);

    scene.add(obstacle);
    obstacles.push(obstacle);
}

// Create coins
function createCoins(zPosition) {
    const lane = Math.floor(Math.random() * 3) - 1;
    const pattern = Math.random();

    if (pattern < 0.5) {
        // Straight line
        const numCoins = Math.floor(Math.random() * 4) + 4;
        for (let i = 0; i < numCoins; i++) {
            createSingleCoin(lane * LANE_WIDTH, 1.5, zPosition - (i * 1.8) - Math.random() * 3);
        }
    } else {
        // Arc pattern across lanes
        const numCoins = 5;
        for (let i = 0; i < numCoins; i++) {
            const progress = i / (numCoins - 1);
            const x = (progress - 0.5) * 5;
            const y = 1.5 + Math.sin(progress * Math.PI) * 1.5;
            createSingleCoin(x, y, zPosition - (i * 1.5) - Math.random() * 3);
        }
    }
}

function createSingleCoin(x, y, z) {
    const geometry = new CylinderGeometry(0.35, 0.35, 0.15, 20);
    const material = new MeshStandardMaterial({
        color: 0xffd700,
        emissive: 0xffd700,
        emissiveIntensity: 0.6,
        metalness: 1,
        roughness: 0.1
    });
    const coin = new Mesh(geometry, material);
    coin.rotation.x = Math.PI / 2;
    coin.position.set(x, y, z);
    coin.castShadow = true;
    coin.userData.collected = false;
    coin.userData.rotationSpeed = 0.08;
    coin.userData.floatOffset = Math.random() * Math.PI * 2;

    // Glow ring
    const glowGeo = new TorusGeometry(0.4, 0.1, 8, 20);
    const glowMat = new MeshBasicMaterial({
        color: 0xffd700,
        transparent: true,
        opacity: 0.4
    });
    const glow = new Mesh(glowGeo, glowMat);
    glow.rotation.x = Math.PI / 2;
    coin.add(glow);

    scene.add(coin);
    coins.push(coin);
}

// Create powerup
function createPowerup(zPosition) {
    const lane = Math.floor(Math.random() * 3) - 1;
    const powerupTypes = ['shield', 'magnet', 'multiplier'];
    const type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];

    const geometry = new SphereGeometry(0.5, 20, 20);
    let color;

    switch (type) {
        case 'shield':
            color = 0x00ff00;
            break;
        case 'magnet':
            color = 0xff00ff;
            break;
        case 'multiplier':
            color = 0x00ffff;
            break;
    }

    const material = new MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.8,
        metalness: 1,
        roughness: 0
    });

    const powerup = new Mesh(geometry, material);
    powerup.position.set(lane * LANE_WIDTH, 2, zPosition - Math.random() * (SEGMENT_LENGTH - 5));
    powerup.castShadow = true;
    powerup.userData.type = type;
    powerup.userData.collected = false;
    powerup.userData.rotationSpeed = 0.05;

    // Outer glow sphere
    const glowGeo = new SphereGeometry(0.7, 16, 16);
    const glowMat = new MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.3
    });
    const glow = new Mesh(glowGeo, glowMat);
    powerup.add(glow);

    scene.add(powerup);
    powerups.push(powerup);
}

// Update game loop
function update() {
    if (gameState !== 'playing') return;

    const delta = clock.getDelta();
    const speedMultiplier = settings.speed / 100;

    // Update distance and speed
    distance += speed * speedMultiplier;
    biomeDistance += speed * speedMultiplier;
    speed = Math.min(baseSpeed + distance * speedIncrement, maxSpeed);

    // Check for biome change
    if (biomeDistance >= nextBiomeChange) {
        changeBiome();
    }

    // Update score
    const multiplier = activePowerup?.type === 'multiplier' ? 2 : 1;
    score = Math.floor(distance * 10) + coinsCollected * 50 * multiplier;

    // Player lane movement (smooth lerp)
    const targetX = targetLane * LANE_WIDTH;
    const lerpSpeed = 0.2;
    playerMesh.position.x += (targetX - playerMesh.position.x) * lerpSpeed;

    // Player jumping physics
    if (isJumping) {
        playerY += jumpVelocity;
        jumpVelocity -= gravity;

        if (playerY <= 0) {
            playerY = 0;
            isJumping = false;
            jumpVelocity = 0;
            if (settings.cameraShake) cameraShake = 0.3;
        }
    }

    // Player height and scale
    if (isSliding) {
        playerMesh.scale.y = 0.5;
        playerMesh.position.y = 0.425;
    } else {
        playerMesh.scale.y = 1;
        playerMesh.position.y = 0.85 + playerY;
    }

    // Player rotation animation
    playerRotation += delta * 2;
    playerMesh.rotation.y = playerRotation;

    // Smooth camera follow
    const targetCameraZ = PLAYER_Z + cameraOffset.z;
    camera.position.z += (targetCameraZ - camera.position.z) * 0.1;
    camera.position.y += (cameraOffset.y - camera.position.y) * 0.1;

    // Camera shake
    if (cameraShake > 0) {
        camera.position.x = Math.sin(Date.now() * 0.05) * cameraShake;
        camera.position.y += Math.cos(Date.now() * 0.05) * cameraShake;
        cameraShake *= 0.9;
    } else {
        camera.position.x *= 0.9;
    }

    // Move ground segments
    groundSegments.forEach((segment, index) => {
        segment.position.z += speed * speedMultiplier;

        if (segment.position.z > PLAYER_Z + 20) {
            scene.remove(segment);
            groundSegments.splice(index, 1);

            const lastSegment = groundSegments[groundSegments.length - 1];
            const newZ = lastSegment.position.z - SEGMENT_LENGTH;
            createGroundSegment(newZ);
        }
    });

    // Update obstacles
    obstacles.forEach((obstacle, index) => {
        obstacle.position.z += speed * speedMultiplier;

        if (obstacle.userData.rotationSpeed) {
            obstacle.rotation.y += obstacle.userData.rotationSpeed;
        }

        if (obstacle.position.z > PLAYER_Z + 10) {
            scene.remove(obstacle);
            obstacles.splice(index, 1);
            return;
        }

        if (!isInvincible && checkCollision(playerMesh, obstacle)) {
            gameOver();
        }
    });

    // Update coins
    coins.forEach((coin, index) => {
        coin.position.z += speed * speedMultiplier;
        coin.rotation.y += coin.userData.rotationSpeed;

        // Floating animation
        coin.userData.floatOffset += delta * 2;
        coin.position.y += Math.sin(coin.userData.floatOffset) * 0.01;

        if (coin.position.z > PLAYER_Z + 10) {
            scene.remove(coin);
            coins.splice(index, 1);
            return;
        }

        // Magnet effect
        if (activePowerup?.type === 'magnet') {
            const direction = new Vector3().subVectors(playerMesh.position, coin.position);
            const distance = direction.length();
            if (distance < 8) {
                coin.position.add(direction.normalize().multiplyScalar(0.2));
            }
        }

        if (!coin.userData.collected && checkCoinCollection(playerMesh, coin)) {
            coin.userData.collected = true;
            coinsCollected++;
            totalCoinsEver++;
            combo++;
            scene.remove(coin);
            coins.splice(index, 1);

            if (settings.particles) createCoinParticles(coin.position);
            showComboText(`+${50 * (activePowerup?.type === 'multiplier' ? 2 : 1)}`);
            if (settings.cameraShake) cameraShake = 0.2;
        }
    });

    // Update powerups
    powerups.forEach((powerup, index) => {
        powerup.position.z += speed * speedMultiplier;
        powerup.rotation.y += powerup.userData.rotationSpeed;
        powerup.position.y += Math.sin(Date.now() * 0.003) * 0.02;

        if (powerup.position.z > PLAYER_Z + 10) {
            scene.remove(powerup);
            powerups.splice(index, 1);
            return;
        }

        if (!powerup.userData.collected && checkCoinCollection(playerMesh, powerup)) {
            powerup.userData.collected = true;
            activatePowerup(powerup.userData.type);
            scene.remove(powerup);
            powerups.splice(index, 1);
            if (settings.particles) createCoinParticles(powerup.position, powerup.material.color);
        }
    });

    // Update active powerup
    if (activePowerup) {
        powerupDuration -= delta;
        updatePowerupIndicator();
        if (powerupDuration <= 0) {
            deactivatePowerup();
        }
    }

    // Update particles
    particles.forEach((particle, index) => {
        particle.position.z += speed * speedMultiplier;
        particle.userData.life -= delta;
        particle.userData.velocity.y -= 0.01;
        particle.position.add(particle.userData.velocity);
        particle.material.opacity = particle.userData.life / particle.userData.maxLife;

        if (particle.userData.life <= 0 || particle.position.z > PLAYER_Z + 15) {
            scene.remove(particle);
            particles.splice(index, 1);
        }
    });

    // Create trail particles
    if (settings.particles && Math.random() > 0.7) {
        createTrailParticle();
    }

    // Update decorations
    decorations.forEach(decoration => {
        if (decoration.userData.rotate) {
            decoration.rotation.x += 0.02;
            decoration.rotation.y += 0.02;
        }
        if (decoration.userData.pulse) {
            const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
            decoration.scale.set(pulse, pulse, pulse);
        }
    });

    updateHUD();
}

// Biome system
function changeBiome() {
    const biomeKeys = Object.keys(biomes);
    let newBiomeKey;
    do {
        newBiomeKey = biomeKeys[Math.floor(Math.random() * biomeKeys.length)];
    } while (newBiomeKey === settings.biome);

    settings.biome = newBiomeKey;
    currentBiome = biomes[newBiomeKey];
    updateBiome(currentBiome);
    showBiomeTransition(currentBiome.name);

    biomeDistance = 0;
    nextBiomeChange = 300 + Math.random() * 400;
}

function updateBiome(biome) {
    scene.fog = new Fog(biome.fogColor, 20, 100);
    scene.background = new Color(biome.bgColor);
    renderer.setClearColor(biome.bgColor);

    // Update player color
    if (playerMesh) {
        playerMesh.material.color.setHex(biome.accentColor);
        playerMesh.material.emissive.setHex(biome.accentColor);
        playerMesh.children[0].material.color.setHex(biome.accentColor);
    }
}

function showBiomeTransition(name) {
    const element = document.createElement('div');
    element.className = 'biome-transition';
    element.textContent = `Entering ${name}`;
    document.body.appendChild(element);
    setTimeout(() => element.remove(), 2000);
}

// Powerup system
function activatePowerup(type) {
    activePowerup = { type };
    powerupDuration = 10;

    switch (type) {
        case 'shield':
            isInvincible = true;
            document.getElementById('powerupName').textContent = '🛡️ Shield Active';
            if (playerMesh) {
                playerMesh.children[0].material.opacity = 0.7;
                playerMesh.children[0].scale.set(1.5, 1.5, 1.5);
            }
            break;
        case 'magnet':
            document.getElementById('powerupName').textContent = '🧲 Coin Magnet';
            break;
        case 'multiplier':
            document.getElementById('powerupName').textContent = '✨ 2x Score';
            break;
    }

    document.getElementById('powerupIndicator').classList.remove('hidden');
    showComboText(`${type.toUpperCase()}!`);
}

function deactivatePowerup() {
    if (activePowerup?.type === 'shield') {
        isInvincible = false;
        if (playerMesh) {
            playerMesh.children[0].material.opacity = 0.4;
            playerMesh.children[0].scale.set(1.3, 1.3, 1.3);
        }
    }

    activePowerup = null;
    document.getElementById('powerupIndicator').classList.add('hidden');
}

function updatePowerupIndicator() {
    const percentage = (powerupDuration / 10) * 100;
    document.getElementById('powerupTimer').style.width = percentage + '%';
}

// Collision detection
function checkCollision(player, obstacle) {
    const playerBox = new Box3().setFromObject(player);
    const obstacleBox = new Box3().setFromObject(obstacle);

    if (playerBox.intersectsBox(obstacleBox)) {
        if (obstacle.userData.needsSlide && isSliding) return false;
        if (!obstacle.userData.needsSlide && playerY > 1.5) return false;
        return true;
    }
    return false;
}

function checkCoinCollection(player, coin) {
    return player.position.distanceTo(coin.position) < 1.2;
}

// Particle effects
function createCoinParticles(position, color = 0xffd700) {
    if (!settings.particles) return;

    for (let i = 0; i < 15; i++) {
        const geometry = new SphereGeometry(0.08, 8, 8);
        const material = new MeshBasicMaterial({
            color: color,
            transparent: true
        });
        const particle = new Mesh(geometry, material);

        particle.position.copy(position);
        particle.userData.velocity = new Vector3(
            (Math.random() - 0.5) * 0.15,
            Math.random() * 0.2,
            (Math.random() - 0.5) * 0.15
        );
        particle.userData.life = 0.8;
        particle.userData.maxLife = 0.8;

        scene.add(particle);
        particles.push(particle);
    }
}

function createTrailParticle() {
    const geometry = new SphereGeometry(0.1, 6, 6);
    const material = new MeshBasicMaterial({
        color: currentBiome.accentColor,
        transparent: true,
        opacity: 0.6
    });
    const particle = new Mesh(geometry, material);

    particle.position.copy(playerMesh.position);
    particle.position.y -= 0.5;
    particle.userData.velocity = new Vector3(0, -0.02, 0.05);
    particle.userData.life = 0.5;
    particle.userData.maxLife = 0.5;

    scene.add(particle);
    particles.push(particle);
}

// UI functions
function showComboText(text) {
    const element = document.createElement('div');
    element.className = 'combo-popup';
    element.textContent = text;
    document.body.appendChild(element);
    setTimeout(() => element.remove(), 1200);
}

function updateHUD() {
    document.getElementById('score').textContent = score;
    document.getElementById('coins').textContent = coinsCollected;
    document.getElementById('distance').textContent = Math.floor(distance) + 'm';
    document.getElementById('combo').textContent = combo + 'x';
}

function updateAllUI() {
    document.getElementById('menuBestScore').textContent = bestScore;
    document.getElementById('totalCoins').textContent = totalCoinsEver;
    document.getElementById('bestScore').textContent = bestScore;
}

// Event listeners
function setupEventListeners() {
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Character selection
    document.querySelectorAll('.character-option').forEach(option => {
        option.addEventListener('click', () => selectCharacter(option.dataset.character));
    });

    // Biome selection
    document.querySelectorAll('.biome-option').forEach(option => {
        option.addEventListener('click', () => selectBiome(option.dataset.biome));
    });

    // Settings
    document.getElementById('darkModeToggle').addEventListener('change', toggleDarkMode);
    document.getElementById('scanlinesToggle').addEventListener('change', toggleScanlines);
    document.getElementById('particlesToggle').addEventListener('change', (e) => {
        settings.particles = e.target.checked;
    });
    document.getElementById('cameraShakeToggle').addEventListener('change', (e) => {
        settings.cameraShake = e.target.checked;
    });
    document.getElementById('speedSlider').addEventListener('input', (e) => {
        settings.speed = parseInt(e.target.value);
        document.getElementById('speedValue').textContent = settings.speed + '%';
    });
    document.getElementById('difficultySlider').addEventListener('input', (e) => {
        settings.difficulty = parseInt(e.target.value);
        const labels = ['Easy', 'Normal', 'Hard'];
        document.getElementById('difficultyValue').textContent = labels[e.target.value - 1];
    });

    // Buttons
    document.getElementById('settingsBtn').addEventListener('click', () => {
        if (gameState === 'playing') togglePause();
        switchTab('settings');
    });
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

function selectCharacter(character) {
    settings.character = character;
    document.querySelectorAll('.character-option').forEach(o => o.classList.remove('selected'));
    document.querySelector(`[data-character="${character}"]`).classList.add('selected');

    if (playerMesh) {
        scene.remove(playerMesh);
        createPlayer();
    }
}

function selectBiome(biome) {
    settings.biome = biome;
    currentBiome = biomes[biome];
    document.querySelectorAll('.biome-option').forEach(o => o.classList.remove('selected'));
    document.querySelector(`[data-biome="${biome}"]`).classList.add('selected');
    updateBiome(currentBiome);
}

function toggleDarkMode(e) {
    settings.darkMode = e.target.checked;
    document.body.classList.toggle('light-mode', !settings.darkMode);
}

function toggleScanlines(e) {
    settings.scanlines = e.target.checked;
    document.querySelector('.scanlines').style.display = settings.scanlines ? 'block' : 'none';
}

// Keyboard controls
function onKeyDown(event) {
    keys[event.code] = true;

    if (gameState !== 'playing') return;

    if (event.code === 'ArrowLeft' && currentLane > -1) {
        targetLane--;
        currentLane--;
    }

    if (event.code === 'ArrowRight' && currentLane < 1) {
        targetLane++;
        currentLane++;
    }

    if ((event.code === 'ArrowUp' || event.code === 'Space') && !isJumping && !isSliding) {
        event.preventDefault();
        isJumping = true;
        jumpVelocity = jumpPower;
    }

    if (event.code === 'ArrowDown' && !isJumping) {
        isSliding = true;
    }

    if (event.code === 'Escape') {
        togglePause();
    }
}

function onKeyUp(event) {
    keys[event.code] = false;

    if (event.code === 'ArrowDown') {
        isSliding = false;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Game state functions
function startGame() {
    document.getElementById('startMenu').classList.add('hidden');
    document.getElementById('controlsHint').classList.remove('hidden');
    gameState = 'playing';

    // Reset game state
    score = 0;
    coinsCollected = 0;
    distance = 0;
    combo = 0;
    speed = baseSpeed;
    currentLane = 0;
    targetLane = 0;
    isJumping = false;
    isSliding = false;
    playerY = 0;
    biomeDistance = 0;
    cameraShake = 0;

    // Deactivate powerup
    if (activePowerup) deactivatePowerup();

    // Reset player position
    if (playerMesh) {
        playerMesh.position.set(0, 0.85, PLAYER_Z);
        playerMesh.rotation.y = 0;
    }

    // Clear objects
    obstacles.forEach(o => scene.remove(o));
    coins.forEach(c => scene.remove(c));
    powerups.forEach(p => scene.remove(p));
    particles.forEach(p => scene.remove(p));
    obstacles = [];
    coins = [];
    powerups = [];
    particles = [];

    updateHUD();
    updateBiome(currentBiome);

    setTimeout(() => {
        document.getElementById('controlsHint').classList.add('hidden');
    }, 5000);
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        document.getElementById('pauseMenu').classList.remove('hidden');
    } else if (gameState === 'paused') {
        gameState = 'playing';
        document.getElementById('pauseMenu').classList.add('hidden');
    }
}

function resumeGame() {
    gameState = 'playing';
    document.getElementById('pauseMenu').classList.add('hidden');
}

function restartGame() {
    document.getElementById('pauseMenu').classList.add('hidden');
    document.getElementById('gameOverMenu').classList.add('hidden');

    // Clear all objects
    obstacles.forEach(o => scene.remove(o));
    coins.forEach(c => scene.remove(c));
    powerups.forEach(p => scene.remove(p));
    particles.forEach(p => scene.remove(p));
    obstacles = [];
    coins = [];
    powerups = [];
    particles = [];

    startGame();
}

function backToMenu() {
    document.getElementById('gameOverMenu').classList.add('hidden');
    document.getElementById('pauseMenu').classList.add('hidden');
    document.getElementById('startMenu').classList.remove('hidden');
    gameState = 'menu';

    // Clear objects
    obstacles.forEach(o => scene.remove(o));
    coins.forEach(c => scene.remove(c));
    powerups.forEach(p => scene.remove(p));
    particles.forEach(p => scene.remove(p));
    obstacles = [];
    coins = [];
    powerups = [];
    particles = [];
}

function gameOver() {
    gameState = 'gameOver';

    // Save stats
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('templeRunBestScore', bestScore);
    }
    localStorage.setItem('totalCoins', totalCoinsEver);

    // Show game over menu
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalCoins').textContent = coinsCollected;
    document.getElementById('finalDistance').textContent = Math.floor(distance) + 'm';
    document.getElementById('bestScore').textContent = bestScore;
    document.getElementById('gameOverMenu').classList.remove('hidden');

    // Camera shake on crash
    if (settings.cameraShake) cameraShake = 1;
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    update();
    renderer.render(scene, camera);
}

// Initialize on load
window.addEventListener('load', () => {
    init();
});
