const auth = require('./auth').auth;
const authError = require('./auth').authError;

exports.getUsersBlogs = async function(params) {
  if (!auth(params)) {
    return authError();
  }
  
  // Return information about the blog
  const blogsArray = [
    {
      blogid: '1',
      blogName: 'T',
      url: 'https://thomascbullock.com',
      xmlrpc: 'https://thomascbullock.com/xmlrpc'
    }
  ];
  
  return blogsArray;
};