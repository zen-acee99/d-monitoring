import fs from 'fs';
import path from 'path';

const srcBase = 'c:/Users/Ace/Desktop/Project/DICT Sys/dict-monitoring';
const dstBase = 'C:/Users/Ace/Desktop/Project/D-monitoring/d-monitoring';

const filesToSync = [
  'src/utils/dtrVectorPdf.ts',
  'src/pages/SigningWorkspace.tsx',
  'src/pages/settings/SystemSettings.tsx',
  'src/components/layout/Sidebar.tsx',
  'server/services/pnpkiSigningService.ts',
  'server/routes/dtrGenerator.ts',
];

for (const rel of filesToSync) {
  const src = path.join(srcBase, rel);
  const dst = path.join(dstBase, rel);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    console.log(`Synced: ${rel}`);
  } else {
    console.warn(`Source not found: ${src}`);
  }
}
