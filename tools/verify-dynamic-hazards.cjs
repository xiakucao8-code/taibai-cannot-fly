// Run: node tools/verify-dynamic-hazards.cjs <path-to-typescript.js>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(process.argv[2] || 'typescript');
const dir = path.join(__dirname, '../game/assets/scripts');
function load(name, imports = {}) {
  const source = fs.readFileSync(path.join(dir, `${name}.ts`), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const context = { exports: {}, require: id => imports[id] };
  vm.runInNewContext(js, context, { filename: `${name}.ts` });
  return context.exports;
}
const flight = load('FlightModel');
const hazard = load('ObstacleCourse', { './FlightModel': flight });
const { ObstacleCourse, LIGHTNING, fireballY, wheelY, wheelAngle,
  lightningCloudY, lightningPhase } = hazard;
const playerX = -160;
const pair = {
  x: playerX + 500, width: 100, center: 0, gap: 400,
  lower: 'fireball', upper: 'lightning', amplitude: 22,
  phase: 0, age: 0, scored: false, serial: 0,
};
const gapBottom = -200;
const gapTop = 200;
const course = new ObstacleCourse(720, 1280, playerX, () => 0.5);

assert.equal(lightningPhase(pair, playerX), 'dormant');
pair.x = playerX + LIGHTNING.warningDistance;
assert.equal(lightningPhase(pair, playerX), 'warning');
pair.x = playerX + LIGHTNING.strikeDistance + 0.01;
assert.equal(lightningPhase(pair, playerX), 'warning');
pair.x = playerX + LIGHTNING.strikeDistance;
assert.equal(lightningPhase(pair, playerX), 'strike');
assert.ok((LIGHTNING.warningDistance - LIGHTNING.strikeDistance) / 320 >= 0.7,
  'warning lasts at least 0.7 s at maximum course speed');
assert.ok(LIGHTNING.strikeDistance > pair.width / 2 + flight.FLIGHT.radius + 60,
  'strike becomes visible well before the hazard overlaps the player');
assert.ok(lightningCloudY(pair) - pair.width * LIGHTNING.cloudRadiusRatio > gapTop,
  'storm cloud stays above the safe opening');

for (const amplitude of [10, 16, 22]) {
  pair.amplitude = amplitude;
  pair.x = playerX;
  for (let i = 0; i <= 720; i++) {
    pair.age = i / 120;
    assert.ok(fireballY(pair) + pair.width * 0.4 <= gapBottom + 1e-8,
      'fireball never floats into the safe opening');
    assert.ok(wheelY(pair) - pair.width * 0.43 >= gapTop - 1e-8,
      'wheel never floats into the safe opening');
    assert.equal(course.hits(pair, 0), false, 'the center of the passage is always safe');
    assert.equal(course.hits(pair, gapTop - flight.FLIGHT.radius - 1), false,
      'the upper side retains collision clearance during the strike');
  }
}
pair.upper = 'wheel';
pair.age = 0;
assert.equal(wheelAngle(pair), 0);
pair.age = 0.5;
assert.equal(wheelAngle(pair), 60, 'wheel rotates steadily');
pair.age = 4;
assert.equal(wheelAngle(pair), 120, 'wheel angle stays bounded modulo 360');

pair.upper = 'lightning';
pair.age = 0;
pair.x = playerX;
assert.equal(course.hits(pair, gapTop + 10), true, 'visible strike lane is lethal');
pair.x = playerX + 300;
assert.equal(lightningPhase(pair, playerX), 'warning', 'a pooled pair does not flash without warning');
course.reset();
assert.ok(course.active.every(item => item.age === 0
  && lightningPhase(item, playerX) === 'dormant'), 'restart clears warning and strike states');

console.log('PASS: fireball and wheel envelopes, rotation, storm warning, strike timing and safe passage');
