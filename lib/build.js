const Website = require('../website');

async function buildSite() {
  try {
    const website = new Website();
    await website.orchestrate();
    console.log('Website build completed successfully!');
    return true;
  } catch (error) {
    console.error('Error building website:', error);
    return false;
  }
}

/**
 * Incremental rebuild after a single post mutation. Falls back to full build
 * inside Website.updateForPost() on any error.
 *
 * @param {Object} opts
 * @param {string} opts.postId
 * @param {'save'|'delete'} opts.op
 * @param {Date|string} [opts.dateCreated] - required for 'delete'
 */
async function updateForPost(opts) {
  try {
    const website = new Website();
    await website.updateForPost(opts);
    return true;
  } catch (error) {
    console.error('Error in updateForPost:', error);
    return false;
  }
}

module.exports = { buildSite, updateForPost };
