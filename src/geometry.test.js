import test from 'node:test';
import assert from 'node:assert/strict';
import { layout } from './geometry.js';
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
