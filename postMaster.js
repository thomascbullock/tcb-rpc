const fs = require('fs-extra');
const MetaBuilder = require('./posts_meta_builder');

class Postmaster {
  constructor() {
    this.all = [];
    this.long = [];
    this.short = [];
    this.photo = [];
    this.link = [];
  }

  sort() {
    for (const postType of Object.entries(this)) {
      this[postType[0]].sort((post1, post2) => {
          const d1 = new Date(post1.dateTime);
          const d2 = new Date(post2.dateTime);
          return d2 - d1;
      });
    }
  }

  async build(mode) {
    const metaBuilder = new MetaBuilder('./posts');
    const meta = await metaBuilder.build(mode);
    const postPromises = [];

    meta.forEach((postData) => {
      this.all.push(postData);
      this[postData.type].push(postData);
    });
    this.sort();
  }
}

module.exports = Postmaster;
