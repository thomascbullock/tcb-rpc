/**
 * Authentication middleware for XML-RPC handlers
 * Creates higher-order functions that check authentication before executing the handler
 */

const { auth, authError } = require('./auth');

/**
 * Creates a middleware function that checks authentication before executing the handler
 * @param {Function} handler - The handler function to execute if authentication succeeds
 * @param {number} usernameIndex - Index of the username in the params array
 * @param {number} passwordIndex - Index of the password in the params array
 * @returns {Function} - A new function that checks authentication and then calls the handler
 */
exports.withAuth = function(handler, usernameIndex = 1, passwordIndex = 2) {
  return async function(params) {
    if (!auth(params, usernameIndex, passwordIndex)) {
      return authError();
    }
    
    return await handler(params);
  };
};

/**
 * Creates a middleware function that reorders parameters and checks authentication
 * @param {Function} handler - The handler function to execute if authentication succeeds
 * @param {Array} order - The new order of parameter indices
 * @param {number} usernameIndex - Index of the username in the reordered params
 * @param {number} passwordIndex - Index of the password in the reordered params
 * @returns {Function} - A new function that reorders parameters, checks auth, and calls the handler
 */
exports.withAuthAndReorder = function(handler, order, usernameIndex = 1, passwordIndex = 2) {
  return async function(params) {
    const reorderedParams = [];
    
    for (const index of order) {
      reorderedParams.push(params[index]);
    }
    
    if (!auth(reorderedParams, usernameIndex, passwordIndex)) {
      return authError();
    }
    
    return await handler(reorderedParams);
  };
};