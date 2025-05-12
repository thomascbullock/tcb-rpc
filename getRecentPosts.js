/**
 * Implementation of metaWeblog.getRecentPosts method
 * Gets a list of recent posts
 */
const auth = require("./auth").auth;
const authError = require("./auth").authError;
const Postmaster = require("./postMaster");
const path = require("path");

exports.getRecentPosts = async function (params) {
  try {
    // Check authentication
    if (!auth(params)) {
      return authError();
    }
    
    // Get number of posts to return (default 10)
    const numberOfPosts = params[3] || 10;
    
    // Load all posts
    const postmaster = new Postmaster();
    await postmaster.build("editor");
    
    // Format posts for API response
    const postArray = [];
    
    // Loop through posts (up to the requested number)
    const postsToProcess = Math.min(postmaster.all.length, numberOfPosts);
    
    for (let i = 0; i < postsToProcess; i++) {
      const post = postmaster.all[i];
      
      // Create categories array
      const categoryArr = [post.type];
      
      const postToPush = {
        // Standard MetaWeblog API fields
        postid: post.postid,
        dateCreated: post.dateCreated,
        title: post.title,
        description: post.body,
        categories: categoryArr,
        link: path.join(
          "https://thomascbullock.com/posts",
          post.path,
          post.slug
        ),
        permalink: path.join(
          "https://thomascbullock.com/posts",
          post.path,
          post.slug
        ),
        // Additional fields
        slug: post.slug,
        wp_slug: post.slug
      };
      
      postArray.push(postToPush);
    }
    
    return postArray;
  } catch (error) {
    console.error(`Error getting recent posts: ${error.message}`);
    return {
      faultCode: 500,
      faultString: `Error getting recent posts: ${error.message}`
    };
  }
};