#!/usr/bin/env node
import { execSync } from 'node:child_process';

function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

function capture(cmd) {
  return execSync(cmd).toString().trim();
}

const currentBranch = capture('git rev-parse --abbrev-ref HEAD');
if (currentBranch !== 'main') {
  console.error(`Refusing to promote: must be on 'main', currently on '${currentBranch}'.`);
  process.exit(1);
}

const dirty = capture('git status --porcelain');
if (dirty) {
  console.error('Refusing to promote: working tree has uncommitted changes.');
  console.error(dirty);
  process.exit(1);
}

const remoteBehind = capture('git rev-list --count main..origin/main');
if (remoteBehind !== '0') {
  console.error(`Refusing to promote: local main is behind origin/main by ${remoteBehind} commit(s). Pull first and review.`);
  process.exit(1);
}

console.log('Promoting current main -> production ...');
run('git fetch origin production:production || git branch production');
run('git checkout production');
run('git reset --hard main');
run('git push origin production --force-with-lease');
run('git checkout main');
console.log('\nDone. Vercel will deploy from production branch (configure in Vercel dashboard if not already).');
