export const PAPERS = {
  A5: [148, 210], A4: [210, 297], A3: [297, 420], A2: [420, 594],
  Carta: [216, 279], Legal: [216, 356],
};

export function layout(config) {
  const cols = Math.max(1, Math.min(6, Math.round(Number(config.cols) || 1)));
  const rows = Math.max(1, Math.min(6, Math.round(Number(config.rows) || 1)));
  const [short, long] = config.paper === 'Personalizado'
    ? [Number(config.customW), Number(config.customH)] : PAPERS[config.paper] || PAPERS.A4;
  const [W, H] = config.orientation === 'landscape' ? [Math.max(short, long), Math.min(short, long)] : [Math.min(short, long), Math.max(short, long)];
  if (!(W >= 50 && H >= 50 && W <= 1200 && H <= 1200)) throw new Error('Informe um papel entre 50 e 1200 mm.');
  const mode = config.mode;
  const overlap = Number(config.overlap) || 0;
  const margins = Object.fromEntries(['left', 'right', 'top', 'bottom'].map(k => [k, Math.max(0, Number(config[k]) || 0)]));
  if (overlap < 0 || overlap >= Math.min(W, H) / 2) throw new Error('A aba precisa ser menor que metade da folha.');
  if (margins.left + margins.right >= W || margins.top + margins.bottom >= H) throw new Error('As margens excedem o papel.');
  if (!['zero', 'flap', 'fold'].includes(mode)) throw new Error('Modo de montagem inválido.');
  const colWidths = Array.from({ length: cols }, (_, col) => mode === 'fold' ? W - margins.left - margins.right : mode === 'flap' && col > 0 ? W - overlap : W);
  const rowHeights = Array.from({ length: rows }, (_, row) => mode === 'fold' ? H - margins.top - margins.bottom : mode === 'flap' && row > 0 ? H - overlap : H);
  const colX = colWidths.map((_, col) => colWidths.slice(0, col).reduce((a, b) => a + b, 0));
  const rowY = rowHeights.map((_, row) => rowHeights.slice(0, row).reduce((a, b) => a + b, 0));
  const posterW = colWidths.reduce((a, b) => a + b, 0);
  const posterH = rowHeights.reduce((a, b) => a + b, 0);
  const pages = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const art = {
      x: mode === 'fold' ? margins.left : mode === 'flap' && col > 0 ? overlap : 0,
      y: mode === 'fold' ? margins.top : mode === 'flap' && row > 0 ? overlap : 0,
      w: colWidths[col], h: rowHeights[row],
    };
    pages.push({ row, col, number: pages.length + 1, art, source: { x: colX[col], y: rowY[row], w: art.w, h: art.h } });
  }
  return { W, H, cols, rows, posterW, posterH, pages, margins, overlap, mode };
}

export function imageCrop(imgW, imgH, posterW, posterH) {
  const srcRatio = imgW / imgH;
  const dstRatio = posterW / posterH;
  if (srcRatio > dstRatio) return { x: (imgW - imgH * dstRatio) / 2, y: 0, w: imgH * dstRatio, h: imgH };
  return { x: 0, y: (imgH - imgW / dstRatio) / 2, w: imgW, h: imgW / dstRatio };
}
