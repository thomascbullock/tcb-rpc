/**
 * XML-RPC authentication.
 *
 * The MetaWeblog / Blogger APIs pass username + password inside the request
 * params (not in an HTTP header), so we can't reuse the Express Basic Auth
 * middleware. This module still provides the auth(params) primitive that
 * each handler calls; it now delegates password verification to the shared
 * argon2 check in lib/auth.js.
 */
const { verifyPassword } = require('./lib/auth');

/**
 * Verify credentials embedded in an XML-RPC params array.
 * @param {Array} params
 * @param {number} usernameIndex
 * @param {number} passwordIndex
 * @returns {Promise<boolean>}
 */
exports.auth = async function (params, usernameIndex = 1, passwordIndex = 2) {
  if (!params || !Array.isArray(params)) {
    console.error('Invalid auth parameters', params);
    return false;
  }
  if (params.length <= usernameIndex || params.length <= passwordIndex) {
    console.error('Auth parameter indexes out of range', {
      paramsLength: params.length,
      usernameIndex,
      passwordIndex,
    });
    return false;
  }
  if (params[usernameIndex] !== process.env.BLOG_USER) {
    console.error('Invalid username');
    return false;
  }
  const ok = await verifyPassword(params[passwordIndex]);
  if (!ok) console.error('Invalid password');
  return ok;
};

exports.authError = function () {
  return {
    faultCode: 403,
    faultString: 'Authentication failed. Incorrect username or password.',
  };
};

/**
 * Reorder XML-RPC params for methods that use inconsistent orderings.
 */
exports.reorderParams = function (params, order) {
  if (!params || !order) return params;
  const reordered = [];
  for (const index of order) {
    reordered.push(params[index]);
  }
  return reordered;
};
