const socket = io();

// UI Elements
const startScreen = document.getElementById('start-screen');
const gameplayScreen = document.getElementById('gameplay-screen');
const startBtn = document.getElementById('start-btn');
const playerNameInput = document.getElementById('player-name');
const charOptions = document.querySelectorAll('.char-option');
const activeCharIcon = document.getElementById('active-char-icon');
const activePlayerName = document.getElementById('active-player-name');
const scoreDisplay = document.getElementById('score-display');
const livesDisplay = document.getElementById('lives-display');
const gameOverOverlay = document.getElementById('game-over-overlay');
const goTitle = document.getElementById('go-title');
const goMessage = document.getElementById('go-message');
const finalScoreContainer = document.getElementById('final-score-container');
const finalScoreVal = document.getElementById('final-score-val');
const restartBtn = document.getElementById('restart-btn');

// Canvas setup
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let canvasWidth, canvasHeight;

const charMap = {
    'duck': '🦆',
    'dog': '🐶',
    'trex': '🦖',
    'turtle': '🐢',
    'bunny': '🐰',
    'horse': '🐴',
    'cow': '🐮'
};

// Game State
let gameState = 'START'; // START, PLAYING, DYING, GAME_OVER
let playerSettings = { name: '', character: 'duck' };
let currentLives = 2;
let score = 0;
let gameSpeed = 6;
let animationFrameId;
let frames = 0;

// Entities
let player;
let obstacles = [];
let groundY = 0;

let bgImage = new Image();
bgImage.src = 'assets/DinoRunBkgrnd.png';
let bgX = 0;

// Audio setup
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isMusicPlaying = false;
let musicInterval;
const notes = [
    {f: 330}, {f: 330}, {f: 0}, {f: 330}, 
    {f: 0}, {f: 261}, {f: 330}, {f: 0},
    {f: 392}, {f: 0}, {f: 0}, {f: 0},
    {f: 196}, {f: 0}, {f: 0}, {f: 0}
];
let noteIdx = 0;

function playNote(freq) {
    if (audioCtx.state === 'suspended') { audioCtx.resume(); }
    if (freq === 0) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

function playMusicLoop() {
    if(!isMusicPlaying) return;
    const note = notes[noteIdx];
    playNote(note.f);
    noteIdx = (noteIdx + 1) % notes.length;
}

function startMusic() {
    if (audioCtx.state === 'suspended') { audioCtx.resume(); }
    if (!isMusicPlaying) {
        isMusicPlaying = true;
        musicInterval = setInterval(playMusicLoop, 150); // fast tempo
    }
}

function stopMusic() {
    isMusicPlaying = false;
    if (musicInterval) {
        clearInterval(musicInterval);
        musicInterval = null;
    }
}

// Event Listeners for UI
charOptions.forEach(opt => {
    opt.addEventListener('click', () => {
        charOptions.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        playerSettings.character = opt.dataset.char;
    });
});

startBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (!name) {
        alert("Please enter a player name!");
        return;
    }
    playerSettings.name = name;
    
    // Switch screens
    startScreen.classList.remove('active');
    gameplayScreen.classList.add('active');
    
    // Set UI
    activeCharIcon.innerText = charMap[playerSettings.character];
    activePlayerName.innerText = playerSettings.name;
    
    // Init Game
    initGame();
});

restartBtn.addEventListener('click', () => {
    location.reload();
});

// Resize handler
function resizeCanvas() {
    canvasWidth = gameplayScreen.clientWidth;
    canvasHeight = gameplayScreen.clientHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    groundY = canvasHeight - 100; // 100px from bottom margin
}
window.addEventListener('resize', resizeCanvas);


// Physics and Classes
class Player {
    constructor() {
        this.width = 60;
        this.originalHeight = 60;
        this.duckHeight = 35;
        this.height = this.originalHeight;
        this.x = 100;
        this.y = groundY - this.height;
        this.vy = 0;
        this.gravity = 0.6;
        this.jumpPower = -12;
        this.isGrounded = false;
        this.isDucking = false;
        this.charEmoji = charMap[playerSettings.character];
        
        // simple animation state
        this.bobOffset = 0;
        this.runCycle = 0;
        this.runAngle = 0;
        this.runStretch = 1;
    }

    jump() {
        if (this.isGrounded && !this.isDucking) {
            this.vy = this.jumpPower;
            this.isGrounded = false;
        }
    }

    duck(state) {
        if (!this.isGrounded) return; // Can't duck in mid-air for simplicity
        this.isDucking = state;
        if (state) {
            this.height = this.duckHeight;
            this.y = groundY - this.height;
        } else {
            this.height = this.originalHeight;
            this.y = groundY - this.height;
        }
    }

