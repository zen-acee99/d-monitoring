import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

async function main() {
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Users\\Ace\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe",
  ];

  let chromePath = "";
  for (const p of chromePaths) {
    if (fs.existsSync(p)) {
      chromePath = p;
      break;
    }
  }

  if (!chromePath) {
    console.log("Chrome executable not found.");
    return;
  }

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
  const pdfFilePath = path.resolve("scratch/ace_dtr_perfect_signed.pdf");
  await page.goto(`file://${pdfFilePath}`);
  await new Promise((r) => setTimeout(r, 1500));

  await page.screenshot({ path: "scratch/ace_dtr_perfect_signed.png" });
  await browser.close();
  console.log("Rendered scratch/ace_dtr_perfect_signed.png!");
}

main().catch(console.error);
