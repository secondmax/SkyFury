const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('scoreEl');
const finalScoreEl = document.getElementById('finalScoreEl');
const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const scoreBoard = document.getElementById('scoreBoard');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

let selectedShipConfig = 'balanced';
const shipOptions = document.querySelectorAll('.ship-option');

// Preload Images
const imgSpeedster = new Image();
imgSpeedster.src = 'speedster.png';

const imgBalanced = new Image();
imgBalanced.src = 'balanced.png';

const imgJuggernaut = new Image();
imgJuggernaut.src = 'juggernaut.png';

const imgPhantom = new Image();
imgPhantom.src = 'phantom.png';

// Preload Enemy Images
const imgEnemyScout = new Image();
imgEnemyScout.src = 'enemy_scout.png';

const imgEnemyFighter = new Image();
imgEnemyFighter.src = 'enemy_fighter.png';

const imgEnemyElite = new Image();
imgEnemyElite.src = 'enemy_elite.jpeg';

const imgEnemyTank = new Image();
imgEnemyTank.src = 'enemy_tank.png';

const imgEnemyBoss = new Image();
imgEnemyBoss.src = 'enemy_boss.png';

const imgEnemyFortress = new Image();
imgEnemyFortress.src = 'enemy_fortress.png';

shipOptions.forEach(option => {
    option.addEventListener('click', () => {
        shipOptions.forEach(opt => opt.classList.remove('active'));
        option.classList.add('active');
        selectedShipConfig = option.dataset.ship;
    });
});

// Set canvas size
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Global Variables
let animationId;
let score = 0;
let frameCount = 0;
let isGameOver = false;
let nextFortressScore = 800;
let fortressActive = false;
let fortressesDefeated = 0;

let player;
let bullets = [];
let enemyBullets = [];
let enemies = [];
let particles = [];
let backgroundStars = [];
let powerUps = [];

// Colors
const COLOR_PLAYER = '#00ffff';
const COLOR_BULLET = '#00ffaa';
const COLOR_ENEMY = '#ff00ff';

// Input handling
const mouse = {
    x: canvas.width / 2,
    y: canvas.height - 100
};

// Handle both mouse and touch
function handleInput(e) {
    if (isGameOver) return;
    
    // For touch events, prevent default scrolling
    if (e.type === 'touchmove' || e.type === 'touchstart') {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
    } else {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }
}

window.addEventListener('mousemove', handleInput);
window.addEventListener('touchmove', handleInput, { passive: false });
window.addEventListener('touchstart', handleInput, { passive: false });

