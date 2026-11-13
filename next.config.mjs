import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// Which build this is, shown in Settings: the version from package.json (bumped by `npm run release`),
// plus the branch and commit on anything that isn't the live site.
const branch = process.env.VERCEL_GIT_COMMIT_REF ?? '';
const channel = process.env.VERCEL_ENV === 'production' ? '' : branch || (process.env.NODE_ENV === 'development' ? 'dev' : '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_APP_CHANNEL: channel,
    NEXT_PUBLIC_APP_COMMIT: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7),
  },
};

export default nextConfig;
