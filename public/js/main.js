// ===========================================================================
//  Cliente principal: conexão, render, input
// ===========================================================================
const socket = io();

let myRole = null;     // 'player' | 'master'
let myColor = 'red';
let myId = null;
let selectedRole = 'player';
let selectedColor = 'red';
let masterDir = 'down';
let latest = null;     // último estado recebido do servidor

// --------- Elementos ---------
const $ = (id) => document.getElementById(id);
const lobby = $('lobby'), gameEl = $('game');
const canvas = $('canvas'), ctx = canvas.getContext('2d');

// =========================================================================
//  LOBBY
// =========================================================================
document.querySelectorAll('.roleBtn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.roleBtn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    selectedRole = b.dataset.role;
    $('colorPick').style.display = selectedRole === 'player' ? 'block' : 'none';
  };
});

document.querySelectorAll('.colorBtn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.colorBtn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    selectedColor = b.dataset.color;
  };
});

$('joinBtn').onclick = () => {
  const name = $('nameInput').value.trim() || 'Anônimo';
  socket.emit('join', { role: selectedRole, name, color: selectedColor });
};

socket.on('joinError', (msg) => { $('errMsg').textContent = msg; });

socket.on('joined', ({ role, color }) => {
  myRole = role;
  myColor = color || 'red';
  lobby.classList.add('hidden');
  gameEl.classList.remove('hidden');
  if (role === 'master') {
    $('masterPanel').classList.remove('hidden');
  }
});

// =========================================================================
//  CONTROLES DO MESTRE
// =========================================================================
document.querySelectorAll('.dirBtn').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('.dirBtn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    masterDir = b.dataset.dir;
  };
});

$('dmg').oninput = (e) => $('dmgVal').textContent = e.target.value;
$('spd').oninput = (e) => $('spdVal').textContent = e.target.value;
$('blasterPos').oninput = (e) => $('blasterPosVal').textContent = e.target.value + '%';

$('startBtn').onclick = () => socket.emit('startBattle');
$('fireBtn').onclick = () => socket.emit('attack', {
  dir: masterDir,
  homing: $('homing').checked,
  damage: parseInt($('dmg').value, 10),
  speed: parseInt($('spd').value, 10),
});
$('blasterBtn').onclick = () => socket.emit('blaster', {
  dir: masterDir,
  pos: parseInt($('blasterPos').value, 10) / 100,
  damage: parseInt($('dmg').value, 10),
});
$('healBtn').onclick = () => socket.emit('healPlayers', 5);
$('endTurnBtn').onclick = () => socket.emit('endAttackTurn');
$('resetBtn').onclick = () => socket.emit('reset');

// =========================================================================
//  AÇÕES DO JOGADOR (turno)
// =========================================================================
document.querySelectorAll('.actBtn').forEach(b => {
  b.onclick = () => {
    const type = b.dataset.act;
    let text = '';
    if (type === 'act') text = prompt('O que você quer dizer ao mestre?') || '';
    socket.emit('playerAction', { type, text });
  };
});

// =========================================================================
//  INPUT DE MOVIMENTO (setas) — só vale no turno de ataque do mestre
// =========================================================================
const keys = { up: false, down: false, left: false, right: false };
function setKey(e, down) {
  let changed = true;
  switch (e.key) {
    case 'ArrowUp': case 'w': case 'W': keys.up = down; break;
    case 'ArrowDown': case 's': case 'S': keys.down = down; break;
    case 'ArrowLeft': case 'a': case 'A': keys.left = down; break;
    case 'ArrowRight': case 'd': case 'D': keys.right = down; break;
    default: changed = false;
  }
  if (changed) {
    e.preventDefault();
    socket.emit('keys', keys);
  }
}
window.addEventListener('keydown', (e) => { if (myRole === 'player') setKey(e, true); });
window.addEventListener('keyup',   (e) => { if (myRole === 'player') setKey(e, false); });

// =========================================================================
//  RECEBE ESTADO
// =========================================================================
socket.on('connect', () => { myId = socket.id; });
socket.on('state', (s) => { latest = s; updateHUD(s); });

const PHASE_TEXT = {
  lobby: 'AGUARDANDO O MESTRE INICIAR...',
  master_attack: '⚔ TURNO DE ATAQUE — DESVIE!',
  player_turn: '✨ TURNO DOS JOGADORES',
  victory: '🏆 VITÓRIA!',
  defeat: '💀 GAME OVER',
};

