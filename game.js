const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
  hp: document.getElementById('hp'),
  level: document.getElementById('level'),
  gold: document.getElementById('gold'),
  wave: document.getElementById('wave'),
};

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const keys = {};
const particles = [];
const projectiles = [];
const enemies = [];
const pickups = [];

const game = {
  over: false,
  wave: 1,
  lastTime: 0,
  spawnTimer: 0,
  spawnInterval: 1.4,
};

const player = {
  x: WIDTH / 2,
  y: HEIGHT / 2,
  r: 18,
  speed: 210,
  hp: 100,
  maxHp: 100,
  invuln: 0,
  attackCooldown: 0,
  facingX: 1,
  facingY: 0,
  gold: 0,
  level: 1,
  xp: 0,
  xpToNext: 30,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function spawnEnemy() {
  const margin = 40;
  const side = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (side === 0) {
    x = rand(-margin, WIDTH + margin);
    y = -margin;
  } else if (side === 1) {
    x = WIDTH + margin;
    y = rand(-margin, HEIGHT + margin);
  } else if (side === 2) {
    x = rand(-margin, WIDTH + margin);
    y = HEIGHT + margin;
  } else {
    x = -margin;
    y = rand(-margin, HEIGHT + margin);
  }

  const speed = 38 + game.wave * 6 + Math.random() * 25;
  enemies.push({
    x,
    y,
    r: 14 + Math.random() * 8,
    speed,
    hp: 1 + game.wave * 0.5,
    damage: 10 + game.wave * 2,
  });
}

function spawnPickup(x, y) {
  pickups.push({
    x,
    y,
    r: 8,
    pulse: Math.random() * Math.PI * 2,
    value: 1 + Math.floor(Math.random() * 3),
  });
}

function shoot() {
  if (player.attackCooldown > 0 || game.over) return;

  const projectileSpeed = 420;
  const dx = player.facingX || 1;
  const dy = player.facingY || 0;

  projectiles.push({
    x: player.x + dx * 18,
    y: player.y + dy * 18,
    r: 5,
    dx: dx * projectileSpeed,
    dy: dy * projectileSpeed,
    life: 1.2,
  });

  player.attackCooldown = 0.24;
}

function gainXP(amount) {
  player.xp += amount;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.xpToNext = Math.floor(player.xpToNext * 1.45);
    player.maxHp += 10;
    player.hp = player.maxHp;
    game.wave += 1;
  }
}

function burst(x, y, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: rand(-90, 90),
      vy: rand(-90, 90),
      life: rand(0.3, 0.8),
      color,
      r: rand(2, 5),
    });
  }
}

function handleInput() {
  const dx = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
  const dy = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);

  const length = Math.hypot(dx, dy) || 1;
  const moveX = dx / length;
  const moveY = dy / length;

  if (dx !== 0 || dy !== 0) {
    player.x += moveX * player.speed * (1 / 60);
    player.y += moveY * player.speed * (1 / 60);
    player.facingX = dx || player.facingX;
    player.facingY = dy || player.facingY;
  }

  if (keys[' ']) {
    shoot();
  }

  player.x = clamp(player.x, player.r, WIDTH - player.r);
  player.y = clamp(player.y, player.r, HEIGHT - player.r);
}

function update(dt) {
  if (game.over) {
    return;
  }

  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    spawnEnemy();
    game.spawnTimer = Math.max(0.45, 1.7 - game.wave * 0.08);
  }

  player.attackCooldown = Math.max(0, player.attackCooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  handleInput();

  for (const projectile of projectiles) {
    projectile.x += projectile.dx * dt;
    projectile.y += projectile.dy * dt;
    projectile.life -= dt;
  }

  for (const enemy of enemies) {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += Math.cos(angle) * enemy.speed * dt;
    enemy.y += Math.sin(angle) * enemy.speed * dt;

    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist < enemy.r + player.r) {
      if (player.invuln <= 0) {
        player.hp -= enemy.damage;
        player.invuln = 0.7;
        burst(player.x, player.y, '#ff6b6b', 16);
        if (player.hp <= 0) {
          player.hp = 0;
          game.over = true;
        }
      }
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const p = projectiles[i];
    if (p.life <= 0 || p.x < -20 || p.x > WIDTH + 20 || p.y < -20 || p.y > HEIGHT + 20) {
      projectiles.splice(i, 1);
      continue;
    }

    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      const enemy = enemies[j];
      const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
      if (dist < p.r + enemy.r) {
        enemy.hp -= 1;
        burst(p.x, p.y, '#ffd76b', 8);
        projectiles.splice(i, 1);
        if (enemy.hp <= 0) {
          const coinChance = Math.random();
          if (coinChance < 0.8) {
            spawnPickup(enemy.x, enemy.y);
          }
          gainXP(8 + game.wave);
          player.gold += 1 + Math.floor(Math.random() * 2);
          enemies.splice(j, 1);
          burst(enemy.x, enemy.y, '#74f0d2', 18);
        }
        break;
      }
    }
  }

  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const pickup = pickups[i];
    pickup.pulse += dt * 4;
    const dist = Math.hypot(player.x - pickup.x, player.y - pickup.y);
    if (dist < player.r + pickup.r + 6) {
      player.gold += pickup.value;
      burst(pickup.x, pickup.y, '#fddc73', 14);
      pickups.splice(i, 1);
    }
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;
    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }

  ui.hp.textContent = `${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`;
  ui.level.textContent = player.level;
  ui.gold.textContent = player.gold;
  ui.wave.textContent = game.wave;
}

