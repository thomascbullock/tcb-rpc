const xmlrpc = require('xmlrpc');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const { buildSite } = require('./lib/build');
const { createApiRouter } = require('./routes/api');
const { registerXmlRpcHandlers } = require('./routes/xmlrpc');

dotenv.config();

if (!process.env.BLOG_USER || !process.env.BLOG_PW) {
  console.error('Error: BLOG_USER and BLOG_PW must be set in environment variables');
  process.exit(1);
}

const webPort = parseInt(process.env.WEB_PORT || '3000', 10);
const rpcPort = parseInt(process.env.RPC_PORT || '9090', 10);
const rpcHost = process.env.RPC_HOST || 'localhost';

const xmlrpcServer = xmlrpc.createServer({ host: rpcHost, port: rpcPort });
registerXmlRpcHandlers(xmlrpcServer);

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(createApiRouter());

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
    console.log(`Website and API running on http://localhost:${webPort}`);
    console.log(`Mobile photo upload endpoint: http://localhost:${webPort}/api/upload-photo`);
    console.log(`Text post creation endpoint: http://localhost:${webPort}/api/create-text-post`);
  });

  console.log(`XML-RPC server running on http://${rpcHost}:${rpcPort}`);
})();
