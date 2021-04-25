const xmlrpc = require("xmlrpc");
const fs = require("fs");
const getRecentPosts = require('./getRecentPosts').getRecentPosts;
const getCategories = require('./getCategories').getCategories;
const editPost = require('./editPost').editPost;
const restart = require('./builderNew');
/*
const newMediaObject = require('./newMediaObject');

const deletePost = require('./deletePost');
const editPost = require('./editPost');
const getPost = require('./getPost');
const newPost = require('./newPost');
*/

process.env.BLOG_USER = 'thobullo';
process.env.BLOG_PW = 'C0pper11!';

var server = xmlrpc.createServer({ host: "localhost", port: 9090 });
// Handle methods not found

server.on("NotFound", function(method, params) {
  console.log("Method " + method + " does not exist");
  console.log(method);
  console.log(params);
  console.log(JSON.stringify(this));
});

// Handle method calls by listening for events with the method call name

server.on("metaWeblog.getRecentPosts", async function(err, params, callback) {
      const result = await getRecentPosts(params);
      if (result.faultCode) {
        callback(result, null);
      } else {
        callback(null, result);
      }}); 
      
server.on("metaWeblog.getCategories", async function(err, params, callback) {
        const result = await getCategories(params);
        if (result.faultCode) {
          callback(result, null);
        } else {
          callback(null, result);
        }});
        
server.on("metaWeblog.editPost", async function(err, params, callback) {
  const result = await editPost(params);
  if (result.faultCode) {
    callback(result, null);
  } else {
    callback(null, result);
    restart();
  }});

      /*
      server.on("metaWeblog.newMediaObject", newMediaObject(err, params, callback));

      server.on("metaWeblog.getCategories", getCategories(err, params, callback));

      server.on("metaWeblog.deletePost", deletePost(err, params, callback));

      server.on("metaWeblog.editPost", editPost(err, params, callback));

      server.on("metaWeblog.getPost", getPost(err, params, callback));

      server.on("metaWeblog.newPost", newPost(err, params, callback));
      */