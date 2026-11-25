const fs = require('fs');
const html = fs.readFileSync('aimastersuresh_com.html', 'utf8');

// Elementor flex containers use data-element_type="container"
const containerRegex = /<div[^>]*data-element_type="container"[^>]*data-id="([^"]+)"[^>]*>([\s\S]*?)<\/div>/gi;
let m;
let topLevel = [];
const idRegex = /class="[^"]*elementor-element-([a-f0-9]+)[^"]*e-con-boxed[^"]*"/gi;

// Let's inspect the direct text sections
console.log('--- ALL TEXT DUMP IN SEQUENCE ---');
const textDump = fs.readFileSync('all_text_dump.txt', 'utf8').split('\n');
textDump.forEach((line, i) => {
  console.log(`${i+1}: ${line}`);
});
