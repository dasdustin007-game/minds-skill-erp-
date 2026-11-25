const fs = require('fs');
const html = fs.readFileSync('aimastersuresh_com.html', 'utf8');

// Extract all images
const imgs = [];
const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
let m;
while ((m = imgRegex.exec(html)) !== null) {
  const altMatch = m[0].match(/alt=["']([^"']*)["']/);
  const alt = altMatch ? altMatch[1] : '';
  imgs.push({ src: m[1], alt });
}

// Extract all links
const links = [];
const aRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
while ((m = aRegex.exec(html)) !== null) {
  const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  links.push({ href: m[1], text });
}

fs.writeFileSync('extracted_assets.json', JSON.stringify({ imgs, links }, null, 2));
console.log('Images count:', imgs.length);
console.log('Links count:', links.length);
