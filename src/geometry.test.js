import test from 'node:test';
import assert from 'node:assert/strict';
import { layout, imageCrop, imagePlacement, pageImageRegion, seamPairs } from './geometry.js';
const base = { paper: 'A4', orientation: 'landscape', cols: 2, rows: 2, mode: 'zero', overlap: 10, left: 5, right: 5, top: 5, bottom: 5 };
for (const [mode, expectedW, expectedH] of [['zero', 594, 420], ['flap', 584, 410], ['fold', 574, 400]]) {
  test(`${mode}: as folhas cobrem o pôster sem lacunas`, () => {
    const l = layout({ ...base, mode });
    assert.equal(l.posterW, expectedW); assert.equal(l.posterH, expectedH);
    assert.equal(l.pages.length, 4);
    for (const page of l.pages) {
      assert.equal(page.art.w, page.source.w); assert.equal(page.art.h, page.source.h);
      assert.ok(page.art.x >= 0 && page.art.y >= 0);
      assert.ok(page.art.x + page.art.w <= l.W);
      assert.ok(page.art.y + page.art.h <= l.H);
    }
    assert.equal(l.pages[1].source.x, l.pages[0].source.w);
    assert.equal(l.pages[2].source.y, l.pages[0].source.h);
  });
}

test('uma folha usa todo o recorte em cada modo', () => {
  for (const mode of ['zero', 'flap', 'fold']) {
    const l = layout({ ...base, cols: 1, rows: 1, mode });
    assert.equal(l.pages.length, 1);
    assert.deepEqual(l.pages[0].source, { x: 0, y: 0, w: l.posterW, h: l.posterH });
  }
});

test('imagem larga: desloca só o eixo horizontal e preserva o recorte central padrão', () => {
  assert.deepEqual(imageCrop(1600, 900, 800, 900, 0), { x: 0, y: 0, w: 800, h: 900 });
  assert.deepEqual(imageCrop(1600, 900, 800, 900), { x: 400, y: 0, w: 800, h: 900 });
  assert.deepEqual(imageCrop(1600, 900, 800, 900, 1), { x: 800, y: 0, w: 800, h: 900 });
});

test('imagem alta: desloca só o eixo vertical', () => {
  assert.deepEqual(imageCrop(900, 1600, 900, 800, 0), { x: 0, y: 0, w: 900, h: 800 });
  assert.deepEqual(imageCrop(900, 1600, 900, 800, 0.5), { x: 0, y: 400, w: 900, h: 800 });
  assert.deepEqual(imageCrop(900, 1600, 900, 800, 1), { x: 0, y: 800, w: 900, h: 800 });
});

test('proporções iguais mantêm a imagem inteira e posições inválidas ficam no limite', () => {
  assert.deepEqual(imageCrop(1600, 900, 800, 450, 1), { x: 0, y: 0, w: 1600, h: 900 });
  assert.deepEqual(imageCrop(1600, 900, 800, 900, -10), { x: 0, y: 0, w: 800, h: 900 });
  assert.deepEqual(imageCrop(1600, 900, 800, 900, 10), { x: 800, y: 0, w: 800, h: 900 });
  assert.deepEqual(imageCrop(1600, 900, 800, 900, NaN), imageCrop(1600, 900, 800, 900));
});

test('imagem quadrada cabe inteira no pôster com branco nas laterais', () => {
  const placement = imagePlacement(1000, 1000, 600, 400);
  assert.deepEqual(placement, {
    fit: 'contain',
    source: { x: 0, y: 0, w: 1000, h: 1000 },
    poster: { x: 100, y: 0, w: 400, h: 400 },
  });
  const l = layout({ ...base, paper: 'Personalizado', customW: 200, customH: 300, mode: 'zero' });
  assert.deepEqual(pageImageRegion(placement, l.pages[0]), {
    source: { x: 0, y: 0, w: 500, h: 500 },
    paper: { x: 100, y: 0, w: 200, h: 200 },
  });
  assert.deepEqual(pageImageRegion(placement, l.pages[1]), {
    source: { x: 500, y: 0, w: 500, h: 500 },
    paper: { x: 0, y: 0, w: 200, h: 200 },
  });
});

test('folhas fora da imagem permanecem inteiramente brancas', () => {
  const l = layout({ ...base, paper: 'Personalizado', customW: 200, customH: 300, cols: 3, rows: 1, mode: 'zero' });
  const placement = imagePlacement(1000, 1000, l.posterW, l.posterH);
  assert.equal(pageImageRegion(placement, l.pages[0]), null);
  assert.deepEqual(pageImageRegion(placement, l.pages[1]).paper, { x: 50, y: 0, w: 200, h: 200 });
  assert.equal(pageImageRegion(placement, l.pages[2]), null);
});

