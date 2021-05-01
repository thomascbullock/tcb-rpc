const xmlrpc = require("xmlrpc");
const fs = require("fs");
const getRecentPosts = require("./getRecentPosts").getRecentPosts;
const getCategories = require("./getCategories").getCategories;
const editPost = require("./editPost").editPost;
const getPost = require('./getPost').getPost;
const newPost = require('./newPost').newPost;
const deletePost = require('./deletePost').deletePost;
const newMediaObject = require('./newMediaObject').newMediaObject;
const express = require("express");
const Website = require("./website");

/*
const newMediaObject = require('./newMediaObject');

const deletePost = require('./deletePost');
const editPost = require('./editPost');
const getPost = require('./getPost');
const newPost = require('./newPost');
*/

process.env.BLOG_USER = "thobullo";
process.env.BLOG_PW = "C0pper11!";

async function buildSite() {
  const website = new Website();
  await website.orchestrate();
}

var server = xmlrpc.createServer({ host: "localhost", port: 9090 });
// Handle methods not found

server.on("NotFound", function (method, params) {
  console.log("Method " + method + " does not exist");
  console.log(method);
  console.log(params);
  console.log(JSON.stringify(this));
});

// Handle method calls by listening for events with the method call name

server.on("metaWeblog.getRecentPosts", async function (err, params, callback) {
  const result = await getRecentPosts(params);
  if (result.faultCode) {
    callback(result, null);
  } else {
    callback(null, result);
  }
});

server.on("metaWeblog.getCategories", async function (err, params, callback) {
  const result = await getCategories(params);
  if (result.faultCode) {
    callback(result, null);
  } else {
    callback(null, result);
  }
});

server.on("metaWeblog.editPost", async function (err, params, callback) {
  const result = await editPost(params);
  if (result.faultCode) {
    callback(result, null);
  } else {
    await buildSite();
    callback(null, result);
  }
});

server.on("metaWeblog.getPost", async function (err, params, callback) {
  const result = await getPost(params);
  if (result.faultCode) {
    callback(result, null);
  } else {
    callback(null, result);
  }
});

server.on("metaWeblog.newPost", async function (err, params, callback) {
  const result = await newPost(params);
  if (result.faultCode) {
    callback(result, null);
  } else {
    await buildSite();
    callback(null, result);
  }
});

server.on("blogger.deletePost", async function (err, params, callback) {
  const result = await deletePost(params);
  if (result.faultCode) {
    callback(result, null);
  } else {
    await buildSite();
    callback(null, result);
  }
});

server.on("metaWeblog.newMediaObject", async function (err, params, callback) {
  const result = await newMediaObject(params);
  if (result.faultCode) {
    callback(result, null);
  } else {
    await buildSite();
    callback(null, result);
  }
});

const app = express();
const port = 3000;
buildSite();
app.use(
  express.static("./build", {
    extensions: ["html"],
    index: "posts/all/all.html",
    etag: false,
  })
);
app.listen(port);

/*
      server.on("metaWeblog.newMediaObject", newMediaObject(err, params, callback));

      server.on("metaWeblog.getCategories", getCategories(err, params, callback));

      server.on("metaWeblog.deletePost", deletePost(err, params, callback));

      server.on("metaWeblog.getPost", getPost(err, params, callback));

      server.on("metaWeblog.newPost", newPost(err, params, callback));
      */
