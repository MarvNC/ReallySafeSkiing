/**
 * Script to render the GameLogo component to PNG.
 * Uses a static HTML template with styles matching the lg breakpoint for consistency.
 *
 * Usage: bun scripts/render-logo.ts [--output-dir <dir>] [--scale <n>]
 *
 * Options:
 *   --output-dir  Directory to save output files (default: ./assets)
 *   --scale       Scale factor for PNG output (default: 2 for retina)
 */

import { readFile } from 'node:fs/promises';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

interface Options {
  outputDir: string;
  scale: number;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    outputDir: join(projectRoot, 'assets'),
    scale: 2,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output-dir' && args[i + 1]) {
      options.outputDir = args[++i];
    } else if (args[i] === '--scale' && args[i + 1]) {
      options.scale = parseInt(args[++i], 10);
    }
  }

  return options;
}

async function renderLogo(options: Options): Promise<void> {
  console.log('Rendering GameLogo...');

  // Read the HTML template
  const templatePath = join(__dirname, 'logo-template.html');
  const template = await readFile(templatePath, 'utf-8');

  // Ensure output directory exists
  await mkdir(options.outputDir, { recursive: true });

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // Set viewport for consistent rendering
    await page.setViewport({
      width: 800,
      height: 400,
      deviceScaleFactor: options.scale,
    });

    // Load the template
    await page.setContent(template, { waitUntil: 'networkidle0' });

    // Wait for font to load
    await page.evaluate(() => document.fonts.ready);

    // Get the logo element bounds
    const logoElement = await page.$('#logo-container');
    if (!logoElement) {
      throw new Error('Logo container not found');
    }

    const boundingBox = await logoElement.boundingBox();
    if (!boundingBox) {
      throw new Error('Could not get logo bounding box');
    }

    // Add padding around the logo
    const padding = 20;
    const clip = {
      x: Math.max(0, boundingBox.x - padding),
      y: Math.max(0, boundingBox.y - padding),
      width: boundingBox.width + padding * 2,
      height: boundingBox.height + padding * 2,
    };

    // Render PNG with transparent background
    const pngPath = join(options.outputDir, 'game-logo.png');
    await page.screenshot({
      path: pngPath,
      clip,
      omitBackground: true,
    });
    console.log(`  PNG saved: ${pngPath}`);

    console.log('\nLogo rendering complete!');
  } finally {
    await browser.close();
  }
}

// Main execution
const options = parseArgs();
renderLogo(options).catch((err) => {
  console.error('Error rendering logo:', err);
  process.exit(1);
});
