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
const markdownIt = require('markdown-it');
const markdownItFootnote = require('markdown-it-footnote');

const md = markdownIt({
  html: true,
  linkify: true,
  typographer: true,
}).use(markdownItFootnote);

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

function render(source) {
  return popoverizeFootnotes(md.render(source));
}

module.exports = { render, popoverizeFootnotes, md };
