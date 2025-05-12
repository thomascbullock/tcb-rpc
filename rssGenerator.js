/**
 * RSS Generator for thomascbullock.com
 * Generates RSS feeds for different post categories
 * Includes fix for development mode to prevent continuous rebuilds
 * Handles blank titles without adding "Untitled"
 */
const fs = require('fs-extra');
const path = require('path');
const RSS = require('rss');
const moment = require('moment');
const { promisify } = require('util');
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

/**
 * RSS Generator class
 */
class RSSGenerator {
  /**
   * Create a new RSS Generator
   * @param {Object} options - Configuration options
   * @param {string} options.siteUrl - Base URL of the site
   * @param {string} options.siteTitle - Title of the site
   * @param {string} options.siteDescription - Description of the site
   * @param {string} options.language - Language of the site (default: 'en')
   * @param {string} options.outputDir - Directory to write feed files
   * @param {Object} options.postmaster - Postmaster instance with posts
   * @param {boolean} options.useBlankTitles - Keep titles blank instead of using fallbacks (default: false)
   */
  constructor(options) {
    this.siteUrl = options.siteUrl || 'https://thomascbullock.com';
    this.siteTitle = options.siteTitle || 'T';
    this.siteDescription = options.siteDescription || 'Thomas C. Bullock\'s Blog';
    this.language = options.language || 'en';
    this.outputDir = options.outputDir || './build/feeds';
    this.postmaster = options.postmaster;
    this.feedTypes = ['all', 'long', 'short', 'photo'];
    this.imageUrl = `${this.siteUrl}/img/logo.jpg`;
    this.useBlankTitles = options.useBlankTitles || false;
  }

  /**
   * Get a stable publication date
   * Uses a fixed date in development mode to prevent continuous rebuilds
   * @returns {Date} Publication date
   */
  getPubDate() {
    // Check if we're in development mode
    const isDev = process.env.NODE_ENV === 'development';
    
    if (isDev) {
      // In development, use a fixed date to prevent rebuilds
      return new Date('2025-01-01T12:00:00Z');
    } else {
      // In production, use the current date
      return new Date();
    }
  }

  /**
   * Get a stable feed ID based on content hash
   * @param {string} type - Feed type
   * @returns {string} Feed ID
   */
  getFeedId(type) {
    return `tcb-${type}-feed`;
  }

  /**
   * Process post title based on options
   * @param {Object} post - Post object
   * @param {Date} pubDate - Publication date
   * @returns {string} Processed title
   */
  processTitle(post, pubDate) {
    // If post has a title, use it
    if (post.title) {
      return post.title;
    }
    
    // If blank titles option is enabled, return empty string
    if (this.useBlankTitles) {
      return '';
    }
    
    // Otherwise use date-based fallback
    return `Post from ${moment(pubDate).format('MMMM Do, YYYY')}`;
  }

  /**
   * Generate all RSS feeds
   * @returns {Promise<Object>} Result object with feed paths
   */
  async generateAllFeeds() {
    try {
      // Ensure output directory exists
      await fs.ensureDir(this.outputDir);
      
      // Track results
      const results = {
        feeds: []
      };
      
      // Generate feed for each type
      for (const type of this.feedTypes) {
        if (this.postmaster[type] && this.postmaster[type].length > 0) {
          const feedPath = await this.generateFeed(type);
          results.feeds.push({
            type,
            path: feedPath,
            count: this.postmaster[type].length
          });
        }
      }
      
      // Also generate a combined feed as index.xml
      await this.generateMainFeed();
      results.feeds.push({
        type: 'main',
        path: path.join(this.outputDir, 'index.xml'),
        count: this.postmaster.all.length
      });
      
      return results;
    } catch (error) {
      console.error('Error generating RSS feeds:', error);
      throw error;
    }
  }

  /**
   * Generate RSS feed for a specific post type
   * @param {string} type - Post type ('all', 'long', 'short', 'photo')
   * @returns {Promise<string>} Path to the generated feed file
   */
  async generateFeed(type) {
    try {
      if (!this.postmaster[type]) {
        throw new Error(`Invalid post type: ${type}`);
      }
      
      // Create new RSS feed
      const feed = new RSS({
        title: `${this.siteTitle} - ${type.charAt(0).toUpperCase() + type.slice(1)} Posts`,
        description: `${this.siteDescription} - ${type} posts feed`,
        feed_url: `${this.siteUrl}/feeds/rss-${type}.xml`,
        site_url: this.siteUrl,
        image_url: this.imageUrl,
        language: this.language,
        pubDate: this.getPubDate(), // Use stable date method
        ttl: 60 // Time to live in minutes
      });
      
      // Add items to feed
      const posts = this.postmaster[type];
      
      for (const post of posts) {
        // Create post URL from path and slug
        const postUrl = path.join(
          this.siteUrl,
          'posts',
          post.path,
          post.slug
        ).replace(/\\/g, '/');
        
        // Get post date
        let pubDate;
        if (post.dateCreated) {
          pubDate = new Date(post.dateCreated);
        } else if (post.dateTime) {
          pubDate = new Date(post.dateTime);
        } else {
          pubDate = new Date();
        }
        
        // Process title (blank or with content)
        const title = this.processTitle(post, pubDate);
        
        // Add post to feed
        feed.item({
          title: title,
          description: post.body,
          url: postUrl,
          guid: post.postid || postUrl,
          categories: [post.type],
          date: pubDate,
          custom_elements: [
            { 'content:encoded': { _cdata: post.body } }
          ]
        });
      }
      
      // Generate XML
      const xml = feed.xml({ indent: true });
      
      // Write to file
      const outputPath = path.join(this.outputDir, `rss-${type}.xml`);
      await writeFileAsync(outputPath, xml);
      
      return outputPath;
    } catch (error) {
      console.error(`Error generating ${type} feed:`, error);
      throw error;
    }
  }