// Star class for parallax background
class Star {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2;
        this.speed = Math.random() * 3 + 1;
        this.alpha = Math.random() * 0.5 + 0.1;
    }
    update() {
        this.y += this.speed;
        if (this.y > canvas.height) {
            this.y = 0;
            this.x = Math.random() * canvas.width;
        }
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Init stars
for (let i = 0; i < 100; i++) {
    backgroundStars.push(new Star());
}

// Classes
class Player {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        
        if (type === 'speedster') {
            this.radius = 15;
            this.color = '#00ffff';
            this.speed = 0.4;
        } else if (type === 'juggernaut') {
            this.radius = 25;
            this.color = '#ffff00';
            this.speed = 0.1;
        } else if (type === 'phantom') {
            this.radius = 12; // Smallest hitbox
            this.color = '#ff00ff'; // Magenta/Purple
            this.speed = 0.5; // Fastest speed
        } else { // balanced
            this.radius = 20;
            this.color = '#00ffaa';
            this.speed = 0.2;
        }
        
        this.weaponType = 'normal';
        this.weaponTimer = 0;
    }

    update() {
        if (this.weaponTimer > 0) {
            this.weaponTimer--;
            if (this.weaponTimer <= 0) {
                this.weaponType = 'normal';
            }
        }
        // Smooth follow mouse
        this.x += (mouse.x - this.x) * this.speed;
        this.y += (mouse.y - this.y) * this.speed;
        
        // Boundaries
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(this.radius, Math.min(canvas.height - this.radius, this.y));
    }

    draw() {
        ctx.save();
        
        let img = imgBalanced;
        if (this.type === 'speedster') img = imgSpeedster;
        else if (this.type === 'juggernaut') img = imgJuggernaut;
        else if (this.type === 'phantom') img = imgPhantom;

        if (img.complete && img.naturalWidth !== 0) {
            const size = this.radius * 3.5; // adjust scaling so it looks right
            ctx.drawImage(img, this.x - size/2, this.y - size/2, size, size);
        } else {
            // fallback
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.radius);
            ctx.lineTo(this.x + this.radius, this.y + this.radius);
            ctx.lineTo(this.x, this.y + this.radius * 0.5);
            ctx.lineTo(this.x - this.radius, this.y + this.radius);
            ctx.closePath();
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = this.color;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(this.x, this.y + this.radius * 0.2, this.radius * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        ctx.restore();
    }
}

class Bullet {
    constructor(x, y, radius, color, velocity, isLaser = false, isExplosive = false, isHoming = false) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.isLaser = isLaser;
        this.isExplosive = isExplosive;
        this.isHoming = isHoming;
        this.exploded = false;
        this.maxExplosionRadius = 80;
        this.target = null;
    }

    update() {
        if (this.exploded) {
            this.radius += 5; // Expand rapidly
            return;
        }
        if (this.isHoming) {
            if (!this.target || this.target.hp <= 0 || !enemies.includes(this.target)) {
                let closestDist = Infinity;
                let closestEnemy = null;
                for (let e of enemies) {
                    if (e.y > 0) {
                        const d = Math.hypot(e.x - this.x, e.y - this.y);
                        if (d < closestDist) {
                            closestDist = d;
                            closestEnemy = e;
                        }
                    }
                }
                this.target = closestEnemy;
            }
            if (this.target) {
                const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                const speed = 12;
                this.velocity.x += (Math.cos(angle) * speed - this.velocity.x) * 0.15;
                this.velocity.y += (Math.sin(angle) * speed - this.velocity.y) * 0.15;
            }
            particles.push(new Particle(this.x, this.y, 2, this.color, {x: (Math.random()-0.5)*2, y: 2}));
        }
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        if (this.exploded) {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 200, 0, ${1 - this.radius / this.maxExplosionRadius})`;
            ctx.fill();
        } else if (this.isLaser) {
            ctx.rect(this.x - this.radius, this.y - this.radius * 4, this.radius * 2, this.radius * 8);
            ctx.fillStyle = this.color;
            ctx.fill();
        } else {
            // Elongated bullet
            ctx.ellipse(this.x, this.y, this.radius * 0.5, this.radius * 2, 0, 0, Math.PI * 2);
            if (this.isExplosive) {
                ctx.fillStyle = '#ffffff'; // White center for explosive bullet
                ctx.fill();
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
                ctx.fillStyle = this.color;
                ctx.fill();
            } else if (this.isHoming) {
                ctx.fillStyle = '#ffffff'; // White center
                ctx.fill();
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.radius, 0, Math.PI*2);
                ctx.fillStyle = this.color;
                ctx.fill();
            } else {
                ctx.fillStyle = this.color;
                ctx.fill();
            }
        }
        ctx.restore();
    }
}

class EnemyBullet {
    constructor(x, y, radius, color, velocity, isExplosive = false) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.isExplosive = isExplosive;
        this.exploded = false;
        this.explosionRadius = 0;
        this.maxExplosionRadius = 150;
    }

    update() {
        if (this.exploded) {
            this.explosionRadius += 10;
            return;
        }
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }

    draw() {
        ctx.save();
        if (this.exploded) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.explosionRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 50, 0, ${1 - this.explosionRadius / this.maxExplosionRadius})`;
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        ctx.restore();
    }
}

