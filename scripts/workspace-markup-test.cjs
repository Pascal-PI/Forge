'use strict';
const assert = require('node:assert/strict');
global.window = {
  markdownit: require('markdown-it'),
  katex: require('katex'),
  hljs: require('@highlightjs/cdn-assets/highlight.js')
};
require('../renderer/workspace-markup.js');

const render = window.WorkspaceMarkup.render;
const formatted = render('**Important** $x^2$\n\n```python\nprint(7)\n```');
assert.match(formatted, /<strong>Important<\/strong>/);
assert.match(formatted, /class="katex"/);
assert.match(formatted, /class="hljs/);
assert.match(formatted, /hljs-built_in/);
const unsafe = render('<img src=x onerror=alert(1)> [bad](javascript:alert(1)) $\\href{javascript:alert(1)}{bad}$');
assert.doesNotMatch(unsafe, /<img|<script|href="javascript:/i);
assert.match(render('[reference](https://example.com)'), /data-learning-link/);
assert.match(render('It costs $5 and $10.'), /\$5 and \$10/);
assert.match(render(String.raw`Inline \(x+1\) and display $$x^2$$`), /katex-display/);
console.log('Workspace markup validation passed');
