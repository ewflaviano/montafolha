import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from './index.mjs';

const request = (body, origin = 'https://montafolha.com.br') => ({ rawPath: '/api/diagnostics/errors', rawQueryString: '', requestContext: { http: { method: 'POST' } }, headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body), isBase64Encoded: false });

test('accepts only fixed diagnostic codes and emits no user supplied text', async () => {
  const lines = [];
  const original = console.log;
  console.log = line => lines.push(JSON.parse(line));
  try {
    assert.equal((await handler(request({ area: 'pdf', code: 'pdf_generation_failed', count: 1 }))).statusCode, 204);
    assert.equal(lines.length, 1);
    assert.deepEqual(Object.keys(lines[0]).sort(), ['ClientErrorReport', '_aws', 'area', 'code', 'kind']);
    for (const body of [
      { area: 'pdf', code: 'pdf_generation_failed', count: 0 },
      { area: 'pdf', code: 'pdf_generation_failed', count: 11 },
      { area: 'pdf', code: 'runtime_exception', count: 1 },
      { area: 'pdf', code: 'pdf_generation_failed', count: 1, message: 'private' },
    ]) assert.equal((await handler(request(body))).statusCode, 400);
    assert.equal((await handler(request({ area: 'pdf', code: 'pdf_generation_failed', count: 1 }, 'https://evil.example'))).statusCode, 403);
    assert.equal(lines.length, 1);
  } finally { console.log = original; }
});
