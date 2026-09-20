import fs from 'fs';
import path from 'path';

function searchFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      searchFiles(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      // Just print any button that might be nested deep
      if (content.includes('<button') && content.includes('div')) {
        console.log(`Checking ${fullPath}...`);
      }
    }
  }
}
searchFiles('src/pages');
