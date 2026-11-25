const fs = require('fs');
const html = fs.readFileSync('aimastersuresh_com.html', 'utf8');

// Find all text blocks and elementor sections in sequential order
const cheerio = null; // Let's parse with simple regex on elementor widgets or classes
const widgets = [];
const widgetRegex = /<div class="elementor-element elementor-element-([^ ]+) elementor-widget elementor-widget-([^"]+)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;

// Also look at the inner texts
const cleanText = html.replace(/<script[\s\S]*?<\/script>/gi, '')
                      .replace(/<style[\s\S]*?<\/style>/gi, '')
                      .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

fs.writeFileSync('clean_site_body.html', cleanText);
console.log('Saved clean_site_body.html');
