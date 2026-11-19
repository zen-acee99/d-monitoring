import { appendSignatureIncremental } from "../server/services/pnpkiSigningService";

async function testViewerPreferencesAtEnd() {
  const rawPdf = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
/ViewerPreferences << /FitWindow true >>
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000100 00000 n 
0000000157 00000 n 
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
225
%%EOF`;

  const updated = await appendSignatureIncremental(
    Buffer.from(rawPdf, "binary"),
    "Test Signer",
    [[100, 100, 250, 150]],
    "Testing ViewerPreferences at end"
  );

  const updatedStr = updated.toString("latin1");
  const obj1Matches = [...updatedStr.matchAll(/1\s+0\s+obj([\s\S]*?)endobj/g)];
  console.log("Updated obj 1 definition:\n" + obj1Matches[obj1Matches.length - 1][1]);
}

testViewerPreferencesAtEnd().catch(console.error);
