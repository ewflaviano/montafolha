const PATH = '/api/diagnostics/errors';
const ORIGINS = new Set(['https://montafolha.com.br', 'https://www.montafolha.com.br']);
const ALLOWED = {
  runtime: new Set(['runtime_exception', 'unhandled_rejection']),
  storage: new Set(['storage_unavailable']),
  image: new Set(['image_decode_failed', 'example_load_failed']),
  pdf: new Set(['pdf_generation_failed']),
};
const respond = statusCode => ({ statusCode, headers: { 'cache-control': 'no-store', 'content-length': '0', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' }, body: '' });

export async function handler(event) {
  const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
  if (event.rawPath !== PATH) return respond(404);
  if (event.requestContext?.http?.method !== 'POST') return respond(405);
  if (!ORIGINS.has(headers.origin) || headers.cookie || headers.authorization || event.rawQueryString) return respond(403);
  if (headers['content-type'] !== 'application/json' || event.isBase64Encoded) return respond(415);
  if (typeof event.body !== 'string' || Buffer.byteLength(event.body, 'utf8') > 512) return respond(413);
  let value;
  try { value = JSON.parse(event.body); } catch { return respond(400); }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'area,code,count' ||
      typeof value.area !== 'string' || typeof value.code !== 'string' ||
      !ALLOWED[value.area]?.has(value.code) ||
      !Number.isInteger(value.count) || value.count < 1 || value.count > 10) return respond(400);
  const timestamp = Date.now();
  console.log(JSON.stringify({
    _aws: { Timestamp: timestamp, CloudWatchMetrics: [{ Namespace: 'MontaFolha/Diagnostics', Dimensions: [[]], Metrics: [{ Name: 'ClientErrorReport', Unit: 'Count' }] }] },
    ClientErrorReport: value.count, kind: 'client_error', area: value.area, code: value.code,
  }));
  return respond(204);
}
