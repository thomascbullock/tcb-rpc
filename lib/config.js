/**
 * Path configuration.
 *
 * On the deployed server, code lives in one place (e.g. /opt/tcb-rpc) and
 * user-writable data lives somewhere else (e.g. /var/lib/tcb-rpc/{posts,img,build}).
 * That separation is what lets systemd sandbox the process with
 * ProtectSystem=strict.
 *
 * Locally, defaults preserve the pre-PR-7 layout: ./posts, ./img, ./build
 * inside the repo.
 *
 * Getters (not static values) so tests that use process.chdir() still see
 * their temp dirs.
 */
const path = require('path');

function resolveDir(envVar, defaultRel) {
  const v = process.env[envVar];
  if (v) return path.resolve(v);
  return path.resolve(process.cwd(), defaultRel);
}

module.exports = {
  get postsDir() { return resolveDir('POSTS_DIR', 'posts'); },
  get imgDir()   { return resolveDir('IMG_DIR', 'img'); },
  get buildDir() { return resolveDir('BUILD_DIR', 'build'); },
};
