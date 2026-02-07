/**
 * Post model with UUID-based file naming
 * Handles post operations like saving and deleting
 */
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class Post {
  /**
   * Create a new Post instance
   * @param {Object} postParams - Post parameters
   * @param {string} [postParams.postid] - Unique ID of the post (optional - will be generated if not provided)
   * @param {Date|string} [postParams.dateCreated] - Publication date (ISO format or Date object)
   * @param {string} [postParams.description] - Post content
   * @param {string} [postParams.title] - Post title
   * @param {Array} [postParams.categories] - Categories/tags
   * @param {string} [postParams.link] - URL of the post
   * @param {string} [postParams.slug] - URL-friendly slug
   */
  constructor(postParams) {
    // Use provided postid or generate a new UUID-based ID
    this.postid = postParams.postid || this.generatePostId();
    
    // Handle the standard MetaWeblog API dateCreated field
    if (postParams.dateCreated) {
      // Store the full date object for API interactions
      if (typeof postParams.dateCreated === 'object' && postParams.dateCreated instanceof Date) {
        this.dateCreated = postParams.dateCreated;
      } else {
        // Try to parse the date string
        try {
          this.dateCreated = new Date(postParams.dateCreated);
          // Validate the date
          if (isNaN(this.dateCreated.getTime())) {
            console.warn(`Invalid dateCreated: ${postParams.dateCreated}, using current date`);
            this.dateCreated = new Date(); // Fallback to current date
          }
        } catch (error) {
          console.warn(`Error parsing dateCreated: ${error.message}, using current date`);
          // Fallback to current date
          this.dateCreated = new Date();
        }
      }
    } else {
      // No date provided, use current date
      this.dateCreated = new Date();
    }
    
    this.description = postParams.description || '';
    this.title = postParams.title || '';
    this.categories = postParams.categories || ['long'];
    this.link = postParams.link;
    this.slug = postParams.slug || this.generateSlug();
  }
  
  /**
   * Generate a unique post ID
   * @returns {string} A unique ID for the post
   */
  generatePostId() {
    return crypto.randomUUID ? 
      crypto.randomUUID() : 
      'post-' + crypto.randomBytes(8).toString('hex');
  }
  
  /**
   * Generate a slug from the post title
   * @returns {string} URL-friendly slug
   */
  generateSlug() {
    if (!this.title) {
      return 'post-' + Date.now().toString(36);
    }
    
    return this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Remove consecutive hyphens
      .trim();                  // Trim leading/trailing spaces
  }
  
  /**
   * Get the path to the post file
   * @returns {string} Path to the post file
   */
  getFilePath() {
    return path.join(process.cwd(), 'posts', `${this.postid}.md`);
  }
  
  /**
   * Check if the post exists
   * @returns {Promise<boolean>} True if the post exists
   */
  async exists() {
    try {
      return await fs.pathExists(this.getFilePath());
    } catch (error) {
      console.error(`Error checking if post exists: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Format date for front matter (ISO format)
   * @returns {string} Formatted date
   */
  formatDate() {
    return this.dateCreated.toISOString();
  }
  
  /**
   * Extract YYYY-MM-DD from date for URL paths
   * @returns {string} Date in YYYY/MM/DD format
   */
  getDatePath() {
    const date = this.dateCreated;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}/${month}/${day}`;
  }
  
  /**
   * Save the post to a file
   * @returns {Promise<string>} The post ID
   */
  async save() {
    try {
      // Generate slug if not already set
      if (!this.slug) {
        this.slug = this.generateSlug();
      }
      
      // Check if this is an update to an existing post
      const isUpdate = await this.exists();
      
      // If updating, load existing content first
      let existingData = {};
      if (isUpdate) {
        try {
          const existingPost = await Post.loadById(this.postid);
          // If dateCreated wasn't provided in this update, use the existing one
          if (!this.dateCreated && existingPost.dateCreated) {
            this.dateCreated = existingPost.dateCreated;
          }
        } catch (error) {
          console.warn(`Couldn't load existing post for update: ${error.message}`);
        }
      }
      
      // Create post metadata
      const postMeta = {
        dateCreated: this.formatDate(),
        type: this.categories[0],
        title: this.title,
        slug: this.slug
      };
      
      console.log(`Saving post with metadata:`, postMeta);
      
      // Format post content with front matter
      const postContent = `---\n${JSON.stringify(postMeta, null, 2)}\n---\n${this.description}`;
      
      // Ensure directory exists
      await fs.ensureDir(path.join(process.cwd(), 'posts'));
      
      // Write file
      const filePath = this.getFilePath();
      await fs.writeFile(filePath, postContent);

      console.log(`Post ${isUpdate ? 'updated' : 'saved'} to ${filePath}`);

      // Auto-commit to git
      await this.gitAutoCommit(`${isUpdate ? 'Update' : 'Add'} post ${this.postid}`);

      return this.postid;
    } catch (error) {
      console.error(`Error saving post: ${error.message}`);
      throw new Error(`Failed to save post: ${error.message}`);
    }
  }
  
  /**
   * Delete the post file
   * @returns {Promise<void>}
   */
  async delete() {
    try {
      const filePath = this.getFilePath();

      // Check if file exists
      if (!await fs.pathExists(filePath)) {
        throw new Error(`Post file not found: ${filePath}`);
      }

      // Delete the file
      await fs.remove(filePath);
      console.log(`Post deleted: ${filePath}`);

      // Auto-commit to git
      await this.gitAutoCommit(`Delete post ${this.postid}`);
    } catch (error) {
      console.error(`Error deleting post: ${error.message}`);
      throw new Error(`Failed to delete post: ${error.message}`);
    }
  }

  /**
   * Auto-commit changes to git for durability
   * Only runs in production (NODE_ENV=production)
   * @param {string} message - Commit message
   * @returns {Promise<void>}
   */
  async gitAutoCommit(message) {
    // Skip git operations in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('Skipping git auto-commit (not in production)');
      return;
    }

    try {
      // Check if we're in a git repo
      await execAsync('git rev-parse --git-dir', { cwd: process.cwd() });

      // Add posts directory and commit
      await execAsync('git add posts/ img/', { cwd: process.cwd() });

      // Check if there are changes to commit
      const { stdout: status } = await execAsync('git status --porcelain posts/ img/', { cwd: process.cwd() });
      if (!status.trim()) {
        console.log('No changes to commit');
        return;
      }

      // Commit and push
      await execAsync(`git commit -m "${message}"`, { cwd: process.cwd() });
      console.log(`Git commit: ${message}`);

      // Try to push, but don't fail if it doesn't work (might be offline)
      try {
        await execAsync('git push', { cwd: process.cwd() });
        console.log('Git push successful');
      } catch (pushError) {
        console.warn('Git push failed (will retry later):', pushError.message);
      }
    } catch (error) {
      // Don't fail the operation if git commit fails
      console.warn('Git auto-commit failed:', error.message);
    }
  }
  
  /**
   * Static method to load a post by ID
   * @param {string} postId - ID of the post to load
   * @returns {Promise<Post>} Loaded post instance
   */
  static async loadById(postId) {
    const filePath = path.join(process.cwd(), 'posts', `${postId}.md`);
    
    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      throw new Error(`Post file not found: ${filePath}`);
    }
    
    // Read the file
    const content = await fs.readFile(filePath, 'utf8');
    
    // Extract front matter
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    
    if (!frontMatterMatch) {
      throw new Error('Invalid post format: front matter not found');
    }
    
    try {
      const meta = JSON.parse(frontMatterMatch[1]);
      const body = frontMatterMatch[2];
      
      // Create post params
      const postParams = {
        postid: postId,
        dateCreated: meta.dateCreated || new Date(),
        title: meta.title || '',
        categories: [meta.type] || ['long'],
        slug: meta.slug,
        description: body
      };
      
      // Create and return post instance
      return new Post(postParams);
    } catch (error) {
      throw new Error(`Error parsing post metadata: ${error.message}`);
    }
  }
}

module.exports = Post;