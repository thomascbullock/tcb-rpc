const express = require('express');
const cookieSession = require('cookie-session');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

const { buildSite } = require('./lib/build');
const { createApiRouter } = require('./routes/api');
const { createXmlRpcRouter } = require('./routes/xmlrpc');

dotenv.config();

// ---- Config validation ----
function fatal(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

if (!process.env.BLOG_USER) {
  fatal('BLOG_USER must be set in .env');
}
if (!process.env.BLOG_PW_HASH) {
  if (process.env.BLOG_PW) {
    console.error('Error: BLOG_PW is set but BLOG_PW_HASH is not.');
    console.error('Migrate: run `node scripts/hash-password.js`, then update .env');
    console.error('  Set BLOG_PW_HASH (and SESSION_SECRET) with the values it prints.');
    console.error('  Then remove BLOG_PW from .env.');
    process.exit(1);
  }
  fatal('BLOG_PW_HASH must be set. Generate: `node scripts/hash-password.js`');
}
if (!process.env.SESSION_SECRET) {
  fatal('SESSION_SECRET must be set. Generate: `node scripts/hash-password.js`');
}
if (process.env.BLOG_PW) {
  console.warn('Warning: BLOG_PW is set but no longer used. Remove it from .env.');
}

const webPort = parseInt(process.env.WEB_PORT || '3000', 10);
const xmlrpcPath = process.env.XMLRPC_PATH || '/xmlrpc';

// ---- Rate limiters ----
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Try again in a minute.',
});

const xmlrpcLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const app = express();

// Trust the first proxy hop (HAProxy / Caddy) so express-rate-limit sees the
// real client IP. If you run this bare on the internet, remove this line.
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cookieSession({
    name: 't_session',
    keys: [process.env.SESSION_SECRET],
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })
);

app.use(createXmlRpcRouter({ xmlrpcPath, limiter: xmlrpcLimiter }));
app.use(createApiRouter({ loginLimiter }));

app.use(
  '/img',
  express.static('./img', {
    maxAge: '1y',
    immutable: true,
    etag: false,
  })
);

app.use(
  express.static('./build', {
    extensions: ['html'],
    index: 'posts/all/all.html',
    etag: false,
  })
);

(async function start() {
  console.log('Building site...');
  await buildSite();

  app.listen(webPort, () => {
    console.log(`Website + API + XML-RPC running on http://localhost:${webPort}`);
    console.log(`  Login:             http://localhost:${webPort}/login`);
    console.log(`  Web posting page:  http://localhost:${webPort}/post`);
    console.log(`  XML-RPC endpoint:  http://localhost:${webPort}${xmlrpcPath}`);
  });
})();
