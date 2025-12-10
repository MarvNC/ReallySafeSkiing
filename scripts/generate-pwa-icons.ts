/**
 * Script to generate PWA icons from the SVG icon.
 * Generates PNG icons in multiple sizes required for PWA manifests.
 *
 * Usage: bun scripts/generate-pwa-icons.ts
 */

import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

type IconSpec = {
  size: number;
  name: string;
};

const iconSizes: IconSpec[] = [
  { size: 64, name: 'pwa-64x64.png' },
  { size: 192, name: 'pwa-192x192.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 512, name: 'pwa-512x512.png' },
];

async function generateIcons(): Promise<void> {
  const svgPath = join(projectRoot, 'public', 'icon.svg');
  const outputDir = join(projectRoot, 'public');

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  console.log('Generating PWA icons from icon.svg...\n');

  for (const icon of iconSizes) {
    const outputPath = join(outputDir, icon.name);

    const pipeline = sharp(svgPath, { density: 512 }).resize(icon.size, icon.size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });

    await pipeline.png().toFile(outputPath);

    const metadata = await sharp(outputPath).metadata();
    console.log(`✓ Generated ${icon.name} - ${metadata.width}x${metadata.height}px`);
  }

  console.log('\nPWA icons generated successfully!');
}

generateIcons()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error generating icons:', err);
    process.exit(1);
  });
