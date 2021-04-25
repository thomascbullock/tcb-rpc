/* eslint-disable no-restricted-syntax */
const fs = require('fs-extra');
const path = require('path');
const express = require('express');
const Rss = require('rss');
const moment = require('moment');
const md = require('markdown-it')();

const app = express();
const port = 3000;
const Postmaster = require('./postMaster');
const Page = require('./page_template_new');

const outputPath = './build';

const pageTypes = ['long', 'short', 'photo', 'all'];

for (const file of fs.readdirSync(outputPath)) {
  fs.removeSync(path.join(outputPath, file));
}

class Website {
  constructor() {
    this.postmaster = new Postmaster();
  }

  async setup() {
    await fs.ensureDir(outputPath);
    for (const file of fs.readdirSync(outputPath)) {
      await fs.remove(path.join(outputPath, file));
    }
    await fs.ensureDir(path.join(outputPath, 'css'));
    await fs.ensureDir(path.join(outputPath, 'img'));
    await fs.ensureDir(path.join(outputPath, 'posts', 'long'));
    await fs.ensureDir(path.join(outputPath, 'posts', 'all'));
    await fs.ensureDir(path.join(outputPath, 'posts', 'photo'));
    await fs.ensureDir(path.join(outputPath, 'posts', 'short'));
    await fs.ensureDir(path.join(outputPath, 'rss'));

    await fs.copyFile('reset.css', path.join(outputPath, 'css', 'reset.css'));
    await fs.copyFile('style.css', path.join(outputPath, 'css', 'style.css'));
    for (const imgFile of fs.readdirSync('img')) {
      await fs.copyFile(path.join('img', imgFile), path.join(outputPath, 'img', imgFile));
    }
    await this.postmaster.build();
  }

  async buildSinglePages() {
    let i;
    for (i = 0; i < this.postmaster.all.length; i++) {
      let footerPrevious;
      let footerNext;
      let singlePostPath;

      //make sure the dir exists

      await fs.ensureDir(path.join(outputPath, this.postmaster.all[i].path));

      // write the indivdual Page

      const singleBodyBag = [{
        title: this.postmaster.all[i].title,
        dateTime: this.postmaster.all[i].dateTime,
        body: this.postmaster.all[i].body,
        href: path.join('/posts',this.postmaster.all[i].path, this.postmaster.all[i].slug),
      }];
      if (i === 0) {
        footerNext = `${path.join('/posts',this.postmaster.all[i + 1].path, this.postmaster.all[i + 1].slug)}.html`;
      } else if (i > 0 && i < this.postmaster.all.length - 1) {
        footerPrevious = `${path.join('/posts',this.postmaster.all[i - 1].path, this.postmaster.all[i - 1].slug)}.html`;
        footerNext = `${path.join('/posts',this.postmaster.all[i + 1].path, this.postmaster.all[i + 1].slug)}.html`;
      } else {
        footerPrevious = `${path.join('/posts',this.postmaster.all[i - 1].path, this.postmaster.all[i - 1].slug)}.html`;
      }

      const singlePage = new Page({
        title: this.postmaster.all[i].title,
        bodyBag: singleBodyBag,
        footerPrevious,
        footerNext,
        fileName: this.postmaster.all[i].slug,
        fileDir: path.join(outputPath, 'posts', this.postmaster.all[i].path),
      });
      await singlePage.savePage();
    }
  }

