import fs from 'fs';
import glob from 'fast-glob';

const files = glob.sync('docs/api/**/*.md');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  // Replace escaped angle brackets
  content = content.replace(/\\</g, '&lt;').replace(/\\>/g, '&gt;');
  
  // Escape all HTML-like tags except the ones typedoc uses to prevent Vue compiler errors
  content = content.replace(/<(\/?)([a-zA-Z0-9_-]+)([^>]*)>/g, (match, slash, tag, rest) => {
    const allowedTags = ['br', 'p', 'a', 'ul', 'li', 'div', 'span', 'code', 'pre', 'strong', 'em', 'b', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'th', 'td'];
    if (allowedTags.includes(tag.toLowerCase())) {
      return match;
    }
    return `&lt;${slash}${tag}${rest}&gt;`;
  });
  
  fs.writeFileSync(file, content);
}
