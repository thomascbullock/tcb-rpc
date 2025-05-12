const auth = require('./auth').auth;
const authError = require('./auth').authError;
const Post = require('./post');

exports.metaWeblogDeletePost = async function(params) {
  // MetaWeblog API deletePost parameters:
  // string postid, string username, string password, boolean publish
  
  if (!auth(params)) {
    return authError();
  }
  
  const postid = params[0];
  
  const postParams = {
    postid: postid
  };
  
  try {
    const post = new Post(postParams);
    await post.delete();
    return true;
  } catch (error) {
    console.error('Error deleting post:', error);
    return {
      faultCode: 404,
      faultString: `Post with ID ${postid} not found.`
    };
  }
};