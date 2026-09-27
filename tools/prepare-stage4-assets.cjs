const fs = require('node:fs');
const path = require('node:path');
const sharp = require('C:/Users/Huawei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets', 'art');
const destination = path.join(root, 'game', 'assets', 'resources', 'stage4');

const entries = [
  ['backgrounds/bg_tiangong_sky.png', 'backgrounds/sky.png', 960, false],
  ['backgrounds/bg_tiangong_far_islands.png', 'backgrounds/far_islands.png', 1024, true],
  ['backgrounds/bg_tiangong_mid_palace.png', 'backgrounds/mid_palace.png', 1024, true],
  ['backgrounds/bg_cloud_bank.png', 'backgrounds/cloud_bank.png', 960, true],
  ['characters/taibai/taibai_idle.png', 'characters/taibai_idle.png', 512, true],
  ['characters/taibai/taibai_rise.png', 'characters/taibai_rise.png', 512, true],
  ['characters/taibai/taibai_fall.png', 'characters/taibai_fall.png', 512, true],
  ['characters/taibai/taibai_hit.png', 'characters/taibai_hit.png', 512, true],
  ['obstacles/ground/obstacle_mountain.png', 'obstacles/mountain.png', 320, true],
  ['obstacles/ground/obstacle_stone_pillar.png', 'obstacles/stone_pillar.png', 320, true],
  ['obstacles/ground/obstacle_fireball.png', 'obstacles/fireball.png', 256, true],
  ['obstacles/sky/obstacle_storm_cloud.png', 'obstacles/storm_cloud.png', 256, true],
  ['obstacles/sky/obstacle_lightning.png', 'obstacles/lightning.png', 320, true],
  ['obstacles/sky/obstacle_wind_fire_wheel.png', 'obstacles/wind_fire_wheel.png', 256, true],
  ['ui/ui_title_taibai.png', 'ui/title.png', 640, true],
  ['ui/ui_panel_results.png', 'ui/results_panel.png', 640, true],
  ['ui/ui_button_primary.png', 'ui/primary_button.png', 400, true],
  ['ui/icons/ui_hint_hold.png', 'ui/hold_hint.png', 128, true],
];

async function alphaBounds(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = -1, bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * info.channels + 3] < 16) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left) return { left: 0, top: 0, width: info.width, height: info.height };
  const margin = Math.ceil(Math.max(right - left, bottom - top) * 0.025);
  left = Math.max(0, left - margin); top = Math.max(0, top - margin);
  right = Math.min(info.width - 1, right + margin);
  bottom = Math.min(info.height - 1, bottom + margin);
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function main() {
  const manifest = [];
  for (const [from, to, maxWidth, trim] of entries) {
    const input = path.join(source, from);
    const output = path.join(destination, to);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    let pipeline = sharp(input);
    if (trim) pipeline = pipeline.extract(await alphaBounds(input));
    const info = await pipeline.resize({ width: maxWidth, withoutEnlargement: true }).png({ compressionLevel: 9, palette: false }).toFile(output);
    manifest.push({ source: from, resource: `stage4/${to.slice(0, -4)}`, width: info.width, height: info.height, bytes: info.size });
    console.log(`${to}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KiB`);
  }
  const mountainBase = path.join(destination, 'obstacles', 'mountain_base.png');
  const baseInfo = await sharp(path.join(destination, 'obstacles', 'mountain.png'))
    .extract({ left: 0, top: 330, width: 320, height: 145 })
    .png({ compressionLevel: 9 }).toFile(mountainBase);
  manifest.push({ source: 'derived from obstacles/ground/obstacle_mountain.png',
    resource: 'stage4/obstacles/mountain_base', width: baseInfo.width,
    height: baseInfo.height, bytes: baseInfo.size });
  fs.writeFileSync(path.join(destination, 'asset-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Total: ${(manifest.reduce((sum, entry) => sum + entry.bytes, 0) / 1024 / 1024).toFixed(2)} MiB`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
