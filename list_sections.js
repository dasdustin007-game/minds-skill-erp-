const fs = require('fs');
const html = fs.readFileSync('aimastersuresh_com.html', 'utf8');

// Match sections
const sectionRegex = /<section[^>]*class=["']([^"']*)["'][^>]*>([\s\S]*?)<\/section>/gi;
let m;
let count = 0;
while ((m = sectionRegex.exec(html)) !== null) {
  count++;
  const sClass = m[1];
  const sContent = m[2];
  // extract text inside
  const text = sContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  console.log(`=== SECTION ${count} [${sClass.substring(0, 30)}] ===`);
  console.log(text.substring(0, 250));
}
