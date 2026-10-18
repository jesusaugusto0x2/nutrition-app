const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

// With pnpm, the API's dependencies live in apps/api/node_modules, which the
// Nx plugin's default externals (root node_modules only) do not see. Keep
// every package import external so node_modules is resolved at runtime and
// only the API's own source is bundled.
const isPackageImport = (request) => /^[^./]/.test(request);

module.exports = {
  externals: [
    ({ request }, callback) =>
      isPackageImport(request)
        ? callback(null, `commonjs ${request}`)
        : callback(),
  ],
  output: {
    path: join(__dirname, 'dist'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
      mergeExternals: true,
    }),
  ],
};