class Enemy {
    constructor(x, y, radius, color, velocity, type) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.type = type;
        this.rotation = 0;
        this.shootTimer = Math.random() * 60; // random start phase
        
        if (type === 'fortress') {
            this.hp = 500 + Math.floor(score / 10) * 10;
            this.rotationSpeed = 0;
            this.sides = 4;
            this.width = canvas.width * 0.7; // Reduced width
            this.height = 300; 
            this.radius = this.width / 2; // approximation for simple distance checks
        } else if (type === 'boss') {
            this.hp = 50; // Set HP to 50 as requested
            this.rotationSpeed = (Math.random() - 0.5) * 0.02; // Very slow spin
            this.sides = 12; // Hexadecagon-ish
        } else if (type === 'scout') {
            this.hp = 1;
            this.rotationSpeed = 0;
            this.sides = 3;
        } else if (type === 'tank') {
            this.hp = 15 + Math.floor(score / 500); // gets tougher
            this.rotationSpeed = (Math.random() - 0.5) * 0.05; // slower spin
            this.sides = 8;
        } else if (type === 'elite') {
            this.hp = 8 + Math.floor(score / 800); // medium health
            this.rotationSpeed = (Math.random() - 0.5) * 0.08;
            this.sides = 6;
        } else { // fighter
            this.hp = 3 + Math.floor(score / 1000);
            this.rotationSpeed = (Math.random() - 0.5) * 0.1;
            this.sides = 5;
        }
        this.maxHp = this.hp;
        if (this.type === 'fortress') {
            this.nextDropHp = this.maxHp * 0.8;
        }
    }

    update() {
        if (this.type === 'fortress') {
            const visibleHeight = 180; // How much of the fortress is on screen
            const targetY = visibleHeight - this.height / 2;
            if (this.y < targetY) {
                this.y += this.velocity.y; // enter slowly
            }
            this.x += this.velocity.x;
            if (this.x < this.width / 2 || this.x > canvas.width - this.width / 2) {
                this.velocity.x *= -1; // bounce on edges
            }
        } else {
            this.x += this.velocity.x;
            this.y += this.velocity.y;
        }
        
        const halfHeight = (this.height ? this.height / 2 : this.radius);
        if (this.y + halfHeight > 0 && this.y - halfHeight < canvas.height) { // Only shoot if on screen
            this.shootTimer--;
            if (this.shootTimer <= 0) {
                if (this.type === 'fortress') {
                    // Fire from multiple turrets
                    const turrets = [this.x - this.width*0.3, this.x, this.x + this.width*0.3];
                    turrets.forEach(tx => {
                        enemyBullets.push(new EnemyBullet(tx, this.y + this.height/2, 6, '#ff00ff', { x: (Math.random()-0.5)*2, y: 4 }));
                    });
                    this.shootTimer = 50;
                } else if (this.type === 'fighter') {
                    // Continuous small fire (every 40 frames)
                    enemyBullets.push(new EnemyBullet(this.x, this.y + this.radius, 4, '#ffaa00', { x: 0, y: 5 }));
                    this.shootTimer = 40;
                } else if (this.type === 'tank') {
                    // One explosive shot every 120 frames
                    enemyBullets.push(new EnemyBullet(this.x, this.y + this.radius, 8, '#ff0000', { x: 0, y: 3 }, true));
                    this.shootTimer = 120;
                } else if (this.type === 'elite') {
                    // V-shape spread every 60 frames
                    enemyBullets.push(new EnemyBullet(this.x, this.y + this.radius, 5, '#00ffff', { x: -2, y: 4 }));
                    enemyBullets.push(new EnemyBullet(this.x, this.y + this.radius, 5, '#00ffff', { x: 2, y: 4 }));
                    this.shootTimer = 60;
                } else if (this.type === 'boss') {
                    // Ring of bullets every 90 frames
                    for (let i = 0; i < 16; i++) {
                        const angle = (i * 2 * Math.PI) / 16;
                        enemyBullets.push(new EnemyBullet(
                            this.x, this.y, 5, '#ff00ff', 
                            { x: Math.cos(angle) * 4, y: Math.sin(angle) * 4 }
                        ));
                    }
                    this.shootTimer = 90;
                } else {
                    // Scout doesn't shoot
                    this.shootTimer = 9999;
                }
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        let img = null;
        let drawWidth = this.radius * 2.5;
        let drawHeight = this.radius * 2.5;

        if (this.type === 'fortress') {
            img = imgEnemyFortress;
            drawWidth = this.width;
            if (img.complete && img.naturalWidth !== 0) {
                const aspectRatio = img.naturalHeight / img.naturalWidth;
                drawHeight = drawWidth * aspectRatio;
                // Sync collision height with visual height if possible
                this.height = drawHeight;
            } else {
                drawHeight = this.height;
            }
        } else if (this.type === 'boss') {
            img = imgEnemyBoss;
            drawWidth = this.radius * 3.5;
            drawHeight = this.radius * 3.5;
        } else if (this.type === 'tank') {
            img = imgEnemyTank;
            drawWidth = this.radius * 3;
            drawHeight = this.radius * 3;
        } else if (this.type === 'elite') {
            img = imgEnemyElite;
        } else if (this.type === 'scout') {
            img = imgEnemyScout;
        } else {
            img = imgEnemyFighter;
        }

        if (img && img.complete && img.naturalWidth !== 0) {
            ctx.rotate(Math.PI); // Keep them pointing down fixed
            ctx.drawImage(img, -drawWidth/2, -drawHeight/2, drawWidth, drawHeight);
        } else {
            // Fallback to geometric shapes
            // Remove ctx.rotate(this.rotation);
            if (this.type === 'fortress') {
                ctx.beginPath();
                ctx.rect(-this.width/2, -this.height/2, this.width, this.height);
                ctx.fillStyle = 'rgba(20, 0, 0, 0.9)';
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = this.color;
                ctx.stroke();
            } else {
                ctx.beginPath();
                for (let i = 0; i < this.sides; i++) {
                    const angle = (i * 2 * Math.PI) / this.sides;
                    let r = this.radius;
                    if (this.type === 'scout' && i === 0) r *= 1.5; 
                    ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
                }
                ctx.closePath();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = this.color;
                ctx.stroke();
            }
        }

        // HP Bar for fortress or large enemies
        if (this.type === 'fortress' || this.type === 'boss' || (this.type === 'tank' && this.hp < this.maxHp)) {
            const barWidth = this.type === 'fortress' ? this.width * 0.8 : this.radius * 2;
            const barHeight = this.type === 'fortress' ? 10 : 4;
            const hpRatio = this.hp / this.maxHp;
            ctx.setTransform(1, 0, 0, 1, this.x, this.y); // Reset transform for HP bar
            
            let barY = -drawHeight/2 - 20; // Default above
            if (this.type === 'fortress') {
                // For fortress, show bar at a fixed visible height
                const visibleHeight = 180;
                barY = (visibleHeight - 20) - this.y; 
            } else if (this.y < 100) {
                // If enemy is too close to top, show bar below it
                barY = drawHeight/2 + 10;
            }

            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(-barWidth/2, barY, barWidth, barHeight);
            ctx.fillStyle = hpRatio > 0.3 ? '#00ff00' : '#ff0000';
            ctx.fillRect(-barWidth/2, barY, barWidth * hpRatio, barHeight);
        }
        
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, radius, color, velocity) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.alpha = 1;
        this.friction = 0.98;
    }

    update() {
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.alpha -= 0.015;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.type = type;
        this.velocity = { x: 0, y: 2 };
        this.color = type === 'laser' ? '#ff0000' : type === 'shotgun' ? '#ffff00' : '#00ff00';
    }

    update() {
        this.y += this.velocity.y;
    }

    draw() {
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.color;
        ctx.stroke();

        ctx.fillStyle = this.color;
        ctx.font = '12px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const text = this.type === 'laser' ? 'L' : this.type === 'shotgun' ? 'S' : '3';
        ctx.fillText(text, this.x, this.y);
        ctx.restore();
    }
}

