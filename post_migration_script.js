/**
 * Migration script to convert existing posts to the new UUID format
 * Run this once to convert posts from the date-based naming to UUID-based naming
 * Will extract dates from filename if not found in front matter
 */
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const gm = require('gray-matter');

const POSTS_DIR = path.join(process.cwd(), 'posts');
const BACKUP_DIR = path.join(process.cwd(), 'posts_backup_' + Date.now());

/**
 * Generate a UUID
 * @returns {string} A UUID string
 */
function generateUUID() {
  return crypto.randomUUID ? 
    crypto.randomUUID() : 
    'post-' + crypto.randomBytes(8).toString('hex');
}

/**
 * Extract date from filename
 * @param {string} filename - The filename to parse
 * @returns {Date|null} Extracted date or null if not found
 */
function extractDateFromFilename(filename) {
  // Check for patterns like 20250510-file-name.md
  const datePattern = /^(\d{8})-/;
  const match = filename.match(datePattern);
  
  if (match) {
    const dateStr = match[1];
    try {
      // Format: YYYYMMDD to YYYY-MM-DD
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      
      // Create date at noon on the extracted date
      const date = new Date(`${year}-${month}-${day}T12:00:00Z`);
      
      // Validate date
      if (!isNaN(date.getTime())) {
        console.log(`  → Extracted date from filename: ${date.toISOString()}`);
        return date;
      }
    } catch (error) {
      console.warn(`  → Failed to parse date from filename ${filename}: ${error.message}`);
    }
  }
  
  return null;
}

/**
 * Convert a post file to the new format
 * @param {string} filePath - Path to the post file
 * @returns {Promise<string>} Path to the new file
 */
async function convertPost(filePath) {
  try {
    // Read the file
    const content = await fs.readFile(filePath, 'utf8');
    const filename = path.basename(filePath);
    
    // Parse front matter
    const parsedContent = gm(content);
    const metadata = parsedContent.data;
    const body = parsedContent.content;
    
    // Ensure dateCreated exists using priority order:
    // 1. Use existing dateCreated if present
    // 2. Convert from dateTime if present
    // 3. Extract from filename if it matches the pattern
    // 4. Fall back to current date
    
    if (!metadata.dateCreated) {
      if (metadata.dateTime) {
        // Try to create a date from dateTime
        try {
          const date = new Date(metadata.dateTime);
          if (!isNaN(date.getTime())) {
            metadata.dateCreated = date.toISOString();
            console.log(`  → Using dateTime from front matter: ${metadata.dateCreated}`);
          } else {
            throw new Error('Invalid dateTime format');
          }
        } catch (error) {
          console.warn(`  → Failed to parse dateTime "${metadata.dateTime}": ${error.message}`);
          
          // Try to extract from filename
          const filenameDate = extractDateFromFilename(filename);
          if (filenameDate) {
            metadata.dateCreated = filenameDate.toISOString();
            console.log(`  → Using date from filename: ${metadata.dateCreated}`);
          } else {
            // Fall back to current date
            metadata.dateCreated = new Date().toISOString();
            console.log(`  → Using current date as fallback: ${metadata.dateCreated}`);
          }
        }
      } else {
        // No dateTime in front matter, try filename
        const filenameDate = extractDateFromFilename(filename);
        if (filenameDate) {
          metadata.dateCreated = filenameDate.toISOString();
          console.log(`  → Using date from filename: ${metadata.dateCreated}`);
        } else {
          // No date information, use current date
          metadata.dateCreated = new Date().toISOString();
          console.log(`  → Using current date as fallback: ${metadata.dateCreated}`);
        }
      }
    }
    
    // Keep original dateTime for backward compatibility
    if (!metadata.dateTime) {
      const dateCreated = new Date(metadata.dateCreated);
      metadata.dateTime = dateCreated.toISOString().substring(0, 10);
    }
    
    // Generate new filename with UUID
    const newId = generateUUID();
    const newFilePath = path.join(POSTS_DIR, `${newId}.md`);
    
    // Create new content with updated front matter
    const newContent = `---\n${JSON.stringify(metadata, null, 2)}\n---\n${body}`;
    
    // Write the new file
    await fs.writeFile(newFilePath, newContent);
    
    return { 
      path: newFilePath,
      originalDate: metadata.dateCreated
    };
  } catch (error) {
    console.error(`Error converting post ${filePath}: ${error.message}`);
    throw error;
  }
}

/**
 * Migrate all posts
 */
async function migrateAllPosts() {
  try {
    // Ensure posts directory exists
    if (!await fs.pathExists(POSTS_DIR)) {
      console.error(`Posts directory not found: ${POSTS_DIR}`);
      return;
    }
    
    // Create backup directory
    await fs.ensureDir(BACKUP_DIR);
    console.log(`Creating backup in ${BACKUP_DIR}`);
    
    // Backup all posts
    await fs.copy(POSTS_DIR, BACKUP_DIR);
    console.log('Backup completed');
    
    // Get all markdown files
    const files = await fs.readdir(POSTS_DIR);
    const markdownFiles = files.filter(file => file.endsWith('.md'));
    
    console.log(`Found ${markdownFiles.length} markdown files to convert`);
    
    // Convert each post
    const conversionMap = {};
    
    for (const file of markdownFiles) {
      const filePath = path.join(POSTS_DIR, file);
      console.log(`Converting ${file}...`);
      
      try {
        const result = await convertPost(filePath);
        const newFile = path.basename(result.path);
        
        conversionMap[file] = {
          newFile: newFile,
          dateCreated: result.originalDate
        };
        
        console.log(`  → Converted to ${newFile}`);
        
        // Delete original file
        await fs.remove(filePath);
      } catch (error) {
        console.error(`  → Failed to convert ${file}: ${error.message}`);
      }
    }
    
    // Save conversion map for reference
    await fs.writeFile(
      path.join(process.cwd(), 'post_conversion_map.json'), 
      JSON.stringify(conversionMap, null, 2)
    );
    
    console.log('Migration completed');
    console.log(`Conversion map saved to ${path.join(process.cwd(), 'post_conversion_map.json')}`);
    console.log('');
    console.log('IMPORTANT: Remember to rebuild your site after migration!');
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  console.log('Starting post migration...');
  migrateAllPosts().then(() => {
    console.log('Migration process finished');
  }).catch(error => {
    console.error('Migration failed with error:', error);
    process.exit(1);
  });
}

module.exports = { migrateAllPosts, convertPost, extractDateFromFilename };