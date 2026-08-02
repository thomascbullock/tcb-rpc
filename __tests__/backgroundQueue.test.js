const { BackgroundQueue } = require('../lib/backgroundQueue');

// Silence the queue's error logs during error-path tests so Jest output
// stays clean.
let errSpy;
beforeEach(() => { errSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); });

// Small helpers
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('BackgroundQueue', () => {
  test('runs tasks in submission order', async () => {
    const q = new BackgroundQueue('t');
    const order = [];
    q.push(async () => { await wait(30); order.push('a'); }, 'a');
    q.push(async () => { await wait(1);  order.push('b'); }, 'b');
    q.push(async () => { await wait(10); order.push('c'); }, 'c');
    // Wait for drain
    await q.pushAndWait(async () => {}, 'sentinel');
    expect(order).toEqual(['a', 'b', 'c']);
  });

  test('concurrency 1 — task N+1 does not start until N settles', async () => {
    const q = new BackgroundQueue('t');
    let running = 0;
    let maxRunning = 0;
    const spawn = (label) => q.push(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await wait(20);
      running--;
    }, label);
    spawn('a'); spawn('b'); spawn('c');
    await q.pushAndWait(async () => {}, 'sentinel');
    expect(maxRunning).toBe(1);
  });

  test('push swallows task errors and keeps draining', async () => {
    const q = new BackgroundQueue('t');
    const results = [];
    q.push(async () => { throw new Error('boom'); }, 'bad');
    q.push(async () => { results.push('ran'); }, 'good');
    await q.pushAndWait(async () => {}, 'sentinel');
    expect(results).toEqual(['ran']);
    // Error was logged (silenced) — no unhandled rejection
    expect(errSpy).toHaveBeenCalled();
  });

  test('pushAndWait resolves with the task result', async () => {
    const q = new BackgroundQueue('t');
    const v = await q.pushAndWait(async () => 42, 'r');
    expect(v).toBe(42);
  });

  test('pushAndWait rejects when the task throws', async () => {
    const q = new BackgroundQueue('t');
    await expect(
      q.pushAndWait(async () => { throw new Error('nope'); }, 'r')
    ).rejects.toThrow('nope');
  });

  test('push and pushAndWait interleave correctly', async () => {
    const q = new BackgroundQueue('t');
    const order = [];
    q.push(async () => { await wait(15); order.push(1); }, '1');
    const p2 = q.pushAndWait(async () => { await wait(5); order.push(2); return 'two'; }, '2');
    q.push(async () => { await wait(5); order.push(3); }, '3');
    const v = await p2;
    expect(v).toBe('two');
    expect(order).toEqual([1, 2]);
    await q.pushAndWait(async () => {}, 'sentinel');
    expect(order).toEqual([1, 2, 3]);
  });

  test('depth reflects pending + running work', async () => {
    const q = new BackgroundQueue('t');
    expect(q.depth).toBe(0);
    let resolve;
    q.push(() => new Promise((r) => { resolve = r; }), 'held');
    q.push(async () => {}, 'pending1');
    q.push(async () => {}, 'pending2');
    // 1 running + 2 pending = 3
    await wait(1);
    expect(q.depth).toBe(3);
    resolve();
    await q.pushAndWait(async () => {}, 'sentinel');
    expect(q.depth).toBe(0);
  });
});
