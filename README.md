# TCB-RPC: XML-RPC Server for Thomas C. Bullock's Website

This project implements an XML-RPC server with MetaWeblog API support for building and publishing content to thomascbullock.com. The server allows you to publish posts to your website using standard MetaWeblog API clients like Open Live Writer, MarsEdit, and others.

## Features

- Complete MetaWeblog API implementation
- Static site generation from Markdown files
- RSS feed generation for different post types
- Express.js server for serving the generated website
- Responsive design for mobile and desktop browsers

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/thomascbullock/tcb-rpc.git
   cd tcb-rpc
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file based on the provided `.env.example`:
   ```
   cp .env.example .env
   ```
   
4. Edit the `.env` file with your credentials and settings.

## Usage

### Start the server

```
npm start
```

This will:
- Generate the static website
- Start the XML-RPC server on port 9090 (default)
- Start the web server on port 3000 (default)

### Development mode

```
npm run dev
```

This uses nodemon to automatically restart the server when files change.

## API Methods

The server implements the following MetaWeblog API methods:

- `metaWeblog.getRecentPosts`: Get a list of recent posts
- `metaWeblog.getCategories`: Get a list of available categories
- `metaWeblog.editPost`: Edit an existing post
- `metaWeblog.getPost`: Get a specific post
- `metaWeblog.newPost`: Create a new post
- `metaWeblog.deletePost`: Delete a post
- `metaWeblog.newMediaObject`: Upload a media file
- `metaWeblog.getUsersBlogs`: Get information about the blog
- `blogger.deletePost`: Delete a post (alternative method)
- `blogger.getUserInfo`: Get information about the user
- `blogger.getUsersBlogs`: Get information about the blog (alternative method)

## Project Structure

- `index.js`: Main entry point that sets up the XML-RPC and Express servers
- `website.js`: Core logic for building the static website
- `auth.js`: Authentication utilities
- API implementation files:
  - `getRecentPosts.js`
  - `getCategories.js`
  - `editPost.js`
  - `getPost.js`
  - `newPost.js`
  - `deletePost.js`
  - `metaWeblogDeletePost.js`
  - `newMediaObject.js`
  - `getUserInfo.js`
  - `getUsersBlogs.js`
- `post.js`: Post model for interacting with post files
- `postMaster.js`: Utility for managing collections of posts
- `page_template_new.js`: Template for generating HTML pages

## Security

- Authentication is required for all API methods that modify content
- Credentials are stored in environment variables, not in code
- Input validation for uploaded content

## License

MIT License