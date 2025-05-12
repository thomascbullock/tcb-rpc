/**
 * Implementation of metaWeblog.getPost method
 * Gets a specific post by ID
 */
const path = require('path');
const Post = require('./post');
const auth = require('./auth').auth;
const authError = require('./auth').authError;

exports.getPost = async function(params) {
  try {
    // Check authentication
    if (!auth(params)) {
      return authError();
    }
    
    // Extract post ID from params
    const postId = params[0];
    
    // Load the post
    const post = await Post.loadById(postId);
    
    // Generate URL path from date components
    const datePath = post.getDatePath();
    
    // Format response in MetaWeblog API format
    const postToReturn = {
      // Standard MetaWeblog API fields
      postid: post.postid,
      dateCreated: post.dateCreated,
      title: post.title,
      description: post.description,
      categories: post.categories,
      link: path.join(
        "https://thomascbullock.com/posts",
        datePath,
        post.slug
      ),
      permalink: path.join(
        "https://thomascbullock.com/posts",
        datePath,
        post.slug
      ),
      // Additional fields
      slug: post.slug,
      wp_slug: post.slug
    };
    
    return postToReturn;
  } catch (error) {
    console.error(`Error getting post: ${error.message}`);
    return {
      faultCode: 404,
      faultString: `Post not found or could not be loaded: ${error.message}`
    };
  }
};