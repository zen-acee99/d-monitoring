import fs from 'fs';

const files = [
  'src/components/dtr/DtrStorageView.tsx',
  'src/pages/DtrGenerator.tsx',
  'src/pages/settings/SystemSettings.tsx',
  'src/pages/SigningWorkspace.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/components/Sidebar.tsx',
  'src/App.tsx',
];

for (const rel of files) {
  if (!fs.existsSync(rel)) continue;
  const content = fs.readFileSync(rel, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (l.toLowerCase().includes('keystore')) {
      console.log(rel + ':' + (idx + 1) + ': ' + l.trim());
    }
  });
}
