const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');
const multer = require('multer');

const { createApiAuth } = require('../lib/apiAuth');
const { buildSite, updateForPost } = require('../lib/build');
const Post = require('../post');
const MediaObject = require('../mediaObject');
const mastodon = require('../mastodon');
const { getRecentPosts } = require('../getRecentPosts');
const { getCategories } = require('../getCategories');
const { getApod } = require('../getApod');

// Load the posting page HTML once at startup.
const POST_PAGE_HTML = fs.readFileSync(
  path.join(__dirname, '..', 'views', 'post.html'),
  'utf8'
);

// Extract the URL of the first image in a Markdown string.
function extractFirstImageUrl(text) {
  if (!text) return null;
  const match = text.match(/!\[.*?\]\(([^\s\)]+)\)/);
  return match ? match[1] : null;
}

// Strip basic Markdown syntax and return a short plain-text preview.
function makePreview(text, maxLen = 120) {
  if (!text) return '';
  const stripped = text
    .replace(/!\[.*?\]\(.*?\)/g, '')          // remove images
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // links → label text
    .replace(/<!--[\s\S]*?-->/g, '')           // HTML comments
    .replace(/^#{1,6}\s+/gm, '')              // headings
    .replace(/[*_`~]/g, '')                   // bold/italic/code/strike
    .replace(/\n+/g, ' ')                     // collapse newlines
    .trim();
  if (stripped.length <= maxLen) return stripped;
  return stripped.slice(0, maxLen).trimEnd() + '…';
}

function createApiRouter() {
  const router = express.Router();
  const apiAuth = createApiAuth();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });

  // Mobile posting page (protected).
  router.get('/post', apiAuth, (req, res) => {
    res.type('html').send(POST_PAGE_HTML);
  });

  // Health check.
  router.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Photo upload + post creation.
  router.post('/api/upload-photo', apiAuth, upload.single('photo'), async (req, res) => {
    const startTime = Date.now();
    const log = (msg) => console.log(`[upload-photo] ${msg} (+${Date.now() - startTime}ms)`);

    try {
      const title = req.body.title || '';
      const caption = req.body.caption || '';
      const category = req.body.category || 'photo';
      const dateCreated = req.body.date ? new Date(req.body.date) : new Date();

      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No photo provided' });
      }

      log(`Received ${req.file.originalname} (${Math.round(req.file.size / 1024)} KB)`);

      const imageOptions = {
        maxWidth: parseInt(req.body.maxWidth, 10) || 1200,
        maxHeight: parseInt(req.body.maxHeight, 10) || 1200,
        quality: parseInt(req.body.quality, 10) || 80,
        convertToJpg: req.body.convertToJpg !== 'false',
        processImages: true,
      };

      const fileExt = path.extname(req.file.originalname) || '.jpg';
      const fileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${fileExt}`;

      const mediaObject = new MediaObject(
        { name: fileName, bits: req.file.buffer, type: req.file.mimetype || 'image/jpeg' },
        imageOptions
      );
      const mediaResult = await mediaObject.save();
      log(`Image processed and saved: ${mediaResult.name}`);

      let markdown = `![${title || 'Photo'}](${mediaResult.url})`;
      if (caption) {
        markdown += `\n\n${caption}`;
      }
      markdown += `\n\n<!-- Image: ${mediaResult.name} | Size: ${Math.round(mediaResult.size / 1024)} KB | Type: ${mediaResult.type} -->`;

      const post = new Post({
        description: markdown,
        title,
        categories: [category],
        dateCreated,
      });
      const postId = await post.save();
      log(`Post saved: ${postId}`);

      res.json({
        success: true,
        postId,
        imageUrl: mediaResult.url,
        title,
        imageInfo: {
          name: mediaResult.name,
          size: mediaResult.size,
          type: mediaResult.type,
          width: imageOptions.maxWidth,
          height: imageOptions.maxHeight,
          processed: mediaResult.processed,
        },
        message: 'Photo uploaded and post created. Site rebuild in progress.',
      });
      log('Response sent to client');

      (async () => {
        try {
          await updateForPost({ postId, op: 'save' });
          log('Site rebuilt (incremental)');

          const mastodonResult = await mastodon.crossPost({
            type: 'photo',
            title,
            content: caption,
            dateCreated,
            slug: post.slug,
            imageBuffer: req.file.buffer,
            imageMimeType: req.file.mimetype,
          });
          if (mastodonResult) {
            log(`Mastodon post created: ${mastodonResult.url}`);
          }
        } catch (bgError) {
          console.error('[upload-photo] Background task error:', bgError);
        }
      })();
    } catch (error) {
      console.error('Error handling mobile upload:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'An unknown error occurred',
      });
    }
  });

  // Image upload only — returns URL, doesn't create a post. Used by the iOS app.
  router.post('/api/upload-image', apiAuth, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image provided' });
      }
      const fileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
      const mediaObject = new MediaObject(
        { name: fileName, bits: req.file.buffer, type: req.file.mimetype || 'image/jpeg' },
        { maxWidth: 1500, maxHeight: 1500, quality: 80 }
      );
      const result = await mediaObject.save();
      res.json({ success: true, url: result.url });
    } catch (error) {
      console.error('Error uploading image:', error);
      res.status(500).json({ success: false, error: error.message || 'Upload failed' });
    }
  });

  // Create a text post.
  router.post('/api/create-text-post', apiAuth, async (req, res) => {
    const startTime = Date.now();
    const log = (msg) => console.log(`[create-text-post] ${msg} (+${Date.now() - startTime}ms)`);

    try {
      const { title, content, category, date } = req.body;

      if (!content) {
        return res.status(400).json({ success: false, error: 'Content is required' });
      }

      log('Request received');

      const postTitle = title == null ? '' : title;
      const postCategory = category || 'short';
      const dateCreated = date ? new Date(date) : new Date();

      const post = new Post({
        description: content,
        title: postTitle,
        categories: [postCategory],
        dateCreated,
      });
      const postId = await post.save();
      log(`Post saved: ${postId}`);

      res.json({
        success: true,
        postId,
        message: 'Text post created. Site rebuild in progress.',
        title: postTitle,
        category: postCategory,
        date: dateCreated.toISOString(),
      });
      log('Response sent to client');

      (async () => {
        try {
          await updateForPost({ postId, op: 'save' });
          log('Site rebuilt (incremental)');

          const mastodonResult = await mastodon.crossPost({
            type: postCategory,
            title: postTitle,
            content,
            dateCreated,
            slug: post.slug,
          });
          if (mastodonResult) {
            log(`Mastodon post created: ${mastodonResult.url}`);
          }
        } catch (bgError) {
          console.error('[create-text-post] Background task error:', bgError);
        }
      })();
    } catch (error) {
      console.error('Error creating text post:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'An unknown error occurred',
      });
    }
  });

  // Categories.
  router.get('/api/categories', apiAuth, async (req, res) => {
    try {
      const categories = await getCategories([null, process.env.BLOG_USER, process.env.BLOG_PW]);
      res.json({
        success: true,
        categories: categories.map((cat) => cat.categoryName),
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'An unknown error occurred',
      });
    }
  });

  // Recent posts.
  router.get('/api/recent-posts', apiAuth, async (req, res) => {
    try {
      const count = parseInt(req.query.count, 10) || 5;
      const posts = await getRecentPosts([null, process.env.BLOG_USER, process.env.BLOG_PW, count]);

      const simplifiedPosts = posts.map((post) => ({
        id: post.postid,
        title: post.title,
        date: post.dateCreated,
        category: post.categories[0],
        link: post.link,
        preview: makePreview(post.description),
        thumbnail: extractFirstImageUrl(post.description),
      }));

      res.json({ success: true, posts: simplifiedPosts });
    } catch (error) {
      console.error('Error fetching recent posts:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'An unknown error occurred',
      });
    }
  });

  // Load a single post for editing.
  router.get('/api/post/:id', apiAuth, async (req, res) => {
    try {
      const post = await Post.loadById(req.params.id);
      res.json({
        success: true,
        post: {
          id: post.postid,
          title: post.title,
          content: post.description,
          category: post.categories[0],
          date: post.dateCreated,
        },
      });
    } catch (error) {
      console.error('Error fetching post:', error);
      res.status(404).json({
        success: false,
        error: error.message || 'Post not found',
      });
    }
  });

  // Update an existing post.
  router.put('/api/edit-post/:id', apiAuth, async (req, res) => {
    try {
      const postId = req.params.id;
      const { title, content, category } = req.body;

      if (!content) {
        return res.status(400).json({ success: false, error: 'Content is required' });
      }

      const existingPost = await Post.loadById(postId);

      const post = new Post({
        postid: postId,
        title: title || '',
        description: content,
        categories: [category || existingPost.categories[0]],
        dateCreated: existingPost.dateCreated,
      });
      await post.save();

      await updateForPost({ postId, op: 'save' });

      res.json({
        success: true,
        postId,
        message: 'Post updated successfully',
        title: title || '',
        category: category || existingPost.categories[0],
      });
    } catch (error) {
      console.error('Error updating post:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'An unknown error occurred',
      });
    }
  });

  // Delete a post.
  router.delete('/api/delete-post/:id', apiAuth, async (req, res) => {
    try {
      const post = await Post.loadById(req.params.id);
      const dateCreated = post.dateCreated;
      const type = post.categories[0];
      await post.delete();

      await updateForPost({ postId: req.params.id, op: 'delete', dateCreated, type });

      res.json({ success: true, message: 'Post deleted successfully' });
    } catch (error) {
      console.error('Error deleting post:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'An unknown error occurred',
      });
    }
  });

  // APOD (NASA Astronomy Picture of the Day).
  router.get('/api/apod', async (req, res) => {
    console.log('made it to apod handler');
    try {
      const apodResponse = await getApod();
      await buildSite();
      res.send(apodResponse);
    } catch (error) {
      console.error('Error getting APOD', error);
      res.status(500).json({
        success: false,
        error: error.message || 'An unknown error occurred',
      });
    }
  });

  return router;
}

module.exports = { createApiRouter };
