/**
 * Enhanced mediaObject.js with image processing capabilities
 * - Converts images to JPG format
 * - Resizes images to web-friendly dimensions
 * - Optimizes image quality
 */
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const { promisify } = require('util');
const fsWriteFile = promisify(fs.writeFile);

class MediaObject {
  /**
   * Create a new media object
   * @param {Object} mediaObjectParams - Parameters for the media object
   * @param {string} mediaObjectParams.name - Original filename
   * @param {string} mediaObjectParams.type - MIME type of the file
   * @param {Buffer|string} mediaObjectParams.bits - File content (Buffer or base64 string)
   * @param {Object} [options] - Processing options
   * @param {number} [options.maxWidth=1200] - Maximum width in pixels
   * @param {number} [options.maxHeight=1200] - Maximum height in pixels
   * @param {number} [options.quality=80] - JPEG quality (1-100)
   * @param {boolean} [options.convertToJpg=true] - Convert images to JPG format
   * @param {boolean} [options.processImages=true] - Process images (resize/convert)
   */
  constructor(mediaObjectParams, options = {}) {
    this.name = mediaObjectParams.name;
    this.type = mediaObjectParams.type;
    this.bits = mediaObjectParams.bits;

    // Default options for image processing
    this.options = {
      maxWidth: options.maxWidth || 1200,
      maxHeight: options.maxHeight || 1200,
      quality: options.quality || 85,
      convertToJpg: options.convertToJpg !== false, // Default true
      processImages: options.processImages !== false // Default true
    };

    // Ensure bits is a Buffer
    if (typeof this.bits === 'string') {
      this.bits = Buffer.from(this.bits, 'base64');
    }
  }

  /**
   * Check if a file is an image based on MIME type
   * @returns {boolean} True if the file is an image
   */
  isImage() {
    return this.type && this.type.startsWith('image/');
  }

  /**
   * Get file extension from MIME type
   * @returns {string} File extension (with dot)
   */
  getExtensionFromMime() {
    const mimeExtMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff'
    };

    return mimeExtMap[this.type] || path.extname(this.name) || '.jpg';
  }

  /**
   * Generate a new filename based on processing options
   * @returns {string} New filename
   */
  generateFilename() {
    // Extract the original name without extension
    const extname = path.extname(this.name);
    const basename = path.basename(this.name, extname);
    
    // Generate timestamp
    const timestamp = Date.now();
    
    // Create new filename
    if (this.isImage() && this.options.convertToJpg) {
      return `${basename}-${timestamp}.jpg`;
    } else {
      const newExt = this.getExtensionFromMime();
      return `${basename}-${timestamp}${newExt}`;
    }
  }

  /**
   * Process image (resize and convert format if needed)
   * @returns {Promise<Buffer>} Processed image buffer
   */
  async processImage() {
    try {
      if (!this.isImage() || !this.options.processImages) {
        return this.bits;
      }

      // Create sharp instance and auto-rotate based on EXIF orientation
      let image = sharp(this.bits).rotate();

      // Get image metadata
      const metadata = await image.metadata();
      
      // Determine if resizing is needed
      if (metadata.width > this.options.maxWidth || metadata.height > this.options.maxHeight) {
        image = image.resize({
          width: Math.min(metadata.width, this.options.maxWidth),
          height: Math.min(metadata.height, this.options.maxHeight),
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Convert to JPG if option is enabled (except for SVG)
      if (this.options.convertToJpg && metadata.format !== 'svg') {
        image = image.jpeg({
          quality: this.options.quality,
          mozjpeg: true,      // Better compression algorithm
          progressive: true   // Progressive loading for better UX
        });
        this.type = 'image/jpeg';
      }

      // Process the image and return buffer
      return await image.toBuffer();
    } catch (error) {
      console.error('Error processing image:', error);
      // Return original image if processing fails
      return this.bits;
    }
  }

  /**
   * Save the media object to disk
   * @returns {Promise<Object>} Result object with file info
   */
  async save() {
    try {
      // Generate new filename
      const newFilename = this.generateFilename();
      
      // Process the file if it's an image
      let processedBits = this.bits;
      if (this.isImage() && this.options.processImages) {
        processedBits = await this.processImage();
      }
      
      // Create directory if it doesn't exist
      await fs.ensureDir(path.join(process.cwd(), 'img'));
      
      // Save the file
      const filePath = path.join('img', newFilename);
      await fsWriteFile(path.join(process.cwd(), filePath), processedBits);
      
      // Determine actual file size
      const stats = await fs.stat(path.join(process.cwd(), filePath));
      
      // Return result object
      const resultObj = {
        name: newFilename,
        url: `/img/${newFilename}`,
        type: this.type,
        size: stats.size,
        processed: this.isImage() && this.options.processImages
      };
      
      return resultObj;
    } catch (error) {
      console.error('Error saving media object:', error);
      throw new Error(`Failed to save media object: ${error.message}`);
    }
  }
}

module.exports = MediaObject;