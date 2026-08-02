/**
 * Tiny in-memory FIFO queue with concurrency 1.
 *
 * Ensures that when multiple mutation requests land in quick succession —
 * e.g. two photo uploads or a MarsEdit sync burst — the resulting site
 * rebuilds and Mastodon cross-posts happen strictly in order, one at a
 * time. No p-queue dependency; the surface area is small enough to
 * hand-roll.
 *
 *   queue.push(fn, label)         → fire-and-forget; errors are logged
 *                                    with the label but don't kill the
 *                                    process or halt the queue.
 *   queue.pushAndWait(fn, label)  → returns a promise that resolves with
 *                                    fn's result, or rejects if fn throws.
 *   queue.depth                   → pending task count (for observability)
 *
 * All tasks run in submission order regardless of which entry point was
 * used to enqueue them.
 */
class BackgroundQueue {
  constructor(name = 'bg') {
    this.name = name;
    this.queue = [];
    this.running = false;
  }

  push(task, label) {
    this._enqueue(task, label, null, null);
  }

  pushAndWait(task, label) {
    return new Promise((resolve, reject) => {
      this._enqueue(task, label, resolve, reject);
    });
  }

  get depth() {
    return this.queue.length + (this.running ? 1 : 0);
  }

  _enqueue(task, label, resolve, reject) {
    this.queue.push({ task, label: label || 'anon', resolve, reject });
    this._drain();
  }

  async _drain() {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const { task, label, resolve, reject } = this.queue.shift();
      try {
        const result = await task();
        if (resolve) resolve(result);
      } catch (err) {
        console.error(`[${this.name}] task "${label}" failed:`, err);
        if (reject) reject(err);
      }
    }
    this.running = false;
  }
}

// Shared singleton for the whole app: every post mutation, regardless of
// whether it came in over REST or XML-RPC, serializes through this.
const mutationQueue = new BackgroundQueue('mutation');

module.exports = { BackgroundQueue, mutationQueue };