  /**
   * Generate main RSS feed (index.xml)
   * @returns {Promise<string>} Path to the generated feed file
   */
  async generateMainFeed() {
    try {
      // Create new RSS feed
      const feed = new RSS({
        title: this.siteTitle,
        description: this.siteDescription,
        feed_url: `${this.siteUrl}/feeds/index.xml`,
        site_url: this.siteUrl,
        image_url: this.imageUrl,
        language: this.language,
        pubDate: this.getPubDate(), // Use stable date method
        ttl: 60 // Time to live in minutes
      });
      
      // Add items to feed (use all posts, limited to 20)
      const posts = this.postmaster.all.slice(0, 20);
      
      for (const post of posts) {
        // Create post URL from path and slug
        const postUrl = path.join(
          this.siteUrl,
          'posts',
          post.path,
          post.slug
        ).replace(/\\/g, '/');
        
        // Get post date
        let pubDate;
        if (post.dateCreated) {
          pubDate = new Date(post.dateCreated);
        } else if (post.dateTime) {
          pubDate = new Date(post.dateTime);
        } else {
          pubDate = new Date();
        }
        
        // Process title (blank or with content)
        const title = this.processTitle(post, pubDate);
        
        // Add post to feed
        feed.item({
          title: title,
          description: post.body,
          url: postUrl,
          guid: post.postid || postUrl,
          categories: [post.type],
          author: this.siteTitle,
          date: pubDate,
          custom_elements: [
            { 'content:encoded': { _cdata: post.body } },
            { 'dc:creator': this.siteTitle }
          ]
        });
      }
      
      // Generate XML
      const xml = feed.xml({ indent: true });
      
      // Write to file
      const outputPath = path.join(this.outputDir, `index.xml`);
      await writeFileAsync(outputPath, xml);
      
      // Also create atom.xml as an alias
      await writeFileAsync(path.join(this.outputDir, `atom.xml`), xml);
      
      // And rss.xml as another common alias
      await writeFileAsync(path.join(this.outputDir, `rss.xml`), xml);
      
      return outputPath;
    } catch (error) {
      console.error('Error generating main feed:', error);
      throw error;
    }
  }
  
  /**
   * Generate a JSON Feed (https://jsonfeed.org/)
   * Modern alternative to RSS
   * @returns {Promise<string>} Path to the generated feed file
   */
  async generateJsonFeed() {
    try {
      // Create JSON Feed structure
      const jsonFeed = {
        version: "https://jsonfeed.org/version/1.1",
        title: this.siteTitle,
        home_page_url: this.siteUrl,
        feed_url: `${this.siteUrl}/feeds/feed.json`,
        description: this.siteDescription,
        icon: this.imageUrl,
        items: []
      };
      
      // Add items to feed (all posts)
      const posts = this.postmaster.all;
      
      for (const post of posts) {
        // Create post URL from path and slug
        const postUrl = path.join(
          this.siteUrl,
          'posts',
          post.path,
          post.slug
        ).replace(/\\/g, '/');
        
        // Get post date
        let pubDate;
        if (post.dateCreated) {
          pubDate = new Date(post.dateCreated);
        } else if (post.dateTime) {
          pubDate = new Date(post.dateTime);
        } else {
          pubDate = new Date();
        }
        
        // Process title (blank or with content)
        const title = this.processTitle(post, pubDate);
        
        // Add post to feed
        jsonFeed.items.push({
          id: post.postid || postUrl,
          url: postUrl,
          title: title, // Use the processed title (blank if empty)
          content_html: post.body,
          date_published: pubDate.toISOString(),
          tags: [post.type]
        });
      }
      
      // Write to file
      const outputPath = path.join(this.outputDir, `feed.json`);
      await writeFileAsync(outputPath, JSON.stringify(jsonFeed, null, 2));
      
      return outputPath;
    } catch (error) {
      console.error('Error generating JSON feed:', error);
      throw error;
    }
  }
}

module.exports = RSSGenerator;