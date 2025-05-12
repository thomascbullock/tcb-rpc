/**
 * Enhanced index.js with Mobile Upload API
 * Includes endpoints for photo uploads and text posts with optional titles
 */
const xmlrpc = require("xmlrpc");
const fs = require("fs-extra");
const express = require("express");
const dotenv = require("dotenv");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const cors = require("cors");
const basicAuth = require("express-basic-auth");
const Website = require("./website");

// Load API handlers
const getRecentPosts = require("./getRecentPosts").getRecentPosts;
const getCategories = require("./getCategories").getCategories;
const editPost = require("./editPost").editPost;
const getPost = require('./getPost').getPost;
const newPost = require('./newPost').newPost;
const deletePost = require('./deletePost').deletePost;
const metaWeblogDeletePost = require('./metaWeblogDeletePost').metaWeblogDeletePost;
const newMediaObject = require('./newMediaObject').newMediaObject;
const getUserInfo = require('./getUserInfo').getUserInfo;
const getUsersBlogs = require('./getUsersBlogs').getUsersBlogs;
const Post = require('./post');
const MediaObject = require('./mediaObject');

// Load environment variables
dotenv.config();

// Validate environment variables
if (!process.env.BLOG_USER || !process.env.BLOG_PW) {
  console.error("Error: BLOG_USER and BLOG_PW must be set in environment variables");
  process.exit(1);
}

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Set up authentication middleware for mobile API
const apiAuth = basicAuth({
  users: { [process.env.BLOG_USER]: process.env.BLOG_PW },
  challenge: true,
  realm: "Mobile Upload API"
});

// Function to rebuild the website
async function buildSite() {
  try {
    const website = new Website();
    await website.orchestrate();
    console.log("Website build completed successfully!");
    return true;
  } catch (error) {
    console.error("Error building website:", error);
    return false;
  }
}

// Create XML-RPC server
const xmlrpcServer = xmlrpc.createServer({ 
  host: process.env.RPC_HOST || "localhost", 
  port: parseInt(process.env.RPC_PORT || "9090")
});

// Method handler helper function
function createMethodHandler(handler) {
  return async function(err, params, callback) {
    try {
      const result = await handler(params);
      if (result && result.faultCode) {
        callback(result, null);
      } else {
        callback(null, result);
      }
    } catch (error) {
      console.error(`Error in handler: ${error}`);
      callback({
        faultCode: 500,
        faultString: `Internal Server Error: ${error.message}`
      }, null);
    }
  };
}

// Method that rebuilds the site after a successful operation
function createMethodHandlerWithRebuild(handler) {
  return async function(err, params, callback) {
    try {
      const result = await handler(params);
      if (result && result.faultCode) {
        callback(result, null);
      } else {
        await buildSite();
        callback(null, result);
      }
    } catch (error) {
      console.error(`Error in handler with rebuild: ${error}`);
      callback({
        faultCode: 500,
        faultString: `Internal Server Error: ${error.message}`
      }, null);
    }
  };
}

// Handle methods not found
xmlrpcServer.on("NotFound", function(method, params) {
  console.log(`Method '${method}' does not exist`);
  console.log("Params:", JSON.stringify(params));
});

// Register method handlers
// Methods that modify content and require site rebuild
xmlrpcServer.on("metaWeblog.editPost", createMethodHandlerWithRebuild(editPost));
xmlrpcServer.on("metaWeblog.newPost", createMethodHandlerWithRebuild(newPost));
xmlrpcServer.on("metaWeblog.deletePost", createMethodHandlerWithRebuild(metaWeblogDeletePost));
xmlrpcServer.on("blogger.deletePost", createMethodHandlerWithRebuild(deletePost));
xmlrpcServer.on("metaWeblog.newMediaObject", createMethodHandlerWithRebuild(newMediaObject));

// Methods that just retrieve information
xmlrpcServer.on("metaWeblog.getRecentPosts", createMethodHandler(getRecentPosts));
xmlrpcServer.on("metaWeblog.getCategories", createMethodHandler(getCategories));
xmlrpcServer.on("metaWeblog.getPost", createMethodHandler(getPost));
xmlrpcServer.on("blogger.getUserInfo", createMethodHandler(getUserInfo));
xmlrpcServer.on("blogger.getUsersBlogs", createMethodHandler(getUsersBlogs));
xmlrpcServer.on("metaWeblog.getUsersBlogs", createMethodHandler(getUsersBlogs));

// Create Express app for serving the website and API
const app = express();
const webPort = process.env.WEB_PORT || 3000;

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Serve static files
app.use(
  express.static("./build", {
    extensions: ["html"],
    index: "posts/all/all.html",
    etag: false,
  })
);

// Mobile API endpoints

/**
 * GET /api/health
 * Simple health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * POST /api/upload-photo
 * Uploads a photo and creates a new post
 * 
 * Required fields:
 * - photo: The image file to upload
 * 
 * Optional fields:
 * - title: The title of the post (default: empty)
 * - caption: Optional caption for the photo
 * - category: Post category (default: "photo")
 * - date: Publication date (default: now)
 */
