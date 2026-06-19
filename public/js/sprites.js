// ===========================================================================
//  Sprites desenhados em pixel-art no canvas (estilo Undertale)
// ===========================================================================

// Mapa de pixels do coração 16x16 (1 = preenchido). Formato clássico do Undertale.
const HEART_PIXELS = [
  "0001100000011000",
  "0011110000111100",
  "0111111001111110",
  "0111111111111110",
  "1111111111111111",
  "1111111111111111",
  "1111111111111111",
  "1111111111111111",
  "0111111111111110",
  "0111111111111110",
  "0011111111111100",
  "0001111111111000",
  "0000111111110000",
  "0000011111100000",
  "0000001111000000",
  "0000000110000000",
];

// Desenha a alma (coração) num bloco de 16x16 px na posição x,y.
function drawSoul(ctx, x, y, hex, opts = {}) {
  const px = 1; // cada célula vale 1px (sprite 16px)
  ctx.save();
  if (opts.blink) ctx.globalAlpha = 0.35;
  // brilho
  ctx.shadowColor = hex;
  ctx.shadowBlur = opts.glow ? 12 : 6;
  ctx.fillStyle = hex;
  for (let r = 0; r < 16; r++) {
    const row = HEART_PIXELS[r];
    for (let c = 0; c < 16; c++) {
      if (row[c] === '1') ctx.fillRect(x + c * px, y + r * px, px, px);
    }
  }
  ctx.restore();
}

// Desenha uma faca de pixel apontando "para cima" no seu próprio referencial,
// depois rotacionada por `angle`. Ponto de rotação no centro da faca.
function drawKnife(ctx, cx, cy, angle, homing) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  // a faca tem ~14px largura x 46px altura, centralizada
  const W = 14, H = 46;
  const ox = -W / 2, oy = -H / 2;

  // Lâmina (cinza claro com brilho)
  ctx.fillStyle = '#e8e8f0';
  ctx.beginPath();
  ctx.moveTo(ox + 7, oy + 0);        // ponta
  ctx.lineTo(ox + 11, oy + 10);
  ctx.lineTo(ox + 11, oy + 30);
  ctx.lineTo(ox + 3, oy + 30);
  ctx.lineTo(ox + 3, oy + 10);
  ctx.closePath();
  ctx.fill();

  // gume (linha mais clara)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ox + 7, oy + 2, 2, 28);

  // sombra da lâmina
  ctx.fillStyle = '#a9a9bd';
  ctx.fillRect(ox + 9, oy + 10, 2, 20);

  // Guarda (cabo cruzeta) cinza escuro
  ctx.fillStyle = '#777';
  ctx.fillRect(ox + 0, oy + 30, W, 4);

  // Cabo
  ctx.fillStyle = homing ? '#ff5d5d' : '#5a3a22';
  ctx.fillRect(ox + 4, oy + 34, 6, 12);
  ctx.fillStyle = homing ? '#b73333' : '#3d2716';
  ctx.fillRect(ox + 4, oy + 34, 2, 12);

  // brilho extra se teleguiada
  if (homing) {
    ctx.shadowColor = '#ff3b3b';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(ox + 6, oy + 38, 2, 2);
  }
  ctx.restore();
}

// Desenha um Gaster Blaster (caveira + laser). `b` é o objeto vindo do servidor.
function drawGasterBlaster(ctx, b, boxW, boxH) {
  const firing = b.state === 'firing';
  const thick = b.thick;

  // -------- Laser / aviso --------
  ctx.save();
  if (b.vertical) {
    const x = b.beamX;
    if (firing) {
      ctx.shadowColor = '#7fefff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = 'rgba(150,230,255,0.45)';
      ctx.fillRect(x, 0, thick, boxH);                     // halo do feixe
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(x + thick * 0.3, 0, thick * 0.4, boxH); // núcleo branco
    } else {
      // linha fina de aviso, pulsando, crescendo conforme carrega
      ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(Date.now() / 70));
      ctx.fillStyle = '#7fefff';
      const w = 2 + b.chargeProg * 4;
      ctx.fillRect(x + thick / 2 - w / 2, 0, w, boxH);
    }
  } else {
    const y = b.beamY;
    if (firing) {
      ctx.shadowColor = '#7fefff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = 'rgba(150,230,255,0.45)';
      ctx.fillRect(0, y, boxW, thick);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fillRect(0, y + thick * 0.3, boxW, thick * 0.4);
    } else {
      ctx.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(Date.now() / 70));
      ctx.fillStyle = '#7fefff';
      const h = 2 + b.chargeProg * 4;
      ctx.fillRect(0, y + thick / 2 - h / 2, boxW, h);
    }
  }
  ctx.restore();

  // -------- Cabeça (caveira) na borda, virada para o feixe --------
  let hx, hy, rot;
  if (b.vertical) {
    hx = b.beamX + thick / 2;
    if (b.dir === 'down') { hy = 22; rot = 0; }
    else                  { hy = boxH - 22; rot = Math.PI; }
  } else {
    hy = b.beamY + thick / 2;
    if (b.dir === 'right') { hx = 22; rot = -Math.PI / 2; }
    else                   { hx = boxW - 22; rot = Math.PI / 2; }
  }
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(rot);
  drawSkull(ctx, firing, b.chargeProg);
  ctx.restore();
}

// Caveira desenhada "olhando para baixo" (focinho na parte de baixo).
function drawSkull(ctx, firing, chargeProg) {
  ctx.fillStyle = '#f2f2f7';
  ctx.strokeStyle = '#b9b9cf';
  ctx.lineWidth = 1;
  // crânio
  ctx.beginPath();
  ctx.moveTo(-17, -20);
  ctx.lineTo(17, -20);
  ctx.lineTo(21, -2);
  ctx.lineTo(11, 6);
  ctx.lineTo(7, 20);
  ctx.lineTo(-7, 20);
  ctx.lineTo(-11, 6);
  ctx.lineTo(-21, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // órbitas dos olhos (brilham ao carregar/disparar)
  const glow = firing ? 1 : chargeProg;
  ctx.save();
  ctx.shadowColor = '#7fefff';
  ctx.shadowBlur = 4 + 14 * glow;
  ctx.fillStyle = firing ? '#bfffff' : `rgba(127,239,255,${0.3 + 0.7 * glow})`;
  ctx.fillRect(-13, -14, 9, 9);
  ctx.fillRect(4, -14, 9, 9);
  ctx.restore();

  // "dentes"/focinho
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(-6, 8, 12, 8);
  ctx.fillStyle = '#f2f2f7';
  ctx.fillRect(-2, 8, 2, 8);
  ctx.fillRect(-6, 11, 12, 2);
}

// "Rosto" simples do mestre desenhado no topo da caixa durante o turno do jogador.
function drawMaster(ctx, cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  // cabeça
  ctx.fillStyle = '#1a1a1a';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.fillRect(-34, -34, 68, 68);
  ctx.strokeRect(-34, -34, 68, 68);
  // olhos (vazios, brilhando)
  ctx.fillStyle = '#ff3b3b';
  ctx.shadowColor = '#ff3b3b';
  ctx.shadowBlur = 12;
  ctx.fillRect(-20, -12, 12, 14);
  ctx.fillRect(8, -12, 12, 14);
  // sorriso
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.fillRect(-18, 14, 36, 3);
  ctx.fillRect(-18, 10, 3, 6);
  ctx.fillRect(15, 10, 3, 6);
  ctx.restore();
}
