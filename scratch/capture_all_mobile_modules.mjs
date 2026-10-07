import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE_OUTPUT_DIR = 'C:\\Users\\Ace\\Desktop\\Project\\DICT Sys\\screenshots\\mobile';

const MONITORING_DIR = path.join(BASE_OUTPUT_DIR, 'dict-monitoring');
const DTR_APP_DIR = path.join(BASE_OUTPUT_DIR, 'dict-dtr-generator');

[BASE_OUTPUT_DIR, MONITORING_DIR, DTR_APP_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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

const monitoringModules = [
  { name: '01_Login_Gateway', url: 'http://localhost:3000/login', auth: false, wait: 1500 },
  { name: '02_Executive_Overview_Dashboard', url: 'http://localhost:3000/', auth: true, wait: 2500 },
  { name: '03_DTR_Generator_Workspace', url: 'http://localhost:3000/dtr?tab=generator', auth: true, wait: 2500 },
  { name: '04_DTR_HRM_Storage', url: 'http://localhost:3000/dtr?tab=hrm', auth: true, wait: 2000 },
  { name: '05_DTR_TOD_Storage', url: 'http://localhost:3000/dtr?tab=tod', auth: true, wait: 2000 },
  { name: '06_DTR_Provincial_Storage', url: 'http://localhost:3000/dtr?tab=provincial', auth: true, wait: 2000 },
  { name: '07_Regional_Calendar', url: 'http://localhost:3000/calendar', auth: true, wait: 2500 },
  { name: '08_Signing_Workspace', url: 'http://localhost:3000/signing-workspace', auth: true, wait: 2500 },
  { name: '09_Project_GECS', url: 'http://localhost:3000/projects/gecs', auth: true, wait: 2500 },
  { name: '10_Project_Free_WiFi', url: 'http://localhost:3000/projects/freewifi', auth: true, wait: 2500 },
  { name: '11_Project_eGOVPH', url: 'http://localhost:3000/projects/egovph', auth: true, wait: 2500 },
  { name: '12_Project_eLGU', url: 'http://localhost:3000/projects/elgu', auth: true, wait: 2500 },
  { name: '13_Project_NBP', url: 'http://localhost:3000/projects/nbp', auth: true, wait: 2500 },
  { name: '14_Project_GovNet', url: 'http://localhost:3000/projects/govnet', auth: true, wait: 2500 },
  { name: '15_Project_PNPKI', url: 'http://localhost:3000/projects/pnpki', auth: true, wait: 2500 },
  { name: '16_Project_ILCDB', url: 'http://localhost:3000/projects/ilcdb', auth: true, wait: 2500 },
  { name: '17_Project_Cybersecurity', url: 'http://localhost:3000/projects/cybersecurity', auth: true, wait: 2500 },
  { name: '18_Project_MISS', url: 'http://localhost:3000/projects/miss', auth: true, wait: 2500 },
  { name: '19_Project_IIDB', url: 'http://localhost:3000/projects/iidb', auth: true, wait: 2500 },
  { name: '20_Settings_Project_Data_Management', url: 'http://localhost:3000/settings/projects', auth: true, wait: 2500 },
  { name: '21_Settings_User_Directory_Access', url: 'http://localhost:3000/settings/users', auth: true, wait: 2500 },
  { name: '22_Settings_System_Administration', url: 'http://localhost:3000/settings/system', auth: true, wait: 2500 }
];

const dtrAppModules = [
  { name: '01_DTR_App_Login', url: 'http://localhost:3002/login', auth: false, wait: 1500 },
  { name: '02_DTR_App_Main_Workspace', url: 'http://localhost:3002/dtr', auth: true, wait: 2500 },
  { name: '03_DTR_App_Schedule_Settings', url: 'http://localhost:3002/schedule', auth: true, wait: 2000 },
  { name: '04_DTR_App_User_Biometrics_Setup', url: 'http://localhost:3002/user-setup', auth: true, wait: 2500 },
  { name: '05_DTR_App_User_Access', url: 'http://localhost:3002/users', auth: true, wait: 2000 }
];

async function captureUrl(page, mod, destDir) {
  const dest = path.join(destDir, `${mod.name}_Mobile.png`);
  console.log(`Capturing Mobile [${mod.name}] from ${mod.url}...`);
  try {
    // Reset viewport to mobile standard initially
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

    if (!mod.auth) {
      await page.evaluate(() => localStorage.removeItem('dict_current_user'));
      await page.goto(mod.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(r => setTimeout(r, mod.wait));
    } else {
      await page.goto(mod.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await new Promise(r => setTimeout(r, mod.wait));
    }

    // Determine full scrollable height for full mobile capture
    const totalHeight = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main && main.scrollHeight > 500) {
        return main.scrollHeight + 80;
      }
      return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    });

    const targetHeight = Math.min(Math.max(totalHeight || 844, 844), 10000);
    await page.setViewport({ width: 390, height: targetHeight, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await new Promise(r => setTimeout(r, 400));

    await page.screenshot({ path: dest });
    console.log(`✓ Saved Mobile: ${dest} (Height: ${targetHeight}px)`);

    // Restore auth if we cleared it
    if (!mod.auth) {
      await page.evaluate((user) => {
        localStorage.setItem('dict_current_user', JSON.stringify(user));
      }, adminUser);
    }
  } catch (err) {
    console.error(`✗ Error capturing Mobile ${mod.name}:`, err.message);
  }
}

async function main() {
  console.log('Starting Mobile screenshot capture for all website modules (iPhone 390px width)...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  });

  const page = await browser.newPage();

  // 1. DICT Monitoring (Port 3000)
  console.log('\n--- CAPTURING MOBILE DICT MONITORING (PORT 3000) ---');
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((user) => {
    localStorage.setItem('dict_current_user', JSON.stringify(user));
  }, adminUser);

  for (const mod of monitoringModules) {
    await captureUrl(page, mod, MONITORING_DIR);
  }

  // 2. DICT DTR Generator (Port 3002)
  console.log('\n--- CAPTURING MOBILE DICT DTR GENERATOR (PORT 3002) ---');
  try {
    await page.goto('http://localhost:3002/login', { waitUntil: 'domcontentloaded' });
    await page.evaluate((user) => {
      localStorage.setItem('dict_current_user', JSON.stringify(user));
    }, adminUser);

    for (const mod of dtrAppModules) {
      await captureUrl(page, mod, DTR_APP_DIR);
    }
  } catch (err) {
    console.warn('Port 3002 mobile capture error:', err.message);
  }

  await browser.close();
  console.log('\nAll mobile screenshots captured successfully!');
  console.log(`Saved in: ${BASE_OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
