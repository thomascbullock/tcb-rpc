/* eslint-disable no-restricted-syntax */
const fs = require("fs-extra");
const path = require("path");
const moment = require("moment");
// Enable HTML in markdown-it for proper image rendering
const md = require("markdown-it")({
  html: true,        // Enable HTML tags in source
  linkify: true,     // Autoconvert URL-like text to links
  typographer: true  // Enable smart quotes and other typographic replacements
});
const Postmaster = require("./postMaster");
const Page = require("./page_template_new");
const RSSGenerator = require('./rssGenerator');

const outputPath = "./build";
const pageTypes = ["long", "short", "photo", "all"];

class Website {
  constructor() {
    this.postmaster = new Postmaster();
    this.createdPermalinks = []; // Track created permalinks for debugging
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
    
    // Copy all images
    if (await fs.pathExists("img")) {
      for (const imgFile of fs.readdirSync("img")) {
        await fs.copyFile(
          path.join("img", imgFile),
          path.join(outputPath, "img", imgFile)
        );
      }
    }
    
    await this.postmaster.build();
  }

  /**
   * Enhanced buildSinglePages method with better permalink support
   * Creates individual pages for ALL post types including photos and short posts
   */
  async buildSinglePages() {
    console.log(`Building individual permalinks for ${this.postmaster.all.length} posts...`);
    
    for (let i = 0; i < this.postmaster.all.length; i++) {
      const currentPost = this.postmaster.all[i];
      
      // Create directory structure based on date path
      const postDir = path.join(outputPath, 'posts', currentPost.path);
      await fs.ensureDir(postDir);
      
      console.log(`Building permalink for ${currentPost.type} post: ${currentPost.slug}`);
      
      // Navigation setup
      let footerPrevious, footerNext;
      
      if (i === 0) {
        // First post - only show next
        if (this.postmaster.all.length > 1) {
          footerNext = path.join(
            "/posts",
            this.postmaster.all[i + 1].path,
            this.postmaster.all[i + 1].slug
          );
        }
      } else if (i > 0 && i < this.postmaster.all.length - 1) {
        // Middle posts - show both previous and next
        footerPrevious = path.join(
          "/posts",
          this.postmaster.all[i - 1].path,
          this.postmaster.all[i - 1].slug
        );
        footerNext = path.join(
          "/posts",
          this.postmaster.all[i + 1].path,
          this.postmaster.all[i + 1].slug
        );
      } else {
        // Last post - only show previous
        footerPrevious = path.join(
          "/posts",
          this.postmaster.all[i - 1].path,
          this.postmaster.all[i - 1].slug
        );
      }

      // Create body bag for the individual post
      const singleBodyBag = [
        {
          title: currentPost.title,
          dateCreated: currentPost.dateCreated,
          dateTime: currentPost.dateTime,
          body: currentPost.body,
          href: path.join("/posts", currentPost.path, currentPost.slug),
        },
      ];

      // Determine page title
      let pageTitle = 'T'; // Default
      if (currentPost.title) {
        pageTitle = currentPost.title;
      } else {
        // Provide meaningful titles for posts without explicit titles
        const postDate = moment(currentPost.dateCreated || currentPost.dateTime).format('MMMM Do, YYYY');
        switch (currentPost.type) {
          case 'photo':
            pageTitle = `Photo from ${postDate}`;
            break;
          case 'short':
            pageTitle = `Post from ${postDate}`;
            break;
          default:
            pageTitle = `Post from ${postDate}`;
        }
      }

      // Create the individual post page
      const singlePage = new Page({
        title: pageTitle,
        bodyBag: singleBodyBag,
        footerPrevious,
        footerNext,
        fileName: currentPost.slug,
        fileDir: postDir,
      });
      
      await singlePage.savePage();
      
      // Track created permalink for verification
      const permalinkPath = path.join(postDir, `${currentPost.slug}.html`);
      const urlPath = path.join("/posts", currentPost.path, currentPost.slug);
      
      this.createdPermalinks.push({
        type: currentPost.type,
        title: currentPost.title || '(no title)',
        filePath: permalinkPath,
        urlPath: urlPath,
        slug: currentPost.slug
      });
      
      console.log(`✓ Created ${currentPost.type} permalink: ${urlPath}`);
    }
    
    // Summary of created permalinks
    console.log('\n=== PERMALINK SUMMARY ===');
    const typeCount = this.createdPermalinks.reduce((acc, link) => {
      acc[link.type] = (acc[link.type] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(`${type}: ${count} permalinks created`);
    });
    
    // Show some examples
    console.log('\n=== EXAMPLE PERMALINKS ===');
    ['photo', 'short', 'long'].forEach(type => {
      const example = this.createdPermalinks.find(link => link.type === type);
      if (example) {
        console.log(`${type}: ${example.urlPath}`);
      }
    });
  }

  /**
   * Enhanced buildMultiPages with improved post type handling
   */
  async buildMultiPages() {
    let archive = "";
    
    for (let pageTypeCounter = 0; pageTypeCounter < pageTypes.length; pageTypeCounter++) {
      const postType = pageTypes[pageTypeCounter];
      let bodyBag = [];
      let pagesCounter = 0;
      let postsCounter = 0;

      if (this.postmaster[postType] && this.postmaster[postType].length > 0) {
        console.log(`Building ${postType} collection pages...`);
        
        for (let totalPostCounter = 0; totalPostCounter < this.postmaster[postType].length; totalPostCounter++) {
          const currentPost = this.postmaster[postType][totalPostCounter];
          
          bodyBag.push({
            title: currentPost.title,
            dateCreated: currentPost.dateCreated,
            dateTime: currentPost.dateTime,
            body: currentPost.body,
            href: path.join("/posts", currentPost.path, currentPost.slug), // Link to individual permalink
          });

          // Build archive (only for titled posts that aren't short posts)
          if (postType === "all" && currentPost.type !== "short" && currentPost.title !== "") {
            let displayDate;
            if (currentPost.dateCreated) {
              displayDate = new Date(currentPost.dateCreated);
            } else if (currentPost.dateTime) {
              displayDate = new Date(currentPost.dateTime);
            } else {
              displayDate = new Date();
            }
            
            const postTitle = currentPost.title || '';
            archive += `${moment(displayDate).format("MMMM Do YYYY")}: [${postTitle}](${path.join("/posts", currentPost.path, currentPost.slug)})\n\n`;
          }

          // Create page when we hit 10 posts or reach the end
          if (postsCounter === 9 || totalPostCounter + 1 === this.postmaster[postType].length) {
            let footerNext, footerPrevious, fileName;

            if (pagesCounter === 0) {
              if (this.postmaster[postType].length > 10) {
                footerPrevious = `/posts/${postType}/1`;
              }
              fileName = `${postType}`;
            } else {
              // Handle pagination
              if (totalPostCounter + 1 < this.postmaster[postType].length) {
                footerPrevious = `/posts/${postType}/${pagesCounter + 1}`;
              }
              if (pagesCounter === 1) {
                footerNext = `/posts/${postType}/${postType}`;
              } else if (pagesCounter > 1) {
                footerNext = `/posts/${postType}/${pagesCounter - 1}`;
              }
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
            console.log(`✓ Created ${postType} page ${fileName} with ${bodyBag.length} posts`);
            
            postsCounter = 0;
            pagesCounter++;
            bodyBag = [];
          } else {
            postsCounter++;
          }
        }
      }
    }

    // Create archive page
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
    console.log("✓ Created archive page");
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
    console.log("✓ Created about page");
  }
  
  async buildRSSFeeds() {
    try {
      console.log('Generating RSS feeds...');
      
      const rssGenerator = new RSSGenerator({
        siteUrl: 'https://thomascbullock.com',
        siteTitle: 'T',
        siteDescription: 'Thomas C. Bullock\'s Blog',
        outputDir: path.join(outputPath, 'feeds'),
        postmaster: this.postmaster,
        useBlankTitles: true
      });
      
      const result = await rssGenerator.generateAllFeeds();
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
    console.log("✓ Setup complete");
    
    await this.buildSinglePages();
    console.log("✓ Individual permalinks complete");
    
    await this.buildMultiPages();
    console.log("✓ Collection pages complete");
    
    await this.buildAboutPage();
    console.log("✓ About page complete");
    
    await this.buildRSSFeeds();
    console.log('✓ RSS feeds complete');
    
    // Final summary
    console.log('\n=== BUILD COMPLETE ===');
    console.log(`Total permalinks created: ${this.createdPermalinks.length}`);
    console.log('All post types (including photos and short posts) now have individual permalinks');
  }
}

module.exports = Website;