/* eslint-disable no-restricted-syntax */
const fs = require("fs-extra");
const path = require("path");
const moment = require("moment");
const md = require("markdown-it")();
const Postmaster = require("./postMaster");
const Page = require("./page_template_new");
const RSSGenerator = require('./rssGenerator');

const outputPath = "./build";

const pageTypes = ["long", "short", "photo", "all"];

class Website {
  constructor() {
    this.postmaster = new Postmaster();
  }

  async setup() {
    for (const file of fs.readdirSync(outputPath)) {
      fs.removeSync(path.join(outputPath, file));
    }
    await fs.ensureDir(outputPath);
    for (const file of fs.readdirSync(outputPath)) {
      await fs.remove(path.join(outputPath, file));
    }
    await fs.ensureDir(path.join(outputPath, "css"));
    await fs.ensureDir(path.join(outputPath, "img"));
    await fs.ensureDir(path.join(outputPath, "posts", "long"));
    await fs.ensureDir(path.join(outputPath, "posts", "all"));
    await fs.ensureDir(path.join(outputPath, "posts", "photo"));
    await fs.ensureDir(path.join(outputPath, "posts", "short"));
    await fs.ensureDir(path.join(outputPath, "feeds"));

    await fs.copyFile("reset.css", path.join(outputPath, "css", "reset.css"));
    await fs.copyFile("style.css", path.join(outputPath, "css", "style.css"));
    for (const imgFile of fs.readdirSync("img")) {
      await fs.copyFile(
        path.join("img", imgFile),
        path.join(outputPath, "img", imgFile)
      );
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
      console.log('ensureDir', path.join(outputPath, 'posts', this.postmaster.all[i].path));
      await fs.ensureDir(path.join(outputPath, 'posts', this.postmaster.all[i].path));

      // write the indivdual Page

      const singleBodyBag = [
        {
          title: this.postmaster.all[i].title,
          dateCreated: this.postmaster.all[i].dateCreated, // Use dateCreated
          dateTime: this.postmaster.all[i].dateTime,       // Include dateTime as fallback
          body: this.postmaster.all[i].body,
          href: path.join(
            "/posts",
            this.postmaster.all[i].path,
            this.postmaster.all[i].slug
          ),
        },
      ];
      if (i === 0) {
        footerNext = `${path.join(
          "/posts",
          this.postmaster.all[i + 1].path,
          this.postmaster.all[i + 1].slug
        )}.html`;
      } else if (i > 0 && i < this.postmaster.all.length - 1) {
        footerPrevious = `${path.join(
          "/posts",
          this.postmaster.all[i - 1].path,
          this.postmaster.all[i - 1].slug
        )}.html`;
        footerNext = `${path.join(
          "/posts",
          this.postmaster.all[i + 1].path,
          this.postmaster.all[i + 1].slug
        )}.html`;
      } else {
        footerPrevious = `${path.join(
          "/posts",
          this.postmaster.all[i - 1].path,
          this.postmaster.all[i - 1].slug
        )}.html`;
      }

      const singlePage = new Page({
        title: this.postmaster.all[i].title,
        bodyBag: singleBodyBag,
        footerPrevious,
        footerNext,
        fileName: this.postmaster.all[i].slug,
        fileDir: path.join(outputPath, "posts", this.postmaster.all[i].path),
      });
      await singlePage.savePage();
    }
  }

