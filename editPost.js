/**
 * Implementation of metaWeblog.editPost method
 * Edits an existing blog post
 */
const auth = require('./auth').auth;
const authError = require('./auth').authError;
const Post = require('./post');

exports.editPost = async function(params) {
  try {
    // Authenticate
    if (!auth(params)) {
      return authError();
    }
    
    // Extract parameters
    const postid = params[0];  // Post ID
    const content = params[3]; // Post content struct
    
    console.log(`Editing post ${postid} with content:`, JSON.stringify(content, null, 2));
    
    // Create post parameters with existing ID
    const postParams = {
      postid: postid,
      description: content.description,
      title: content.title,
      categories: content.categories || ['long'],
      link: content.link
    };
    
    // Handle dateCreated field from MetaWeblog API
    if (content.dateCreated) {
      console.log(`Received dateCreated: ${content.dateCreated}`);
      
      // Parse to ensure it's a valid date
      try {
        const date = new Date(content.dateCreated);
        if (!isNaN(date.getTime())) {
          postParams.dateCreated = date;
          console.log(`Setting dateCreated to: ${date.toISOString()}`);
        } else {
          console.warn(`Invalid dateCreated format: ${content.dateCreated}`);
        }
      } catch (error) {
        console.warn(`Error parsing dateCreated: ${error.message}`);
      }
    }
    
    // Handle WordPress slug
    if (content.wp_slug) {
      postParams.slug = content.wp_slug;
    }
    
    // Handle custom fields
    if (content.custom_fields) {
      for (let i = 0; i < content.custom_fields.length; i++) {
        console.log('Custom field:', content.custom_fields[i]);
        const paramKey = content.custom_fields[i].key;
        const paramValue = content.custom_fields[i].value;
        postParams[paramKey] = paramValue;
      }
    }
    
    // Before updating the post, load the existing post to preserve any fields not provided
    try {
      const existingPost = await Post.loadById(postid);
      
      // Merge existing properties that weren't provided in this update
      if (!postParams.dateCreated && existingPost.dateCreated) {
        postParams.dateCreated = existingPost.dateCreated;
      }
      
      if (!postParams.slug && existingPost.slug) {
        postParams.slug = existingPost.slug;
      }
      
      console.log(`Merged with existing post data`);
    } catch (error) {
      console.warn(`Couldn't load existing post: ${error.message}`);
      // Continue with the update even if we couldn't load the existing post
    }
    
    // Create and save the post
    const post = new Post(postParams);
    await post.save();
    
    console.log(`Post ${postid} updated successfully`);
    return true;
  } catch (error) {
    console.error(`Error updating post: ${error.message}`);
    return {
      faultCode: 500,
      faultString: `Error updating post: ${error.message}`
    };
  }
};