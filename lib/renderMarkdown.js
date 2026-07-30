/**
 * Shared markdown renderer.
 *
 * Enables markdown-it-footnote and post-processes its output so footnote
 * references open as HTML popovers (Baseline 2024, all modern browsers)
 * instead of jump-scrolling to the bottom of the article.
 *
 * Bigfoot.js-style behaviour, no JavaScript required.
 *
 * Fallback (pre-popover browsers): the reference button does nothing when
 * clicked, but the footnote text is still visible in the section at the
 * bottom of the article.
 */
const fs = require('fs');
const path = require('path');
const markdownIt = require('markdown-it');
const markdownItFootnote = require('markdown-it-footnote');
const config = require('./config');

const md = markdownIt({
  html: true,
  linkify: true,
  typographer: true,
}).use(markdownItFootnote);

// Width used for the smaller srcset variant (kept in sync with
// mediaObject.js's default variantWidth). The renderer looks for
// <basename>-<VARIANT_W>.<ext> next to each image src.
const VARIANT_W = 800;
const MAIN_W = 1200; // matches mediaObject.js's default maxWidth

// markdown-it-footnote emits:
//   <sup class="footnote-ref"><a href="#fnN" id="fnrefN">[N]</a></sup>
//   <li id="fnN" class="footnote-item">...</li>
//
// We replace the <sup><a> with a <sup><button popovertarget="fnN">, and add
// the `popover` attribute to each <li> so clicking the ref opens the item
// as a popover. On non-supporting browsers, the <li>s remain visible in
// the bottom section; the button is inert but the text is still readable.
function popoverizeFootnotes(html) {
  return html
    .replace(
      /<sup class="footnote-ref"><a href="#(fn\d+)" id="(fnref\d+)">(\[\d+\])<\/a><\/sup>/g,
      // The inline `anchor-name` binds this button as a CSS anchor so the
      // popover can position itself right below it (progressive enhancement;
      // browsers without anchor positioning fall back to centered popover).
      '<sup class="footnote-ref"><button type="button" popovertarget="$1" id="$2" class="footnote-ref-btn" aria-label="Show footnote" style="anchor-name: --$1">$3</button></sup>'
    )
    .replace(
      /<li id="(fn\d+)" class="footnote-item">/g,
      '<li id="$1" class="footnote-item" popover style="position-anchor: --$1">'
    );
}

/**
 * Rewrite <img src="/img/foo.jpg" ...> tags to include srcset + sizes +
 * loading="lazy" when a smaller variant exists on disk. Existing images
 * without a companion variant pass through unchanged (except loading=lazy
 * is added universally).
 *
 * Not touched:
 *   - <img> tags with an existing srcset (author-authored HTML)
 *   - src URLs that don't start with /img/
 */
function addImageSrcset(html, opts = {}) {
  const imgRoot = opts.imgRoot || config.imgDir;

  return html.replace(/<img\b([^>]*?)\/?>/gi, (match, attrs) => {
    if (/\bsrcset\s*=/i.test(attrs)) return match;

    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    if (!srcMatch) return match;

    const src = srcMatch[1];
    if (!src.startsWith('/img/')) {
      // Non-local image (or already off the expected path) — just add loading=lazy.
      return injectAttr(match, 'loading', 'lazy');
    }

    const filename = src.slice(5); // strip "/img/"
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const variantName = `${base}-${VARIANT_W}${ext}`;
    const variantPath = path.join(imgRoot, variantName);

    let out = match;
    out = injectAttr(out, 'loading', 'lazy');

    // Only add srcset if the variant file actually exists.
    try {
      if (fs.existsSync(variantPath)) {
        const srcsetVal = `/img/${variantName} ${VARIANT_W}w, ${src} ${MAIN_W}w`;
        out = injectAttr(out, 'srcset', srcsetVal);
        out = injectAttr(out, 'sizes', `(max-width: ${MAIN_W}px) 100vw, ${MAIN_W}px`);
      }
    } catch (_) {
      // fs error → fall through with just loading=lazy
    }

    return out;
  });
}

// Insert (or replace) a single attribute on an existing <img ...> tag.
function injectAttr(tag, name, value) {
  const re = new RegExp(`\\b${name}\\s*=\\s*["'][^"']*["']`, 'i');
  const escapedValue = String(value).replace(/"/g, '&quot;');
  if (re.test(tag)) {
    return tag.replace(re, `${name}="${escapedValue}"`);
  }
  // Insert before the closing > (handles both `<img …>` and `<img …/>`).
  return tag.replace(/\s*\/?>$/, ` ${name}="${escapedValue}"$&`);
}

function render(source, opts) {
  return addImageSrcset(popoverizeFootnotes(md.render(source)), opts);
}

module.exports = { render, popoverizeFootnotes, addImageSrcset, md };
