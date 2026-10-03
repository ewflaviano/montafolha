import test from 'node:test';
import assert from 'node:assert/strict';
import { layout, imageCrop } from './geometry.js';
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
