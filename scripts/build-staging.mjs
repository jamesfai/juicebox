// Builds the site for the staging server: same output, but told to stay out of search engines.
//
//   npm run build:staging
//
// Three layers keep staging out of search results:
//   1. a <meta name="robots" content="noindex, ..."> tag on every page (via PUBLIC_NOINDEX in Layout.astro)
//   2. a robots.txt that disallows everything
//   3. an X-Robots-Tag response header, set in .htaccess (Apache / LiteSpeed)
//
// The same .htaccess also refuses any request that is not for the staging hostname, so the files are
// never reachable through the live domain even though the folder sits under public_html.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const site = process.env.SITE_URL || 'https://staging.juicebox.ph';

const build = spawnSync(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, PUBLIC_NOINDEX: 'true', SITE_URL: site },
});
if (build.status !== 0) process.exit(build.status ?? 1);

writeFileSync('dist/robots.txt', 'User-agent: *\nDisallow: /\n');
writeFileSync(
  'dist/.htaccess',
  [
    '# Staging: keep out of search engines',
    '<IfModule mod_rewrite.c>',
    '  RewriteEngine On',
    `  RewriteCond %{HTTP_HOST} !^${new URL(site).hostname.replaceAll('.', '\\.')}$ [NC]`,
    '  RewriteRule ^ - [F,L]',
    '</IfModule>',
    '<IfModule mod_headers.c>',
    '  Header set X-Robots-Tag "noindex, nofollow, noarchive, nosnippet"',
    '</IfModule>',
    '',
  ].join('\n'),
);
console.log(`\nStaging build ready in dist/ for ${site} (noindex on).`);
