const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../game/build/wechatgame');
const source = path.resolve(root, 'assets/resources');
const subpackages = path.resolve(root, 'subpackages');
const destination = path.resolve(subpackages, 'resources');
const inside = target => target.startsWith(root + path.sep);
if (![source, subpackages, destination].every(inside)) throw new Error('Package path left the build directory');

if (fs.existsSync(source) && fs.existsSync(destination)) {
  throw new Error('Both resources locations exist; inspect them before packaging again');
}
if (!fs.existsSync(source) && !fs.existsSync(destination)) {
  throw new Error('Missing built resources bundle; build wechatgame first');
}
if (fs.existsSync(source)) {
  fs.mkdirSync(subpackages, { recursive: true });
  fs.renameSync(source, destination);
}

const gameJsonPath = path.join(root, 'game.json');
const settingsPath = path.join(root, 'src/settings.json');
const gameJson = JSON.parse(fs.readFileSync(gameJsonPath, 'utf8'));
gameJson.subpackages = [{ name: 'resources', root: 'subpackages/resources' }];
fs.writeFileSync(gameJsonPath, JSON.stringify(gameJson, null, 2) + '\n');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
settings.assets.subpackages = ['resources'];
fs.writeFileSync(settingsPath, JSON.stringify(settings));

function directoryBytes(directory) {
  let bytes = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    bytes += entry.isDirectory() ? directoryBytes(target) : fs.statSync(target).size;
  }
  return bytes;
}
const total = directoryBytes(root);
const artPackage = directoryBytes(destination);
const main = total - artPackage;
console.log(JSON.stringify({ mainMiB: +(main / 1048576).toFixed(2),
  resourcesMiB: +(artPackage / 1048576).toFixed(2),
  totalMiB: +(total / 1048576).toFixed(2) }));
if (main > 4 * 1048576) throw new Error('WeChat main package exceeds 4 MiB');
if (total > 20 * 1048576) throw new Error('WeChat full package exceeds 20 MiB');