// Spawning functions
function spawnEnemy() {
    const r = Math.random();
    let type, radius, color, velocity;
    
    const speedMultiplier = 1 + score / 2000;

    if (fortressesDefeated >= 3 && r < 0.03) {
        // 3% chance Boss
        type = 'boss';
        radius = Math.random() * 20 + 80;
        color = '#ff0000';
        velocity = { x: (Math.random() - 0.5) * 0.5, y: (Math.random() * 0.5 + 0.2) * speedMultiplier };
    } else if (fortressesDefeated >= 2 && r < 0.15) {
        // Tank
        type = 'tank';
        radius = Math.random() * 10 + 35;
        color = '#ff0055';
        velocity = { x: (Math.random() - 0.5) * 1, y: (Math.random() * 1 + 0.5) * speedMultiplier };
    } else if (fortressesDefeated >= 1 && r < 0.3) {
        // Elite
        type = 'elite';
        radius = Math.random() * 5 + 25;
        color = '#00ffff'; // Cyan
        velocity = { x: (Math.random() - 0.5) * 2, y: (Math.random() * 1.5 + 1.5) * speedMultiplier };
    } else if (r < 0.55) {
        // Scout
        type = 'scout';
        radius = Math.random() * 5 + 10;
        color = '#ffff00';
        velocity = { x: (Math.random() - 0.5) * 3, y: (Math.random() * 3 + 4) * speedMultiplier };
    } else {
        // Fighter
        type = 'fighter';
        radius = Math.random() * 10 + 15;
        color = ['#ff00ff', '#ffaa00'][Math.floor(Math.random() * 2)];
        velocity = { x: (Math.random() - 0.5) * 2, y: (Math.random() * 2 + 2) * speedMultiplier };
    }

    const x = Math.random() * (canvas.width - radius * 2) + radius;
    const y = -radius;
    
    enemies.push(new Enemy(x, y, radius, color, velocity, type));
}

