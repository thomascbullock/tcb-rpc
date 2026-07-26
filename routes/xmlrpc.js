const express = require('express');

const { parseMethodCall, serializeResponse, serializeFault } = require('../lib/xmlrpc');
const { updateForPost } = require('../lib/build');
const Post = require('../post');

const { editPost } = require('../editPost');
const { newPost } = require('../newPost');
const { deletePost } = require('../deletePost');
const { metaWeblogDeletePost } = require('../metaWeblogDeletePost');
const { newMediaObject } = require('../newMediaObject');
const { getRecentPosts } = require('../getRecentPosts');
const { getCategories } = require('../getCategories');
const { getPost } = require('../getPost');
const { getUserInfo } = require('../getUserInfo');
const { getUsersBlogs } = require('../getUsersBlogs');

function isFault(result) {
  return result && typeof result === 'object' && 'faultCode' in result;
}

// blogger.deletePost accepts params in either order (Blogger-style: appkey
// first, or MetaWeblog-style: postid first). Match the detection in
// deletePost.js so we look up the right post.
function bloggerDeletePostId(params) {
  if (typeof params[0] === 'string' && (params[0].includes('-') || /^\d{8,}/.test(params[0]))) {
    return params[0];
  }
  return params[1];
}

// Method table. Each entry:
//   handler(params) → result | fault
//   afterSuccess(params, result) → optional, called only on non-fault result
const methods = {
  'metaWeblog.getRecentPosts':  { handler: getRecentPosts },
  'metaWeblog.getCategories':   { handler: getCategories },
  'metaWeblog.getPost':         { handler: getPost },
  'blogger.getUserInfo':        { handler: getUserInfo },
  'blogger.getUsersBlogs':      { handler: getUsersBlogs },
  'metaWeblog.getUsersBlogs':   { handler: getUsersBlogs },

  'metaWeblog.newPost': {
    handler: newPost,
    afterSuccess: async (_params, postId) => {
      await updateForPost({ postId, op: 'save' });
    },
  },
  'metaWeblog.editPost': {
    handler: editPost,
    afterSuccess: async (params) => {
      await updateForPost({ postId: params[0], op: 'save' });
    },
  },

  // Deletes need to look up dateCreated + type BEFORE the mutation.
  'metaWeblog.deletePost': {
    handler: async (params) => {
      const postId = params[0];
      let dateCreated;
      let type;
      try {
        const post = await Post.loadById(postId);
        dateCreated = post.dateCreated;
        type = post.categories[0];
      } catch (_) {}
      const result = await metaWeblogDeletePost(params);
      if (isFault(result)) return result;
      try {
        await updateForPost({ postId, op: 'delete', dateCreated, type });
      } catch (err) {
        console.error('post-processing failed:', err);
      }
      return result;
    },
  },
  'blogger.deletePost': {
    handler: async (params) => {
      const postId = bloggerDeletePostId(params);
      let dateCreated;
      let type;
      try {
        const post = await Post.loadById(postId);
        dateCreated = post.dateCreated;
        type = post.categories[0];
      } catch (_) {}
      const result = await deletePost(params);
      if (isFault(result)) return result;
      try {
        await updateForPost({ postId, op: 'delete', dateCreated, type });
      } catch (err) {
        console.error('post-processing failed:', err);
      }
      return result;
    },
  },

  // newMediaObject only writes to ./img; ./img is served directly, so no rebuild.
  'metaWeblog.newMediaObject': { handler: newMediaObject },
};

function createXmlRpcRouter({ xmlrpcPath = '/xmlrpc', limiter } = {}) {
  const router = express.Router();

  // Capture the raw XML body for the xmlrpc endpoint specifically. Other
  // routes are unaffected by this middleware.
  router.use(
    xmlrpcPath,
    express.text({ type: ['text/xml', 'application/xml', '*/xml'], limit: '10mb' })
  );

  const handler = async (req, res) => {
    res.set('Content-Type', 'text/xml');

    let methodName;
    let params;
    try {
      ({ methodName, params } = await parseMethodCall(req.body));
    } catch (err) {
      console.error('XML-RPC parse error:', err);
      res.status(400).send(serializeFault({ faultCode: 400, faultString: `Bad XML-RPC request: ${err.message}` }));
      return;
    }

    const entry = methods[methodName];
    if (!entry) {
      console.log(`XML-RPC method not found: ${methodName}`);
      res.send(serializeFault({ faultCode: -32601, faultString: `Method '${methodName}' not found` }));
      return;
    }

    let result;
    try {
      result = await entry.handler(params);
    } catch (err) {
      console.error(`XML-RPC handler error for ${methodName}:`, err);
      res.send(serializeFault({ faultCode: 500, faultString: `Internal Server Error: ${err.message}` }));
      return;
    }

    if (isFault(result)) {
      res.send(serializeFault(result));
      return;
    }

    if (entry.afterSuccess) {
      try {
        await entry.afterSuccess(params, result);
      } catch (err) {
        console.error(`afterSuccess failed for ${methodName}:`, err);
      }
    }

    res.send(serializeResponse(result));
  };

  if (limiter) {
    router.post(xmlrpcPath, limiter, handler);
  } else {
    router.post(xmlrpcPath, handler);
  }

  return router;
}

module.exports = { createXmlRpcRouter, methods };
