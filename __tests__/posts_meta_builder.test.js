const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const { PostFromFile, MetaBuilder } = require('../posts_meta_builder');

describe('PostFromFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcb-meta-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  function writePost(name, meta, body) {
    const front = JSON.stringify(meta, null, 2);
    const contents = `---\n${front}\n---\n${body}`;
    const p = path.join(tmpDir, name);
    fs.writeFileSync(p, contents);
    return p;
  }

  test('parses JSON front matter and renders markdown to HTML', async () => {
    const file = writePost(
      'abc.md',
      {
        dateCreated: '2024-04-01T00:00:00.000Z',
        type: 'short',
        title: 'Hello',
        slug: 'hello',
      },
      '**bold** text'
    );

    const post = await new PostFromFile(file, 'render').readPost();
    expect(post.postid).toBe('abc');
    expect(post.title).toBe('Hello');
    expect(post.type).toBe('short');
    expect(post.slug).toBe('hello');
    expect(post.path).toMatch(/^2024\/(03|04)\/(3[01]|0[12])$/); // tolerate tz
    expect(post.body).toContain('<strong>bold</strong>');
  });

  test('editor mode returns raw markdown, not rendered HTML', async () => {
    const file = writePost(
      'abc.md',
      {
        dateCreated: '2024-04-01T00:00:00.000Z',
        type: 'long',
        title: 'X',
        slug: 'x',
      },
      '**still bold**'
    );

    const post = await new PostFromFile(file, 'editor').readPost();
    expect(post.body).toBe('**still bold**');
  });

  test('falls back to dateTime when dateCreated is missing', async () => {
    const file = writePost(
      'legacy.md',
      { dateTime: '2020-01-15', type: 'short', title: '', slug: 'legacy' },
      'body'
    );

    const post = await new PostFromFile(file, 'render').readPost();
    expect(post.path).toMatch(/^2020\/01\/(14|15)$/); // tolerate tz
  });

  test('generates a slug from title when not provided', async () => {
    const file = writePost(
      'auto-slug.md',
      { dateCreated: '2024-01-01T00:00:00.000Z', type: 'long', title: 'Hello World' },
      'body'
    );

    const post = await new PostFromFile(file, 'render').readPost();
    expect(post.slug).toBe('hello-world');
  });

  test('falls back to current date when both dates are missing', async () => {
    const file = writePost(
      'no-date.md',
      { type: 'short', title: '', slug: 'no-date' },
      'body'
    );

    const post = await new PostFromFile(file, 'render').readPost();
    expect(post.dateCreated instanceof Date).toBe(true);
    expect(isNaN(post.dateCreated.getTime())).toBe(false);
  });
});

describe('MetaBuilder', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcb-metab-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  function writePost(name, meta, body) {
    const front = JSON.stringify(meta, null, 2);
    fs.writeFileSync(path.join(tmpDir, name), `---\n${front}\n---\n${body}`);
  }

  test('build() collects markdown files and sorts newest-first', async () => {
    writePost('older.md', { dateCreated: '2020-01-01T00:00:00.000Z', type: 'short', title: 'Older', slug: 'older' }, 'a');
    writePost('newer.md', { dateCreated: '2024-01-01T00:00:00.000Z', type: 'short', title: 'Newer', slug: 'newer' }, 'b');
    // A non-markdown file should be skipped.
    fs.writeFileSync(path.join(tmpDir, 'ignore.txt'), 'not a post');

    const builder = new MetaBuilder(tmpDir);
    const posts = await builder.build('editor');

    expect(posts).toHaveLength(2);
    expect(posts[0].title).toBe('Newer');
    expect(posts[1].title).toBe('Older');
  });

  test('build() returns an empty array when the directory does not exist', async () => {
    const builder = new MetaBuilder(path.join(tmpDir, 'nope'));
    const posts = await builder.build('editor');
    expect(posts).toEqual([]);
  });
});
