import { relative } from 'node:path';

const toRelative = (files) =>
  files.map((file) => relative(process.cwd(), file));

export default {
  // Format first, then lint every Nx project touched by the staged files so
  // module-boundary and typed rules run with each project's own config.
  '*.{ts,tsx,js,jsx,mjs,cjs,mts,cts}': (files) => [
    `prettier --write ${files.join(' ')}`,
    `nx affected -t lint --files=${toRelative(files).join(',')}`,
  ],
  '*.{json,md,css,html,yml,yaml}': 'prettier --write',
};
