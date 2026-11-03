import fs from 'fs';
import path from 'path';

function searchFile(dir, targetName) {
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      if (item === 'node_modules' || item === '.git' || item === 'dist') continue;
      const full = path.join(dir, item);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          searchFile(full, targetName);
        } else if (item.toLowerCase().includes(targetName)) {
          console.log('Found:', full, stat.size);
        }
      } catch {}
    }
  } catch {}
}

console.log('Searching DICT Sys for rene...');
searchFile('c:/Users/Ace/Desktop/Project/DICT Sys/', 'rene');
console.log('Searching DICT Sys for .p12...');
searchFile('c:/Users/Ace/Desktop/Project/DICT Sys/', '.p12');
