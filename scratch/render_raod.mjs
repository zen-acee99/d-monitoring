import puppeteer from 'puppeteer-core';
import fs from 'fs';

async function main() {
  const pdfBytes = fs.readFileSync('C:/Users/Ace/Downloads/October RAOD - TechQuest 02-0204.pdf');
  const base64 = pdfBytes.toString('base64');
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
    </head>
    <body style="margin:0">
      <canvas id="c"></canvas>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const raw = atob("${base64}");
        const arr = new Uint8Array(raw.length);
        for(let i=0;i<raw.length;i++) arr[i] = raw.charCodeAt(i);
        pdfjsLib.getDocument({ data: arr }).promise.then(p => p.getPage(1)).then(page => {
          const vp = page.getViewport({ scale: 1.5 });
          const c = document.getElementById('c');
          c.width = vp.width;
          c.height = vp.height;
          return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
        }).then(() => { window.DONE = true; });
      </script>
    </body>
    </html>
  `;
  fs.writeFileSync('scratch/render_temp.html', html);
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    headless: true
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  await page.goto('file:///' + process.cwd().replace(/\\/g, '/') + '/scratch/render_temp.html');
  await page.waitForFunction(() => window.DONE, { timeout: 15000 });
  const canvas = await page.$('#c');
  await canvas.screenshot({ path: 'scratch/final_downloads_raod.png' });
  await browser.close();
  console.log('Rendered scratch/final_downloads_raod.png successfully!');
}
main().catch(console.error);
