// Matter.js module aliases
const Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    Bodies = Matter.Bodies,
    Composite = Matter.Composite,
    Body = Matter.Body,
    Events = Matter.Events,
    Mouse = Matter.Mouse,
    MouseConstraint = Matter.MouseConstraint;

// Game variables
let engine, render, runner, bacon, pans = [], ground, walls = [];
let score = 0, combo = 0, highScore = 0;
let charging = false, power = 0;
let gameStarted = false;
let lastLandedPan = null;

// Canvas and UI elements
const canvas = document.getElementById('gameCanvas');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const highScoreEl = document.getElementById('highScore');
const powerFill = document.getElementById('powerFill');
const flipBtn = document.getElementById('flipBtn');
const resetBtn = document.getElementById('resetBtn');

// Load high score
highScore = parseInt(localStorage.getItem('baconFlipHighScore')) || 0;
highScoreEl.textContent = highScore;

// Initialize physics engine
function initGame() {
    engine = Engine.create({
        gravity: { x: 0, y: 1 }
    });

    render = Render.create({
        canvas: canvas,
        engine: engine,
        options: {
            width: canvas.parentElement.clientWidth,
            height: canvas.parentElement.clientHeight,
            wireframes: false,
            background: 'transparent'
        }
    });

    // Create ground
    ground = Bodies.rectangle(
        render.options.width / 2,
        render.options.height - 10,
        render.options.width,
        20,
        {
            isStatic: true,
            render: {
                fillStyle: '#2c3e50',
                strokeStyle: '#34495e',
                lineWidth: 2
            }
        }
    );

    // Create walls
    const wallThickness = 20;
    walls.push(
        Bodies.rectangle(10, render.options.height / 2, wallThickness, render.options.height, {
            isStatic: true,
            render: { fillStyle: '#34495e' }
        }),
        Bodies.rectangle(render.options.width - 10, render.options.height / 2, wallThickness, render.options.height, {
            isStatic: true,
            render: { fillStyle: '#34495e' }
        })
    );

    // Create bacon
    createBacon();

    // Create pans at random positions
    createPans();

    // Add all bodies to the world
    Composite.add(engine.world, [bacon, ground, ...walls, ...pans]);

    // Collision detection
    Events.on(engine, 'collisionStart', handleCollision);

    // Run the engine
    runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    gameStarted = true;
}

// Create bacon strip
function createBacon() {
    const baconWidth = 80;
    const baconHeight = 40;
    const startX = 200;
    const startY = render.options.height - 200;

    bacon = Bodies.rectangle(startX, startY, baconWidth, baconHeight, {
        density: 0.001,
        friction: 0.8,
        restitution: 0.3,
        render: {
            sprite: {
                texture: createBaconTexture(),
                xScale: 1,
                yScale: 1
            }
        },
        label: 'bacon'
    });
}

// Create bacon texture (canvas-based)
function createBaconTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');

    // Bacon background
    const gradient = ctx.createLinearGradient(0, 0, 80, 40);
    gradient.addColorStop(0, '#ff6b6b');
    gradient.addColorStop(0.3, '#ff8787');
    gradient.addColorStop(0.5, '#ffcccc');
    gradient.addColorStop(0.7, '#ff8787');
    gradient.addColorStop(1, '#ff6b6b');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 80, 40);

    // Bacon stripes
    ctx.strokeStyle = '#d63031';
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 10 + i * 10);
        ctx.lineTo(80, 10 + i * 10);
        ctx.stroke();
    }

    // Fat marbling
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(10, 5, 15, 8);
    ctx.fillRect(40, 15, 12, 6);
    ctx.fillRect(60, 25, 10, 8);

    // Border
    ctx.strokeStyle = '#a83232';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 80, 40);

    return canvas.toDataURL();
}

// Create pans to land on
function createPans() {
    const panWidth = 120;
    const panHeight = 15;
    const numPans = 4;
    const spacing = (render.options.width - 200) / numPans;

    for (let i = 0; i < numPans; i++) {
        const x = 100 + spacing * i + Math.random() * 100;
        const y = render.options.height - 100 - Math.random() * 300;

        const pan = Bodies.rectangle(x, y, panWidth, panHeight, {
            isStatic: true,
            render: {
                sprite: {
                    texture: createPanTexture(),
                    xScale: 1,
                    yScale: 1
                }
            },
            label: 'pan',
            friction: 1,
            panId: i
        });

        pans.push(pan);
    }
}

// Create pan texture
function createPanTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 15;
    const ctx = canvas.getContext('2d');

    // Pan gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 15);
    gradient.addColorStop(0, '#555');
    gradient.addColorStop(0.5, '#777');
    gradient.addColorStop(1, '#555');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 120, 15);

    // Shine
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(0, 0, 120, 5);

    // Border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 120, 15);

    return canvas.toDataURL();
}

