'use strict'

import path from 'node:path'
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin'

const currentDir = import.meta.dirname

// @ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig */

/** @type WebpackConfig */

export default function config() {
  return {
    target: `node`,
    mode: `none`,
    entry: `./src/extension.ts`,
    output: {
      path: path.resolve(currentDir, `dist`),
      filename: `extension.js`,
      library: { type: `commonjs2` },
    },
    externals: {
      vscode: `commonjs vscode`,
    },
    resolve: {
      alias: {
        'isomorphic-dompurify': path.resolve(currentDir, `src/dompurify-shim.ts`),
      },
      extensions: [`.ts`, `.js`],
      fallback: {
        'bufferutil': false,
        'utf-8-validate': false,
        'canvas': false,
      },
      plugins: [new TsconfigPathsPlugin({ configFile: path.resolve(currentDir, `tsconfig.json`) })],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [
            {
              loader: `ts-loader`,
            },
          ],
        },
        {
          test: /\.(css|txt)$/,
          type: 'asset/source',
        },
      ],
    },
    devtool: `nosources-source-map`,
    infrastructureLogging: {
      level: `log`,
    },
    optimization: {
      sideEffects: true,
    },
  }
}
