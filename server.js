const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const { buildSite } = require('./lib/build');
const { createApiRouter } = require('./routes/api');
const { createXmlRpcRouter } = require('./routes/xmlrpc');

dotenv.config();

if (!process.env.BLOG_USER || !process.env.BLOG_PW) {
  console.error('Error: BLOG_USER and BLOG_PW must be set in environment variables');
  process.exit(1);
}

const webPort = parseInt(process.env.WEB_PORT || '3000', 10);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// XML-RPC must come before the JSON/urlencoded parsers can steal the body,
// but Express is fine either way — the /xmlrpc route uses its own express.text().
app.use(createXmlRpcRouter());
app.use(createApiRouter());

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
    console.log(`  XML-RPC endpoint: http://localhost:${webPort}/xmlrpc`);
    console.log(`  Web posting page: http://localhost:${webPort}/post`);
  });
})();
