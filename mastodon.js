/**
 * Mastodon cross-posting module
 * Posts blog content to Mastodon based on post type
 */
const axios = require('axios');
const FormData = require('form-data');

const MASTODON_INSTANCE = process.env.MASTODON_INSTANCE;
const MASTODON_ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;
const MASTODON_CHAR_LIMIT = 500;

/**
 * Check if Mastodon is configured
 * @returns {boolean}
 */
function isConfigured() {
  return !!(MASTODON_INSTANCE && MASTODON_ACCESS_TOKEN);
}

/**
 * Upload media to Mastodon
 * @param {Buffer} imageBuffer - Image data
 * @param {string} mimeType - MIME type of the image
 * @param {string} description - Alt text for the image
 * @returns {Promise<string>} Media ID
 */
async function uploadMedia(imageBuffer, mimeType, description = '') {
  const form = new FormData();
  form.append('file', imageBuffer, {
    filename: 'image.jpg',
    contentType: mimeType || 'image/jpeg'
  });
  if (description) {
    form.append('description', description);
  }

  const response = await axios.post(
    `${MASTODON_INSTANCE}/api/v2/media`,
    form,
    {
      headers: {
        'Authorization': `Bearer ${MASTODON_ACCESS_TOKEN}`,
        ...form.getHeaders()
      }
    }
  );

  // v2 media endpoint may return 202 for async processing
  // The media ID is still returned and can be used
  return response.data.id;
}

/**
 * Post a status to Mastodon
 * @param {string} status - The status text
 * @param {string[]} mediaIds - Optional array of media IDs to attach
 * @returns {Promise<Object>} The created status
 */
async function postStatus(status, mediaIds = []) {
  const payload = { status };
  if (mediaIds.length > 0) {
    payload.media_ids = mediaIds;
  }

  const response = await axios.post(
    `${MASTODON_INSTANCE}/api/v1/statuses`,
    payload,
    {
      headers: {
        'Authorization': `Bearer ${MASTODON_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

/**
 * Generate permalink URL for a post
 * @param {Object} post - Post object with dateCreated and slug
 * @returns {string} Full URL to the post
 */
function getPermalink(post) {
  const date = new Date(post.dateCreated);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `https://thomascbullock.com/posts/${year}/${month}/${day}/${post.slug}`;
}

/**
 * Cross-post a blog post to Mastodon
 * @param {Object} options - Post options
 * @param {string} options.type - Post type: 'short', 'long', or 'photo'
 * @param {string} options.title - Post title (may be empty)
 * @param {string} options.content - Post content (markdown)
 * @param {Date} options.dateCreated - Post creation date
 * @param {string} options.slug - Post slug for permalink
 * @param {Buffer} [options.imageBuffer] - Image data for photo posts
 * @param {string} [options.imageMimeType] - Image MIME type
 * @returns {Promise<Object|null>} Mastodon status object or null if not configured
 */
async function crossPost(options) {
  if (!isConfigured()) {
    console.warn('Mastodon not configured, skipping cross-post');
    return null;
  }

  const { type, title, content, dateCreated, slug, imageBuffer, imageMimeType } = options;
  const permalink = getPermalink({ dateCreated, slug });

  try {
    let statusText;
    let mediaIds = [];

    if (type === 'photo' && imageBuffer) {
      // Photo post: upload image and post with caption
      console.log('Uploading image to Mastodon...');
      const mediaId = await uploadMedia(imageBuffer, imageMimeType, title || 'Photo');
      mediaIds.push(mediaId);

      // Use title or content as caption, or just empty
      if (title) {
        statusText = title;
      } else if (content && !content.startsWith('![')) {
        // Use content if it's not just the image markdown
        statusText = content.replace(/!\[.*?\]\(.*?\)/g, '').trim();
      }

      // Add permalink
      if (statusText) {
        statusText = `${statusText}\n\n${permalink}`;
      } else {
        statusText = permalink;
      }

    } else if (type === 'long' || content.length > MASTODON_CHAR_LIMIT) {
      // Long post: title + link
      if (title) {
        statusText = `${title}\n\n${permalink}`;
      } else {
        statusText = permalink;
      }

    } else {
      // Short post: full content
      statusText = content;

      // Add permalink if there's room
      const withLink = `${content}\n\n${permalink}`;
      if (withLink.length <= MASTODON_CHAR_LIMIT) {
        statusText = withLink;
      }
    }

    // Truncate if still too long (shouldn't happen but just in case)
    if (statusText.length > MASTODON_CHAR_LIMIT) {
      statusText = statusText.substring(0, MASTODON_CHAR_LIMIT - 3) + '...';
    }

    console.log(`Posting to Mastodon (${type}): ${statusText.substring(0, 50)}...`);
    const result = await postStatus(statusText, mediaIds);
    console.log(`Mastodon post created: ${result.url}`);

    return result;

  } catch (error) {
    console.error('Error posting to Mastodon:', error.response?.data || error.message);
    // Don't throw - we don't want to fail the blog post
    return null;
  }
}

module.exports = {
  isConfigured,
  crossPost,
  uploadMedia,
  postStatus
};
