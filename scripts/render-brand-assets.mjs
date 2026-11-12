import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

// Run `pnpm assets:brand` after editing the HTML artwork or SVG icon.
// Uses Playwright's Chromium by default; PLAYWRIGHT_CHANNEL=chrome uses installed Chrome.
const root = new URL("../", import.meta.url);
const app = new URL("src/app/", root);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
});

try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(new URL("assets/brand/social-preview.html", root).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: fileURLToPath(new URL("opengraph-image.png", app)),
  });

  const svg = await readFile(new URL("icon.svg", app), "utf8");
  const sizes = [16, 32, 48, 180];
  const icons = [];
  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>body{margin:0}svg{display:block;width:100%;height:100%}</style>${svg}`,
    );
    icons.push(await page.screenshot({ omitBackground: true }));
  }
  await writeFile(new URL("apple-icon.png", app), icons[3]);

  // ICO supports PNG entries; retain native resolutions for small browser tabs.
  const header = Buffer.alloc(6 + 16 * 3);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(3, 4);
  let offset = header.length;
  for (let index = 0; index < 3; index++) {
    const entry = 6 + index * 16;
    header[entry] = sizes[index];
    header[entry + 1] = sizes[index];
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(icons[index].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += icons[index].length;
  }
  await writeFile(
    new URL("favicon.ico", app),
    Buffer.concat([header, ...icons.slice(0, 3)]),
  );
  console.log(
    "Rendered social preview, favicon (16/32/48px), and Apple icon (180px).",
  );
} finally {
  await browser.close();
}
