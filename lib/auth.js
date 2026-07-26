/**
 * Auth primitives for the site. One source of truth for password verification
 * and request-level access control.
 *
 *   verifyPassword(plaintext)  — argon2id verify against BLOG_PW_HASH
 *   verifyBasicAuthHeader(hdr) — parses Basic auth, returns bool
 *   requireAuth                — middleware: session OR Basic Auth accepted
 *   requireCsrf                — middleware: enforces CSRF token unless the
 *                                request authenticated via Basic Auth
 *
 * Session state lives on req.session (cookie-session, set up in server.js).
 * Basic Auth callers (scripts, iOS) skip CSRF: they already had to know the
 * password to send Authorization, which is what CSRF tokens defend against.
 */
const crypto = require('crypto');
const argon2 = require('argon2');

async function verifyPassword(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return false;
  const hash = process.env.BLOG_PW_HASH;
  if (!hash) return false;
  try {
    return await argon2.verify(hash, plaintext);
  } catch (err) {
    console.error('argon2 verify error:', err.message);
    return false;
  }
}

async function verifyBasicAuthHeader(header) {
  if (!header || !header.startsWith('Basic ')) return false;
  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch (_) {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx === -1) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  if (user !== process.env.BLOG_USER) return false;
  return await verifyPassword(pass);
}

// Attach req.authMethod = 'session' | 'basic' when authenticated.
async function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    req.authMethod = 'session';
    return next();
  }

  const authHeader = req.get('Authorization');
  if (authHeader) {
    const ok = await verifyBasicAuthHeader(authHeader);
    if (ok) {
      req.authMethod = 'basic';
      return next();
    }
  }

  // For browsers hitting /post or /login-required pages, redirect to /login.
  // For API calls or other clients, 401.
  const accepts = req.get('Accept') || '';
  if (req.method === 'GET' && accepts.includes('text/html')) {
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  res.set('WWW-Authenticate', 'Basic realm="tcb-rpc"');
  res.status(401).json({ success: false, error: 'Authentication required' });
}

function requireCsrf(req, res, next) {
  // Basic Auth requests already prove password knowledge, so no CSRF needed.
  if (req.authMethod === 'basic') return next();

  if (!req.session || !req.session.csrf) {
    return res.status(403).json({ success: false, error: 'No CSRF token in session' });
  }
  const supplied = req.get('X-CSRF-Token') || (req.body && req.body._csrf);
  if (!supplied) {
    return res.status(403).json({ success: false, error: 'Missing X-CSRF-Token header' });
  }
  // Constant-time compare.
  const a = Buffer.from(supplied);
  const b = Buffer.from(req.session.csrf);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).json({ success: false, error: 'Bad CSRF token' });
  }
  next();
}

function newCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  verifyPassword,
  verifyBasicAuthHeader,
  requireAuth,
  requireCsrf,
  newCsrfToken,
};
