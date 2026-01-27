# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run Commands

```bash
npm install          # Install dependencies
npm start            # Build static site and start servers (XML-RPC on 9090, web on 3000)
npm run dev          # Development mode with nodemon auto-restart
npm test             # Run tests with Jest
```

## Environment Setup

Create a `.env` file with:
- `BLOG_USER` and `BLOG_PW` - Required for authentication
- `RPC_PORT` - XML-RPC server port (default: 9090)
- `WEB_PORT` - Web server port (default: 3000)

## Architecture Overview

This is a static site generator with XML-RPC (MetaWeblog API) and REST API support for publishing blog posts.

### Core Flow

1. **Posts** are stored as Markdown files with JSON front matter in `./posts/` (UUID-named, e.g., `abc123-def456.md`)
2. **Website.js** orchestrates the build: reads posts via `Postmaster` → generates HTML pages via `Page` → outputs to `./build/`
3. **index.js** runs two servers: XML-RPC (for desktop blog clients like MarsEdit) and Express (serves static site + REST API)

### Key Modules

- `post.js` - Post model (save/load/delete individual posts)
- `postMaster.js` - Manages post collections, sorts by date, categorizes into `all`, `long`, `short`, `photo`
- `posts_meta_builder.js` - Parses Markdown files with gray-matter, renders with markdown-it
- `website.js` - Static site generator: creates individual permalinks, paginated collection pages, archive, RSS feeds
- `page_template_new.js` - HTML page template generation
- `rssGenerator.js` - Generates RSS/Atom/JSON feeds
- `mediaObject.js` - Handles image uploads with Sharp for processing

### Post Types

Posts have a `type` field in front matter: `long`, `short`, or `photo`. Each type gets its own collection pages at `/posts/{type}/`.

### API Endpoints

- XML-RPC at `/` (port 9090) - Full MetaWeblog API
- REST at `/api/upload-photo` - Photo upload with processing
- REST at `/api/create-text-post` - Text post creation
- Mobile posting UI at `/post` (Basic Auth protected)

### Build Output Structure

```
./build/
├── posts/{year}/{month}/{day}/{slug}.html  # Individual permalinks
├── posts/{type}/{type}.html                # Collection pages (paginated)
├── posts/archive.html                      # Archive of titled posts
├── feeds/                                  # RSS, Atom, JSON feeds
├── css/                                    # Stylesheets
└── img/                                    # Images
```

