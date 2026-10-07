import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUTPUT_DIR = 'C:\\Users\\Ace\\Desktop\\Project\\DICT Sys\\dict-monitoring\\screenshots';

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const adminUser = {
  id: 3,
  name: "Juan Dela Cruz",
  email: "juan.dela.cruz@dict.gov.ph",
  role: "Super Admin",
  region: "National",
  status: "active",
  isFocal: false,
  access: {
    MOD_OVERVIEW: true,
    MOD_DTR: true,
    MOD_CALENDAR: true,
    MOD_SIGNING: true,
    MOD_GECS: true,
    MOD_FREEWIFI: true,
    MOD_EGOVPH: true,
    MOD_ELGU: true,
    MOD_NBP: true,
    MOD_GOVNET: true,
    MOD_PNPKI: true,
    MOD_ILCDB: true,
    MOD_CYBERSECURITY: true,
    MOD_MISS: true,
    MOD_IIDB: true,
    MOD_PROJECT_DATA: true,
    MOD_ADMIN: true,
    gecs: true,
    freewifi: true,
    egovph: true,
    elgu: true,
    nbp: true,
    govnet: true,
    pnpki: true,
    ilcdb: true,
    cybersecurity: true,
    miss: true,
    iidb: true
  },
  authProvider: "google",
  lastLogin: "Just now"
};

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080 }
  });

  const page = await browser.newPage();

  // Test 1: Login page
  console.log('Capturing Login...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '01_Login.png') });
  console.log('Login captured.');

  // Set auth in localStorage
  await page.evaluate((user) => {
    localStorage.setItem('dict_current_user', JSON.stringify(user));
  }, adminUser);

  // Test 2: Overview
  console.log('Capturing Overview...');
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 15000 });
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: path.join(OUTPUT_DIR, '02_Overview.png') });
  console.log('Overview captured.');

  await browser.close();
  console.log('Done test!');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