function drawBackground() {
  ctx.fillStyle = '#102736';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (let x = 0; x < WIDTH; x += 48) {
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    ctx.fillRect(x, 0, 1, HEIGHT);
  }
  for (let y = 0; y < HEIGHT; y += 48) {
    ctx.fillStyle = 'rgba(255,255,255,0.015)';
    ctx.fillRect(0, y, WIDTH, 1);
  }

  ctx.fillStyle = 'rgba(129, 182, 255, 0.2)';
  for (let i = 0; i < 42; i += 1) {
    const x = (i * 131) % WIDTH;
    const y = (i * 97) % HEIGHT;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  const pulse = player.invuln > 0 ? Math.sin(performance.now() / 70) * 6 : 0;
  ctx.beginPath();
  ctx.fillStyle = player.invuln > 0 ? '#ffef8a' : '#7ce7ff';
  ctx.arc(0, 0, player.r + pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = '#113d5c';
  ctx.moveTo(0, 0);
  ctx.lineTo(player.facingX * 18, player.facingY * 18);
  ctx.lineTo(player.facingY * 13, -player.facingX * 13);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.beginPath();
    ctx.fillStyle = '#ff5d73';
    ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawProjectiles() {
  for (const projectile of projectiles) {
    ctx.beginPath();
    ctx.fillStyle = '#f9d976';
    ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPickups() {
  for (const pickup of pickups) {
    const bob = Math.sin(pickup.pulse) * 4;
    ctx.beginPath();
    ctx.fillStyle = '#f6d365';
    ctx.arc(pickup.x, pickup.y + bob, pickup.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = '#fff4b8';
    ctx.fillRect(pickup.x - 2.5, pickup.y - 8 + bob, 5, 16);
    ctx.fillRect(pickup.x - 8, pickup.y - 2.5 + bob, 16, 5);
  }
}

function drawParticles() {
  for (const particle of particles) {
    ctx.beginPath();
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = Math.max(0, particle.life * 2);
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawUI() {
  ctx.fillStyle = 'rgba(10, 13, 28, 0.55)';
  ctx.fillRect(18, 18, 170, 50);

  ctx.fillStyle = '#eaf6ff';
  ctx.font = '16px sans-serif';
  ctx.fillText(`HP: ${Math.ceil(player.hp)}/${player.maxHp}`, 28, 42);
  ctx.fillText(`XP: ${player.xp}/${player.xpToNext}`, 28, 58);

  if (game.over) {
    ctx.fillStyle = 'rgba(9, 11, 18, 0.68)';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText('You Fell', WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = '22px sans-serif';
    ctx.fillText(`Final gold: ${player.gold} · Wave ${game.wave}`, WIDTH / 2, HEIGHT / 2 + 28);
    ctx.fillText('Press R to start over', WIDTH / 2, HEIGHT / 2 + 58);
    ctx.textAlign = 'start';
  }
}

function resetGame() {
  game.over = false;
  game.wave = 1;
  game.spawnTimer = 0.8;
  enemies.length = 0;
  projectiles.length = 0;
  particles.length = 0;
  pickups.length = 0;
  player.x = WIDTH / 2;
  player.y = HEIGHT / 2;
  player.hp = player.maxHp;
  player.gold = 0;
  player.level = 1;
  player.xp = 0;
  player.xpToNext = 30;
  player.invuln = 0;
  player.attackCooldown = 0;
}

function loop(timestamp) {
  const dt = Math.min((timestamp - game.lastTime) / 1000 || 0, 0.033);
  game.lastTime = timestamp;

  update(dt);

  drawBackground();
  drawPickups();
  drawProjectiles();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawUI();

  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;
  if (key === ' ' || key === 'spacebar') {
    event.preventDefault();
  }
  if (key === 'r' && game.over) {
    resetGame();
  }
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = false;
});

resetGame();
requestAnimationFrame(loop);
