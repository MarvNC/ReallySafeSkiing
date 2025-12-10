/**
 * Script to render the GameLogo and/or AppIcon components to PNG.
 * Starts a Vite dev server to ensure components are rendered with full CSS/styling,
 * exactly as they appear in the game.
 *
 * Usage: bun scripts/render-logo.ts [--output-dir <dir>] [--scale <n>] [--component <type>]
 *
 * Options:
 *   --output-dir  Directory to save output files (default: ./assets)
 *   --scale       Scale factor for PNG output (default: 2 for retina)
 *   --component   Component to render: logo, appicon, or both (default: both)
 */

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import puppeteer from 'puppeteer';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

type ComponentType = 'logo' | 'appicon' | 'both';

interface Options {
  outputDir: string;
  scale: number;
  component: ComponentType;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    outputDir: join(projectRoot, 'assets'),
    scale: 2,
    component: 'both',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output-dir' && args[i + 1]) {
      options.outputDir = args[++i];
    } else if (args[i] === '--scale' && args[i + 1]) {
      options.scale = parseInt(args[++i], 10);
    } else if (args[i] === '--component' && args[i + 1]) {
      const component = args[++i];
      if (component === 'logo' || component === 'appicon' || component === 'both') {
        options.component = component;
      } else {
        console.error(
          `Invalid component type: ${component}. Must be 'logo', 'appicon', or 'both'.`
        );
        process.exit(1);
      }
    }
  }

  return options;
}

async function startViteServer(): Promise<{ url: string; process: ReturnType<typeof spawn> }> {
  return new Promise((resolve, reject) => {
    const viteProcess = spawn('bun', ['vite', '--port', '5174'], {
      cwd: projectRoot,
      stdio: 'pipe',
    });

    let stderr = '';

    viteProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      // Look for the server URL in the output
      const match = output.match(/Local:\s+(http:\/\/[^\s]+)/);
      if (match) {
        resolve({ url: match[1], process: viteProcess });
      }
    });

    viteProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    viteProcess.on('error', (err) => {
      reject(new Error(`Failed to start Vite server: ${err.message}`));
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      reject(new Error(`Vite server failed to start:\n${stderr}`));
    }, 30000);
  });
}

async function renderComponent(
  componentType: 'logo' | 'appicon',
  options: Options,
  browser: Awaited<ReturnType<typeof puppeteer.launch>>,
  serverUrl: string
): Promise<void> {
  const isLogo = componentType === 'logo';
  const componentName = isLogo ? 'GameLogo' : 'AppIcon';
  const outputFilename = isLogo ? 'game-logo.png' : 'app-icon.png';

  console.log(`Rendering ${componentName}...`);

  const page = await browser.newPage();

  // Enable console logging from the page
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));

  try {
    // Set large viewport to capture everything
    const viewportConfig = isLogo
      ? { width: 1600, height: 800, deviceScaleFactor: options.scale }
      : { width: 800, height: 800, deviceScaleFactor: options.scale };

    await page.setViewport(viewportConfig);

    // Navigate with cache busting to ensure fresh render
    const cacheBuster = Date.now();
    const renderUrl = `${serverUrl}/scripts/render-page.html?component=${componentType}&t=${cacheBuster}`;
    await page.goto(renderUrl, { waitUntil: 'networkidle0' });

    // Wait for fonts to load
    await page.evaluate(() => document.fonts.ready);

    // Wait for React to render and animations to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Take full viewport screenshot to buffer
    const screenshotBuffer = await page.screenshot({
      omitBackground: true,
      type: 'png',
    });

    // Use sharp to automatically trim transparent pixels
    const pngPath = join(options.outputDir, outputFilename);
    await sharp(screenshotBuffer)
      .trim({
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
        threshold: 1, // Trim pixels with alpha <= 1
      })
      .toFile(pngPath);

    console.log(`  PNG saved (auto-trimmed): ${pngPath}`);
  } finally {
    await page.close();
  }
}

async function renderLogo(options: Options): Promise<void> {
  console.log('Starting Vite dev server...');

  let viteServer: { url: string; process: ReturnType<typeof spawn> } | null = null;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    // Ensure output directory exists
    await mkdir(options.outputDir, { recursive: true });

    // Start Vite dev server
    viteServer = await startViteServer();
    console.log(`Vite server started at ${viteServer.url}`);

    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // Determine which components to render
    const componentsToRender: Array<'logo' | 'appicon'> = [];

    if (options.component === 'both') {
      componentsToRender.push('logo', 'appicon');
    } else {
      componentsToRender.push(options.component);
    }

    // Render each component
    for (const component of componentsToRender) {
      await renderComponent(component, options, browser, viteServer.url);
    }

    console.log('\nComponent rendering complete!');
  } finally {
    // Cleanup
    if (browser) {
      await browser.close();
    }
    if (viteServer) {
      viteServer.process.kill();
    }
  }
}

// Main execution
const options = parseArgs();
renderLogo(options).catch((err) => {
  console.error('Error rendering logo:', err);
  process.exit(1);
});
