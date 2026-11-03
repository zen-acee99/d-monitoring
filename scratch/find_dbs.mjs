import fs from 'fs';
import path from 'path';

function findDatabases(dir) {
  try {
    const list = fs.readdirSync(dir);
    for (const item of list) {
      if (item === 'node_modules' || item === '.git' || item === 'dist') continue;
      const full = path.join(dir, item);
      try {
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          findDatabases(full);
        } else if (item.endsWith('.db') || item.endsWith('.sqlite')) {
          console.log('Found database:', full, stat.size);
        }
      } catch {}
    }
  } catch {}
}

findDatabases('c:/Users/Ace/Desktop/Project/DICT Sys/');
