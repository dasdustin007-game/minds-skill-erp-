const fs = require('fs');
const html = fs.readFileSync('aimastersuresh_com.html', 'utf8');

// Strip tags except for keeping structure to inspect all text
const clean = html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<svg[\s\S]*?<\/svg>/gi, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const lines = [];
const pRegex = /<(p|h1|h2|h3|h4|h5|h6|li|span|a|div)[^>]*>([\s\S]*?)<\/\1>/gi;

// Let's do a text dump of readable sections
const textDump = clean.replace(/<[^>]+>/g, '\n')
  .split('\n')
  .map(s => s.trim())
  .filter(s => s.length > 0);

// deduplicate consecutive or common noise
const uniqueText = [];
for (const t of textDump) {
  if (t === '&nbsp;' || t === '&amp;' || t === 'Menu') continue;
  uniqueText.push(t);
}

fs.writeFileSync('all_text_dump.txt', uniqueText.join('\n'));
console.log('Saved all_text_dump.txt with lines:', uniqueText.length);
