(function (root) {
  'use strict';

  const md = root.markdownit({
    html: false,
    linkify: false,
    breaks: false,
    highlight(code, language) {
      if (language && root.hljs.getLanguage(language)) {
        try { return `<pre><code class="hljs">${root.hljs.highlight(code, { language, ignoreIllegals: true }).value}</code></pre>`; }
        catch { /* Show the original code if a language parser fails. */ }
      }
      return `<pre><code class="hljs">${md.utils.escapeHtml(code)}</code></pre>`;
    }
  });
  md.disable('image');
  md.validateLink = value => {
    try { const url = new URL(value); return value.length <= 2048 && url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  };
  md.renderer.rules.link_open = (tokens, index, options, _environment, renderer) => {
    tokens[index].attrSet('data-learning-link', '');
    tokens[index].attrSet('rel', 'noopener noreferrer');
    tokens[index].attrSet('title', tokens[index].attrGet('href'));
    return renderer.renderToken(tokens, index, options);
  };

  md.inline.ruler.before('escape', 'forge_math', (state, silent) => {
    const start = state.pos;
    let open, close, display;
    if (state.src.startsWith('$$', start)) { open = '$$'; close = '$$'; display = true; }
    else if (state.src[start] === '$') { open = '$'; close = '$'; display = false; }
    else if (state.src.startsWith('\\(', start)) { open = '\\('; close = '\\)'; display = false; }
    else if (state.src.startsWith('\\[', start)) { open = '\\['; close = '\\]'; display = true; }
    else return false;
    if (open === '$' && /\s/.test(state.src[start + 1] || ' ')) return false;
    let end = start + open.length;
    while ((end = state.src.indexOf(close, end)) !== -1) {
      let slashes = 0;
      for (let i = end - 1; i >= start && state.src[i] === '\\'; i--) slashes++;
      if (slashes % 2 === 0) break;
      end += close.length;
    }
    if (end < 0 || end === start + open.length) return false;
    if (open === '$' && /\s/.test(state.src[end - 1])) return false;
    if (!silent) { const token = state.push('forge_math', '', 0); token.content = state.src.slice(start + open.length, end); token.meta = { display }; }
    state.pos = end + close.length;
    return true;
  });
  md.renderer.rules.forge_math = (tokens, index) => {
    const token = tokens[index];
    try { return root.katex.renderToString(token.content, { displayMode: token.meta.display, throwOnError: false, trust: false, maxSize: 10, maxExpand: 1000 }); }
    catch { return md.utils.escapeHtml(token.content); }
  };

  root.WorkspaceMarkup = { render: text => md.render(text) };
})(window);
