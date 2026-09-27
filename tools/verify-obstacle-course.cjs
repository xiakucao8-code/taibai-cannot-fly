// Run: node tools/verify-obstacle-course.cjs <path-to-typescript.js>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(process.argv[2] || 'typescript');
const scripts = path.join(__dirname, '../game/assets/scripts');

function load(name, imports = {}) {
  const source = fs.readFileSync(path.join(scripts, `${name}.ts`), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
  }).outputText;
  const context = { exports: {}, require: id => imports[id] };
  vm.runInNewContext(js, context, { filename: `${name}.ts` });
  return context.exports;
}
const flight = load('FlightModel');
const { ObstacleCourse, circleHitsCircle, circleHitsTriangle } = load('ObstacleCourse', { './FlightModel': flight });
let seed = 42691;
const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
const course = new ObstacleCourse(720, 1280, -160, random);
course.reset();
assert.equal(course.score, 0);
assert.ok(course.active.length >= 3, 'initial obstacles are staged outside the right edge');
assert.ok(course.active.every(pair => pair.x - pair.width / 2 > 360), 'no instant collision');
assert.equal(circleHitsCircle(0, 0, 30, 61, 0, 30), false);
assert.equal(circleHitsCircle(0, 0, 30, 60, 0, 30), true);
assert.equal(circleHitsTriangle(0, 0, 1, 0, 20, -20, -20, 20, -20), true,
  'the mountain silhouette remains solid');
assert.equal(circleHitsTriangle(18, 12, 1, 0, 20, -20, -20, 20, -20), false,
  'empty sky beside the painted peak is safe');

const seen = new Set();
let prior = null;
for (let cycle = 0; cycle < 50; cycle++) {
  for (const pair of course.active) {
    const key = `${pair.lower}+${pair.upper}`;
    seen.add(key);
    assert.ok(pair.gap >= 2 * flight.FLIGHT.radius + 100, 'gap keeps player clearance');
    assert.ok(pair.center - pair.gap / 2 >= -616 + 48, 'lower opening has margin');
    assert.ok(pair.center + pair.gap / 2 <= 616 - 48, 'upper opening has margin');
    if (pair.upper === 'lightning') {
      assert.ok(pair.center + pair.gap / 2 <= 616 - 170,
        'storm clouds retain room for a visible warning and strike');
    }
    const originalX = pair.x;
    pair.x = course.playerX;
    assert.equal(course.hits(pair, pair.center), false, 'center of every opening is safe');
    for (const age of [0, 0.5, 1, 2, 3]) {
      pair.age = age;
      assert.equal(course.hits(pair, pair.center - pair.gap / 2 + flight.FLIGHT.radius + 1), false,
        'lower side stays safe throughout dynamic motion');
      assert.equal(course.hits(pair, pair.center + pair.gap / 2 - flight.FLIGHT.radius - 1), false,
        'upper side stays safe throughout dynamic motion');
    }
    pair.x = originalX;
    if (prior) {
      assert.ok(Math.abs(pair.center - prior.center) <= 180.001, 'neighboring centers are reachable');
      assert.notEqual(key, prior.key, 'identical combinations do not repeat directly');
    }
    prior = { center: pair.center, key };
  }
  course.active.forEach(pair => { pair.x = -10000; });
  const result = course.step(1 / 120, 0);
  assert.equal(result.hit, false);
  assert.ok(course.active.length <= 5, 'active set stays bounded');
  assert.ok(course.pool.length <= 5, 'pair data objects are recycled');
}
assert.equal(seen.size, 9, 'all nine lower/upper combinations appear');
assert.equal(course.difficulty.speed, 320, 'speed reaches its cap');
assert.equal(course.difficulty.gap, 335, 'opening shrink reaches its cap');
assert.equal(course.difficulty.spacing, 420, 'spacing reaches its cap');

course.reset();
const first = course.active[0];
first.x = course.playerX - first.width / 2 + 10;
let result = course.step(1 / 120, first.center);
assert.equal(result.gained, 0, 'score line has not passed the player');
first.x = course.playerX - first.width / 2 - 1;
result = course.step(1 / 120, first.center);
assert.equal(result.gained, 1, 'trailing edge passing the player scores once');
assert.equal(course.score, 1);
result = course.step(1 / 120, first.center);
assert.equal(result.gained, 0, 'a pair cannot score twice');

course.reset();
assert.equal(course.score, 0, 'restart clears score');
assert.ok(course.active.every(pair => !pair.scored && pair.age === 0), 'restart clears pair state');
course.active[0].x = course.playerX - course.active[0].width;
course.active[1].x = course.playerX;
const dangerous = course.active[1];
result = course.step(1 / 120, dangerous.center + dangerous.gap / 2 + flight.FLIGHT.radius + 5);
assert.equal(result.hit, true, 'upper obstacle is lethal');
assert.equal(result.gained, 0, 'death cancels scoring in the same step');
assert.equal(course.score, 0);

console.log('PASS: pooled pairs, nine combinations, safe moving gaps, reachable centers, score line, difficulty and restart');
