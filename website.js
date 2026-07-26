/* eslint-disable no-restricted-syntax */
const fs = require("fs-extra");
const path = require("path");
const moment = require("moment");
const md = require("markdown-it")({
  html: true,
  linkify: true,
  typographer: true,
});
const Postmaster = require("./postMaster");
const Page = require("./page_template_new");
const RSSGenerator = require('./rssGenerator');

const outputPath = "./build";
const pageTypes = ["long", "short", "photo", "all"];
const POSTS_PER_PAGE = 10;

class Website {
  constructor() {
    this.postmaster = new Postmaster();
    this.createdPermalinks = [];
  }

  // Ensure the on-disk tree matches what the renderers expect. Called by both
  // full and incremental builds; safe to run multiple times.
  async ensureDirs() {
    await fs.ensureDir(outputPath);
    await fs.ensureDir(path.join(outputPath, "css"));
    for (const t of pageTypes) {
      await fs.ensureDir(path.join(outputPath, "posts", t));
    }
    await fs.ensureDir(path.join(outputPath, "feeds"));
  }

  async copyStaticAssets() {
    await fs.copyFile("reset.css", path.join(outputPath, "css", "reset.css"));
    await fs.copyFile("style.css", path.join(outputPath, "css", "style.css"));
  }

  async loadPosts() {
    await this.postmaster.build();
  }

  // Full-build setup: nuke build/ and start fresh.
  async setup() {
    await fs.ensureDir(outputPath);
    for (const file of fs.readdirSync(outputPath)) {
      await fs.remove(path.join(outputPath, file));
    }
    await this.ensureDirs();
    await this.copyStaticAssets();
    await this.loadPosts();
  }

  // Build the permalink page for the post at position i in postmaster.all.
  async buildSinglePageAt(i) {
    const posts = this.postmaster.all;
    const currentPost = posts[i];

    const postDir = path.join(outputPath, 'posts', currentPost.path);
    await fs.ensureDir(postDir);

    let footerPrevious;
    let footerNext;

    if (i > 0) {
      footerPrevious = path.join(
        "/posts",
        posts[i - 1].path,
        posts[i - 1].slug
      );
    }
    if (i < posts.length - 1) {
      footerNext = path.join(
        "/posts",
        posts[i + 1].path,
        posts[i + 1].slug
      );
    }

    const singleBodyBag = [
      {
        title: currentPost.title,
        dateCreated: currentPost.dateCreated,
        dateTime: currentPost.dateTime,
        body: currentPost.body,
        href: path.join("/posts", currentPost.path, currentPost.slug),
      },
    ];

    let pageTitle = 'T';
    if (currentPost.title) {
      pageTitle = currentPost.title;
    } else {
      const postDate = moment(currentPost.dateCreated || currentPost.dateTime).format('MMMM Do, YYYY');
      switch (currentPost.type) {
        case 'photo':
          pageTitle = `Photo from ${postDate}`;
          break;
        default:
          pageTitle = `Post from ${postDate}`;
      }
    }

    const singlePage = new Page({
      title: pageTitle,
      bodyBag: singleBodyBag,
      footerPrevious,
      footerNext,
      fileName: currentPost.slug,
      fileDir: postDir,
    });
    await singlePage.savePage();

    this.createdPermalinks.push({
      type: currentPost.type,
      title: currentPost.title || '(no title)',
      filePath: path.join(postDir, `${currentPost.slug}.html`),
      urlPath: path.join("/posts", currentPost.path, currentPost.slug),
      slug: currentPost.slug,
    });
  }

  async buildSinglePages() {
    console.log(`Building individual permalinks for ${this.postmaster.all.length} posts...`);
    for (let i = 0; i < this.postmaster.all.length; i++) {
      await this.buildSinglePageAt(i);
    }

    const typeCount = this.createdPermalinks.reduce((acc, link) => {
      acc[link.type] = (acc[link.type] || 0) + 1;
      return acc;
    }, {});
    console.log('=== PERMALINK SUMMARY ===');
    for (const [type, count] of Object.entries(typeCount)) {
      console.log(`${type}: ${count} permalinks created`);
    }
  }

