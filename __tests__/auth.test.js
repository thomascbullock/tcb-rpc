const argon2 = require('argon2');

const {
  verifyPassword,
  verifyBasicAuthHeader,
  requireAuth,
  requireCsrf,
  newCsrfToken,
} = require('../lib/auth');

// argon2 hash of 'correct-horse-staple' generated once here to keep the tests
// deterministic. In practice the hash lives in .env as BLOG_PW_HASH.
let TEST_HASH;
const TEST_USER = 'testuser';
const TEST_PW = 'correct-horse-staple';

beforeAll(async () => {
  TEST_HASH = await argon2.hash(TEST_PW, { type: argon2.argon2id });
  process.env.BLOG_USER = TEST_USER;
  process.env.BLOG_PW_HASH = TEST_HASH;
});

// Helper: build a fake req/res pair.
function makeReq(overrides = {}) {
  return {
    session: overrides.session,
    method: overrides.method || 'GET',
    originalUrl: overrides.originalUrl || '/',
    body: overrides.body || {},
    _headers: overrides.headers || {},
    get(name) { return this._headers[name.toLowerCase()]; },
    authMethod: undefined,
  };
}
function makeRes() {
  const res = {};
  res.statusCode = 200;
  res.jsonBody = null;
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.jsonBody = b; return res; };
  res.set = () => res;
  res.redirect = (url) => { res.redirectedTo = url; return res; };
  return res;
}

describe('verifyPassword', () => {
  test('accepts correct password', async () => {
    expect(await verifyPassword(TEST_PW)).toBe(true);
  });
  test('rejects wrong password', async () => {
    expect(await verifyPassword('wrong')).toBe(false);
  });
  test('rejects empty', async () => {
    expect(await verifyPassword('')).toBe(false);
    expect(await verifyPassword(null)).toBe(false);
    expect(await verifyPassword(undefined)).toBe(false);
  });
});

describe('verifyBasicAuthHeader', () => {
  function b64(s) { return Buffer.from(s).toString('base64'); }

  test('accepts correct user:pass', async () => {
    const ok = await verifyBasicAuthHeader(`Basic ${b64(`${TEST_USER}:${TEST_PW}`)}`);
    expect(ok).toBe(true);
  });
  test('rejects wrong password', async () => {
    const ok = await verifyBasicAuthHeader(`Basic ${b64(`${TEST_USER}:nope`)}`);
    expect(ok).toBe(false);
  });
  test('rejects wrong username', async () => {
    const ok = await verifyBasicAuthHeader(`Basic ${b64(`elsewhere:${TEST_PW}`)}`);
    expect(ok).toBe(false);
  });
  test('rejects malformed header', async () => {
    expect(await verifyBasicAuthHeader('Basic ')).toBe(false);
    expect(await verifyBasicAuthHeader('Bearer xyz')).toBe(false);
    expect(await verifyBasicAuthHeader('')).toBe(false);
    expect(await verifyBasicAuthHeader(null)).toBe(false);
  });
});

describe('requireAuth', () => {
  test('passes through when session.authenticated is true', async () => {
    const req = makeReq({ session: { authenticated: true } });
    const res = makeRes();
    let called = false;
    await requireAuth(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(req.authMethod).toBe('session');
  });

  test('passes through with valid Basic Auth header', async () => {
    const auth = `Basic ${Buffer.from(`${TEST_USER}:${TEST_PW}`).toString('base64')}`;
    const req = makeReq({ headers: { authorization: auth } });
    const res = makeRes();
    let called = false;
    await requireAuth(req, res, () => { called = true; });
    expect(called).toBe(true);
    expect(req.authMethod).toBe('basic');
  });

  test('returns 401 JSON for API-shaped request without auth', async () => {
    const req = makeReq({ headers: { accept: 'application/json' } });
    const res = makeRes();
    await requireAuth(req, res, () => { throw new Error('should not call next'); });
    expect(res.statusCode).toBe(401);
    expect(res.jsonBody.success).toBe(false);
  });

  test('redirects browser GET to /login', async () => {
    const req = makeReq({ method: 'GET', originalUrl: '/post', headers: { accept: 'text/html' } });
    const res = makeRes();
    await requireAuth(req, res, () => { throw new Error('should not call next'); });
    expect(res.redirectedTo).toBe('/login?next=%2Fpost');
  });
});

describe('requireCsrf', () => {
  test('passes through for Basic-Auth requests without CSRF token', () => {
    const req = makeReq();
    req.authMethod = 'basic';
    const res = makeRes();
    let called = false;
    requireCsrf(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  test('rejects session request with no supplied token', () => {
    const req = makeReq({ session: { authenticated: true, csrf: 'abc' } });
    req.authMethod = 'session';
    const res = makeRes();
    requireCsrf(req, res, () => { throw new Error('should not call next'); });
    expect(res.statusCode).toBe(403);
  });

  test('rejects session request with mismatched token', () => {
    const req = makeReq({
      session: { authenticated: true, csrf: 'abcdef' },
      headers: { 'x-csrf-token': 'wrongxx' },
    });
    req.authMethod = 'session';
    const res = makeRes();
    requireCsrf(req, res, () => { throw new Error('should not call next'); });
    expect(res.statusCode).toBe(403);
  });

  test('accepts session request with matching header token', () => {
    const token = newCsrfToken();
    const req = makeReq({
      session: { authenticated: true, csrf: token },
      headers: { 'x-csrf-token': token },
    });
    req.authMethod = 'session';
    const res = makeRes();
    let called = false;
    requireCsrf(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  test('accepts session request with matching body token', () => {
    const token = newCsrfToken();
    const req = makeReq({
      session: { authenticated: true, csrf: token },
      body: { _csrf: token },
    });
    req.authMethod = 'session';
    const res = makeRes();
    let called = false;
    requireCsrf(req, res, () => { called = true; });
    expect(called).toBe(true);
  });
});

describe('newCsrfToken', () => {
  test('generates 64-char hex tokens', () => {
    const t = newCsrfToken();
    expect(t).toMatch(/^[a-f0-9]{64}$/);
  });
  test('tokens are unique', () => {
    const a = newCsrfToken();
    const b = newCsrfToken();
    expect(a).not.toBe(b);
  });
});
