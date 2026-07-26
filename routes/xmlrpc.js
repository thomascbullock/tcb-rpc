const { buildSite } = require('../lib/build');

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

function createMethodHandler(handler) {
  return async function (err, params, callback) {
    try {
      const result = await handler(params);
      if (result && result.faultCode) {
        callback(result, null);
      } else {
        callback(null, result);
      }
    } catch (error) {
      console.error(`Error in handler: ${error}`);
      callback(
        {
          faultCode: 500,
          faultString: `Internal Server Error: ${error.message}`,
        },
        null
      );
    }
  };
}

function createMethodHandlerWithRebuild(handler) {
  return async function (err, params, callback) {
    try {
      const result = await handler(params);
      if (result && result.faultCode) {
        callback(result, null);
      } else {
        await buildSite();
        callback(null, result);
      }
    } catch (error) {
      console.error(`Error in handler with rebuild: ${error}`);
      callback(
        {
          faultCode: 500,
          faultString: `Internal Server Error: ${error.message}`,
        },
        null
      );
    }
  };
}

/**
 * Register all MetaWeblog / Blogger API handlers on the given xmlrpc server.
 */
function registerXmlRpcHandlers(xmlrpcServer) {
  xmlrpcServer.on('NotFound', function (method, params) {
    console.log(`Method '${method}' does not exist`);
    console.log('Params:', JSON.stringify(params));
  });

  // Methods that modify content and require site rebuild.
  xmlrpcServer.on('metaWeblog.editPost', createMethodHandlerWithRebuild(editPost));
  xmlrpcServer.on('metaWeblog.newPost', createMethodHandlerWithRebuild(newPost));
  xmlrpcServer.on('metaWeblog.deletePost', createMethodHandlerWithRebuild(metaWeblogDeletePost));
  xmlrpcServer.on('blogger.deletePost', createMethodHandlerWithRebuild(deletePost));
  xmlrpcServer.on('metaWeblog.newMediaObject', createMethodHandlerWithRebuild(newMediaObject));

  // Read-only methods.
  xmlrpcServer.on('metaWeblog.getRecentPosts', createMethodHandler(getRecentPosts));
  xmlrpcServer.on('metaWeblog.getCategories', createMethodHandler(getCategories));
  xmlrpcServer.on('metaWeblog.getPost', createMethodHandler(getPost));
  xmlrpcServer.on('blogger.getUserInfo', createMethodHandler(getUserInfo));
  xmlrpcServer.on('blogger.getUsersBlogs', createMethodHandler(getUsersBlogs));
  xmlrpcServer.on('metaWeblog.getUsersBlogs', createMethodHandler(getUsersBlogs));
}

module.exports = { registerXmlRpcHandlers };
