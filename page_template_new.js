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
                <title>${this.title}</title>
            </head>
            <body>
                <header id="heading">
                        <h1><a href="/"><img src="/img/logo.jpg"></a></h1>
                    <nav>
                        <a href="/posts/long/long">Long</a>
                        <a href="/posts/short/short">Short</a>
                        <a href="/posts/photo/photo">Photo</a>
                        <a href="/posts/about">About</a>
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
      let singleBody = `<article><h1><a href=${this.bodyBag[bodyCount].href}>${this.bodyBag[bodyCount].title}</a></h1>`;
      if (!this.bodyBag[bodyCount].noDate) {
        const readableDate = new moment(this.bodyBag[bodyCount].dateTime).format('MMMM Do YYYY');
        singleBody = singleBody += `<p class="date-time">
        <time datetime="${this.bodyBag[bodyCount].dateTime}" pubdate="pubdate">${readableDate}</time></p>`;
      }
      singleBody += `${this.bodyBag[bodyCount].body}</article>`;
      body += singleBody;
    }
    return body;
  }
}

module.exports = Page;
