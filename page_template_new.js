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
                <div class="rss-links">
                    <p>Subscribe: 
                        <a href="/feeds/index.xml">RSS</a> | 
                        <a href="/feeds/rss-all.xml">All</a> | 
                        <a href="/feeds/rss-long.xml">Long</a> | 
                        <a href="/feeds/rss-short.xml">Short</a> | 
                        <a href="/feeds/rss-photo.xml">Photo</a>
                    </p>
                </div>
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
      // Handle title display - keep it blank if empty (instead of "Untitled")
      let titleDisplay = '';
      if (this.bodyBag[bodyCount].title) {
        titleDisplay = this.bodyBag[bodyCount].title;
      }
      
      let singleBody = `<article><h1><a href=${this.bodyBag[bodyCount].href}>${titleDisplay}</a></h1>`;
      
      if (!this.bodyBag[bodyCount].noDate) {
        // Use dateCreated if available, otherwise fall back to dateTime
        let displayDate;
        if (this.bodyBag[bodyCount].dateCreated) {
          displayDate = new Date(this.bodyBag[bodyCount].dateCreated);
        } else if (this.bodyBag[bodyCount].dateTime) {
          displayDate = new Date(this.bodyBag[bodyCount].dateTime);
        } else {
          displayDate = new Date(); // Fallback to current date
        }
        
        const readableDate = moment(displayDate).format('MMMM Do YYYY');
        singleBody = singleBody += `<p class="date-time">
        <time datetime="${moment(displayDate).format('YYYY-MM-DD')}" pubdate="pubdate">${readableDate}</time></p>`;
      }
      singleBody += `${this.bodyBag[bodyCount].body}</article>`;
      body += singleBody;
    }
    return body;
  }
}

module.exports = Page;