    update() {
        this.y += this.vy;
        
        // Apply gravity
        if (this.y + this.height < groundY) {
            this.vy += this.gravity;
            this.isGrounded = false;
        } else {
            this.vy = 0;
            this.y = groundY - this.height;
            this.isGrounded = true;
        }

        // Animation Bobbing and Running calculation
        if (this.isGrounded && gameSpeed > 0) {
            this.runCycle += 0.2 + (gameSpeed * 0.02);
            this.bobOffset = Math.sin(this.runCycle * 2) * -5;
            this.runAngle = Math.sin(this.runCycle) * 0.15; // Side to side wobble
            this.runStretch = 1 + Math.abs(Math.sin(this.runCycle * 2)) * 0.1; // Vertical squash/stretch
        } else {
            this.bobOffset = 0;
            this.runAngle = 0;
            this.runStretch = 1;
            this.runCycle = 0;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2 + this.bobOffset);
        
        // Rotate for wobble and Scale by -1 on X to flip the emoji to face RIGHT
        ctx.rotate(this.runAngle);
        ctx.scale(-1, this.runStretch);
        
        if (this.isDucking) {
            // Apply extra scale for duck
            ctx.scale(1, 0.7);
        }
        
        // Draw emoji as character
        ctx.font = `${this.originalHeight * 0.8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.charEmoji, 0, 0);
        
        ctx.restore();
    }
}

class Obstacle {
    constructor(type) {
        this.type = type; // 0 = small cactus, 1 = large cactus, 2 = bird
        this.x = canvasWidth;
        
        if (this.type === 2) { // Bird
            this.width = 40;
            this.height = 30;
            this.y = groundY - 80 - Math.random() * 40; // High up
            this.emoji = '🦅';
        } else {
            // Cactus
            this.width = this.type === 1 ? 50 : 30;
            this.height = this.type === 1 ? 70 : 50;
            this.y = groundY - this.height;
            this.emoji = '🌵';
        }
    }

    update() {
        this.x -= gameSpeed;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        
        ctx.font = `${this.height * 0.8}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.emoji, 0, 0);
        
        ctx.restore();
    }
}

// Controls
window.addEventListener('keydown', (e) => {
    if (gameState === 'PLAYING') {
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            player.jump();
            e.preventDefault();
        }
        if (e.code === 'ArrowDown') {
            player.duck(true);
            e.preventDefault();
        }
    } else if (gameState === 'DYING') {
        if (e.code === 'Space' || e.type === 'click') {
            resetLevel();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (gameState === 'PLAYING') {
        if (e.code === 'ArrowDown') {
            player.duck(false);
        }
    }
});

// For touch/mouse users
window.addEventListener('mousedown', () => {
    if (gameState === 'PLAYING') player.jump();
    if (gameState === 'DYING') resetLevel();
});


function initGame() {
    resizeCanvas();
    currentLives = 2;
    score = 0;
    resetLevel();
}

function resetLevel() {
    player = new Player();
    obstacles = [];
    gameSpeed = 6;
    frames = 0;
    gameState = 'PLAYING';
    
    gameOverOverlay.classList.add('hidden');
    finalScoreContainer.classList.add('hidden');
    updateHUD();
    
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    
    startMusic();
    gameLoop();
}

function spawnObstacle() {
    let type = 0;
    const rand = Math.random();
    if (rand > 0.85 && score > 200) type = 2; // Bird after 200 score
    else if (rand > 0.5) type = 1; // Big cactus
    
    obstacles.push(new Obstacle(type));
}

function checkCollision() {
    // Simple AABB collision with margin
    const margin = 10;
    for (let obs of obstacles) {
        if (
            player.x < obs.x + obs.width - margin &&
            player.x + player.width - margin > obs.x &&
            player.y < obs.y + obs.height - margin &&
            player.y + player.height - margin > obs.y
        ) {
            return true;
        }
    }
    return false;
}

function die() {
    stopMusic();
    gameState = 'DYING';
    currentLives -= 1;
    updateHUD();
    
    gameOverOverlay.classList.remove('hidden');
    
    if (currentLives <= 0) {
        gameState = 'GAME_OVER';
        goTitle.innerText = "GAME OVER";
        goMessage.innerText = "";
        finalScoreContainer.classList.remove('hidden');
        finalScoreVal.innerText = Math.floor(score);
        
        // Emit to server
        socket.emit('submit_score', {
            playerName: playerSettings.name,
            score: Math.floor(score),
            character: playerSettings.character
        });
        
    } else {
        goTitle.innerText = "LIFE LOST!";
        goMessage.innerText = "Press Space or click to continue";
    }
}

function updateHUD() {
    scoreDisplay.innerText = `Score: ${Math.floor(score)}`;
    livesDisplay.innerText = `Lives: ${currentLives}`;
}

function drawBackground() {
    // Clear canvas
    ctx.fillStyle = "#e0fbfc";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (bgImage.complete && bgImage.naturalHeight > 0) {
        ctx.imageSmoothingEnabled = false;
        
        // Scale image height to fit canvas height up to groundY
        const scale = canvasHeight / bgImage.naturalHeight;
        const scaledWidth = bgImage.naturalWidth * scale;
        
        bgX -= (gameSpeed * 0.3); // parallax speed
        if (bgX <= -scaledWidth) {
            bgX += scaledWidth;
        }

        // Tile the background horizontally
        let currentX = bgX;
        while (currentX < canvasWidth) {
            ctx.drawImage(bgImage, currentX, 0, scaledWidth, canvasHeight);
            currentX += scaledWidth;
        }
    } else {
        // Fallback drawing if image not loaded
        ctx.fillStyle = "rgba(0,0,0,0.05)";
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(300, groundY - 200);
        ctx.lineTo(600, groundY);
        ctx.fill();
    }

    // Draw Ground
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvasWidth, groundY);
    ctx.stroke();
}

function gameLoop() {
    if (gameState !== 'PLAYING') return;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Update
    frames++;
    score += 0.05 * (gameSpeed / 6);
    if (frames % 600 === 0) gameSpeed += 0.5; // increase speed
    
    if (frames % 120 === 0) {
        // Spawn rate logic
        if (Math.random() > 0.3) {
            spawnObstacle();
        }
    }

    player.update();
    
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].update();
        if (obstacles[i].x + obstacles[i].width < 0) {
            obstacles.splice(i, 1);
        }
    }

    if (checkCollision()) {
        die();
        return; // Pause frame drawing
    }
    
    if (frames % 5 === 0) updateHUD();

    // Draw
    drawBackground();
    obstacles.forEach(obs => obs.draw());
    player.draw();

    animationFrameId = requestAnimationFrame(gameLoop);
}