function updateHUD(s) {
  $('phaseLabel').textContent = PHASE_TEXT[s.phase] || s.phase;

  // timer
  if (s.phase === 'master_attack' || s.phase === 'player_turn') {
    $('timer').textContent = '⏱ ' + Math.ceil(s.timeLeft / 1000) + 's';
  } else {
    $('timer').textContent = '';
  }

  // mestre
  if (s.master) {
    $('masterName').textContent = s.master.name;
    $('masterHp').style.width = (100 * s.master.hp / s.master.maxHp) + '%';
    $('masterHpTxt').textContent = s.master.hp + '/' + s.master.maxHp;
  } else {
    $('masterName').textContent = 'SEM MESTRE';
    $('masterHpTxt').textContent = '';
  }

  // misericórdia
  $('mercyFill').style.width = (100 * s.mercy / s.mercyToWin) + '%';

  // lista de jogadores
  const list = $('playerList');
  list.innerHTML = '';
  for (const p of s.players) {
    const row = document.createElement('div');
    row.className = 'pRow' + (p.hp <= 0 ? ' dead' : '') + (p.acted ? ' acted' : '');
    row.innerHTML = `
      <canvas class="pHeart" width="16" height="16"></canvas>
      <span class="pName">${escapeHtml(p.name)}</span>
      <div class="pHpTrack"><div class="pHpFill" style="width:${100 * p.hp / p.maxHp}%"></div></div>
      <span class="pHp">${p.hp}/${p.maxHp}</span>`;
    list.appendChild(row);
    const hc = row.querySelector('.pHeart').getContext('2d');
    drawSoul(hc, 0, 0, p.hex, { glow: false });
  }

  // log
  $('log').innerHTML = s.log.map(l => `<div>${escapeHtml(l.text)}</div>`).join('');

  // menu de ação do jogador
  const me = s.players.find(p => p.id === myId);
  if (myRole === 'player') {
    const myTurn = s.phase === 'player_turn' && me && me.hp > 0 && !me.acted;
    $('playerActions').classList.toggle('hidden', !myTurn);
    $('actHint').classList.toggle('hidden', s.phase !== 'master_attack');
  }

  // botões do mestre: habilita conforme a fase
  if (myRole === 'master') {
    const inAttack = s.phase === 'master_attack';
    ['fireBtn', 'blasterBtn', 'endTurnBtn'].forEach(id => $(id).disabled = !inAttack);
    $('startBtn').style.display =
      (s.phase === 'lobby' || s.phase === 'victory' || s.phase === 'defeat') ? 'block' : 'none';
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// =========================================================================
//  RENDER LOOP (canvas da batalha)
// =========================================================================
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = latest;
  if (!s) { requestAnimationFrame(render); return; }

  if (s.phase === 'lobby') {
    drawCenterText('Esperando o mestre iniciar a batalha...', '#9b9b9b');
  } else if (s.phase === 'victory') {
    drawCenterText('VOCÊS VENCERAM!  ❤', '#ffe14d', 18);
  } else if (s.phase === 'defeat') {
    drawCenterText('GAME OVER', '#ff3b3b', 22);
  } else {
    // durante o turno dos jogadores mostra o "rosto" do mestre
    if (s.phase === 'player_turn') {
      drawMaster(ctx, canvas.width / 2, 70);
    }
    // gaster blasters (desenhados atrás das facas/almas)
    if (s.blasters) {
      for (const b of s.blasters) drawGasterBlaster(ctx, b, canvas.width, canvas.height);
    }
    // facas
    for (const k of s.knives) {
      drawKnife(ctx, k.x + k.w / 2, k.y + k.h / 2, k.angle, k.homing);
    }
    // almas
    for (const p of s.players) {
      if (p.hp <= 0) continue;
      drawSoul(ctx, p.x, p.y, p.hex, { glow: p.id === myId, blink: p.inv });
    }
  }
  requestAnimationFrame(render);
}

function drawCenterText(text, color, size = 11) {
  ctx.fillStyle = color;
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // quebra simples
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + w).length > 26) { lines.push(line); line = ''; }
    line += w + ' ';
  }
  lines.push(line);
  const lh = size + 10;
  lines.forEach((ln, i) =>
    ctx.fillText(ln.trim(), canvas.width / 2, canvas.height / 2 - (lines.length - 1) * lh / 2 + i * lh));
}

requestAnimationFrame(render);
