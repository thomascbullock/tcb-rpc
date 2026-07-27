const { render, popoverizeFootnotes } = require('../lib/renderMarkdown');

describe('renderMarkdown', () => {
  test('basic markdown still renders (smart quotes on)', () => {
    expect(render("It's fine")).toContain('It’s fine'); // typographer curly apostrophe
    expect(render('**bold**')).toContain('<strong>bold</strong>');
  });

  test('inline HTML passes through (html:true)', () => {
    expect(render('<img src="/x.jpg">')).toContain('<img src="/x.jpg">');
  });

  test('footnote reference becomes a <button popovertarget> with anchor-name', () => {
    const src = 'Body[^1].\n\n[^1]: The note.\n';
    const html = render(src);

    expect(html).toContain('<sup class="footnote-ref"><button');
    expect(html).toContain('type="button"');
    expect(html).toContain('popovertarget="fn1"');
    expect(html).toContain('id="fnref1"');
    expect(html).toContain('class="footnote-ref-btn"');
    expect(html).toContain('aria-label="Show footnote"');
    expect(html).toContain('style="anchor-name: --fn1"');
    expect(html).toContain('>[1]</button>');
    expect(html).not.toMatch(/<sup class="footnote-ref"><a /);
  });

  test('footnote body gains the popover attribute and position-anchor', () => {
    const src = 'Body[^1].\n\n[^1]: The note.\n';
    const html = render(src);

    expect(html).toContain('<li id="fn1" class="footnote-item" popover style="position-anchor: --fn1">');
  });

  test('multiple footnotes get correctly numbered targets and unique anchor names', () => {
    const src = 'A[^1] B[^2] C[^3].\n\n[^1]: one\n[^2]: two\n[^3]: three\n';
    const html = render(src);

    for (const n of [1, 2, 3]) {
      expect(html).toContain(`popovertarget="fn${n}"`);
      expect(html).toContain(`anchor-name: --fn${n}`);
      expect(html).toContain(`<li id="fn${n}" class="footnote-item" popover style="position-anchor: --fn${n}">`);
    }
  });

  test('bottom section wrappers survive so non-popover browsers see the fallback', () => {
    const src = 'X[^1].\n\n[^1]: fallback text\n';
    const html = render(src);

    expect(html).toContain('<section class="footnotes">');
    expect(html).toContain('<ol class="footnotes-list">');
    expect(html).toContain('fallback text');
  });

  test('backref anchor is preserved (hidden by CSS inside popover)', () => {
    const src = 'X[^1].\n\n[^1]: note\n';
    const html = render(src);
    expect(html).toContain('class="footnote-backref"');
    expect(html).toContain('href="#fnref1"');
  });

  test('popoverizeFootnotes is a no-op when there are no footnotes', () => {
    const html = '<p>plain</p>';
    expect(popoverizeFootnotes(html)).toBe(html);
  });
});
