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

export function imageCrop(imgW, imgH, posterW, posterH, position = 0.5) {
  const srcRatio = imgW / imgH;
  const dstRatio = posterW / posterH;
  const requested = Number(position);
  const offset = Number.isFinite(requested) ? Math.max(0, Math.min(1, requested)) : 0.5;
  if (srcRatio > dstRatio) {
    const w = imgH * dstRatio;
    return { x: (imgW - w) * offset, y: 0, w, h: imgH };
  }
  const h = imgW / dstRatio;
  return { x: 0, y: (imgH - h) * offset, w: imgW, h };
}

export function imagePlacement(imgW, imgH, posterW, posterH, fit = 'contain', position = 0.5) {
  if (fit === 'cover') {
    return {
      fit,
      source: imageCrop(imgW, imgH, posterW, posterH, position),
      poster: { x: 0, y: 0, w: posterW, h: posterH },
    };
  }
  if (fit !== 'contain') throw new Error('Ajuste da imagem inválido.');
  const scale = Math.min(posterW / imgW, posterH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return {
    fit,
    source: { x: 0, y: 0, w: imgW, h: imgH },
    poster: { x: (posterW - w) / 2, y: (posterH - h) / 2, w, h },
  };
}

export function orientedImageSize(imgW, imgH, turns) {
  return turns % 2 === 0 ? { w: imgW, h: imgH } : { w: imgH, h: imgW };
}

// Converte uma região da imagem girada em coordenadas da imagem original.
export function originalImageRegion(region, imgW, imgH, turns) {
  const { x, y, w, h } = region;
  switch (turns) {
    case 0: return { x, y, w, h };
    case 1: return { x: y, y: imgH - x - w, w: h, h: w };
    case 2: return { x: imgW - x - w, y: imgH - y - h, w, h };
    case 3: return { x: imgW - y - h, y: x, w: h, h: w };
    default: throw new Error('Rotação inválida.');
  }
}

export function pageImageRegion(placement, page) {
  const { poster, source } = placement;
  const left = Math.max(poster.x, page.source.x);
  const top = Math.max(poster.y, page.source.y);
  const right = Math.min(poster.x + poster.w, page.source.x + page.source.w);
  const bottom = Math.min(poster.y + poster.h, page.source.y + page.source.h);
  if (right <= left || bottom <= top) return null;
  return {
    source: {
      x: source.x + (left - poster.x) * source.w / poster.w,
      y: source.y + (top - poster.y) * source.h / poster.h,
      w: (right - left) * source.w / poster.w,
      h: (bottom - top) * source.h / poster.h,
    },
    paper: {
      x: page.art.x + left - page.source.x,
      y: page.art.y + top - page.source.y,
      w: right - left,
      h: bottom - top,
    },
  };
}

// Janelas nas bordas úteis da arte; margens de dobra e aba ficam fora da comparação.
export function seamPairs(l, direction) {
  if (!['vertical', 'horizontal'].includes(direction)) throw new Error('Direção de junção inválida.');
  const pairs = [];
  for (const first of l.pages) {
    if (direction === 'vertical' && first.col === l.cols - 1) continue;
    if (direction === 'horizontal' && first.row === l.rows - 1) continue;
    const second = l.pages[first.number - 1 + (direction === 'vertical' ? 1 : l.cols)];
    let firstWindow, secondWindow;
    if (direction === 'vertical') {
      const band = Math.min(40, first.art.w / 3, second.art.w / 3);
      const span = Math.min(150, first.art.h, second.art.h);
      firstWindow = { x: first.art.x + first.art.w - band, y: first.art.y + (first.art.h - span) / 2, w: band, h: span };
      secondWindow = { x: second.art.x, y: second.art.y + (second.art.h - span) / 2, w: band, h: span };
    } else {
      const band = Math.min(40, first.art.h / 3, second.art.h / 3);
      const span = Math.min(150, first.art.w, second.art.w);
      firstWindow = { x: first.art.x + (first.art.w - span) / 2, y: first.art.y + first.art.h - band, w: span, h: band };
      secondWindow = { x: second.art.x + (second.art.w - span) / 2, y: second.art.y, w: span, h: band };
    }
    pairs.push({ first, second, firstWindow, secondWindow });
  }
  return pairs;
}
