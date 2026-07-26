const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const Post = require('../post');

describe('Post', () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tcb-post-'));
    fs.ensureDirSync(path.join(tmpDir, 'posts'));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.removeSync(tmpDir);
  });

  test('save() writes a markdown file with JSON front matter', async () => {
    const post = new Post({
      description: 'Hello world',
      title: 'My Title',
      categories: ['short'],
      dateCreated: new Date('2024-05-01T12:00:00Z'),
    });

    const id = await post.save();
    expect(typeof id).toBe('string');

    const filePath = path.join(tmpDir, 'posts', `${id}.md`);
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf8');
    expect(content.startsWith('---\n')).toBe(true);
    expect(content).toMatch(/"title": "My Title"/);
    expect(content).toMatch(/"type": "short"/);
    expect(content.endsWith('Hello world')).toBe(true);
  });

  test('loadById() round-trips a saved post', async () => {
    const original = new Post({
      description: 'body text',
      title: 'Round Trip',
      categories: ['long'],
      dateCreated: new Date('2024-06-15T09:30:00Z'),
    });
    const id = await original.save();

    const loaded = await Post.loadById(id);
    expect(loaded.postid).toBe(id);
    expect(loaded.title).toBe('Round Trip');
    expect(loaded.description).toBe('body text');
    expect(loaded.categories).toEqual(['long']);
    expect(loaded.dateCreated.toISOString()).toBe('2024-06-15T09:30:00.000Z');
  });

  test('generateSlug() lowercases and hyphenates the title', () => {
    const post = new Post({ title: 'Hello, World! Foo' });
    expect(post.slug).toBe('hello-world-foo');
  });

  test('generateSlug() falls back to a stamp when title is empty', () => {
    const post = new Post({ title: '' });
    expect(post.slug).toMatch(/^post-/);
  });

  test('getDatePath() formats YYYY/MM/DD from dateCreated', () => {
    const post = new Post({
      title: 'x',
      dateCreated: new Date('2023-02-05T00:00:00Z'),
    });
    expect(post.getDatePath()).toMatch(/^2023\/02\/0[45]$/); // tolerate local-tz off-by-one
  });

  test('delete() removes the file', async () => {
    const post = new Post({
      description: 'to be deleted',
      title: 'Delete Me',
      categories: ['short'],
    });
    const id = await post.save();
    const filePath = path.join(tmpDir, 'posts', `${id}.md`);
    expect(fs.existsSync(filePath)).toBe(true);

    await post.delete();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test('invalid dateCreated string falls back to current date', () => {
    const post = new Post({ title: 'x', dateCreated: 'not-a-date' });
    expect(post.dateCreated instanceof Date).toBe(true);
    expect(isNaN(post.dateCreated.getTime())).toBe(false);
  });
});
