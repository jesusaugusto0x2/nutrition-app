import nx from '@nx/eslint-plugin';

// Imports that tie code to a runtime. Shared libs must stay framework-agnostic
// so they can run in both the API (Nest) and the web app (React).
const frameworkImports = [
  '@nestjs/*',
  'express',
  'react',
  'react/*',
  'react-dom',
  'react-dom/*',
  '@tanstack/*',
  'drizzle-orm',
  'drizzle-orm/*',
];

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/out-tsc',
      '**/vitest.config.*.timestamp*',
      '**/vite.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // Scope: api and web never import each other; both may use shared.
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: ['scope:api', 'scope:shared'],
            },
            {
              sourceTag: 'scope:web',
              onlyDependOnLibsWithTags: ['scope:web', 'scope:shared'],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
              bannedExternalImports: frameworkImports,
            },
            // Type: utils may use schemas, never the other way around.
            {
              sourceTag: 'type:schemas',
              onlyDependOnLibsWithTags: ['type:schemas'],
            },
            {
              sourceTag: 'type:utils',
              onlyDependOnLibsWithTags: ['type:utils', 'type:schemas'],
            },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: ['type:schemas', 'type:utils'],
            },
          ],
        },
      ],
    },
  },
];
