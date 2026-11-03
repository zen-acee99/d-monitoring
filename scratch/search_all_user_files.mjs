import fs from 'fs';
import path from 'path';

function searchDir(dir, maxDepth = 4, depth = 0) {
  if (depth > maxDepth) return;
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      if (item === 'node_modules' || item === '.git' || item === 'AppData' || item === 'dist') continue;
      const full = path.join(dir, item);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          searchDir(full, maxDepth, depth + 1);
        } else {
          const lower = item.toLowerCase();
          if (lower.includes('rene') || lower.includes('buena') || lower.endsWith('.p12') || lower.endsWith('.pfx')) {
            console.log('Found:', full, stat.size);
          }
        }
      } catch {}
    }
  } catch {}
}

console.log('Searching C:/Users/Ace/Downloads...');
searchDir('C:/Users/Ace/Downloads');
console.log('Searching C:/Users/Ace/Desktop...');
searchDir('C:/Users/Ace/Desktop');
console.log('Searching C:/Users/Ace/Documents...');
searchDir('C:/Users/Ace/Documents');