app.post('/api/upload-photo', apiAuth, upload.single('photo'), async (req, res) => {
  try {
    // Extract parameters
    const title = req.body.title || ""; // Title is now optional, default to empty string
    const caption = req.body.caption || "";
    const category = req.body.category || "photo";
    const dateCreated = req.body.date ? new Date(req.body.date) : new Date();

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No photo provided" });
    }

    // Generate a unique filename
    const fileExt = path.extname(req.file.originalname) || '.jpg';
    const fileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${fileExt}`;

    // Create media object
    const mediaObjParams = {
      name: fileName,
      bits: req.file.buffer,
      type: req.file.mimetype || 'image/jpeg'
    };

    // Save the media file
    const mediaObject = new MediaObject(mediaObjParams);
    const mediaResult = await mediaObject.save();

    // Create markdown image reference
    let markdown = `![${title || "Photo"}](/img/${fileName})`;
    
    // Add caption if provided
    if (caption) {
      markdown += `\n\n${caption}`;
    }

    // Create post with the image
    const postParams = {
      description: markdown,
      title: title,
      categories: [category],
      dateCreated: dateCreated
    };

    // Create and save the post
    const post = new Post(postParams);
    const postId = await post.save();

    // Rebuild the site
    await buildSite();

    // Return success response
    res.json({ 
      success: true, 
      postId: postId,
      imageUrl: `/img/${fileName}`,
      title: title,
      message: "Photo uploaded and post created successfully"
    });
  } catch (error) {
    console.error("Error handling mobile upload:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "An unknown error occurred" 
    });
  }
});

/**
 * POST /api/create-text-post
 * Creates a new text post
 * 
 * Required fields:
 * - content: The content of the post (markdown supported)
 * 
 * Optional fields:
 * - title: The title of the post (default: empty)
 * - category: Post category (default: "short")
 * - date: Publication date (default: now)
 */
app.post('/api/create-text-post', apiAuth, express.json(), async (req, res) => {
  try {
    // Extract parameters
    const { title, content, category, date } = req.body;
    
    // Validate required content field
    if (!content) {
      return res.status(400).json({ 
        success: false, 
        error: "Content is required" 
      });
    }
    
    // Set defaults for optional fields
    let postTitle = title;
    
    // If no title is provided, use empty string
    if (postTitle === undefined || postTitle === null) {
      postTitle = '';
    }
    
    const postCategory = category || "short";
    const dateCreated = date ? new Date(date) : new Date();
    
    // Create post parameters
    const postParams = {
      description: content,
      title: postTitle,
      categories: [postCategory],
      dateCreated: dateCreated
    };
    
    // Create and save the post
    const post = new Post(postParams);
    const postId = await post.save();
    
    // Rebuild the site
    await buildSite();
    
    // Return success response
    res.json({
      success: true,
      postId: postId,
      message: "Text post created successfully",
      title: postTitle,
      category: postCategory,
      date: dateCreated.toISOString()
    });
  } catch (error) {
    console.error("Error creating text post:", error);
    res.status(500).json({
      success: false,
      error: error.message || "An unknown error occurred"
    });
  }
});

/**
 * GET /api/categories
 * Returns available post categories
 */
app.get('/api/categories', apiAuth, async (req, res) => {
  try {
    // Reuse the getCategories function
    const categories = await getCategories([null, process.env.BLOG_USER, process.env.BLOG_PW]);
    res.json({ 
      success: true, 
      categories: categories.map(cat => cat.categoryName)
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "An unknown error occurred" 
    });
  }
});

/**
 * GET /api/recent-posts
 * Returns recent posts
 */
app.get('/api/recent-posts', apiAuth, async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 5;
    
    // Reuse the getRecentPosts function
    const posts = await getRecentPosts([null, process.env.BLOG_USER, process.env.BLOG_PW, count]);
    
    // Simplify the response format
    const simplifiedPosts = posts.map(post => ({
      id: post.postid,
      title: post.title,
      date: post.dateCreated,
      category: post.categories[0],
      link: post.link
    }));
    
    res.json({ 
      success: true, 
      posts: simplifiedPosts
    });
  } catch (error) {
    console.error("Error fetching recent posts:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "An unknown error occurred" 
    });
  }
});

// Start servers
(async function start() {
  console.log("Building site...");
  await buildSite();
  
  app.listen(webPort, () => {
    console.log(`Website and API running on http://localhost:${webPort}`);
    console.log(`Mobile photo upload endpoint: http://localhost:${webPort}/api/upload-photo`);
    console.log(`Text post creation endpoint: http://localhost:${webPort}/api/create-text-post`);
  });
  
  console.log(`XML-RPC server running on http://localhost:${process.env.RPC_PORT || "9090"}`);
})();