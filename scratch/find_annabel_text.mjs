import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    headless: true
  });
  const page = await browser.newPage();
  await page.goto('file:///' + process.cwd().replace(/\\/g, '/') + '/scratch/render_temp.html');
  await page.waitForFunction(() => window.DONE, { timeout: 15000 });
  const textContent = await page.evaluate(async () => {
    const scripts = document.querySelectorAll('script');
    let base64 = '';
    for (const s of scripts) {
      const m = s.textContent.match(/const raw = atob\("([^"]+)"\)/);
      if (m) { base64 = m[1]; break; }
    }
    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) arr[i] = raw.charCodeAt(i);
    const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
    const p1 = await pdf.getPage(1);
    const tc = await p1.getTextContent();
    return tc.items.map(it => ({ str: it.str, transform: it.transform, width: it.width, height: it.height }));
  });
  console.log('Items found:', textContent.length);
  for(const it of textContent) {
    if (it.str.includes('ANNABEL') || it.str.includes('CALIMPONG') || it.str.includes('Noted') || it.str.includes('LEAH') || it.str.includes('BALANA') || it.str.includes('CABREDO')) {
      console.log(it.str, 'x:', it.transform[4], 'y:', it.transform[5], 'w:', it.width, 'h:', it.height);
    }
  }
  await browser.close();
}
main().catch(console.error);
