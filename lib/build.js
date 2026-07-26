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

module.exports = { buildSite };
