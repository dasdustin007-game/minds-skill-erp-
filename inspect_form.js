const fs = require('fs');
const html = fs.readFileSync('aimastersuresh_com.html', 'utf8');

// Find form tags or popup modal tags
const formMatch = html.match(/<form[\s\S]*?<\/form>/gi);
console.log('Forms found:', formMatch ? formMatch.length : 0);
if (formMatch) {
  formMatch.forEach((f, i) => {
    console.log(`--- FORM ${i+1} ---`);
    console.log(f.substring(0, 500));
  });
}

// Find popup elements or elementor modal
const popupMatch = html.match(/class=["'][^"']*elementor-popup[\s\S]*?<\/div>/gi);
console.log('Popup elements:', popupMatch ? popupMatch.length : 0);
