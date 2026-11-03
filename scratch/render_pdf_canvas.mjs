import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

async function render() {
  const pdfBytes = fs.readFileSync('public/DTR_Ace_M._Malto_September_2026.pdf');
  const base64 = pdfBytes.toString('base64');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <style>
        body { margin: 0; padding: 20px; background: #525659; display: flex; justify-content: center; }
        canvas { box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
      </style>
    </head>
    <body>
      <canvas id="pdf-canvas"></canvas>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdfData = atob("${base64}");
        const uint8Array = new Uint8Array(pdfData.length);
        for (let i = 0; i < pdfData.length; i++) {
          uint8Array[i] = pdfData.charCodeAt(i);
        }

        pdfjsLib.getDocument({ data: uint8Array }).promise.then(pdf => {
          return pdf.getPage(1).then(page => {
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.getElementById('pdf-canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
              canvasContext: context,
              viewport: viewport
            };
            return page.render(renderContext).promise;
          });
        }).then(() => {
          window.RENDER_DONE = true;
        });
      </script>
    </body>
    </html>
  `;

  fs.writeFileSync('scratch/pdf_viewer.html', html);

  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    headless: true,
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1800 });
  const htmlPath = path.resolve('scratch/pdf_viewer.html');
  await page.goto('file:///' + htmlPath.replace(/\\/g, '/'));

  await page.waitForFunction('window.RENDER_DONE === true', { timeout: 15000 });

  const canvasEl = await page.$('#pdf-canvas');
  await canvasEl.screenshot({ path: 'scratch/clean_canvas_preview.png' });
  console.log('Saved clean canvas preview to scratch/clean_canvas_preview.png');

  await browser.close();
}

render().catch(console.error);
