/**
 * Implementation of the blogger.deletePost method for XML-RPC
 * 
 * Note: This implementation handles both the Blogger API and MetaWeblog API versions
 * of the deletePost method, which have different parameter orderings.
 * 
 * Blogger API: appkey, postid, username, password, publish
 * MetaWeblog API: postid, username, password, publish
 */
const auth = require('./auth').auth;
const authError = require('./auth').authError;
const Post = require('./post');
const fs = require('fs-extra');
const path = require('path');

/**
 * Delete a post
 * 
 * @param {Array} params - Parameters from the XML-RPC call
 * @returns {boolean|Object} - true on success, fault object on error
 */
exports.deletePost = async function(params) {
  try {
    // Check if we're called from blogger or metaWeblog API
    // by examining if the first parameter looks like a postid or an appkey
    let postid, user, pw;
    let paramsCopy = [...params]; // Create a copy to avoid modifying the original
    
    // MetaWeblog API: postid is first parameter
    // Blogger API: postid is second parameter (after appkey)
    // We can usually tell by checking if it matches a post ID pattern (starts with date)
    
    // Assume blogger API parameters by default (appkey, postid, username, password, publish)
    postid = params[1]; // Second parameter for blogger API
    user = params[2];
    pw = params[3];
    
    // If first parameter looks like a postid (contains a date or dash)
    if (typeof params[0] === 'string' && 
        (params[0].includes('-') || /^\d{8,}/.test(params[0]))) {
      // This is probably the MetaWeblog API pattern
      postid = params[0]; // First parameter for metaWeblog API
      user = params[1];
      pw = params[2];
    }
    
    console.log(`Attempting to delete post: ${postid}`);
    
    // Validate credentials
    const authParams = [null, user, pw]; // Auth function expects username at index 1, password at index 2
    if (!auth(authParams)) {
      console.error('Authentication failed');
      return authError();
    }
    
    // Check if the post exists before attempting to delete
    const postsDir = path.join(process.cwd(), 'posts');
    const postPath = path.join(postsDir, `${postid}.md`);
    
    if (!await fs.pathExists(postPath)) {
      console.error(`Post file not found: ${postPath}`);
      return {
        faultCode: 404,
        faultString: `Post with ID ${postid} not found.`
      };
    }
    
    // Delete the post
    const postParams = {
      postid: postid
    };
    
    const post = new Post(postParams);
    await post.delete();
    
    console.log(`Successfully deleted post: ${postid}`);
    return true;
  } catch (error) {
    console.error('Error in deletePost:', error);
    return {
      faultCode: 500,
      faultString: `Failed to delete post: ${error.message}`
    };
  }
};

/**
 * MetaWeblog API version of deletePost
 * Adapter for the main deletePost function with metaWeblog parameter order
 */
exports.metaWeblogDeletePost = async function(params) {
  // Just call the main deletePost, it will handle parameter detection
  return exports.deletePost(params);
};