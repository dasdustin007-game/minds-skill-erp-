const fs = require('fs');

function unescapeText(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const originalLines = fs.readFileSync('all_text_dump.txt', 'utf8')
  .split('\n')
  .map(unescapeText)
  .filter(Boolean);

const redesignedHtml = fs.readFileSync('C:\\Users\\Home\\Downloads\\aimastersuresh-redesign\\index.html', 'utf8');
const textFromRedesign = unescapeText(redesignedHtml.replace(/<[^>]+>/g, ' '));

const missing = [];
for (const phrase of originalLines) {
  if (!textFromRedesign.includes(phrase)) {
    missing.push(phrase);
  }
}

console.log('Original phrases count:', originalLines.length);
console.log('Missing count:', missing.length);
if (missing.length === 0) {
  console.log('PERFECT CONFIRMATION: 100% of original website content is preserved without change!');
} else {
  console.log('Missing phrases:', missing);
}
