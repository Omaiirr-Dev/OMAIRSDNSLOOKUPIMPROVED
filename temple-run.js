// Three.js scene setup
let scene, camera, renderer;
let player, playerMesh;
let groundSegments = [];
let obstacles = [];
let coins = [];
let particles = [];

// Game state
let gameState = 'menu'; // menu, playing, paused, gameOver
let score = 0;
let coinsCollected = 0;
let distance = 0;
let speed = 0.2;
let baseSpeed = 0.2;
let maxSpeed = 0.8;
let speedIncrement = 0.0001;

// Player state
let currentLane = 0; // -1 (left), 0 (center), 1 (right)
let targetLane = 0;
let isJumping = false;
let isSliding = false;
let jumpVelocity = 0;
let gravity = 0.02;
let jumpPower = 0.4;
let playerY = 0;

// Constants
const LANE_WIDTH = 2.5;
const SEGMENT_LENGTH = 10;
const SEGMENTS_VISIBLE = 20;
const PLAYER_Z = -5;

// Controls
let keys = {};

// Best score
let bestScore = parseInt(localStorage.getItem('templeRunBestScore')) || 0;

// Initialize the game
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x2a5298, 10, 100);
    scene.background = new THREE.Color(0x1e3c72);

    // Create camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 5, PLAYER_Z + 5);
    camera.lookAt(0, 2, PLAYER_Z - 10);

    // Create renderer
    const canvas = document.getElementById('gameCanvas');
    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Hemisphere light for better ambient lighting
    const hemiLight = new THREE.HemisphereLight(0x4facfe, 0x2a5298, 0.4);
    scene.add(hemiLight);

    // Create player
    createPlayer();

    // Create initial ground
    for (let i = 0; i < SEGMENTS_VISIBLE; i++) {
        createGroundSegment(-i * SEGMENT_LENGTH);
    }

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.getElementById('pauseBtn').addEventListener('click', togglePause);

    // Update HUD
    updateHUD();
}

// Create player character
function createPlayer() {
    const geometry = new THREE.BoxGeometry(0.8, 1.6, 0.8);
    const material = new THREE.MeshPhongMaterial({
        color: 0x667eea,
        shininess: 100,
        specular: 0x444444
    });

    playerMesh = new THREE.Mesh(geometry, material);
    playerMesh.castShadow = true;
    playerMesh.receiveShadow = true;
    playerMesh.position.set(0, 0.8, PLAYER_Z);

    scene.add(playerMesh);

    // Add player glow effect
    const glowGeometry = new THREE.BoxGeometry(1, 1.8, 1);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x667eea,
        transparent: true,
        opacity: 0.3
    });
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    playerMesh.add(glowMesh);
}

// Create ground segment
function createGroundSegment(zPosition) {
    const segment = new THREE.Group();
    segment.userData.zPosition = zPosition;

    // Main track
    const trackGeometry = new THREE.BoxGeometry(8, 0.5, SEGMENT_LENGTH);
    const trackMaterial = new THREE.MeshPhongMaterial({
        color: 0x8e44ad,
        shininess: 50
    });
    const track = new THREE.Mesh(trackGeometry, trackMaterial);
    track.position.y = -0.25;
    track.receiveShadow = true;
    track.castShadow = true;
    segment.add(track);

    // Track lines
    for (let i = -1; i <= 1; i++) {
        if (i !== 0) {
            const lineGeometry = new THREE.BoxGeometry(0.1, 0.51, SEGMENT_LENGTH);
            const lineMaterial = new THREE.MeshPhongMaterial({
                color: 0xffffff,
                emissive: 0xffffff,
                emissiveIntensity: 0.5
            });
            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            line.position.set(i * LANE_WIDTH, 0, 0);
            segment.add(line);
        }
    }

    // Side walls with gradient
    const wallHeight = 3;
    const wallGeometry = new THREE.BoxGeometry(0.3, wallHeight, SEGMENT_LENGTH);
    const wallMaterial = new THREE.MeshPhongMaterial({
        color: 0x5f27cd,
        shininess: 50
    });

    const leftWall = new THREE.Mesh(wallGeometry, wallMaterial);
    leftWall.position.set(-4.5, wallHeight / 2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    segment.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeometry, wallMaterial);
    rightWall.position.set(4.5, wallHeight / 2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    segment.add(rightWall);

    // Decorative pillars
    if (Math.random() > 0.7) {
        const pillarGeometry = new THREE.CylinderGeometry(0.3, 0.4, 5, 8);
        const pillarMaterial = new THREE.MeshPhongMaterial({
            color: 0x9b59b6,
            shininess: 100
        });

        const leftPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        leftPillar.position.set(-4.5, 2.5, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);
        leftPillar.castShadow = true;
        segment.add(leftPillar);

        const rightPillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
        rightPillar.position.set(4.5, 2.5, Math.random() * SEGMENT_LENGTH - SEGMENT_LENGTH / 2);
        rightPillar.castShadow = true;
        segment.add(rightPillar);
    }

    segment.position.z = zPosition;
    scene.add(segment);
    groundSegments.push(segment);

    // Add obstacles and coins to this segment
    if (zPosition < 0 && Math.random() > 0.4) {
        createObstacle(zPosition);
    }

    if (zPosition < 0 && Math.random() > 0.3) {
        createCoins(zPosition);
    }
}

// Create obstacle
function createObstacle(zPosition) {
    const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    const obstacleType = Math.random();

    let obstacle;

    if (obstacleType < 0.5) {
        // Barrier obstacle
        const geometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const material = new THREE.MeshPhongMaterial({
            color: 0xe74c3c,
            shininess: 100
        });
        obstacle = new THREE.Mesh(geometry, material);
        obstacle.position.set(lane * LANE_WIDTH, 0.75, zPosition - Math.random() * SEGMENT_LENGTH);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;

        // Add glow
        const glowGeometry = new THREE.BoxGeometry(1.7, 1.7, 1.7);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xe74c3c,
            transparent: true,
            opacity: 0.3
        });
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        obstacle.add(glowMesh);
    } else {
        // Tall barrier (must slide under)
        const geometry = new THREE.BoxGeometry(1.8, 1.0, 1.0);
        const material = new THREE.MeshPhongMaterial({
            color: 0xf39c12,
            shininess: 100
        });
        obstacle = new THREE.Mesh(geometry, material);
        obstacle.position.set(lane * LANE_WIDTH, 2.0, zPosition - Math.random() * SEGMENT_LENGTH);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        obstacle.userData.needsSlide = true;

        // Add stripes
        const stripeGeometry = new THREE.BoxGeometry(1.9, 0.2, 1.1);
        const stripeMaterial = new THREE.MeshPhongMaterial({
            color: 0x000000
        });
        const stripe1 = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe1.position.y = 0.3;
        obstacle.add(stripe1);

        const stripe2 = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe2.position.y = -0.3;
        obstacle.add(stripe2);
    }

    obstacle.userData.lane = lane;
    scene.add(obstacle);
    obstacles.push(obstacle);
}

