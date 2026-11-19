import puppeteer from 'puppeteer-core';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  // Set user in localStorage
  await page.goto('http://localhost:3000/login');
  await page.evaluate(() => {
    localStorage.setItem('dict_user', JSON.stringify({
      email: 'ace.malto@dict.gov.ph',
      name: 'Ace Malto',
      role: 'SUPER_ADMIN',
      access: { MOD_SIGNING: true, MOD_OVERVIEW: true, MOD_DTR: true }
    }));
  });

  console.log('Navigating to http://localhost:3000/signing-workspace...');
  await page.goto('http://localhost:3000/signing-workspace', { waitUntil: 'networkidle2' });

  // Check canvas on signing-workspace
  const canvasInfo = await page.evaluate(() => {
    const canvasList = Array.from(document.querySelectorAll('canvas'));
    return canvasList.map(c => ({
      tagName: c.tagName,
      dataFallingSnow: c.hasAttribute('data-falling-snow'),
      width: c.width,
      height: c.height,
      style: c.getAttribute('style'),
      zIndex: window.getComputedStyle(c).zIndex,
      display: window.getComputedStyle(c).display,
    }));
  });
  console.log('Canvas info on signing-workspace:', JSON.stringify(canvasInfo, null, 2));

  await page.screenshot({ path: 'scratch/snow_signing_workspace.png' });
  console.log('Screenshot saved to scratch/snow_signing_workspace.png');

  await browser.close();
}

main().catch(console.error);
