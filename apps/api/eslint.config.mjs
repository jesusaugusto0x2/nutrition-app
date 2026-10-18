import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    languageOptions: {
      parserOptions: {
        // Root-level config files are not part of any tsconfig; lint them with
        // the default project instead.
        projectService: { allowDefaultProject: ['*.js', '*.mjs', '*.ts'] },
        project: null,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
