// ===========================================================================
//  UNDERTALE CO-OP  -  Servidor multiplayer autoritativo
// ===========================================================================
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server);

// ----- Constantes do jogo --------------------------------------------------
const BOX = { w: 580, h: 360 };          // tamanho da "caixa de batalha"
const SOUL = 16;                          // tamanho da alma (coração)
const PLAYER_SPEED = 210;                 // px/s
const KNIFE = { w: 14, h: 46 };           // tamanho da faca
const TICK_HZ = 30;
const TICK_MS = 1000 / TICK_HZ;
const ATTACK_PHASE_MS = 60000;            // 60s de turno de ataque do mestre
const PLAYER_TURN_MS = 30000;             // tempo para escolher a ação
const IFRAMES_MS = 800;                   // invencibilidade após levar dano
const MERCY_TO_WIN = 100;                 // misericórdia necessária p/ poupar

const SOUL_COLORS = {
  red:    '#ff2b2b',
  blue:   '#2b6bff',
  orange: '#ff9b2b',
  green:  '#39d353',
  purple: '#a64bff',
  cyan:   '#28e0e0',
  yellow: '#ffe14d',
};

// ----- Estado global -------------------------------------------------------
const game = {
  phase: 'lobby',          // lobby | master_attack | player_turn | victory | defeat
  players: {},             // socketId -> player
  master: null,            // { id, name, hp, maxHp }
  knives: [],
  nextKnifeId: 1,
  phaseEndsAt: 0,
  mercy: 0,
  log: [],
  acted: {},               // socketId -> true (já agiu no turno do jogador)
};

function logMsg(text) {
  game.log.push({ t: Date.now(), text });
  if (game.log.length > 40) game.log.shift();
}

function alivePlayers() {
  return Object.values(game.players).filter(p => p.hp > 0);
}

function startMasterAttack() {
  game.phase = 'master_attack';
  game.knives = [];
  game.phaseEndsAt = Date.now() + ATTACK_PHASE_MS;
  game.acted = {};
  // reposiciona as almas no centro
  for (const p of Object.values(game.players)) {
    p.x = BOX.w / 2 - SOUL / 2;
    p.y = BOX.h / 2 - SOUL / 2;
    p.invUntil = 0;
  }
  logMsg('* O mestre se prepara para atacar... DESVIE!');
}

function startPlayerTurn() {
  game.phase = 'player_turn';
  game.knives = [];
  game.phaseEndsAt = Date.now() + PLAYER_TURN_MS;
  game.acted = {};
  logMsg('* É a vez dos jogadores. Escolham sua ação!');
}

function checkEndConditions() {
  if (game.master && game.master.hp <= 0) {
    game.phase = 'victory';
    logMsg('* VOCÊS DERROTARAM O MESTRE!');
    return true;
  }
  if (game.mercy >= MERCY_TO_WIN) {
    game.phase = 'victory';
    logMsg('* O mestre foi poupado. Paz alcançada. (Final de Misericórdia)');
    return true;
  }
  if (Object.keys(game.players).length > 0 && alivePlayers().length === 0) {
    game.phase = 'defeat';
    logMsg('* Todas as almas se quebraram... GAME OVER.');
    return true;
  }
  return false;
}

// ----- Spawn de faca -------------------------------------------------------
// dir: 'up'|'down'|'left'|'right' = direção em que a faca VIAJA
function spawnKnife({ dir, homing, damage, speed }) {
  damage = Math.max(1, Math.min(99, damage | 0));
  speed = Math.max(60, Math.min(700, speed | 0));
  const k = {
    id: game.nextKnifeId++,
    homing: !!homing,
    damage,
    speed,
    dir,
    angle: 0,
  };
  // posição inicial na borda oposta e velocidade
  if (dir === 'right') {
    k.x = -KNIFE.h; k.y = Math.random() * (BOX.h - KNIFE.w);
    k.vx = speed; k.vy = 0; k.angle = Math.PI / 2;
  } else if (dir === 'left') {
    k.x = BOX.w; k.y = Math.random() * (BOX.h - KNIFE.w);
    k.vx = -speed; k.vy = 0; k.angle = -Math.PI / 2;
  } else if (dir === 'down') {
    k.x = Math.random() * (BOX.w - KNIFE.w); k.y = -KNIFE.h;
    k.vx = 0; k.vy = speed; k.angle = Math.PI;
  } else { // up
    k.x = Math.random() * (BOX.w - KNIFE.w); k.y = BOX.h;
    k.vx = 0; k.vy = -speed; k.angle = 0;
  }
  game.knives.push(k);
}

