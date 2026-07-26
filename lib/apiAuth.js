const basicAuth = require('express-basic-auth');

/**
 * Basic Auth middleware for the REST API and the /post editor page.
 *
 * NOTE: This is the pre-refactor auth model. PR 4 replaces it with
 * argon2 password hashing + session cookies + rate limiting.
 */
function createApiAuth() {
  if (!process.env.BLOG_USER || !process.env.BLOG_PW) {
    throw new Error('BLOG_USER and BLOG_PW must be set in environment variables');
  }

  return basicAuth({
    users: { [process.env.BLOG_USER]: process.env.BLOG_PW },
    challenge: true,
    realm: 'Mobile Upload API',
  });
}

module.exports = { createApiAuth };
