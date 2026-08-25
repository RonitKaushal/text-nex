const path = require('path');
const fs = require('fs');
const { nativeImage } = require('electron');

const frontendRoot = path.join(__dirname, '..');

function iconPathForSize(size) {
  const candidates = [
    path.join(frontendRoot, 'assets', 'icons', `icon-${size}x${size}.png`),
    path.join(frontendRoot, 'public', 'icons', `icon-${size}x${size}.png`),
    path.join(frontendRoot, 'assets', 'icon.png'),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function getAppIcon(preferredSize = 256) {
  for (const size of [preferredSize, 256, 128, 64, 48, 32, 512, 1024, 16]) {
    const p = iconPathForSize(size);
    if (p) return nativeImage.createFromPath(p);
  }
  return undefined;
}

module.exports = { iconPathForSize, getAppIcon };