// Handle collisions
function handleCollision(event) {
    const pairs = event.pairs;

    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];

        // Check if bacon landed on a pan
        if ((pair.bodyA.label === 'bacon' && pair.bodyB.label === 'pan') ||
            (pair.bodyA.label === 'pan' && pair.bodyB.label === 'bacon')) {

            const panBody = pair.bodyA.label === 'pan' ? pair.bodyA : pair.bodyB;
            const baconBody = pair.bodyA.label === 'bacon' ? pair.bodyA : pair.bodyB;

            // Check if bacon is mostly flat (good landing)
            const angle = Math.abs(baconBody.angle % (Math.PI * 2));
            const isFlat = (angle < 0.3 || angle > Math.PI * 2 - 0.3) ||
                          (angle > Math.PI - 0.3 && angle < Math.PI + 0.3);

            // Check velocity (soft landing)
            const velocity = Math.abs(baconBody.velocity.y);
            const isSoftLanding = velocity < 5;

            // Calculate score
            if (isFlat && isSoftLanding) {
                // Perfect landing
                if (lastLandedPan !== panBody.panId) {
                    combo++;
                    const points = 100 * combo;
                    score += points;
                    lastLandedPan = panBody.panId;

                    showComboPopup(`Perfect! +${points}`, panBody.position);
                    createParticles(panBody.position.x, panBody.position.y, '#ffd700');
                }
            } else if (isFlat || isSoftLanding) {
                // Good landing
                if (lastLandedPan !== panBody.panId) {
                    combo = Math.max(1, combo);
                    const points = 50 * combo;
                    score += points;
                    lastLandedPan = panBody.panId;

                    showComboPopup(`Good! +${points}`, panBody.position);
                    createParticles(panBody.position.x, panBody.position.y, '#4facfe');
                }
            } else {
                // Bad landing - reset combo
                combo = 0;
            }

            updateScore();
        }

        // Reset combo if bacon hits ground
        if ((pair.bodyA.label === 'bacon' && pair.bodyB === ground) ||
            (pair.bodyA === ground && pair.bodyB.label === 'bacon')) {
            combo = 0;
            lastLandedPan = null;
            updateScore();
        }
    }
}

// Update score display
function updateScore() {
    scoreEl.textContent = score;
    comboEl.textContent = combo + 'x';

    if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = highScore;
        localStorage.setItem('baconFlipHighScore', highScore);
    }
}

// Show combo popup
function showComboPopup(text, position) {
    const popup = document.createElement('div');
    popup.className = 'combo-popup';
    popup.textContent = text;
    popup.style.left = position.x + 'px';
    popup.style.top = position.y + 'px';
    document.querySelector('.game-container').appendChild(popup);

    setTimeout(() => popup.remove(), 1000);
}

// Create particle effects
function createParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = x + 'px';
        particle.style.top = y + 'px';
        particle.style.background = color;

        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 100;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        particle.style.animation = `particleAnim ${0.5 + Math.random() * 0.5}s ease-out forwards`;

        document.querySelector('.game-container').appendChild(particle);

        setTimeout(() => particle.remove(), 1000);
    }
}

// Flip bacon with power
function flipBacon() {
    if (!gameStarted) return;

    const flipForce = 0.02 + (power / 100) * 0.08;
    const torque = 0.1 + (power / 100) * 0.3;

    Body.applyForce(bacon, bacon.position, {
        x: (Math.random() - 0.5) * flipForce,
        y: -flipForce
    });

    Body.setAngularVelocity(bacon, (Math.random() - 0.5) * torque);

    // Reset power
    power = 0;
    charging = false;
    updatePowerMeter();
}

// Power charging
function startCharging() {
    if (!gameStarted) return;
    charging = true;
    chargePower();
}

function chargePower() {
    if (charging && power < 100) {
        power += 2;
        updatePowerMeter();
        requestAnimationFrame(chargePower);
    }
}

function stopCharging() {
    if (charging) {
        flipBacon();
    }
}

function updatePowerMeter() {
    powerFill.style.height = power + '%';
}

// Reset game
function resetGame() {
    // Remove bacon and pans
    Composite.remove(engine.world, bacon);
    pans.forEach(pan => Composite.remove(engine.world, pan));
    pans = [];

    // Reset bacon and pans
    createBacon();
    createPans();
    Composite.add(engine.world, [bacon, ...pans]);

    // Reset score
    lastLandedPan = null;
    power = 0;
    charging = false;
    updatePowerMeter();
}

// Start game
function startGame() {
    document.getElementById('instructions').classList.add('hidden');
    initGame();
}

// Event listeners
flipBtn.addEventListener('mousedown', startCharging);
flipBtn.addEventListener('mouseup', stopCharging);
flipBtn.addEventListener('mouseleave', stopCharging);

resetBtn.addEventListener('click', resetGame);

// Keyboard controls
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !charging && gameStarted) {
        e.preventDefault();
        startCharging();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && charging) {
        e.preventDefault();
        stopCharging();
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (render) {
        render.canvas.width = canvas.parentElement.clientWidth;
        render.canvas.height = canvas.parentElement.clientHeight;
        render.options.width = canvas.parentElement.clientWidth;
        render.options.height = canvas.parentElement.clientHeight;
    }
});
