import fs from 'fs';

function normalizeNameForMatch(name) {
  return (name || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(ENGR\.?|ATTY\.?|DIR\.?|DR\.?)\s+/i, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchNames(a, b) {
  const na = normalizeNameForMatch(a);
  const nb = normalizeNameForMatch(b);
  if (na === nb) return true;
  const pa = na.split(/\s+/).filter(p => p.length > 2);
  const pb = nb.split(/\s+/).filter(p => p.length > 2);
  return pa.length >= 2 && pb.length >= 2 && pa.every(p => nb.includes(p));
}

const latestUsers = [
  { name: 'Annabel C. Odoño-Calimpong', role: 'Regional Director' },
  { name: 'Leah B. Dy', role: 'Chief Administrative Officer' },
  { name: 'Ace Malto', role: 'Super Admin' },
  { name: 'Rene Jane R. Buena', role: 'Provincial Officer' },
  { name: 'DE LEON, KEN MATTHEW L.', role: 'ISA I' },
];

const mockDoc = {
  id: 'doc-1',
  fileName: 'October RAOD - Free Wifi 11-1454.pdf',
  targetPersonnel: 'ACE MALTO',
  requiredSigners: ['ACE MALTO'],
  signers: [{ name: 'ACE MALTO', status: 'pending' }],
  scannedInfo: {
    detectedTexts: [
      'Page 1',
      'DANREV A. BALANA',
      'CARLA MAE R. CABREDO',
      'LEAH B. DY',
      'ANNABEL C. ODOÑO-CALIMPONG',
      'Budget Staff',
      'Budget Officer',
      'Chief Administrative Officer',
      'OIC-Regional Director, Regional Office No. V',
    ],
    signers: [
      { name: 'ANNABEL C. ODOÑO-CALIMPONG', status: 'pending' },
      { name: 'LEAH B. DY', status: 'signed' }
    ]
  }
};

// Let's test the recheck logic
function recheck(doc, users) {
  const isRaod = (doc.fileName || '').toUpperCase().includes('RAOD');
  
  // 1. Matched users strictly from detected texts or signers
  const candidateTexts = [
    ...(doc.scannedInfo?.detectedTexts || []),
    ...(doc.scannedInfo?.signers?.map(s => s.name) || [])
  ];

  const matched = users.filter(u => {
    const nu = normalizeNameForMatch(u.name);
    const uParts = nu.split(/\s+/).filter(p => p.length > 2);
    return candidateTexts.some(t => {
      const nt = normalizeNameForMatch(t);
      return nt === nu || nt.includes(nu) || (uParts.length >= 2 && uParts.every(p => nt.includes(p)));
    });
  });

  console.log('Matched registered users:', matched.map(m => m.name));

  // Determine who needs to sign
  // If a user in matched is already signed, they don't need to sign
  // Check if they are signed in doc.scannedInfo.signers
  const pendingUsers = matched.filter(u => {
    const sObj = doc.scannedInfo?.signers?.find(s => matchNames(s.name, u.name));
    return !sObj || sObj.status !== 'signed';
  });

  console.log('Pending users who need to sign:', pendingUsers.map(p => p.name));
  
  // Required signers should be the registered users who need to sign
  const required = (pendingUsers.length > 0 ? pendingUsers : matched).map(u => 
    u.name.toUpperCase().replace(/^(ENGR\.?|ATTY\.?|DIR\.?|DR\.?)\s+/i, '').trim()
  );

  return {
    targetPersonnel: required[0] || 'PERSONNEL',
    requiredSigners: required,
  };
}

const res = recheck(mockDoc, latestUsers);
console.log('Result:', res);
