'use strict';
const fs = require('node:fs');
const path = require('node:path');
const target = path.join(__dirname, '../renderer/vendor/learning');
const packageDir = name => path.dirname(require.resolve(`${name}/package.json`));
const markdown = packageDir('markdown-it');
const katex = packageDir('katex');
const highlight = packageDir('@highlightjs/cdn-assets');
fs.mkdirSync(target, { recursive: true });
for (const [source, destination] of [
  [path.join(markdown, 'dist/browser/markdown-it.umd.min.js'), 'markdown-it.min.js'],
  [path.join(markdown, 'LICENSE'), 'MARKDOWN-IT-LICENSE.txt'],
  [path.join(katex, 'dist/katex.min.js'), 'katex.min.js'],
  [path.join(katex, 'dist/katex.min.css'), 'katex.min.css'],
  [path.join(katex, 'LICENSE'), 'KATEX-LICENSE.txt'],
  [path.join(highlight, 'highlight.min.js'), 'highlight.min.js'],
  [path.join(highlight, 'LICENSE'), 'HIGHLIGHT-LICENSE.txt']
]) fs.copyFileSync(source, path.join(target, destination));
fs.cpSync(path.join(katex, 'dist/fonts'), path.join(target, 'fonts'), { recursive: true });