  async buildMultiPages() {
    let archive = "";
    for (
      let pageTypeCounter = 0;
      pageTypeCounter < pageTypes.length;
      pageTypeCounter++
    ) {
      const postType = pageTypes[pageTypeCounter];
      let bodyBag = [];
      let pagesCounter = 0;
      let postsCounter = 0;

      if (this.postmaster[postType]) {
        console.log("building: ", postType);
        for (
          let totalPostCounter = 0;
          totalPostCounter < this.postmaster[postType].length;
          totalPostCounter++
        ) {
          bodyBag.push({
            title: this.postmaster[postType][totalPostCounter].title,
            dateCreated: this.postmaster[postType][totalPostCounter].dateCreated, // Use dateCreated
            dateTime: this.postmaster[postType][totalPostCounter].dateTime,       // Include dateTime as fallback
            body: this.postmaster[postType][totalPostCounter].body,
            href: path.join(
              "/posts",
              this.postmaster[postType][totalPostCounter].path,
              this.postmaster[postType][totalPostCounter].slug
            ),
          });

          if (
            postType === "all" &&
            this.postmaster[postType][totalPostCounter].type !== "short" &&
            this.postmaster[postType][totalPostCounter].title !== ""
          ) {
            // Use dateCreated if available, otherwise fall back to dateTime
            let displayDate;
            if (this.postmaster[postType][totalPostCounter].dateCreated) {
              displayDate = new Date(this.postmaster[postType][totalPostCounter].dateCreated);
            } else if (this.postmaster[postType][totalPostCounter].dateTime) {
              displayDate = new Date(this.postmaster[postType][totalPostCounter].dateTime);
            } else {
              displayDate = new Date();
            }
            
            // Use empty string for posts without titles - not "Untitled"
            const postTitle = this.postmaster[postType][totalPostCounter].title || '';
            
            archive =
              archive +
              `${moment(displayDate).format("MMMM Do YYYY")}: [${postTitle}](${path.join(
                "/posts",
                this.postmaster[postType][totalPostCounter].path,
                this.postmaster[postType][totalPostCounter].slug
              )})\n\n`;
          }

          if (
            postsCounter === 10 ||
            totalPostCounter + 1 === this.postmaster[postType].length
          ) {
            let footerNext;
            let footerPrevious;
            let fileName;

            if (pagesCounter === 0) {
              if (this.postmaster[postType].length > 10) {
                footerPrevious = `/posts/${postType}/${pagesCounter + 1}`;
              }
              fileName = `${postType}`;
            } else if (pagesCounter === 1) {
              footerPrevious = `/posts/${postType}/${pagesCounter + 1}`;
              footerNext = `/posts/${postType}/${postType}`;
              fileName = `${pagesCounter}`;
            } else if (
              pagesCounter > 1 &&
              pagesCounter < this.postmaster[postType].length / 10
            ) {
              footerPrevious = `/posts/${postType}/${pagesCounter + 1}`;
              footerNext = `/posts/${postType}/${pagesCounter - 1}`;
              fileName = `${pagesCounter}`;
            } else {
              footerNext = `/posts/${postType}/${pagesCounter - 1}`;
              fileName = `${pagesCounter}`;
            }
            const pageOfPosts = new Page({
              title: "T",
              bodyBag,
              footerPrevious,
              footerNext,
              fileName,
              fileDir: path.join(outputPath, "posts", postType),
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
    }
    const archiveBag = [
      {
        title: "Archive",
        dateTime: Date.now(),
        body: md.render(archive),
        href: `/posts/archive`,
        noDate: true,
      },
    ];
    const archivePage = new Page({
      title: "Archive",
      bodyBag: archiveBag,
      fileName: "archive",
      fileDir: path.join(outputPath, "posts"),
    });
    await archivePage.savePage();
  }

  async buildAboutPage() {
    const aboutBody = await fs.readFile(`./about.md`);

    const aboutBodyBag = [
      {
        title: "About",
        dateTime: Date.now(),
        body: md.render(aboutBody.toString()),
        href: "/posts/about",
        noDate: true,
      },
    ];

    const aboutPage = new Page({
      title: "About",
      bodyBag: aboutBodyBag,
      fileName: "about",
      fileDir: path.join(outputPath, "posts"),
    });

    await aboutPage.savePage();
  }
  
  async buildRSSFeeds() {
    try {
      console.log('Generating RSS feeds...');
      
      // Create RSS generator
      const rssGenerator = new RSSGenerator({
        siteUrl: 'https://thomascbullock.com',
        siteTitle: 'T',
        siteDescription: 'Thomas C. Bullock\'s Blog',
        outputDir: path.join(outputPath, 'feeds'),
        postmaster: this.postmaster,
        // Pass option to keep titles blank (not "Untitled")
        useBlankTitles: true
      });
      
      // Generate all feeds
      const result = await rssGenerator.generateAllFeeds();
      
      // Also generate JSON Feed
      const jsonFeedPath = await rssGenerator.generateJsonFeed();
      
      console.log('RSS feeds generated:');
      result.feeds.forEach(feed => {
        console.log(`- ${feed.type}: ${feed.path} (${feed.count} posts)`);
      });
      console.log(`- JSON Feed: ${jsonFeedPath}`);
      
      // Create .htaccess for feed redirects
      const htaccessContent = `
# Feed redirects
RedirectMatch 301 ^/feed/?$ /feeds/index.xml
RedirectMatch 301 ^/rss/?$ /feeds/index.xml
RedirectMatch 301 ^/atom/?$ /feeds/atom.xml
RedirectMatch 301 ^/feeds/all/?$ /feeds/rss-all.xml
RedirectMatch 301 ^/feeds/long/?$ /feeds/rss-long.xml
RedirectMatch 301 ^/feeds/short/?$ /feeds/rss-short.xml
RedirectMatch 301 ^/feeds/photo/?$ /feeds/rss-photo.xml
`;
      
      await fs.writeFile(path.join(outputPath, '.htaccess'), htaccessContent);
      
    } catch (error) {
      console.error('Error building RSS feeds:', error);
    }
  }

  async orchestrate() {
    await this.setup();
    console.log("setup complete");
    await this.buildSinglePages();
    console.log("single pages complete");
    await this.buildMultiPages();
    console.log("multi pages complete");
    await this.buildAboutPage();
    console.log("about complete");
    await this.buildRSSFeeds();
    console.log('RSS feeds complete');
  }
}

module.exports = Website;