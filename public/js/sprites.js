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
