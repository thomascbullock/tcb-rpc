const moment = require('moment');
const fs = require('fs-extra');
const path = require('path');

class Page {
  constructor(inPage) {
    this.title = inPage.title;
    this.bodyBag = inPage.bodyBag;
    this.footerPrevious = inPage.footerPrevious;
    this.footerNext = inPage.footerNext;
    this.fileName = inPage.fileName;
    this.fileDir = inPage.fileDir;
  }

  makePage() {
    let pageRendered = `<!DOCTYPE html>
        <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <link rel="stylesheet" href="/css/reset.css" />
                <link rel="stylesheet" href="/css/style.css" />
                <link rel="shortcut icon" href="/img/logo.jpg" />
                <link rel="EditURI" href="https://thomascbullock.com/xmlrpc" />
                
                <!-- RSS Feed Links -->
                <link
                    rel="alternate"
                    type="application/rss+xml"
                    title="All posts feed"
                    href="https://thomascbullock.com/feeds/rss-all.xml"
                />
                <link
                    rel="alternate"
                    type="application/rss+xml"
                    title="Photo posts feed"
                    href="https://thomascbullock.com/feeds/rss-photo.xml"
                />
                <link
                    rel="alternate"
                    type="application/rss+xml"
                    title="Long posts feed"
                    href="https://thomascbullock.com/feeds/rss-long.xml"
                />
                <link
                    rel="alternate"
                    type="application/rss+xml"
                    title="Short posts feed"
                    href="https://thomascbullock.com/feeds/rss-short.xml"
                />
                <link
                    rel="alternate"
                    type="application/feed+json"
                    title="JSON Feed"
                    href="https://thomascbullock.com/feeds/feed.json"
                />
                
                <title>${this.title || 'T'}</title>
            </head>
            <body>
                <header id="heading">
                        <h1><a href="/"><img src="/img/logo.jpg"></a></h1>
                    <nav>
                        <a href="/posts/long/long">Long</a>
                        <a href="/posts/short/short">Short</a>
                        <a href="/posts/photo/photo">Photo</a>
                        <a href="/posts/about">About</a>
                        <a href="/feeds/index.xml">RSS</a>
                    </nav>
                </header>${this.bodyBuilder()}
                
                <footer id="footer">
                <nav>`;
    if (this.footerPrevious) {
      pageRendered = `${pageRendered}<a href="${this.footerPrevious}">Previous</a>`;
    }

    pageRendered = `${pageRendered}<a href="/posts/archive">Archive</a>`;

    if (this.footerNext) {
      pageRendered = `${pageRendered}<a href="${this.footerNext}">Next</a>`;
    }

    pageRendered = `${pageRendered}
                </nav>
            </footer>    
            </body>
        </html>`;

    return pageRendered;
  }

  async savePage() {
    await fs.ensureDir(this.fileDir);
    await fs.writeFile(path.join(this.fileDir, `${this.fileName}.html`), this.makePage());
  }

  bodyBuilder() {
    let body = '';
    for (let bodyCount = 0; bodyCount < this.bodyBag.length; bodyCount++) {
      const post = this.bodyBag[bodyCount];
      
      // Determine if this post has a title
      const hasTitle = post.title && post.title.trim() !== '';
      
      // Build the title/header section
      let titleSection = '';
      if (hasTitle) {
        // Post has a title - use it as the main link
        titleSection = `<h1><a href="${post.href}">${post.title}</a></h1>`;
      } else {
        // Post has no title - show empty h1 (glyph will be next to date)
        titleSection = `<h1 class="untitled-post"></h1>`;
      }
      
      let singleBody = `<article>${titleSection}`;
      
      // Add date if not explicitly disabled
      if (!post.noDate) {
        // Use dateCreated if available, otherwise fall back to dateTime
        let displayDate;
        if (post.dateCreated) {
          displayDate = new Date(post.dateCreated);
        } else if (post.dateTime) {
          displayDate = new Date(post.dateTime);
        } else {
          displayDate = new Date(); // Fallback to current date
        }

        const readableDate = moment(displayDate).format('MMMM Do YYYY');

        // Always show permalink glyph next to the date
        const permalinkGlyph = `<a href="${post.href}" class="permalink-glyph" title="Permalink" aria-label="Permalink to this post">∞</a>`;

        singleBody += `<p class="date-time">
        <time datetime="${moment(displayDate).format('YYYY-MM-DD')}" pubdate="pubdate">${readableDate}</time>${permalinkGlyph}</p>`;
      }
      
      singleBody += `${post.body}</article>`;
      body += singleBody;
    }
    return body;
  }
}

module.exports = Page;