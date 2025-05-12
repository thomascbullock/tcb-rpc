/**
 * Authentication module for XML-RPC API
 * Provides functions to verify user credentials and generate auth errors
 */

// Load environment variables if not already loaded
if (!process.env.BLOG_USER || !process.env.BLOG_PW) {
  try {
    require('dotenv').config();
  } catch (e) {
    console.error('Error loading environment variables. Make sure dotenv is installed.');
  }
}

/**
 * Authenticate a user based on username and password
 * @param {Array} params - Parameters array containing username and password
 * @param {number} [usernameIndex=1] - Index of the username in the params array
 * @param {number} [passwordIndex=2] - Index of the password in the params array
 * @returns {boolean} - True if authenticated, false otherwise
 */
exports.auth = function(params, usernameIndex = 1, passwordIndex = 2) {
  // Check if parameters are valid
  if (!params || !Array.isArray(params)) {
    console.error('Invalid auth parameters', params);
    return false;
  }
  
  // Check if indexes are in range
  if (params.length <= usernameIndex || params.length <= passwordIndex) {
    console.error('Auth parameter indexes out of range', { 
      paramsLength: params.length, 
      usernameIndex, 
      passwordIndex 
    });
    return false;
  }
  
  // Check username
  if (params[usernameIndex] !== process.env.BLOG_USER) {
    console.error('Invalid username');
    return false;
  }
  
  // Check password
  if (params[passwordIndex] !== process.env.BLOG_PW) {
    console.error('Invalid password');
    return false;
  }
  
  return true;
};

/**
 * Generate an authentication error response
 * @returns {Object} - XML-RPC fault response
 */
exports.authError = function() {
  return {
    faultCode: 403,
    faultString: "Authentication failed. Incorrect username or password."
  };
};

/**
 * Reorder parameters for inconsistent API methods
 * @param {Array} params - Original parameters
 * @param {Array} order - New order of indices
 * @returns {Array} - Reordered parameters
 */
exports.reorderParams = function(params, order) {
  if (!params || !order) return params;
  
  const reordered = [];
  for (const index of order) {
    reordered.push(params[index]);
  }
  
  return reordered;
};