#!/usr/bin/env node
/**
 * One-shot migration + setup tool. Prompts for a password (no echo), prints
 * an argon2id hash suitable for BLOG_PW_HASH in .env, and generates a fresh
 * SESSION_SECRET.
 *
 * Usage: node scripts/hash-password.js
 */
const readline = require('readline');
const crypto = require('crypto');
const argon2 = require('argon2');

function promptSilent(prompt) {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

    process.stdout.write(prompt);

    // Mute output while password is typed.
    const stdin = process.stdin;
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = () => true;
    const restore = () => {
      process.stdout.write = origWrite;
    };

    rl.question('', (answer) => {
      restore();
      process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });

    rl.on('error', (err) => {
      restore();
      reject(err);
    });
  });
}

(async function main() {
  try {
    const pw1 = await promptSilent('New blog password: ');
    if (!pw1) {
      console.error('Empty password. Aborting.');
      process.exit(1);
    }
    const pw2 = await promptSilent('Confirm: ');
    if (pw1 !== pw2) {
      console.error('Passwords do not match. Aborting.');
      process.exit(1);
    }

    const hash = await argon2.hash(pw1, { type: argon2.argon2id });
    const sessionSecret = crypto.randomBytes(32).toString('base64');

    console.log('');
    console.log('# Add these lines to .env (replacing any existing BLOG_PW / BLOG_PW_HASH / SESSION_SECRET):');
    console.log('');
    console.log(`BLOG_PW_HASH='${hash}'`);
    console.log(`SESSION_SECRET='${sessionSecret}'`);
    console.log('');
    console.log('# Remove or comment out any BLOG_PW=... line — plaintext password is no longer used.');
    console.log('');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