// Create coins
function createCoins(zPosition) {
    const lane = Math.floor(Math.random() * 3) - 1;
    const numCoins = Math.floor(Math.random() * 3) + 3; // 3-5 coins

    for (let i = 0; i < numCoins; i++) {
        const geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
        const material = new THREE.MeshPhongMaterial({
            color: 0xffd700,
            emissive: 0xffd700,
            emissiveIntensity: 0.5,
            shininess: 100
        });
        const coin = new THREE.Mesh(geometry, material);
        coin.rotation.x = Math.PI / 2;
        coin.position.set(
            lane * LANE_WIDTH,
            1.5,
            zPosition - (i * 1.5) - Math.random() * 2
        );
        coin.castShadow = true;
        coin.userData.collected = false;
        coin.userData.rotationSpeed = 0.05;

        scene.add(coin);
        coins.push(coin);
    }
}

// Update game
function update() {
    if (gameState !== 'playing') return;

    // Update distance and speed
    distance += speed;
    speed = Math.min(baseSpeed + distance * speedIncrement, maxSpeed);

    // Update score
    score = Math.floor(distance * 10) + coinsCollected * 50;

    // Player lane movement
    const targetX = targetLane * LANE_WIDTH;
    const lerpSpeed = 0.15;
    playerMesh.position.x += (targetX - playerMesh.position.x) * lerpSpeed;

    // Player jumping
    if (isJumping) {
        playerY += jumpVelocity;
        jumpVelocity -= gravity;

        if (playerY <= 0) {
            playerY = 0;
            isJumping = false;
            jumpVelocity = 0;
        }
    }

    // Player sliding
    if (isSliding) {
        playerMesh.scale.y = 0.5;
        playerMesh.position.y = 0.4;
    } else {
        playerMesh.scale.y = 1;
        playerMesh.position.y = 0.8 + playerY;
    }

    // Player animation (rotation)
    playerMesh.rotation.y += 0.05;

    // Move ground segments
    groundSegments.forEach((segment, index) => {
        segment.position.z += speed;

        if (segment.position.z > PLAYER_Z + 15) {
            scene.remove(segment);
            groundSegments.splice(index, 1);

            // Create new segment ahead
            const lastSegment = groundSegments[groundSegments.length - 1];
            const newZ = lastSegment.position.z - SEGMENT_LENGTH;
            createGroundSegment(newZ);
        }
    });

    // Move and check obstacles
    obstacles.forEach((obstacle, index) => {
        obstacle.position.z += speed;
        obstacle.rotation.y += 0.02;

        // Remove if behind player
        if (obstacle.position.z > PLAYER_Z + 5) {
            scene.remove(obstacle);
            obstacles.splice(index, 1);
            return;
        }

        // Collision detection
        if (checkCollision(playerMesh, obstacle)) {
            gameOver();
        }
    });

    // Move and check coins
    coins.forEach((coin, index) => {
        coin.position.z += speed;
        coin.rotation.z += coin.userData.rotationSpeed;

        // Remove if behind player
        if (coin.position.z > PLAYER_Z + 5) {
            scene.remove(coin);
            coins.splice(index, 1);
            return;
        }

        // Collection detection
        if (!coin.userData.collected && checkCoinCollection(playerMesh, coin)) {
            coin.userData.collected = true;
            coinsCollected++;
            scene.remove(coin);
            coins.splice(index, 1);

            // Coin collection effect
            createCoinParticles(coin.position);
            showComboText('+50');
        }
    });

    // Update particles
    particles.forEach((particle, index) => {
        particle.position.z += speed;
        particle.rotation.x += 0.1;
        particle.rotation.y += 0.1;

        if (particle.position.z > PLAYER_Z + 10) {
            scene.remove(particle);
            particles.splice(index, 1);
        }
    });

    // Update HUD
    updateHUD();

    // Camera follow with smooth motion
    camera.position.z += (PLAYER_Z + 5 - camera.position.z) * 0.1;
}

