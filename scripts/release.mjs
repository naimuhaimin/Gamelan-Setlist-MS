#!/usr/bin/env node
/**
 * Release staging to main with a version bump.
 *
 *   npm run release            # bump picked from the commits since the last tag
 *   npm run release -- minor   # or force one: patch | minor | major
 *   npm run release -- --dry   # only show what would happen
 *
 * Auto bump (Conventional Commits since the last vX.Y.Z tag):
 *   "feat!:" / "BREAKING CHANGE" -> major, any "feat:" -> minor, otherwise patch.
 *
 * Steps: bump package.json + package-lock.json on staging, commit "chore: release vX.Y.Z",
 * push staging, fast-forward main to it, push main, tag vX.Y.Z (message = the commit list)
 * and push the tag. Stops before touching anything if the tree is dirty or not on staging.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const forced = args.find((a) => ['patch', 'minor', 'major'].includes(a));

const git = (cmd) => execSync(`git ${cmd}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const run = (cmd) => {
  console.log(`$ git ${cmd}`);
  if (!dry) execSync(`git ${cmd}`, { stdio: 'inherit' });
};
const fail = (msg) => {
  console.error(`release: ${msg}`);
  process.exit(1);
};

if (git('rev-parse --abbrev-ref HEAD') !== 'staging') fail('switch to the staging branch first.');
if (git('status --porcelain --untracked-files=no')) fail('commit or stash your changes first.');

run('fetch --tags origin');
run('pull --ff-only origin staging');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const current = pkg.version;

let lastTag = '';
try {
  lastTag = git('describe --tags --abbrev=0 --match "v[0-9]*"');
} catch {
  /* no tag yet: every commit counts */
}
const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
const log = git(`log ${range} --no-merges --format=%s%n%b%x00`)
  .split('\0')
  .map((s) => s.trim())
  .filter(Boolean);
const subjects = log.map((s) => s.split('\n')[0]).filter((s) => !/^chore: release v/.test(s));
if (!subjects.length) fail(`nothing new since ${lastTag || 'the start'}.`);

const auto = log.some((s) => /^\w+(\(.+\))?!:/.test(s) || /BREAKING CHANGE/.test(s))
  ? 'major'
  : subjects.some((s) => /^feat(\(.+\))?:/.test(s))
    ? 'minor'
    : 'patch';
const level = forced ?? auto;

const [ma, mi, pa] = current.split('.').map(Number);
const next = level === 'major' ? `${ma + 1}.0.0` : level === 'minor' ? `${ma}.${mi + 1}.0` : `${ma}.${mi}.${pa + 1}`;

console.log(`\n${current} -> ${next} (${level}${forced ? ', forced' : ', auto'}) — ${subjects.length} change(s) since ${lastTag || 'the start'}:`);
for (const s of subjects) console.log(`  - ${s}`);
console.log('');

if (!dry) {
  pkg.version = next;
  writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  try {
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    lock.version = next;
    if (lock.packages?.['']) lock.packages[''].version = next;
    writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
  } catch {
    /* no lockfile */
  }
}

const notes = [`v${next}`, '', ...subjects.map((s) => `- ${s}`)].join('\n');
run('add package.json package-lock.json');
run(`commit -q -m "chore: release v${next}"`);
run('push -q origin staging');
run('switch -q main');
run('pull -q --ff-only origin main');
run('merge -q --ff-only staging');
run('push -q origin main');
console.log(`$ git tag -a v${next}`);
if (!dry) execSync(`git tag -a v${next} -F -`, { input: notes, stdio: ['pipe', 'inherit', 'inherit'] });
run(`push -q origin v${next}`);
run('switch -q staging');

console.log(`\nReleased v${next} to main.`);
