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
let nextFortressScore = 300;
let fortressActive = false;

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
    constructor(x, y, radius, color, velocity, isLaser = false) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.velocity = velocity;
        this.isLaser = isLaser;
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
    }

    draw() {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        if (this.isLaser) {
            ctx.rect(this.x - this.radius, this.y - this.radius * 4, this.radius * 2, this.radius * 8);
        } else {
            // Elongated bullet
            ctx.ellipse(this.x, this.y, this.radius * 0.5, this.radius * 2, 0, 0, Math.PI * 2);
        }
        ctx.fillStyle = this.color;
        ctx.fill();
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
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
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
            this.width = canvas.width * 0.8;
            this.height = 80;
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
            if (this.y < 100) {
                this.y += this.velocity.y; // enter slowly
            }
            this.x += this.velocity.x;
            if (this.x < this.width / 2 || this.x > canvas.width - this.width / 2) {
                this.velocity.x *= -1; // bounce on edges
            }
        } else {
            this.x += this.velocity.x;
            this.y += this.velocity.y;
            this.rotation += this.rotationSpeed;
        }
        
        if (this.y > 0 && this.y < canvas.height) { // Only shoot if on screen
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
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        if (this.type === 'fortress') {
            // Draw Fortress
            ctx.beginPath();
            ctx.rect(-this.width/2, -this.height/2, this.width, this.height);
            ctx.fillStyle = 'rgba(20, 0, 0, 0.9)';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = this.color;
            ctx.stroke();

            // Draw turrets
            ctx.fillStyle = this.color;
            [-0.3, 0, 0.3].forEach(offset => {
                ctx.beginPath();
                ctx.arc(this.width * offset, this.height/2, 15, 0, Math.PI, true);
                ctx.fill();
            });

            // HP Bar
            const hpRatio = this.hp / this.maxHp;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(-this.width/2 + 10, -this.height/2 + 10, (this.width - 20) * hpRatio, 10);
        } else {
            // If it's a scout, point it downwards (assuming velocity is downwards)
            if (this.type === 'scout') {
                // angle towards velocity
                const angle = Math.atan2(this.velocity.y, this.velocity.x);
                ctx.rotate(angle - Math.PI / 2); // default points up, rotate to velocity
            }
            
            ctx.beginPath();
            for (let i = 0; i < this.sides; i++) {
                const angle = (i * 2 * Math.PI) / this.sides;
                // for scout make it pointy
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

            // Draw inner core showing HP for tanks or fighters
            if (this.type === 'tank' || this.type === 'boss' || this.hp > 1) {
                ctx.beginPath();
                const hpRatio = this.hp / this.maxHp;
                ctx.arc(0, 0, this.radius * 0.5 * hpRatio, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.globalAlpha = 0.5;
                ctx.fill();
                ctx.globalAlpha = 1;
            }
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
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
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
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
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

    if (r < 0.03) {
        // 3% chance Boss
        type = 'boss';
        radius = Math.random() * 20 + 80; // 80 to 100, much larger than tank
        color = '#ff0000'; // Pure red
        velocity = {
            x: (Math.random() - 0.5) * 0.5,
            y: (Math.random() * 0.5 + 0.2) * speedMultiplier // Very slow
        };
    } else if (r < 0.2) {
        // 17% chance Tank
        type = 'tank';
        radius = Math.random() * 10 + 35; // 35 to 45
        color = '#ff0055'; // Reddish
        velocity = {
            x: (Math.random() - 0.5) * 1,
            y: (Math.random() * 1 + 0.5) * speedMultiplier
        };
    } else if (r < 0.5) {
        // 30% chance Scout
        type = 'scout';
        radius = Math.random() * 5 + 10; // 10 to 15
        color = '#ffff00'; // Yellow
        velocity = {
            x: (Math.random() - 0.5) * 3,
            y: (Math.random() * 3 + 4) * speedMultiplier
        };
    } else {
        // 50% chance Fighter
        type = 'fighter';
        radius = Math.random() * 10 + 20; // 20 to 30
        color = ['#ff00ff', '#ffaa00'][Math.floor(Math.random() * 2)];
        velocity = {
            x: (Math.random() - 0.5) * 2,
            y: (Math.random() * 2 + 2) * speedMultiplier
        };
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
        } else if (player.weaponType === 'threeway') {
            bullets.push(new Bullet(bx, by, 4, COLOR_BULLET, { x: 0, y: -15 }));
            bullets.push(new Bullet(bx - 10, by + 5, 4, COLOR_BULLET, { x: -3, y: -15 }));
            bullets.push(new Bullet(bx + 10, by + 5, 4, COLOR_BULLET, { x: 3, y: -15 }));
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
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ff0000';
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
        
        // Remove if off screen
        if (b.y + b.radius < 0 || b.x < 0 || b.x > canvas.width) {
            bullets.splice(i, 1);
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
                createExplosion(bullet.x, bullet.y, COLOR_BULLET, 5); // small spark
                if (!bullet.isLaser) {
                    bullets.splice(j, 1);
                }
                
                enemy.hp--;
                
                if (enemy.hp <= 0) {
                    if (enemy.type === 'fortress') {
                        fortressActive = false;
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
        nextFortressScore += 500;
        
        // create the fortress
        const fWidth = canvas.width * 0.8;
        enemies.push(new Enemy(canvas.width/2, -100, fWidth/2, '#ff0000', {x: 1, y: 0.5}, 'fortress'));
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
    nextFortressScore = 300;
    fortressActive = false;
    
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
    
    setTimeout(() => {
        scoreBoard.classList.add('hidden');
        gameOverScreen.classList.remove('hidden');
        finalScoreEl.innerHTML = score;
    }, 1000);
}

// Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