function createExplosion(x, y, color, amount = 20) {
    for (let i = 0; i < amount; i++) {
        particles.push(new Particle(
            x,
            y,
            Math.random() * 3 + 1,
            color,
            {
                x: (Math.random() - 0.5) * (Math.random() * 8),
                y: (Math.random() - 0.5) * (Math.random() * 8)
            }
        ));
    }
}

// Main Game Loop
function animate() {
    if (isGameOver) return;
    
    animationId = requestAnimationFrame(animate);
    
    // Create trailing effect by filling with slight opacity
    ctx.fillStyle = 'rgba(5, 5, 16, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Background Stars
    backgroundStars.forEach(star => {
        star.update();
        star.draw();
    });

    player.update();
    player.draw();

    // Auto Fire
    if (frameCount % 10 === 0 && player.weaponType !== 'laser') { // adjust fire rate
        const bx = player.x;
        const by = player.y - player.radius;
        
        if (player.weaponType === 'shotgun') {
            for(let i = -2; i <= 2; i++) {
                bullets.push(new Bullet(bx + i*5, by, 4, COLOR_BULLET, { x: i * 3, y: -15 }));
            }
            if (Math.random() < 0.2) { // 20% chance for a homing missile
                bullets.push(new Bullet(bx, by, 8, '#ff0055', { x: (Math.random()-0.5)*10, y: -5 }, false, false, true));
            }
        } else if (player.weaponType === 'threeway') {
            bullets.push(new Bullet(bx, by, 6, '#ffff00', { x: 0, y: -15 }, false, true)); // explosive middle bullet
            bullets.push(new Bullet(bx - 15, by + 5, 4, COLOR_BULLET, { x: -3, y: -15 }));
            bullets.push(new Bullet(bx + 15, by + 5, 4, COLOR_BULLET, { x: 3, y: -15 }));
        } else { // normal
            bullets.push(new Bullet(bx, by, 4, COLOR_BULLET, { x: 0, y: -15 }));
            if (score > 1000) {
                bullets.push(new Bullet(bx - 10, by + 5, 3, COLOR_BULLET, { x: -2, y: -12 }));
                bullets.push(new Bullet(bx + 10, by + 5, 3, COLOR_BULLET, { x: 2, y: -12 }));
            }
        }
    }

    // Continuous Laser Beam Logic
    if (player.weaponType === 'laser') {
        const laserWidth = 16;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.fillRect(player.x - laserWidth / 2, 0, laserWidth, player.y - player.radius);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(player.x - laserWidth / 4, 0, laserWidth / 2, player.y - player.radius);
        ctx.restore();
    }

    // Update PowerUps
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i];
        p.update();
        p.draw();

        // Check Collision with Player
        const dist = Math.hypot(player.x - p.x, player.y - p.y);
        if (dist - p.radius - player.radius < 0) {
            player.weaponType = p.type;
            player.weaponTimer = 600; // 10 seconds at 60fps
            powerUps.splice(i, 1);
            continue;
        }

        if (p.y - p.radius > canvas.height) {
            powerUps.splice(i, 1);
        }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        } else {
            p.update();
            p.draw();
        }
    }

    // Update Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.update();
        b.draw();
        
        if (b.exploded) {
            if (b.radius >= b.maxExplosionRadius) {
                bullets.splice(i, 1);
            }
        } else {
            // Remove if off screen
            if (b.y + b.radius < 0 || b.x < 0 || b.x > canvas.width) {
                bullets.splice(i, 1);
            }
        }
    }

    // Update Enemy Bullets
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.update();
        b.draw();
        
        // Handle explosive bullets
        if (b.isExplosive && !b.exploded) {
            // Explode if near player's Y or reached bottom
            if (b.y >= player.y - 50 || b.y > canvas.height - 50) {
                b.exploded = true;
            }
        }

        if (b.exploded) {
            if (b.explosionRadius >= b.maxExplosionRadius) {
                enemyBullets.splice(i, 1);
            } else {
                // Check player collision with explosion
                const dist = Math.hypot(player.x - b.x, player.y - b.y);
                if (dist - player.radius < b.explosionRadius) {
                    endGame();
                    return;
                }
            }
        } else {
            // Check player collision with normal bullet
            const dist = Math.hypot(player.x - b.x, player.y - b.y);
            if (dist - b.radius - player.radius * 0.5 < 0) {
                endGame();
                return;
            }
            // Remove if off screen
            if (b.y - b.radius > canvas.height || b.x < 0 || b.x > canvas.width || b.y < 0) {
                enemyBullets.splice(i, 1);
            }
        }
    }

    // Update Enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();
        enemy.draw();

        // Check Collision with Player
        let distToPlayer = 0;
        let isHitPlayer = false;
        
        if (enemy.type === 'fortress') {
            isHitPlayer = player.x > enemy.x - enemy.width/2 && player.x < enemy.x + enemy.width/2 &&
                          player.y > enemy.y - enemy.height/2 && player.y < enemy.y + enemy.height/2;
        } else {
            distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            isHitPlayer = distToPlayer - enemy.radius - player.radius * 0.5 < 0; // slightly forgiving hitbox
        }

        if (isHitPlayer) {
            endGame();
            return;
        }

        // Check Collision with Bullets
        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            let hitEnemy = false;
            if (enemy.type === 'fortress') {
                hitEnemy = bullet.x > enemy.x - enemy.width/2 && bullet.x < enemy.x + enemy.width/2 &&
                           bullet.y > enemy.y - enemy.height/2 && bullet.y < enemy.y + enemy.height/2;
            } else {
                const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
                hitEnemy = dist - enemy.radius - bullet.radius < 0;
            }
            
            if (hitEnemy) {
                // Hit!
                if (bullet.isExplosive && !bullet.exploded) {
                    bullet.exploded = true;
                    bullet.velocity = {x: 0, y: 0};
                    bullet.color = '#ffaa00';
                    createExplosion(bullet.x, bullet.y, '#ffffff', 20); // big spark
                } else if (!bullet.isLaser && !bullet.exploded) {
                    bullets.splice(j, 1);
                    createExplosion(bullet.x, bullet.y, bullet.color, 10); // spark
                }
                
                if (bullet.isHoming) {
                    enemy.hp -= 100; // Insta-kill damage
                } else {
                    enemy.hp--;
                }
                
                if (enemy.hp <= 0) {
                    if (enemy.type === 'fortress') {
                        fortressActive = false;
                        fortressesDefeated++;
                        score += 500;
                        // multiple powerups
                        for(let k=0; k<5; k++) {
                            const types = ['threeway', 'shotgun', 'laser'];
                            const pType = types[Math.floor(Math.random() * types.length)];
                            powerUps.push(new PowerUp(enemy.x - 100 + k*50, enemy.y, pType));
                        }
                        createExplosion(enemy.x, enemy.y, enemy.color, 100);
                    } else {
                        score += Math.floor(enemy.radius);
                        if (Math.random() < 0.1) { // 10% drop rate
                            const types = ['threeway', 'shotgun', 'laser'];
                            const pType = types[Math.floor(Math.random() * types.length)];
                            powerUps.push(new PowerUp(enemy.x, enemy.y, pType));
                        }
                        createExplosion(enemy.x, enemy.y, enemy.color, enemy.radius * 1.5);
                    }
                    scoreEl.innerHTML = score;
                    
                    enemies.splice(i, 1);
                } else {
                    // visual feedback for hit
                    if (enemy.type !== 'fortress') {
                        enemy.radius *= 0.95; 
                    } else if (enemy.hp <= enemy.nextDropHp) {
                        enemy.nextDropHp -= enemy.maxHp * 0.2;
                        const types = ['threeway', 'shotgun', 'laser'];
                        const pType = types[Math.floor(Math.random() * types.length)];
                        powerUps.push(new PowerUp(enemy.x + (Math.random() - 0.5) * enemy.width, enemy.y + enemy.height / 2, pType));
                    }
                }
                break; // A bullet can only hit one enemy
            }
        }

        // Check Collision with Laser Beam
        if (enemy && player.weaponType === 'laser') {
            const laserWidth = 16;
            let hitLaser = false;
            if (enemy.type === 'fortress') {
                hitLaser = enemy.y < player.y && Math.abs(enemy.x - player.x) < enemy.width/2 + laserWidth/2;
            } else {
                hitLaser = enemy.y < player.y && Math.abs(enemy.x - player.x) < enemy.radius + laserWidth / 2;
            }

            if (hitLaser) {
                createExplosion(enemy.x, enemy.y + enemy.radius, '#ff0000', 1); // sparks
                enemy.hp -= 0.5; // continuous damage
                if (enemy.hp <= 0) {
                    if (enemy.type === 'fortress') {
                        fortressActive = false;
                        fortressesDefeated++;
                        score += 500;
                        for(let k=0; k<5; k++) {
                            const types = ['threeway', 'shotgun', 'laser'];
                            const pType = types[Math.floor(Math.random() * types.length)];
                            powerUps.push(new PowerUp(enemy.x - 100 + k*50, enemy.y, pType));
                        }
                        createExplosion(enemy.x, enemy.y, enemy.color, 100);
                    } else {
                        score += Math.floor(enemy.radius);
                        if (Math.random() < 0.1) {
                            const types = ['threeway', 'shotgun', 'laser'];
                            const pType = types[Math.floor(Math.random() * types.length)];
                            powerUps.push(new PowerUp(enemy.x, enemy.y, pType));
                        }
                        createExplosion(enemy.x, enemy.y, enemy.color, enemy.radius * 1.5);
                    }
                    scoreEl.innerHTML = score;
                    enemies.splice(i, 1);
                    continue; // Skip the rest for this enemy
                } else {
                    if (enemy.type !== 'fortress') {
                        enemy.radius *= 0.99; // slight shrink feedback
                    } else if (enemy.hp <= enemy.nextDropHp) {
                        enemy.nextDropHp -= enemy.maxHp * 0.2;
                        const types = ['threeway', 'shotgun', 'laser'];
                        const pType = types[Math.floor(Math.random() * types.length)];
                        powerUps.push(new PowerUp(enemy.x + (Math.random() - 0.5) * enemy.width, enemy.y + enemy.height / 2, pType));
                    }
                }
            }
        }

        // Remove if off screen
        if (enemy && enemy.y - enemy.radius > canvas.height) {
            enemies.splice(i, 1);
        }
    }

    // Spawn Fortress Boss
    if (score >= nextFortressScore && !fortressActive) {
        fortressActive = true;
        nextFortressScore += 1000 + (fortressesDefeated * 200); // Progressively harder to trigger boss
        
        // create the fortress
        const fWidth = canvas.width * 0.7;
        enemies.push(new Enemy(canvas.width/2, -200, fWidth/2, '#ff0000', {x: 1, y: 0.5}, 'fortress'));
    }

    // Spawn Enemy (slower if fortress is active)
    let spawnInterval = Math.max(30, 90 - Math.floor(score / 50));
    if (fortressActive) {
        spawnInterval *= 4; // Spawn much slower during boss fight
    }
    
    if (frameCount % spawnInterval === 0) {
        spawnEnemy();
    }

    frameCount++;
}

