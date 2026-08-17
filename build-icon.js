const sharp = require('sharp');
const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, 'renderer', 'assets', 'logo.jpeg');
const OUTPUT_DIR = path.join(__dirname, 'renderer', 'assets');
const BUILD_DIR = path.join(__dirname, 'build');

async function buildIcons() {
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  // Windows standard icon sizes
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  console.log('Generating PNG icons from logo.jpeg...');
  for (const size of icoSizes) {
    const buf = await sharp(SOURCE)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .png()
      .toBuffer();
    pngBuffers.push(buf);
    console.log(`  ✓ ${size}x${size}`);
  }

  // 256x256 and 512x512 PNGs for electron-builder / packaging
  const png256 = pngBuffers[pngBuffers.length - 1];
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.png'), png256);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'icon.png'), png256);

  const png512 = await sharp(SOURCE)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(BUILD_DIR, 'icon-512.png'), png512);

  // Generate complete Windows .ico file with all standard sizes
  console.log('Generating standard Windows .ico file...');
  const icoBuffer = await pngToIco(pngBuffers);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'icon.ico'), icoBuffer);
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), icoBuffer);

  console.log(`✅ Icons generated successfully! (${icoBuffer.length} bytes)`);
  console.log(`  → ${path.join(OUTPUT_DIR, 'icon.ico')}`);
  console.log(`  → ${path.join(BUILD_DIR, 'icon.ico')}`);
}

buildIcons().catch(err => {
  console.error('❌ Icon generation failed:', err);
  process.exit(1);
});
