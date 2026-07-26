const { buildSite, updateForPost } = require('../lib/build');
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

// Read-only wrapper: no post-processing.
function createMethodHandler(handler) {
  return async function (err, params, callback) {
    try {
      const result = await handler(params);
      if (isFault(result)) callback(result, null);
      else callback(null, result);
    } catch (error) {
      console.error(`Error in handler: ${error}`);
      callback(
        { faultCode: 500, faultString: `Internal Server Error: ${error.message}` },
        null
      );
    }
  };
}

// Wrapper that runs a post-processing step (e.g. incremental rebuild) after
// the handler succeeds. postProcess receives (params, result) and returns a
// promise. Errors in postProcess are logged but don't affect the response.
function createMethodHandlerWithPost(handler, postProcess) {
  return async function (err, params, callback) {
    try {
      const result = await handler(params);
      if (isFault(result)) {
        callback(result, null);
        return;
      }
      try {
        await postProcess(params, result);
      } catch (postErr) {
        console.error('post-processing failed:', postErr);
      }
      callback(null, result);
    } catch (error) {
      console.error(`Error in handler: ${error}`);
      callback(
        { faultCode: 500, faultString: `Internal Server Error: ${error.message}` },
        null
      );
    }
  };
}

// For blogger.deletePost the postId might be at params[0] (MetaWeblog-style
// clients hitting this endpoint) or params[1] (Blogger-style). See deletePost.js
// for the detection logic; we mirror it here.
function bloggerDeletePostId(params) {
  if (typeof params[0] === 'string' && (params[0].includes('-') || /^\d{8,}/.test(params[0]))) {
    return params[0];
  }
  return params[1];
}

function registerXmlRpcHandlers(xmlrpcServer) {
  xmlrpcServer.on('NotFound', function (method, params) {
    console.log(`Method '${method}' does not exist`);
    console.log('Params:', JSON.stringify(params));
  });

  // metaWeblog.newPost: returns the new postId.
  xmlrpcServer.on(
    'metaWeblog.newPost',
    createMethodHandlerWithPost(newPost, async (_params, postId) => {
      await updateForPost({ postId, op: 'save' });
    })
  );

  // metaWeblog.editPost: postId is params[0].
  xmlrpcServer.on(
    'metaWeblog.editPost',
    createMethodHandlerWithPost(editPost, async (params) => {
      await updateForPost({ postId: params[0], op: 'save' });
    })
  );

  // Deletes need the post's dateCreated to locate its former position.
  // We look it up BEFORE calling the handler by wrapping differently.
  xmlrpcServer.on('metaWeblog.deletePost', async (err, params, callback) => {
    const postId = params[0];
    let dateCreated;
    let type;
    try {
      const post = await Post.loadById(postId);
      dateCreated = post.dateCreated;
      type = post.categories[0];
    } catch (_) {
      // Post might already be missing; incremental will fall back to full build.
    }
    try {
      const result = await metaWeblogDeletePost(params);
      if (isFault(result)) {
        callback(result, null);
        return;
      }
      try {
        await updateForPost({ postId, op: 'delete', dateCreated, type });
      } catch (postErr) {
        console.error('post-processing failed:', postErr);
      }
      callback(null, result);
    } catch (error) {
      console.error(`Error in handler: ${error}`);
      callback(
        { faultCode: 500, faultString: `Internal Server Error: ${error.message}` },
        null
      );
    }
  });

  xmlrpcServer.on('blogger.deletePost', async (err, params, callback) => {
    const postId = bloggerDeletePostId(params);
    let dateCreated;
    try {
      const post = await Post.loadById(postId);
      dateCreated = post.dateCreated;
    } catch (_) {}
    try {
      const result = await deletePost(params);
      if (isFault(result)) {
        callback(result, null);
        return;
      }
      try {
        await updateForPost({ postId, op: 'delete', dateCreated, type });
      } catch (postErr) {
        console.error('post-processing failed:', postErr);
      }
      callback(null, result);
    } catch (error) {
      console.error(`Error in handler: ${error}`);
      callback(
        { faultCode: 500, faultString: `Internal Server Error: ${error.message}` },
        null
      );
    }
  });

  // newMediaObject only writes to ./img; nothing in build/ needs updating.
  xmlrpcServer.on('metaWeblog.newMediaObject', createMethodHandler(newMediaObject));

  // Read-only.
  xmlrpcServer.on('metaWeblog.getRecentPosts', createMethodHandler(getRecentPosts));
  xmlrpcServer.on('metaWeblog.getCategories', createMethodHandler(getCategories));
  xmlrpcServer.on('metaWeblog.getPost', createMethodHandler(getPost));
  xmlrpcServer.on('blogger.getUserInfo', createMethodHandler(getUserInfo));
  xmlrpcServer.on('blogger.getUsersBlogs', createMethodHandler(getUsersBlogs));
  xmlrpcServer.on('metaWeblog.getUsersBlogs', createMethodHandler(getUsersBlogs));
}

module.exports = { registerXmlRpcHandlers };