// Check collision
function checkCollision(player, obstacle) {
    const playerBox = new THREE.Box3().setFromObject(player);
    const obstacleBox = new THREE.Box3().setFromObject(obstacle);

    if (playerBox.intersectsBox(obstacleBox)) {
        // Check if player is sliding under high obstacle
        if (obstacle.userData.needsSlide && isSliding) {
            return false;
        }
        // Check if player jumped over low obstacle
        if (!obstacle.userData.needsSlide && playerY > 1) {
            return false;
        }
        return true;
    }
    return false;
}

// Check coin collection
function checkCoinCollection(player, coin) {
    const distance = player.position.distanceTo(coin.position);
    return distance < 1;
}

// Create coin particles
function createCoinParticles(position) {
    for (let i = 0; i < 10; i++) {
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xffd700 });
        const particle = new THREE.Mesh(geometry, material);

        particle.position.copy(position);
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.2,
            Math.random() * 0.2,
            (Math.random() - 0.5) * 0.2
        );

        scene.add(particle);
        particles.push(particle);

        // Remove after animation
        setTimeout(() => {
            scene.remove(particle);
            const index = particles.indexOf(particle);
            if (index > -1) particles.splice(index, 1);
        }, 500);
    }
}

// Show combo text
function showComboText(text) {
    const element = document.createElement('div');
    element.className = 'combo-text';
    element.textContent = text;
    document.body.appendChild(element);

    setTimeout(() => element.remove(), 1000);
}

// Update HUD
function updateHUD() {
    document.getElementById('score').textContent = score;
    document.getElementById('coins').textContent = coinsCollected;
    document.getElementById('distance').textContent = Math.floor(distance) + 'm';
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

    if ((event.code === 'ArrowUp' || event.code === 'Space') && !isJumping) {
        isJumping = true;
        jumpVelocity = jumpPower;
    }

    if (event.code === 'ArrowDown') {
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

// Window resize
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

    // Reset game
    score = 0;
    coinsCollected = 0;
    distance = 0;
    speed = baseSpeed;
    currentLane = 0;
    targetLane = 0;
    isJumping = false;
    isSliding = false;
    playerY = 0;

    // Reset player position
    playerMesh.position.set(0, 0.8, PLAYER_Z);

    // Clear obstacles and coins
    obstacles.forEach(o => scene.remove(o));
    coins.forEach(c => scene.remove(c));
    obstacles = [];
    coins = [];

    updateHUD();

    // Hide hint after 5 seconds
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
    // Hide all menus
    document.getElementById('pauseMenu').classList.add('hidden');
    document.getElementById('gameOverMenu').classList.add('hidden');

    // Clear existing objects
    obstacles.forEach(o => scene.remove(o));
    coins.forEach(c => scene.remove(c));
    particles.forEach(p => scene.remove(p));
    obstacles = [];
    coins = [];
    particles = [];

    startGame();
}

function backToMenu() {
    document.getElementById('gameOverMenu').classList.add('hidden');
    document.getElementById('startMenu').classList.remove('hidden');
    gameState = 'menu';

    // Clear objects
    obstacles.forEach(o => scene.remove(o));
    coins.forEach(c => scene.remove(c));
    particles.forEach(p => scene.remove(p));
    obstacles = [];
    coins = [];
    particles = [];
}

function gameOver() {
    gameState = 'gameOver';

    // Update best score
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('templeRunBestScore', bestScore);
    }

    // Show game over menu
    document.getElementById('finalScore').textContent = score;
    document.getElementById('finalCoins').textContent = coinsCollected;
    document.getElementById('finalDistance').textContent = Math.floor(distance) + 'm';
    document.getElementById('bestScore').textContent = bestScore;
    document.getElementById('gameOverMenu').classList.remove('hidden');
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    update();
    renderer.render(scene, camera);
}

// Initialize and start
init();
animate();

// Update best score display on load
document.getElementById('bestScore').textContent = bestScore;
