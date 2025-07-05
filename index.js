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
const getApod = require('./getApod').getApod;

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

// Mobile posting page route (protected)
app.get('/post', apiAuth, (req, res) => {
  // Serve the posting page HTML content directly
  const mobilePostHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Post to T</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            background-color: #fff;
            color: #222;
            line-height: 1.6;
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #eee;
        }

        .header h1 {
            font-size: 2em;
            margin-bottom: 10px;
            color: #222;
        }

        .header p {
            color: #666;
            font-size: 0.9em;
        }

        .post-type-selector {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            justify-content: center;
        }

        .post-type-btn {
            flex: 1;
            padding: 12px 16px;
            border: 2px solid #222;
            background: white;
            border-radius: 25px;
            cursor: pointer;
            font-size: 0.9em;
            transition: all 0.2s ease;
            text-align: center;
        }

        .post-type-btn:hover {
            background-color: #f5f5f5;
        }

        .post-type-btn.active {
            background-color: #222;
            color: white;
        }

        .form-section {
            display: none;
            animation: fadeIn 0.3s ease;
        }

        .form-section.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .form-group {
            margin-bottom: 20px;
        }

        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #333;
        }

        input[type="text"], 
        input[type="file"], 
        input[type="number"],
        input[type="datetime-local"],
        textarea, 
        select {
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 8px;
            font-size: 16px;
            font-family: inherit;
            transition: border-color 0.2s ease;
        }

        input[type="text"]:focus, 
        input[type="number"]:focus,
        input[type="datetime-local"]:focus,
        textarea:focus, 
        select:focus {
            outline: none;
            border-color: #222;
        }

        textarea {
            resize: vertical;
            min-height: 150px;
        }

        .photo-preview {
            margin-top: 10px;
            text-align: center;
        }

        .photo-preview img {
            max-width: 100%;
            max-height: 200px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .submit-btn {
            width: 100%;
            padding: 16px;
            background-color: #222;
            color: white;
            border: none;
            border-radius: 25px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-top: 10px;
        }

        .submit-btn:hover {
            background-color: #444;
            transform: translateY(-1px);
        }

        .submit-btn:disabled {
            background-color: #ccc;
            cursor: not-allowed;
            transform: none;
        }

        .loading {
            display: none;
            text-align: center;
            margin: 20px 0;
            color: #666;
        }

        .loading.active {
            display: block;
        }

        .result {
            margin-top: 20px;
            padding: 15px;
            border-radius: 8px;
            display: none;
        }

        .result.success {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }

        .result.error {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }

        .result.active {
            display: block;
        }

        .advanced-options {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }

        .advanced-toggle {
            background: none;
            border: none;
            color: #666;
            cursor: pointer;
            font-size: 0.9em;
            margin-bottom: 15px;
        }

        .advanced-content {
            display: none;
        }

        .advanced-content.active {
            display: block;
        }

        .form-row {
            display: flex;
            gap: 15px;
        }

        .form-row .form-group {
            flex: 1;
        }

        .home-link {
            display: block;
            text-align: center;
            margin-bottom: 20px;
            color: #666;
            text-decoration: none;
            font-size: 0.9em;
        }

        .home-link:hover {
            color: #222;
        }

        @media (max-width: 480px) {
            body {
                padding: 15px;
            }

            .post-type-selector {
                flex-direction: column;
            }

            .form-row {
                flex-direction: column;
                gap: 0;
            }

            .header h1 {
                font-size: 1.5em;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Post to T</h1>
        <p>Create a new post from your mobile device</p>
        <a href="/" class="home-link">← Back to site</a>
    </div>

    <div class="post-type-selector">
        <button class="post-type-btn active" data-type="text">📝 Text</button>
        <button class="post-type-btn" data-type="photo">📸 Photo</button>
    </div>

    <!-- Text Post Form -->
    <div id="text-form" class="form-section active">
        <div class="form-group">
            <label for="text-title">Title (optional)</label>
            <input type="text" id="text-title" placeholder="Leave blank for untitled post">
        </div>

        <div class="form-group">
            <label for="text-content">Content *</label>
            <textarea id="text-content" placeholder="Write your post here... (Markdown supported)" required></textarea>
        </div>

        <div class="advanced-options">
            <button type="button" class="advanced-toggle" onclick="toggleAdvanced('text')">
                ⚙️ Advanced Options
            </button>
            <div id="text-advanced" class="advanced-content">
                <div class="form-group">
                    <label for="text-category">Category</label>
                    <select id="text-category">
                        <option value="short">Short</option>
                        <option value="long">Long</option>
                        <option value="photo">Photo</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="text-date">Date (optional)</label>
                    <input type="datetime-local" id="text-date">
                </div>
            </div>
        </div>

        <button type="button" class="submit-btn" onclick="submitTextPost()">
            Publish Text Post
        </button>
    </div>

    <!-- Photo Post Form -->
    <div id="photo-form" class="form-section">
        <div class="form-group">
            <label for="photo-file">Photo *</label>
            <input type="file" id="photo-file" accept="image/*" required onchange="previewPhoto()">
            <div id="photo-preview" class="photo-preview"></div>
        </div>

        <div class="form-group">
            <label for="photo-title">Title (optional)</label>
            <input type="text" id="photo-title" placeholder="Leave blank for untitled post">
        </div>

        <div class="form-group">
            <label for="photo-caption">Caption (optional)</label>
            <textarea id="photo-caption" placeholder="Add a caption for your photo..." rows="3"></textarea>
        </div>

        <div class="advanced-options">
            <button type="button" class="advanced-toggle" onclick="toggleAdvanced('photo')">
                ⚙️ Advanced Options
            </button>
            <div id="photo-advanced" class="advanced-content">
                <div class="form-row">
                    <div class="form-group">
                        <label for="photo-max-width">Max Width (px)</label>
                        <input type="number" id="photo-max-width" value="1200" min="100" max="2000">
                    </div>
                    <div class="form-group">
                        <label for="photo-quality">Quality (%)</label>
                        <input type="number" id="photo-quality" value="80" min="10" max="100">
                    </div>
                </div>
                <div class="form-group">
                    <label for="photo-date">Date (optional)</label>
                    <input type="datetime-local" id="photo-date">
                </div>
            </div>
        </div>

        <button type="button" class="submit-btn" onclick="submitPhotoPost()">
            Upload Photo & Publish
        </button>
    </div>

    <div id="loading" class="loading">
        <p>📤 Publishing your post...</p>
    </div>

    <div id="result" class="result">
        <div id="result-message"></div>
    </div>

    <script>
        // Authentication will be handled by server-side Basic Auth
        const API_BASE = window.location.origin;

        // Post type switching
        document.querySelectorAll('.post-type-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.type;
                switchPostType(type);
            });
        });

        function switchPostType(type) {
            // Update buttons
            document.querySelectorAll('.post-type-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === type);
            });

            // Update forms
            document.querySelectorAll('.form-section').forEach(section => {
                section.classList.toggle('active', section.id === \`\${type}-form\`);
            });
        }

        function toggleAdvanced(type) {
            const content = document.getElementById(\`\${type}-advanced\`);
            const toggle = content.previousElementSibling;
            
            content.classList.toggle('active');
            toggle.textContent = content.classList.contains('active') 
                ? '⚙️ Hide Advanced Options' 
                : '⚙️ Advanced Options';
        }

        function previewPhoto() {
            const file = document.getElementById('photo-file').files[0];
            const preview = document.getElementById('photo-preview');
            
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.innerHTML = \`<img src="\${e.target.result}" alt="Photo preview">\`;
                };
                reader.readAsDataURL(file);
            } else {
                preview.innerHTML = '';
            }
        }

        function showLoading() {
            document.getElementById('loading').classList.add('active');
            document.querySelectorAll('.submit-btn').forEach(btn => btn.disabled = true);
        }

        function hideLoading() {
            document.getElementById('loading').classList.remove('active');
            document.querySelectorAll('.submit-btn').forEach(btn => btn.disabled = false);
        }

        function showResult(message, isSuccess = true) {
            const result = document.getElementById('result');
            const resultMessage = document.getElementById('result-message');
            
            result.className = \`result active \${isSuccess ? 'success' : 'error'}\`;
            resultMessage.innerHTML = message;
            
            // Scroll to result
            result.scrollIntoView({ behavior: 'smooth' });
            
            // Auto-hide after 10 seconds for success messages
            if (isSuccess) {
                setTimeout(() => {
                    result.classList.remove('active');
                }, 10000);
            }
        }

        async function submitTextPost() {
            const title = document.getElementById('text-title').value.trim();
            const content = document.getElementById('text-content').value.trim();
            const category = document.getElementById('text-category').value;
            const date = document.getElementById('text-date').value;

            if (!content) {
                showResult('Please enter some content for your post.', false);
                return;
            }

            showLoading();

            try {
                const response = await fetch(\`\${API_BASE}/api/create-text-post\`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        title: title || undefined,
                        content: content,
                        category: category,
                        date: date || undefined
                    })
                });

                const result = await response.json();

                if (result.success) {
                    showResult(\`
                        ✅ Post published successfully!<br>
                        <strong>Post ID:</strong> \${result.postId}<br>
                        <strong>Category:</strong> \${result.category}<br>
                        <a href="\${API_BASE}" target="_blank">View your site →</a>
                    \`);
                    
                    // Clear form
                    document.getElementById('text-title').value = '';
                    document.getElementById('text-content').value = '';
                    document.getElementById('text-date').value = '';
                } else {
                    showResult(\`❌ Error: \${result.error}\`, false);
                }
            } catch (error) {
                showResult(\`❌ Network error: \${error.message}\`, false);
            } finally {
                hideLoading();
            }
        }

        async function submitPhotoPost() {
            const file = document.getElementById('photo-file').files[0];
            const title = document.getElementById('photo-title').value.trim();
            const caption = document.getElementById('photo-caption').value.trim();
            const maxWidth = document.getElementById('photo-max-width').value;
            const quality = document.getElementById('photo-quality').value;
            const date = document.getElementById('photo-date').value;

            if (!file) {
                showResult('Please select a photo to upload.', false);
                return;
            }

            showLoading();

            try {
                const formData = new FormData();
                formData.append('photo', file);
                formData.append('title', title);
                formData.append('caption', caption);
                formData.append('category', 'photo');
                formData.append('maxWidth', maxWidth);
                formData.append('quality', quality);
                if (date) {
                    formData.append('date', date);
                }

                const response = await fetch(\`\${API_BASE}/api/upload-photo\`, {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    showResult(\`
                        ✅ Photo uploaded and published!<br>
                        <strong>Post ID:</strong> \${result.postId}<br>
                        <strong>Image:</strong> \${result.imageInfo.name} (\${Math.round(result.imageInfo.size / 1024)} KB)<br>
                        <a href="\${API_BASE}" target="_blank">View your site →</a>
                    \`);
                    
                    // Clear form
                    document.getElementById('photo-file').value = '';
                    document.getElementById('photo-title').value = '';
                    document.getElementById('photo-caption').value = '';
                    document.getElementById('photo-date').value = '';
                    document.getElementById('photo-preview').innerHTML = '';
                } else {
                    showResult(\`❌ Error: \${result.error}\`, false);
                }
            } catch (error) {
                showResult(\`❌ Network error: \${error.message}\`, false);
            } finally {
                hideLoading();
            }
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', () => {
            console.log('Mobile posting page loaded');
        });
    </script>
</body>
</html>`;

  res.send(mobilePostHtml);
});


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
 * Uploads a photo, processes it, and creates a new post
 * 
 * Required fields:
 * - photo: The image file to upload
 * 
 * Optional fields:
 * - title: The title of the post (default: empty)
 * - caption: Optional caption for the photo
 * - category: Post category (default: "photo")
 * - date: Publication date (default: now)
 * - maxWidth: Maximum width in pixels (default: 1200)
 * - maxHeight: Maximum height in pixels (default: 1200)
 * - quality: JPEG quality 1-100 (default: 80)
 * - convertToJpg: Whether to convert images to JPG (default: true)
 */
app.post('/api/upload-photo', apiAuth, upload.single('photo'), async (req, res) => {
  try {
    // Extract basic parameters
    const title = req.body.title || "";
    const caption = req.body.caption || "";
    const category = req.body.category || "photo";
    const dateCreated = req.body.date ? new Date(req.body.date) : new Date();

    // Validate photo upload
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No photo provided" });
    }

    // Extract image processing options
    const imageOptions = {
      maxWidth: parseInt(req.body.maxWidth, 10) || 1200,
      maxHeight: parseInt(req.body.maxHeight, 10) || 1200,
      quality: parseInt(req.body.quality, 10) || 80,
      convertToJpg: req.body.convertToJpg !== 'false',
      processImages: true
    };

    // Log upload info
    console.log(`Mobile API photo upload: ${req.file.originalname} (${req.file.mimetype})`);
    console.log('Image processing options:', imageOptions);

    // Generate a unique filename
    const fileExt = path.extname(req.file.originalname) || '.jpg';
    const fileName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${fileExt}`;

    // Create media object
    const mediaObjParams = {
      name: fileName,
      bits: req.file.buffer,
      type: req.file.mimetype || 'image/jpeg'
    };

    // Process and save the image
    const mediaObject = new MediaObject(mediaObjParams, imageOptions);
    const mediaResult = await mediaObject.save();

    // Create markdown image reference
    let markdown = `![${title || "Photo"}](${mediaResult.url})`;
    
    // Add caption if provided
    if (caption) {
      markdown += `\n\n${caption}`;
    }

    // Add image info comment in markdown (invisible in rendered output)
    markdown += `\n\n<!-- Image: ${mediaResult.name} | Size: ${Math.round(mediaResult.size / 1024)} KB | Type: ${mediaResult.type} -->`;

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
      imageUrl: mediaResult.url,
      title: title,
      imageInfo: {
        name: mediaResult.name,
        size: mediaResult.size,
        type: mediaResult.type,
        width: imageOptions.maxWidth,
        height: imageOptions.maxHeight,
        processed: mediaResult.processed
      },
      message: "Photo uploaded, processed, and post created successfully"
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
app.post('/api/create-text-post', apiAuth, async (req, res) => {
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


app.get('/api/apod', async(req,res) => {
  console.log('made it to apod handler');
  try {
    console.log(req);
    const apodResponse = await getApod();
    await buildSite();
    res.send(apodResponse);
  } catch (error) {
    console.error("Error getting APOD", error);
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