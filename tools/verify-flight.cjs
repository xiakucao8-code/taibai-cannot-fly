// Run: node tools/verify-flight.cjs <path-to-typescript.js>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require(process.argv[2] || 'typescript');
const source = fs.readFileSync(path.join(__dirname, '../game/assets/scripts/FlightModel.ts'), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
}).outputText;
const context = { exports: {} };
vm.runInNewContext(output, context);
const { FlightModel, FLIGHT, circleHitsRect } = context.exports;

const tap = new FlightModel();
tap.start();
tap.press();
assert.equal(tap.velocity, FLIGHT.tapRiseSpeed, 'a single press lifts immediately');
tap.held = false;
tap.step(FLIGHT.step);
assert.ok(tap.y > 0, 'a released tap still creates visible lift');
tap.velocity = -FLIGHT.maxFallSpeed;
tap.press();
assert.equal(tap.velocity, FLIGHT.tapRiseSpeed, 'a new tap reverses a fast fall');
tap.velocity = 400;
tap.press();
assert.equal(tap.velocity, 400, 'repeated taps do not stack unlimited speed');
tap.die();
tap.press();
assert.equal(tap.velocity, 0, 'dead character ignores taps');

const flight = new FlightModel();
flight.start();
flight.held = true;
for (let i = 0; i < 600; i++) flight.step(FLIGHT.step);
assert.equal(flight.velocity, FLIGHT.maxRiseSpeed, 'rising speed is capped');
assert.ok(flight.angle > 24 && flight.angle <= 25, 'rising tilt is bounded');
const beforeRelease = flight.y;
flight.held = false;
flight.step(FLIGHT.step);
assert.ok(flight.y > beforeRelease, 'release preserves upward inertia');
for (let i = 0; i < 600; i++) flight.step(FLIGHT.step);
assert.equal(flight.velocity, -FLIGHT.maxFallSpeed, 'falling speed is capped');
assert.ok(flight.angle < -39 && flight.angle >= -40, 'falling tilt is bounded');
flight.die();
const deadY = flight.y;
flight.step(1);
assert.equal(flight.y, deadY, 'death stops simulation');
assert.equal(flight.held, false, 'death clears input');
flight.reset();
assert.equal(flight.phase, 'ready');
assert.equal(flight.y + flight.velocity + flight.angle, 0, 'restart clears motion');

assert.equal(circleHitsRect(0, 0, 30, 30, -10, 20, 20), true, 'edge contact collides');
assert.equal(circleHitsRect(0, 0, 30, 31, -10, 20, 20), false, 'visible gap does not collide');
assert.equal(circleHitsRect(0, 0, 30, 25, 25, 20, 20), false, 'rectangle corner outside circle is safe');
assert.equal(circleHitsRect(0, 0, 30, 20, 20, 20, 20), true, 'rectangle corner inside circle collides');
console.log('PASS: click lift, hold flight, speed limits, inertia, tilt, death, reset, collision');
