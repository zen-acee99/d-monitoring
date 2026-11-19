import fs from 'fs';

async function verify() {
  const bytes = fs.readFileSync('scratch/signed_ob_slip.pdf');
  const str = new TextDecoder('latin1').decode(bytes);

  // Find all /Subtype /Widget
  const matches = str.match(/\/Rect\s*\[\s*([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s+([\d\.\-]+)\s*\]/g);
  console.log("All /Rect in document:", matches);

  // Check occurrences of Digitally signed by Buena
  const textMatches = str.match(/Digitally signed by/g);
  console.log("Digitally signed by count:", textMatches ? textMatches.length : 0);

  const buenaMatches = str.match(/Buena Rene Jane Rosendo/g);
  console.log("Buena Rene Jane Rosendo count in appearance streams:", buenaMatches ? buenaMatches.length : 0);

  const sigImgMatches = str.match(/\/SigImg\s+Do/g);
  console.log("/SigImg Do count:", sigImgMatches ? sigImgMatches.length : 0);
}
verify().catch(console.error);