function knifeRect(k) {
  // a faca gira; usamos um AABB aproximado conforme a orientação
  const horizontal = k.dir === 'left' || k.dir === 'right';
  return horizontal
    ? { x: k.x, y: k.y, w: KNIFE.h, h: KNIFE.w }
    : { x: k.x, y: k.y, w: KNIFE.w, h: KNIFE.h };
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ----- Loop principal ------------------------------------------------------
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  if (game.phase === 'master_attack') {
    // movimento das almas (input dos jogadores)
    for (const p of Object.values(game.players)) {
      if (p.hp <= 0) continue;
      let dx = 0, dy = 0;
      if (p.keys.left) dx -= 1;
      if (p.keys.right) dx += 1;
      if (p.keys.up) dy -= 1;
      if (p.keys.down) dy += 1;
      if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
      p.x = Math.max(0, Math.min(BOX.w - SOUL, p.x + dx * PLAYER_SPEED * dt));
      p.y = Math.max(0, Math.min(BOX.h - SOUL, p.y + dy * PLAYER_SPEED * dt));
    }

    // movimento das facas
    for (const k of game.knives) {
      if (k.homing) {
        // mira na alma viva mais próxima
        let target = null, best = Infinity;
        for (const p of alivePlayers()) {
          const ddx = (p.x + SOUL / 2) - (k.x + KNIFE.w / 2);
          const ddy = (p.y + SOUL / 2) - (k.y + KNIFE.h / 2);
          const d = ddx * ddx + ddy * ddy;
          if (d < best) { best = d; target = p; }
        }
        if (target) {
          const ddx = (target.x + SOUL / 2) - (k.x + KNIFE.w / 2);
          const ddy = (target.y + SOUL / 2) - (k.y + KNIFE.h / 2);
          const len = Math.hypot(ddx, ddy) || 1;
          // interpola a velocidade na direção do alvo (curva suave)
          const desiredVx = (ddx / len) * k.speed;
          const desiredVy = (ddy / len) * k.speed;
          const steer = 3.5 * dt;
          k.vx += (desiredVx - k.vx) * steer;
          k.vy += (desiredVy - k.vy) * steer;
          k.angle = Math.atan2(k.vy, k.vx) + Math.PI / 2;
        }
      }
      k.x += k.vx * dt;
      k.y += k.vy * dt;
    }

    // colisões
    for (const k of game.knives) {
      const kr = knifeRect(k);
      for (const p of Object.values(game.players)) {
        if (p.hp <= 0) continue;
        if (now < p.invUntil) continue;
        const sr = { x: p.x, y: p.y, w: SOUL, h: SOUL };
        if (aabb(kr, sr)) {
          p.hp = Math.max(0, p.hp - k.damage);
          p.invUntil = now + IFRAMES_MS;
          logMsg(`* ${p.name} levou ${k.damage} de dano!`);
          if (p.hp <= 0) logMsg(`* A alma de ${p.name} se quebrou!`);
        }
      }
    }

    // remove facas fora da tela
    game.knives = game.knives.filter(k => {
      const m = 80;
      return k.x > -m && k.x < BOX.w + m && k.y > -m && k.y < BOX.h + m;
    });

    if (checkEndConditions()) { /* fim */ }
    else if (now >= game.phaseEndsAt) startPlayerTurn();
  }

  else if (game.phase === 'player_turn') {
    const living = alivePlayers();
    const allActed = living.length > 0 && living.every(p => game.acted[p.id]);
    if (checkEndConditions()) { /* fim */ }
    else if (allActed || now >= game.phaseEndsAt) startMasterAttack();
  }

  broadcast();
}, TICK_MS);

// ----- Broadcast do estado -------------------------------------------------
function broadcast() {
  const state = {
    phase: game.phase,
    box: BOX,
    soulSize: SOUL,
    knifeSize: KNIFE,
    players: Object.values(game.players).map(p => ({
      id: p.id, name: p.name, color: p.color, hex: SOUL_COLORS[p.color],
      x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp,
      inv: Date.now() < p.invUntil, acted: !!game.acted[p.id],
    })),
    master: game.master,
    knives: game.knives.map(k => ({
      id: k.id, x: k.x, y: k.y, angle: k.angle,
      w: KNIFE.w, h: KNIFE.h, homing: k.homing,
    })),
    mercy: game.mercy,
    mercyToWin: MERCY_TO_WIN,
    timeLeft: Math.max(0, game.phaseEndsAt - Date.now()),
    log: game.log.slice(-12),
  };
  io.emit('state', state);
}