function initGame() {
    score = 0;
    frameCount = 0;
    scoreEl.innerHTML = score;
    bullets = [];
    enemyBullets = [];
    enemies = [];
    particles = [];
    powerUps = [];
    isGameOver = false;
    nextFortressScore = 800;
    fortressActive = false;
    fortressesDefeated = 0;
    
    // Set initial mouse pos to center bottom
    mouse.x = canvas.width / 2;
    mouse.y = canvas.height - 100;

    player = new Player(mouse.x, mouse.y, selectedShipConfig);
}

function startGame() {
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    scoreBoard.classList.remove('hidden');
    initGame();
    animate();
}

function endGame() {
    isGameOver = true;
    cancelAnimationFrame(animationId);
    createExplosion(player.x, player.y, COLOR_PLAYER, 50); // player explosion
    
    // Render one last frame to show the explosion
    ctx.fillStyle = 'rgba(5, 5, 16, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    
    // Handle Leaderboard
    let highScores = JSON.parse(localStorage.getItem('skyfury_leaderboard') || '[]');
    const currentScoreObj = { score: score, date: new Date().toLocaleDateString() };
    highScores.push(currentScoreObj);
    highScores.sort((a, b) => b.score - a.score);
    highScores = highScores.slice(0, 5); // Keep top 5
    localStorage.setItem('skyfury_leaderboard', JSON.stringify(highScores));
    
    setTimeout(() => {
        scoreBoard.classList.add('hidden');
        gameOverScreen.classList.remove('hidden');
        finalScoreEl.innerHTML = score;
        
        // Update Leaderboard UI
        const leaderboardList = document.getElementById('leaderboardList');
        if (leaderboardList) {
            leaderboardList.innerHTML = '';
            let isCurrentScoreHighlighted = false;
            highScores.forEach((item, index) => {
                const li = document.createElement('li');
                li.innerHTML = `<span>#${index + 1}</span> <span>${item.score} pts</span>`;
                // Highlight the current score exactly once if it's in the top 5
                if (!isCurrentScoreHighlighted && item.score === score && item.date === currentScoreObj.date) {
                    li.classList.add('new-score');
                    isCurrentScoreHighlighted = true;
                }
                leaderboardList.appendChild(li);
            });
        }
    }, 1000);
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
