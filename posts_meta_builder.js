/**
 * Post metadata builder
 * Handles extraction and parsing of post metadata from markdown files
 * with front matter, and builds collections of posts
 */

const md = require("markdown-it")();
const fs = require("fs-extra");
const path = require("path");
const gm = require("gray-matter");

/**
 * Class for reading and parsing an individual post file
 */
class PostFromFile {
  /**
   * Create a new PostFromFile instance
   * @param {string} inFile - Path to the post file
   * @param {string} mode - Mode to operate in ('editor' for raw content, any other value for rendered HTML)
   */
  constructor(inFile, mode) {
    this.path = inFile;
    this.mode = mode;
  }

  /**
   * Read and parse the post file
   * @returns {Object} Post metadata and content
   */
  async readPost() {
    try {
      // Read the file
      const post = await fs.readFile(this.path);
      const postString = post.toString();
      
      // Parse front matter
      const postJson = gm(postString);
      this.metadata = postJson.data;
      
      // Return raw or rendered markdown based on mode
      let mdToReturn;
      if (this.mode === "editor") {
        mdToReturn = postJson.content;
      } else {
        mdToReturn = md.render(postJson.content);
      }
      
      // Parse date components for URL path
      let datePath = '';
      let dateCreated;
      
      // Try to use dateCreated from metadata first
      if (this.metadata.dateCreated) {
        try {
          dateCreated = new Date(this.metadata.dateCreated);
          if (!isNaN(dateCreated.getTime())) {
            const year = dateCreated.getFullYear();
            const month = String(dateCreated.getMonth() + 1).padStart(2, '0');
            const day = String(dateCreated.getDate()).padStart(2, '0');
            datePath = `${year}/${month}/${day}`;
          } else {
            throw new Error('Invalid dateCreated format');
          }
        } catch (error) {
          console.warn(`Failed to parse dateCreated "${this.metadata.dateCreated}": ${error.message}`);
          
          // Fall back to dateTime if available
          if (this.metadata.dateTime) {
            try {
              const dateTime = new Date(this.metadata.dateTime);
              if (!isNaN(dateTime.getTime())) {
                dateCreated = dateTime;
                const year = dateTime.getFullYear();
                const month = String(dateTime.getMonth() + 1).padStart(2, '0');
                const day = String(dateTime.getDate()).padStart(2, '0');
                datePath = `${year}/${month}/${day}`;
              } else {
                throw new Error('Invalid dateTime format');
              }
            } catch (error) {
              console.warn(`Failed to parse dateTime "${this.metadata.dateTime}": ${error.message}`);
              // Use current date as fallback
              dateCreated = new Date();
              const now = dateCreated;
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, '0');
              const day = String(now.getDate()).padStart(2, '0');
              datePath = `${year}/${month}/${day}`;
            }
          } else {
            // No date information, use current date
            dateCreated = new Date();
            const now = dateCreated;
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            datePath = `${year}/${month}/${day}`;
          }
        }
      } else if (this.metadata.dateTime) {
        // No dateCreated but dateTime is available
        try {
          const dateTime = new Date(this.metadata.dateTime);
          if (!isNaN(dateTime.getTime())) {
            dateCreated = dateTime;
            const year = dateTime.getFullYear();
            const month = String(dateTime.getMonth() + 1).padStart(2, '0');
            const day = String(dateTime.getDate()).padStart(2, '0');
            datePath = `${year}/${month}/${day}`;
          } else {
            throw new Error('Invalid dateTime format');
          }
        } catch (error) {
          console.warn(`Failed to parse dateTime "${this.metadata.dateTime}": ${error.message}`);
          // Use current date as fallback
          dateCreated = new Date();
          const now = dateCreated;
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          datePath = `${year}/${month}/${day}`;
        }
      } else {
        // No date information, use current date
        dateCreated = new Date();
        const now = dateCreated;
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        datePath = `${year}/${month}/${day}`;
      }
      
      // Generate slug if not provided
      if (!this.metadata.slug && this.metadata.title) {
        this.metadata.slug = this.metadata.title
          .toLowerCase()
          .replace(/[^\w\s-]/g, '') 
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();
      } else if (!this.metadata.slug) {
        // Fallback slug if no title
        this.metadata.slug = path.basename(this.path, path.extname(this.path));
      }
      
      // Get the post ID from the filename
      const postid = path.basename(this.path, path.extname(this.path));
      
      // Return the post object
      return {
        postid: postid,
        dateCreated: dateCreated, // Include full dateCreated object
        dateTime: this.metadata.dateTime || dateCreated.toISOString().substring(0, 10),
        title: this.metadata.title || '',
        type: this.metadata.type || 'long',
        body: mdToReturn,
        path: datePath,
        slug: this.metadata.slug,
        fileName: path.basename(this.path)
      };
    } catch (error) {
      console.error(`Error reading post ${this.path}:`, error);
      throw new Error(`Failed to read post: ${error.message}`);
    }
  }
}

/**
 * Class for building a collection of posts from a directory
 */
class MetaBuilder {
  /**
   * Create a new MetaBuilder instance
   * @param {string} inDir - Directory containing post files
   */
  constructor(inDir) {
    this.dir = inDir;
    this.metaArr = [];
  }

  /**
   * Build the collection of posts
   * @param {string} mode - Mode to operate in ('editor' for raw content, any other value for rendered HTML)
   * @returns {Array} Array of post objects
   */
  async build(mode) {
    try {
      // Clear any existing posts
      this.metaArr = [];
      
      // Check if directory exists
      if (!await fs.pathExists(this.dir)) {
        console.warn(`Posts directory not found: ${this.dir}`);
        return this.metaArr;
      }
      
      // Get all files in the directory
      const files = await fs.readdir(this.dir);
      
      // Process each file
      for (const file of files) {
        // Skip hidden files
        if (file.toString()[0] === ".") continue;
        
        // Skip non-markdown files
        if (!file.endsWith('.md')) continue;
        
        try {
          // Create and read post
          const postFromFile = new PostFromFile(path.join(this.dir, file), mode);
          const postJson = await postFromFile.readPost();
          this.metaArr.push(postJson);
        } catch (error) {
          console.error(`Error processing file ${file}:`, error);
          // Continue processing other files
        }
      }
      
      // Sort posts by date
      this.sortByDate();
      
      return this.metaArr;
    } catch (error) {
      console.error("Error building post collection:", error);
      return [];
    }
  }
  
  /**
   * Sort posts by date in descending order (newest first)
   */
  sortByDate() {
    this.metaArr.sort((a, b) => {
      const dateA = a.dateCreated instanceof Date ? a.dateCreated : new Date(a.dateCreated);
      const dateB = b.dateCreated instanceof Date ? b.dateCreated : new Date(b.dateCreated);
      return dateB - dateA;
    });
  }
  
  /**
   * Filter posts by type
   * @param {string} type - Post type to filter by
   * @returns {Array} Filtered array of posts
   */
  filterByType(type) {
    return this.metaArr.filter(post => post.type === type);
  }
}

module.exports = { PostFromFile, MetaBuilder };