  async buildMultiPages() {
    let archive = '';
    for (let pageTypeCounter = 0; pageTypeCounter < pageTypes.length; pageTypeCounter++) {
      const postType = pageTypes[pageTypeCounter];
      let bodyBag = [];
      let pagesCounter = 0;
      let postsCounter = 0;
      
      const feed = new Rss({
        title: postType,
        feed_url: `http://thomascbullock.com/rss/rss-${postType}.xml`,
        site_url: 'http://thomascbullock.com',
      });
      console.log(this.postmaster);
      if (this.postmaster[postType]) {

        for (let totalPostCounter = 0; totalPostCounter < this.postmaster[postType].length; totalPostCounter++) {
          bodyBag.push({
            title: this.postmaster[postType][totalPostCounter].title,
            dateTime: this.postmaster[postType][totalPostCounter].dateTime,
            body: this.postmaster[postType][totalPostCounter].body,
            href: path.join('/posts',this.postmaster[postType][totalPostCounter].path, this.postmaster[postType][totalPostCounter].slug),
          });
          feed.item({
            title: this.postmaster[postType][totalPostCounter].title,
            description: this.postmaster[postType][totalPostCounter].title,
            url: `http://thomascbullock.com/${path.join('posts',this.postmaster[postType][totalPostCounter].path, this.postmaster[postType][totalPostCounter].slug)}`,
          });

          if (postType === 'all' && this.postmaster[postType][totalPostCounter].type !== 'short' && this.postmaster[postType][totalPostCounter].title !== '') {
            archive = archive + `${moment(this.postmaster[postType][totalPostCounter].dateTime).format('MMMM Do YYYY')}: [${this.postmaster[postType][totalPostCounter].title}](${path.join('/posts',this.postmaster[postType][totalPostCounter].path, this.postmaster[postType][totalPostCounter].slug)})\n\n`;
          }

          if (postsCounter === 10 || totalPostCounter + 1 === this.postmaster[postType].length) {
            let footerNext;
            let footerPrevious;
            let fileName;

            if (pagesCounter === 0) {
              if (this.postmaster[postType].length > 10) {
                footerPrevious = `/posts/${postType}/${pagesCounter + 1}`;
                console.log(footerPrevious);
              }
              fileName = `${postType}`;
            } else if (pagesCounter === 1) {
              footerPrevious = `/posts/${postType}/${pagesCounter + 1}`;
              footerNext = `/posts/${postType}/${postType}`;
              fileName = `${pagesCounter}`;
            } else if (pagesCounter > 1 && pagesCounter < (this.postmaster[postType].length / 10)) {
              footerPrevious = `/posts/${postType}/${pagesCounter + 1}`;
              footerNext = `/posts/${postType}/${pagesCounter - 1}`;
              fileName = `${pagesCounter}`;
            } else {
              footerNext = `/posts/${postType}/${pagesCounter - 1}`;
              fileName = `${pagesCounter}`;
            }
            const pageOfPosts = new Page({
              title: 'T',
              bodyBag,
              footerPrevious,
              footerNext,
              fileName,
              fileDir: path.join(outputPath, 'posts', postType),
            });
            await pageOfPosts.savePage();
            postsCounter = 0;
            pagesCounter++;
            bodyBag = [];
          } else {
            postsCounter++;
          }
        }
      }
      await fs.writeFile(path.join(outputPath, 'rss',`rss-${postType}.xml`),feed.xml({indent: true}));
    }
    const archiveBag = [{
      title: 'Archive',
            dateTime: Date.now(),
            body: md.render(archive),
            href: `/posts/archive`,
            noDate: true,
    }];
    const archivePage = new Page({
      title: 'Archive',
      bodyBag: archiveBag,
      fileName: 'archive',
      fileDir: path.join(outputPath,'posts'),
    });
    await archivePage.savePage();
  }

    async buildAboutPage(){

      const aboutBody = await fs.readFile(`./about.md`);

      const aboutBodyBag = [{
        title: 'About',
        dateTime: Date.now(),
        body: md.render(aboutBody.toString()),
        href: '/posts/about',
        noDate: true,
      }];
   
      const aboutPage = new Page({
        title: 'About',
        bodyBag: aboutBodyBag,
        fileName: 'about',
        fileDir: path.join(outputPath, 'posts'),
      });

      await aboutPage.savePage();

  }

  async orchestrate() {
    await website.setup();
    await website.buildSinglePages();
    await website.buildMultiPages();
    await website.buildAboutPage();
    app.use(express.static('./build', { extensions: ['html'], index: 'posts/all/all.html' }));
    app.listen(port);
  }
}

const website = new Website();
website.orchestrate();