test('área impressa respeita margens de dobra e aba', () => {
  for (const mode of ['fold', 'flap']) {
    const l = layout({ ...base, paper: 'Personalizado', customW: 200, customH: 300, mode });
    const placement = imagePlacement(1000, 1000, l.posterW, l.posterH);
    for (const page of l.pages) {
      const region = pageImageRegion(placement, page);
      assert.ok(region.paper.x >= page.art.x);
      assert.ok(region.paper.y >= page.art.y);
      assert.ok(region.paper.x + region.paper.w <= page.art.x + page.art.w);
      assert.ok(region.paper.y + region.paper.h <= page.art.y + page.art.h);
    }
  }
});

test('preencher mantém o recorte deslocável e ocupa todo o pôster', () => {
  const placement = imagePlacement(1600, 900, 800, 900, 'cover', 1);
  assert.deepEqual(placement.source, { x: 800, y: 0, w: 800, h: 900 });
  assert.deepEqual(placement.poster, { x: 0, y: 0, w: 800, h: 900 });
  assert.deepEqual(pageImageRegion(placement, { source: { x: 0, y: 0, w: 400, h: 450 }, art: { x: 5, y: 5 } }), {
    source: { x: 800, y: 0, w: 400, h: 450 },
    paper: { x: 5, y: 5, w: 400, h: 450 },
  });
  assert.throws(() => imagePlacement(1000, 1000, 600, 400, 'invalid'), /inválido/);
});

test('junções seguem pares adjacentes nas duas direções', () => {
  const l = layout(base);
  assert.deepEqual(seamPairs(l, 'vertical').map(({ first, second }) => [first.number, second.number]), [[1, 2], [3, 4]]);
  assert.deepEqual(seamPairs(l, 'horizontal').map(({ first, second }) => [first.number, second.number]), [[1, 3], [2, 4]]);
  assert.equal(seamPairs(layout({ ...base, cols: 1, rows: 1 }), 'vertical').length, 0);
  assert.equal(seamPairs(layout({ ...base, cols: 1, rows: 3 }), 'vertical').length, 0);
  assert.equal(seamPairs(layout({ ...base, cols: 3, rows: 1 }), 'horizontal').length, 0);
  assert.equal(seamPairs(layout({ ...base, cols: 6, rows: 6 }), 'vertical').length, 30);
  assert.equal(seamPairs(layout({ ...base, cols: 6, rows: 6 }), 'horizontal').length, 30);
  assert.throws(() => seamPairs(l, 'diagonal'), /inválida/);
});

test('janelas da junção usam bordas da arte, excluindo margens e aba', () => {
  for (const mode of ['zero', 'flap', 'fold']) {
    const l = layout({ ...base, mode });
    for (const direction of ['vertical', 'horizontal']) {
      const { first, second, firstWindow, secondWindow } = seamPairs(l, direction)[0];
      if (direction === 'vertical') {
        assert.equal(firstWindow.x + firstWindow.w, first.art.x + first.art.w);
        assert.equal(secondWindow.x, second.art.x);
        assert.equal(first.source.x + first.source.w, second.source.x);
        assert.equal(firstWindow.h, secondWindow.h);
      } else {
        assert.equal(firstWindow.y + firstWindow.h, first.art.y + first.art.h);
        assert.equal(secondWindow.y, second.art.y);
        assert.equal(first.source.y + first.source.h, second.source.y);
        assert.equal(firstWindow.w, secondWindow.w);
      }
      for (const [page, window] of [[first, firstWindow], [second, secondWindow]]) {
        assert.ok(window.x >= page.art.x && window.y >= page.art.y);
        assert.ok(window.x + window.w <= page.art.x + page.art.w);
        assert.ok(window.y + window.h <= page.art.y + page.art.h);
      }
    }
  }
  const flap = layout({ ...base, mode: 'flap' });
  assert.equal(seamPairs(flap, 'vertical')[0].secondWindow.x, 10);
  assert.equal(seamPairs(flap, 'horizontal')[0].secondWindow.y, 10);
  const fold = layout({ ...base, mode: 'fold' });
  assert.equal(seamPairs(fold, 'vertical')[0].secondWindow.x, 5);
  assert.equal(seamPairs(fold, 'horizontal')[0].secondWindow.y, 5);
});