  // Build all paginated collection pages for one type ('long', 'short', 'photo', 'all').
  async buildTypeCollection(postType) {
    const posts = this.postmaster[postType];
    if (!posts || posts.length === 0) return;

    const pageDir = path.join(outputPath, "posts", postType);
    const pageCount = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));

    for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
      const slice = posts.slice(pageIdx * POSTS_PER_PAGE, (pageIdx + 1) * POSTS_PER_PAGE);

      const bodyBag = slice.map((post) => ({
        title: post.title,
        dateCreated: post.dateCreated,
        dateTime: post.dateTime,
        body: post.body,
        href: path.join("/posts", post.path, post.slug),
      }));

      // File naming: page 0 → /posts/<type>/<type>.html, page N → /posts/<type>/<N>.html.
      // Footer "Previous" points to older content (higher page number); "Next" to newer.
      const fileName = pageIdx === 0 ? postType : `${pageIdx}`;
      let footerPrevious;
      let footerNext;
      if (pageIdx + 1 < pageCount) {
        footerPrevious = `/posts/${postType}/${pageIdx + 1}`;
      }
      if (pageIdx === 1) {
        footerNext = `/posts/${postType}/${postType}`;
      } else if (pageIdx > 1) {
        footerNext = `/posts/${postType}/${pageIdx - 1}`;
      }

      const pageOfPosts = new Page({
        title: "T",
        bodyBag,
        footerPrevious,
        footerNext,
        fileName,
        fileDir: pageDir,
      });
      await pageOfPosts.savePage();
      console.log(`✓ Created ${postType} page ${fileName} with ${bodyBag.length} posts`);
    }
  }

  async buildMultiPages() {
    for (const postType of pageTypes) {
      if (this.postmaster[postType] && this.postmaster[postType].length > 0) {
        console.log(`Building ${postType} collection pages...`);
        await this.buildTypeCollection(postType);
      }
    }
    await this.buildArchive();
  }

  // Archive lists every titled non-short post. Cheap to regenerate.
  async buildArchive() {
    let archive = '';
    for (const post of this.postmaster.all) {
      if (post.type === 'short' || !post.title) continue;
      const displayDate = new Date(post.dateCreated || post.dateTime || Date.now());
      archive += `${moment(displayDate).format("MMMM Do YYYY")}: [${post.title}](${path.join("/posts", post.path, post.slug)})\n\n`;
    }

    const archiveBag = [{
      title: "Archive",
      dateTime: Date.now(),
      body: md.render(archive),
      href: `/posts/archive`,
      noDate: true,
    }];
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
    const aboutBody = await fs.readFile('./about.md');
    const aboutBodyBag = [{
      title: "About",
      dateTime: Date.now(),
      body: md.render(aboutBody.toString()),
      href: "/posts/about",
      noDate: true,
    }];
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
        siteDescription: "Thom Bullock's Blog",
        outputDir: path.join(outputPath, 'feeds'),
        postmaster: this.postmaster,
        useBlankTitles: true,
      });

      const result = await rssGenerator.generateAllFeeds();
      const jsonFeedPath = await rssGenerator.generateJsonFeed();

      console.log('RSS feeds generated:');
      result.feeds.forEach((feed) => {
        console.log(`- ${feed.type}: ${feed.path} (${feed.count} posts)`);
      });
      console.log(`- JSON Feed: ${jsonFeedPath}`);

      // .htaccess is a no-op under Express; retained for parity with the
      // previous build in case anything downstream depends on its presence.
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

  /**
   * Incremental rebuild after a single post was created, edited, or deleted.
   *
   * Rewrites just the pages that can be affected: the post's permalink and
   * its immediate neighbors (whose prev/next links point at it), plus the
   * paginated collection pages for the affected type + 'all', plus the
   * archive and RSS feeds.
   *
   * For deletes, pass dateCreated so we can locate the post's former
   * position (the post is already gone from disk by then).
   *
   * Does NOT rebuild every permalink, does NOT touch build/img/, does NOT
   * re-copy CSS. Falls back to fullBuild() on any error.
   *
   * @param {Object} opts
   * @param {string} opts.postId
   * @param {'save'|'delete'} opts.op
   * @param {Date|string} [opts.dateCreated] - required for delete
   * @param {string} [opts.type] - required for delete (the deleted post's type)
   */
  async updateForPost({ postId, op, dateCreated, type }) {
    try {
      await this.ensureDirs();
      await this.loadPosts();

      const all = this.postmaster.all;
      const affectedIndices = new Set();
      const affectedTypes = new Set(['all']);
      let deletedPost = null;

      if (op === 'save') {
        const idx = all.findIndex((p) => p.postid === postId);
        if (idx === -1) {
          console.warn(`[incremental] postId ${postId} not found after save; falling back to full build`);
          await this.orchestrate();
          return;
        }
        if (idx > 0) affectedIndices.add(idx - 1);
        affectedIndices.add(idx);
        if (idx < all.length - 1) affectedIndices.add(idx + 1);
        affectedTypes.add(all[idx].type);
      } else if (op === 'delete') {
        // Find the two posts that now sit on either side of the deleted post's
        // former position. Posts are sorted newest-first.
        if (!dateCreated) {
          console.warn('[incremental] delete without dateCreated; falling back to full build');
          await this.orchestrate();
          return;
        }
        const deletedTime = new Date(dateCreated).getTime();
        // Find first post older than the deleted one (its new "next" neighbor).
        const nextIdx = all.findIndex((p) => {
          const t = new Date(p.dateCreated || p.dateTime).getTime();
          return t < deletedTime;
        });
        if (nextIdx > 0) affectedIndices.add(nextIdx - 1);
        if (nextIdx !== -1) affectedIndices.add(nextIdx);
        // If deleted post was the newest, nextIdx is 0 and only newIdx=0's prev changes.
        // If deleted post was the oldest, nextIdx is -1 and we add the last post below.
        if (nextIdx === -1 && all.length > 0) affectedIndices.add(all.length - 1);

        // The deleted post's type-specific collection page must be rebuilt so
        // the deleted post disappears from it.
        if (type) affectedTypes.add(type);

        // Also nuke the orphan permalink file from disk. We can't know its
        // slug/date-path without the post, but the caller-loaded Post is gone.
        // The full rebuild fallback would recreate the build/ dir clean; we
        // just leave the orphan file here. It's harmless — nothing links to it
        // now that the collection pages and feeds no longer reference it.
        // (A future full build will remove it via setup()'s nuke step.)
      } else {
        throw new Error(`Unknown op: ${op}`);
      }

      for (const i of affectedIndices) {
        await this.buildSinglePageAt(i);
        console.log(`[incremental] rewrote permalink at position ${i}`);
      }

      for (const t of affectedTypes) {
        if (this.postmaster[t] && this.postmaster[t].length > 0) {
          await this.buildTypeCollection(t);
        }
      }

      await this.buildArchive();
      await this.buildRSSFeeds();

      console.log(`[incremental] update complete (${op} ${postId})`);
    } catch (error) {
      console.error('[incremental] failed, falling back to full build:', error);
      await this.orchestrate();
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

    console.log('\n=== BUILD COMPLETE ===');
    console.log(`Total permalinks created: ${this.createdPermalinks.length}`);
  }
}

module.exports = Website;
