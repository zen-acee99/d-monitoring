import fs from 'fs';

function findInFile(file) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  console.log('--- ' + file + ' ---');
  content.split('\n').forEach((l, i) => {
    if (l.toLowerCase().includes('keystore') || l.toLowerCase().includes('pnpki') || l.toLowerCase().includes('signing workspace') || l.toLowerCase().includes('workspace')) {
      console.log(`${i+1}: ${l.trim()}`);
    }
  });
}

findInFile('src/App.tsx');
findInFile('src/components/layout/Sidebar.tsx');
findInFile('src/components/Sidebar.tsx');
findInFile('src/components/Navigation.tsx');
findInFile('src/components/Header.tsx');
findInFile('src/components/Navbar.tsx');
findInFile('src/components/layout/Header.tsx');
findInFile('src/components/layout/Navbar.tsx');
