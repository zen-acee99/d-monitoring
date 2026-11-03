const fs = require('fs');
const cacheFile = __dirname + '/otc-users-cache.json';
const users = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));

function isRegionV(user) {
  const dept = (user.departmentName || '').toLowerCase();
  return dept.includes('r5') || dept.includes('region v') || dept.includes('bicol') || dept.includes('albay') || dept.includes('camarines') || dept.includes('catanduanes') || dept.includes('masbate') || dept.includes('sorsogon');
}

function findOtcUser(users, queryTerm, preferredName = '') {
  if (!queryTerm) return null;
  const q = queryTerm.toLowerCase().trim();
  const qClean = q.replace(/[\.\,\-\_]/g, ' ').replace(/\s+/g, ' ').trim();
  const qTokens = qClean.split(' ').filter((t) => t.length > 0);
  const prefNorm = preferredName ? preferredName.toLowerCase().replace(/[\.\,\-\_]/g, ' ').replace(/\s+/g, ' ').trim() : '';

  // 0. Preferred user alias match
  if (prefNorm) {
    const prefUser = users.find((u) => {
      const f = (u.userFullName || '').toLowerCase().replace(/[\.\,\-\_]/g, ' ').replace(/\s+/g, ' ').trim();
      const uName = (u.userName || '').toLowerCase().replace(/[\.\,\-\_]/g, ' ').replace(/\s+/g, ' ').trim();
      return f === prefNorm || uName === prefNorm || f.includes(prefNorm) || prefNorm.includes(f);
    });
    if (prefUser) {
      const prefWords = `${prefUser.userName || ''} ${prefUser.userFullName || ''}`
        .toLowerCase()
        .replace(/[\.\,\-\_]/g, ' ')
        .split(' ')
        .filter(Boolean);
      if (prefWords.includes(qClean) || (qTokens.length > 0 && qTokens.every(t => prefWords.includes(t)))) {
        return prefUser;
      }
    }
  }

  // 1. Exact Email
  if (q.includes('@')) {
    const emailMatch = users.find((u) => (u.email || '').toLowerCase().trim() === q);
    if (emailMatch) return emailMatch;
  }

  // 2. Exact match on username or full name
  const exactMatches = users.filter((u) => {
    const uName = (u.userName || '').toLowerCase().trim();
    const fName = (u.userFullName || '').toLowerCase().trim();
    return uName === q || fName === q;
  });
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) {
    const r5Match = exactMatches.find(isRegionV);
    if (r5Match) return r5Match;
    return exactMatches[0];
  }

  // 3. Normalized clean match
  const cleanMatches = users.filter((u) => {
    const uNameClean = (u.userName || '').toLowerCase().replace(/[\.\,\-\_]/g, ' ').replace(/\s+/g, ' ').trim();
    const fNameClean = (u.userFullName || '').toLowerCase().replace(/[\.\,\-\_]/g, ' ').replace(/\s+/g, ' ').trim();
    return uNameClean === qClean || fNameClean === qClean;
  });
  if (cleanMatches.length === 1) return cleanMatches[0];
  if (cleanMatches.length > 1) {
    const r5Match = cleanMatches.find(isRegionV);
    if (r5Match) return r5Match;
    return cleanMatches[0];
  }

  // 4. Multi-token scoring (all tokens must match)
  if (qTokens.length > 1) {
    let bestUsers = [];
    let bestScore = 0;
    for (const u of users) {
      const uFull = `${u.userName || ''} ${u.userFullName || ''} ${u.email || ''}`
        .toLowerCase()
        .replace(/[\.\,\-\_]/g, ' ');
      const matchedCount = qTokens.filter((t) => uFull.includes(t)).length;
      if (matchedCount === qTokens.length) {
        if (matchedCount > bestScore) {
          bestScore = matchedCount;
          bestUsers = [u];
        } else if (matchedCount === bestScore) {
          bestUsers.push(u);
        }
      }
    }
    if (bestUsers.length === 1) return bestUsers[0];
    if (bestUsers.length > 1) {
      const r5Match = bestUsers.find(isRegionV);
      if (r5Match) return r5Match;
      return bestUsers[0];
    }
  }

  // 5. Employee number
  const empMatch = users.find((u) => (u.employeeNumber || '').toLowerCase().trim() === q);
  if (empMatch) return empMatch;

  // 6. Word boundary match on single token
  const wordMatches = users.filter((u) => {
    const uNameClean = (u.userName || '').toLowerCase().replace(/[\.\,\-\_]/g, ' ').replace(/\s+/g, ' ').trim();
    const fNameClean = (u.userFullName || '').toLowerCase().replace(/[\.\,\-\_]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = `${uNameClean} ${fNameClean}`.split(' ');
    return words.includes(qClean) || (qClean.length >= 4 && fNameClean.includes(qClean));
  });
  if (wordMatches.length === 1) return wordMatches[0];
  if (wordMatches.length > 1) {
    const r5Match = wordMatches.find(isRegionV);
    if (r5Match) return r5Match;
    return wordMatches[0];
  }

  return null;
}

console.log('Query "Ace" with preferred "Ace Mata Malto":', findOtcUser(users, 'Ace', 'Ace Mata Malto')?.userFullName, '|', findOtcUser(users, 'Ace', 'Ace Mata Malto')?.departmentName);
console.log('Query "Ace" without preferredName:', findOtcUser(users, 'Ace')?.userFullName, '|', findOtcUser(users, 'Ace')?.departmentName);
console.log('Query "Ace M.":', findOtcUser(users, 'Ace M.')?.userFullName, '|', findOtcUser(users, 'Ace M.')?.departmentName);
console.log('Query "Ace Mata Malto":', findOtcUser(users, 'Ace Mata Malto')?.userFullName, '|', findOtcUser(users, 'Ace Mata Malto')?.departmentName);
console.log('Query "Ralph Dela Torre":', findOtcUser(users, 'Ralph Dela Torre')?.userFullName, '|', findOtcUser(users, 'Ralph Dela Torre')?.departmentName);
