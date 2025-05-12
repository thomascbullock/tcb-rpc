/**
 * Implementation of metaWeblog.newPost method
 * Creates a new blog post
 */
const auth = require('./auth').auth;
const authError = require('./auth').authError;
const Post = require('./post');

exports.newPost = async function(params) {
  try {
    if (!auth(params)) {
      return authError();
    }
    
    // Extract post content
    const postContent = params[3];
    
    // Create post parameters
    const postParams = {
      description: postContent.description || '',
      title: postContent.title || '',
      categories: postContent.categories || ['long'],
      // Use standard MetaWeblog API dateCreated field
      dateCreated: postContent.dateCreated || new Date(),
    };
    
    // Handle custom fields
    if (postContent.custom_fields) {
      for (let i = 0; i < postContent.custom_fields.length; i++) {
        console.log('Custom field:', postContent.custom_fields[i]);
        const paramKey = postContent.custom_fields[i].key;
        const paramValue = postContent.custom_fields[i].value;
        postParams[paramKey] = paramValue;
      }
    }
    
    // Handle slug (WordPress compatibility)
    if (postContent.wp_slug) {
      postParams.slug = postContent.wp_slug;
    }
    
    // Create post object
    const post = new Post(postParams);
    
    // Save the post and get ID
    const postId = await post.save();
    
    // MetaWeblog API requires returning the post ID as a string
    return postId;
  } catch (error) {
    console.error('Error creating post:', error);
    return {
      faultCode: 500,
      faultString: `Error creating post: ${error.message}`
    };
  }
};