// ----- Conexões ------------------------------------------------------------
io.on('connection', (socket) => {

  socket.on('join', ({ role, name, color }) => {
    name = (name || 'Anônimo').toString().slice(0, 16);
    if (role === 'master') {
      if (game.master) { socket.emit('joinError', 'Já existe um mestre na sala.'); return; }
      game.master = { id: socket.id, name, hp: 100, maxHp: 100 };
      socket.data.role = 'master';
      socket.emit('joined', { role: 'master' });
      logMsg(`* ${name} entrou como o MESTRE.`);
    } else {
      if (!SOUL_COLORS[color]) color = 'red';
      game.players[socket.id] = {
        id: socket.id, name, color,
        x: BOX.w / 2 - SOUL / 2, y: BOX.h / 2 - SOUL / 2,
        hp: 20, maxHp: 20, invUntil: 0,
        keys: { up: false, down: false, left: false, right: false },
      };
      socket.data.role = 'player';
      socket.emit('joined', { role: 'player', color });
      logMsg(`* ${name} entrou com a alma ${color.toUpperCase()}.`);
    }
    broadcast();
  });

  socket.on('startBattle', () => {
    if (socket.data.role !== 'master') return;
    if (Object.keys(game.players).length === 0) {
      socket.emit('joinError', 'Espere ao menos um jogador entrar.'); return;
    }
    startMasterAttack();
  });

  // ----- input do jogador (teclas) -----
  socket.on('keys', (keys) => {
    const p = game.players[socket.id];
    if (!p) return;
    p.keys = {
      up: !!keys.up, down: !!keys.down, left: !!keys.left, right: !!keys.right,
    };
  });

  // ----- mestre dispara faca -----
  socket.on('attack', (cfg) => {
    if (socket.data.role !== 'master' || game.phase !== 'master_attack') return;
    spawnKnife({
      dir: ['up', 'down', 'left', 'right'].includes(cfg.dir) ? cfg.dir : 'down',
      homing: cfg.homing,
      damage: cfg.damage,
      speed: cfg.speed,
    });
  });

  // ----- mestre cura os jogadores -----
  socket.on('healPlayers', (amount) => {
    if (socket.data.role !== 'master') return;
    amount = Math.max(1, Math.min(20, (amount | 0) || 5));
    for (const p of Object.values(game.players)) {
      if (p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + amount);
    }
    logMsg(`* O mestre curou as almas em ${amount} HP. Que misericórdia...`);
    game.mercy = Math.min(MERCY_TO_WIN, game.mercy + 5);
  });

  // ----- mestre encerra o turno de ataque antes do tempo -----
  socket.on('endAttackTurn', () => {
    if (socket.data.role !== 'master' || game.phase !== 'master_attack') return;
    startPlayerTurn();
  });

  // ----- ação do jogador no turno dele -----
  socket.on('playerAction', ({ type, text }) => {
    const p = game.players[socket.id];
    if (!p || game.phase !== 'player_turn' || p.hp <= 0 || game.acted[p.id]) return;
    game.acted[p.id] = true;

    if (type === 'fight') {
      const dmg = 4 + Math.floor(Math.random() * 6); // 4-9
      if (game.master) game.master.hp = Math.max(0, game.master.hp - dmg);
      logMsg(`* ${p.name} ATACOU o mestre com a faca! ${dmg} de dano.`);
      game.mercy = Math.max(0, game.mercy - 5);
    } else if (type === 'item') {
      const heal = 8;
      p.hp = Math.min(p.maxHp, p.hp + heal);
      logMsg(`* ${p.name} usou um item e curou ${heal} HP.`);
    } else if (type === 'act') {
      const msg = (text || '').toString().slice(0, 60);
      logMsg(`* ${p.name} conversa: "${msg || '...'}"`);
      game.mercy = Math.min(MERCY_TO_WIN, game.mercy + 8);
    } else if (type === 'mercy') {
      logMsg(`* ${p.name} pede PIEDADE ao mestre.`);
      game.mercy = Math.min(MERCY_TO_WIN, game.mercy + 12);
    }
    broadcast();
  });

  socket.on('reset', () => {
    if (socket.data.role !== 'master') return;
    game.phase = 'lobby';
    game.knives = [];
    game.mercy = 0;
    game.acted = {};
    if (game.master) { game.master.hp = game.master.maxHp; }
    for (const p of Object.values(game.players)) {
      p.hp = p.maxHp; p.invUntil = 0;
      p.x = BOX.w / 2 - SOUL / 2; p.y = BOX.h / 2 - SOUL / 2;
    }
    logMsg('* A batalha foi reiniciada.');
    broadcast();
  });

  socket.on('disconnect', () => {
    if (game.players[socket.id]) {
      logMsg(`* ${game.players[socket.id].name} saiu.`);
      delete game.players[socket.id];
    }
    if (game.master && game.master.id === socket.id) {
      logMsg('* O mestre saiu. Batalha pausada.');
      game.master = null;
      if (game.phase !== 'lobby') game.phase = 'lobby';
    }
    broadcast();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  ❤  Undertale Co-op rodando em  http://localhost:${PORT}\n`);
});
