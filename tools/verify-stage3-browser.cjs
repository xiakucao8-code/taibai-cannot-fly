// Run after serving game/build/web-mobile on port 8766.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) {
        errors.push(message.text());
      }
    });
    await page.goto(process.env.GAME_PREVIEW_URL || 'http://127.0.0.1:8766/');
    await page.waitForFunction(() => !!window.System);
    await page.evaluate(async () => { window.testCC = await System.import('cc'); });
    await page.waitForFunction(() =>
      !!window.testCC.director.getScene()?.getChildByName('Canvas')?.getComponent('GameDirector'));
    const read = () => page.evaluate(() => {
      const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
      const pair = g.course.active[0];
      const visual = g.visuals.get(pair.serial);
      return {
        warning: visual.warning.active,
        strike: visual.strike.active,
        fireballY: visual.lower.position.y,
        wheelY: visual.upper.position.y,
        wheelAngle: visual.upper.angle,
        phase: g.flight.phase,
      };
    });
    await page.evaluate(() => {
      const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
      const pair = g.course.active[0];
      pair.lower = 'fireball'; pair.upper = 'lightning'; pair.age = 0;
      pair.center = Math.min(pair.center, g.height / 2 - 24 - pair.gap / 2 - 170);
      pair.x = g.playerX + 300;
      g.paintPair(g.visuals.get(pair.serial), pair);
      g.status.string = ''; g.hint.string = '';
      g.syncVisuals();
    });
    const warned = await read();
    assert.equal(warned.warning, true);
    assert.equal(warned.strike, false);
    await page.screenshot({ path: path.join(__dirname, '../preview/stage3-lightning-warning.png') });

    await page.evaluate(() => {
      const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
      g.course.active[0].x = g.playerX + 160;
      g.syncVisuals();
    });
    const striking = await read();
    assert.equal(striking.warning, false);
    assert.equal(striking.strike, true);
    await page.screenshot({ path: path.join(__dirname, '../preview/stage3-lightning-strike.png') });

    const details = await page.evaluate(() => {
      const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
      const pair = g.course.active[0];
      const visual = g.visuals.get(pair.serial);
      pair.x = g.playerX;
      g.syncVisuals();
      const gapTop = pair.center + pair.gap / 2;
      const strikeHits = g.course.hits(pair, gapTop + 10);
      const passageSafe = !g.course.hits(pair, pair.center);
      const warningOpacity = visual.warningOpacity.opacity;
      const strikeOpacity = visual.strikeOpacity.opacity;
      pair.age = 0.5;
      g.syncVisuals();
      const fireballMoved = Math.abs(visual.lower.position.y - (-pair.gap / 2 + pair.center
        - pair.width * 0.4 - pair.amplitude + Math.sin(0.5 * 2.2 + pair.phase) * pair.amplitude)) < 0.01;
      pair.upper = 'wheel';
      g.paintPair(visual, pair);
      g.syncVisuals();
      const wheelRotates = Math.abs(visual.upper.angle - 60) < 0.01;
      const wheelMoved = Math.abs(visual.upper.position.y - (pair.center + pair.gap / 2
        + pair.width * 0.43 + pair.amplitude
        + Math.sin(0.5 * 2.6 + pair.phase) * pair.amplitude)) < 0.01;
      const wheelSafe = !g.course.hits(pair, pair.center);
      const ageBeforeDeath = pair.age;
      g.flight.start(); g.endRound('碰撞'); g.update(1);
      const frozen = pair.age === ageBeforeDeath;
      g.resetRound();
      const reset = g.flight.phase === 'ready' && g.course.active.every(p => p.age === 0)
        && g.visuals.size === g.course.active.length;
      return { strikeHits, passageSafe, warningOpacity, strikeOpacity,
        fireballMoved, wheelRotates, wheelMoved, wheelSafe, frozen, reset };
    });
    assert.equal(details.strikeHits, true);
    assert.equal(details.passageSafe, true);
    assert.ok(details.warningOpacity >= 150 && details.strikeOpacity >= 220,
      'warning and strike remain visible');
    assert.ok(details.fireballMoved && details.wheelRotates && details.wheelMoved && details.wheelSafe
      && details.frozen && details.reset, JSON.stringify(details));
    assert.deepEqual(errors, [], 'no browser runtime errors');
    console.log(JSON.stringify({ passed: true, warned, striking, details, errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
