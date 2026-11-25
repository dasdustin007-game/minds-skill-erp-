const fs = require('fs');
const html = fs.readFileSync('aimastersuresh_com.html', 'utf8');

const formMatch = html.match(/<form[\s\S]*?<\/form>/gi);
if (formMatch) {
  fs.writeFileSync('form_full.html', formMatch[0]);
  console.log('Saved form_full.html, length:', formMatch[0].length);
}
