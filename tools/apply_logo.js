#!/usr/bin/env node
/**
 * Generate every brand asset from the master art: assets/logo-master.png.
 *
 * Replaces tools/make_icons.py, which drew the old "7 on a baseline" mark.
 * The shipped logo is now supplied artwork, so the pipeline only derives
 * sizes and transparencies from it — it never redraws the brand.
 *
 * Outputs:
 *   assets/icon.png                       1024 opaque (iOS / store)
 *   assets/favicon.png                     196 opaque (web)
 *   assets/splash-icon.png                1024 keyed (native splash, contain)
 *   assets/android-icon-foreground.png    1024 keyed (adaptive foreground)
 *   assets/android-icon-monochrome.png    1024 white silhouette (themed icons)
 *   assets/android-icon-background.png    flat #0A0A0B (adaptive background)
 *   src/assets/seven_tracking_logo.png     512 keyed (in-app: auth, lock…)
 *
 * "Keyed": the artwork sits on pure black, which the app never shows — the
 * background is converted to transparency with a smoothstep ramp on
 * luminance, so the faint chart grid survives as low-alpha detail and the
 * dark plate blends into every dark surface instead of showing as a square.
 *
 * Run:  node tools/apply_logo.js
 */
const path = require('path');
const Jimp = require('jimp-compact');

const ROOT = path.join(__dirname, '..');
const MASTER = path.join(ROOT, 'assets', 'logo-master.png');
const ASSETS = path.join(ROOT, 'assets');
const SRC_ASSETS = path.join(ROOT, 'src', 'assets');

// Luminance ramp for keying the black background out.
const KEY_LO = 8;
const KEY_HI = 48;
// Harder ramp for the themed-icon silhouette: faint grid must vanish.
const SIL_LO = 18;
const SIL_HI = 82;

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const smooth = t => t * t * (3 - 2 * t);

/** Convert the black plate to transparency, keeping dark detail as low alpha. */
function keyAlpha(img, lo = KEY_LO, hi = KEY_HI) {
  const d = img.bitmap.data;
  for (let i = 0; i < d.length; i += 4) {
    const t = smooth(Math.max(0, Math.min(1, (luminance(d[i], d[i + 1], d[i + 2]) - lo) / (hi - lo))));
    d[i + 3] = Math.round(t * 255);
  }
  return img;
}

/** Flatten to a white silhouette: the OS tints themed icons itself. */
function toSilhouette(img) {
  const d = img.bitmap.data;
  for (let i = 0; i < d.length; i += 4) {
    const t = smooth(Math.max(0, Math.min(1, (luminance(d[i], d[i + 1], d[i + 2]) - SIL_LO) / (SIL_HI - SIL_LO))));
    d[i] = 255;
    d[i + 1] = 255;
    d[i + 2] = 255;
    d[i + 3] = Math.round(t * 255);
  }
  return img;
}

/** Alpha bounding box — sanity check that the mark sits in the mask safe zone. */
function alphaBBox(img) {
  const { width, height, data } = img.bitmap;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

async function save(img, relPath) {
  const p = path.join(ROOT, relPath);
  await img.writeAsync(p);
  console.log(`  ${relPath.padEnd(48)} ${img.bitmap.width}x${img.bitmap.height}`);
}

async function main() {
  const master = await Jimp.read(MASTER);
  const { width, height } = master.bitmap;
  if (width !== height) throw new Error(`Master must be square, got ${width}x${height}`);

  const px = (x, y) => {
    const i = (y * width + x) * 4;
    return [master.bitmap.data[i], master.bitmap.data[i + 1], master.bitmap.data[i + 2]];
  };
  console.log(`master ${width}x${height}, corners rgb=${px(2, 2)} ${px(width - 3, 2)} ${px(2, height - 3)}`);

  // iOS / store icon: opaque, full-bleed (App Store forbids transparency).
  await save(master.clone(), path.join('assets', 'icon.png'));

  // Web favicon: opaque, small.
  await save(
    master.clone().resize(196, 196, Jimp.RESIZE_BICUBIC),
    path.join('assets', 'favicon.png')
  );

  // Native splash: keyed, centred by expo-splash-screen (contain) on #0A0A0B.
  const splash = keyAlpha(master.clone());
  console.log('  splash alpha bbox', JSON.stringify(alphaBBox(splash)));
  await save(splash, path.join('assets', 'splash-icon.png'));

  /**
   * Android adaptive foreground: keyed, and scaled INTO the safe zone.
   *
   * It used to ship full-bleed, on the assumption that the mark survived the
   * mask. Measured on the built APK it does not: the artwork spans 71% of the
   * canvas and reaches x=150..874, while the launcher only guarantees the
   * central 66% (roughly 174..850). The outer edge was being cropped, which
   * is exactly what "the icon looks zoomed in" means -- the launcher was
   * showing a magnified crop rather than the whole logo.
   *
   * Drawing the mark at 60% of the canvas leaves the whole thing inside the
   * mask on a circle, a squircle or a rounded square alike.
   */
  const SAFE_FRACTION = 0.6;
  const fgInner = Math.round(1024 * SAFE_FRACTION);
  const foreground = new Jimp(1024, 1024, 0x00000000);
  const fgMark = keyAlpha(master.clone()).autocrop().contain(fgInner, fgInner, Jimp.RESIZE_BICUBIC);
  foreground.composite(fgMark, Math.round((1024 - fgInner) / 2), Math.round((1024 - fgInner) / 2));
  console.log('  adaptive fg bbox', JSON.stringify(alphaBBox(foreground)));
  await save(foreground, path.join('assets', 'android-icon-foreground.png'));

  // Android 13+ themed icon: single-colour silhouette the OS can tint.
  await save(toSilhouette(master.clone()), path.join('assets', 'android-icon-monochrome.png'));

  // Adaptive background layer: flat colour, matches app.json.
  await save(new Jimp(1024, 1024, 0x0a0a0bff), path.join('assets', 'android-icon-background.png'));

  // In-app logo (auth card, lock screen, share cards): keyed, 512.
  await save(
    keyAlpha(master.clone().resize(512, 512, Jimp.RESIZE_BICUBIC)),
    path.join('src', 'assets', 'seven_tracking_logo.png')
  );

  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
