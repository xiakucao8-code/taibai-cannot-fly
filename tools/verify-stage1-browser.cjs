// Run: node tools/verify-stage1-browser.cjs <playwright-package-path>
const { chromium } = require(process.argv[2] || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const previewUrl = process.env.GAME_PREVIEW_URL || 'http://127.0.0.1:8766/';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) {
      errors.push(`${message.text()} (${message.location().url})`);
    }
  });
  await page.goto(previewUrl);
  await page.waitForFunction(() => !!window.System);
  await page.evaluate(async () => { window.testCC = await System.import('cc'); });
  await page.waitForFunction(() =>
    !!window.testCC.director.getScene()?.getChildByName('Canvas')?.getComponent('GameDirector'));
  await page.waitForTimeout(600);
  const snapshot = () => page.evaluate(async () => {
    const cc = await System.import('cc');
    const game = cc.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
    return { phase: game.flight.phase, y: game.flight.y, velocity: game.flight.velocity,
      held: game.flight.held, angle: game.player.angle, width: game.width, height: game.height };
  });
  assert.equal((await snapshot()).phase, 'ready');
  await page.screenshot({ path: path.join(__dirname, '../preview/stage1-ready.png') });
  await page.mouse.move(195, 422);
  await page.mouse.down();
  await page.waitForTimeout(50);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const firstTap = await snapshot();
  assert.ok(firstTap.y > 0 && firstTap.velocity > 0 && !firstTap.held,
    'a quick click causes upward movement after release');
  await page.waitForTimeout(350);
  const beforeSecondTap = await snapshot();
  assert.ok(beforeSecondTap.velocity < 0, 'character eventually falls after a click');
  await page.mouse.click(195, 422);
  await page.waitForTimeout(70);
  const secondTap = await snapshot();
  assert.ok(secondTap.velocity > 0 && secondTap.y > beforeSecondTap.y,
    'another quick click reverses the fall');
  await page.evaluate(() => {
    const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
    g.resetRound();
  });
  await page.mouse.down();
  await page.waitForTimeout(450);
  const rising = await snapshot();
  assert.equal(rising.phase, 'playing');
  assert.equal(rising.held, true);
  assert.ok(rising.velocity > 0 && rising.y > 0 && rising.angle > 0, 'holding rises and tilts up');
  await page.mouse.up();
  await page.waitForTimeout(550);
  const falling = await snapshot();
  assert.equal(falling.held, false);
  assert.ok(falling.velocity < 0 && falling.angle < 0, 'release falls and tilts down');
  await page.waitForTimeout(1600);
  assert.equal((await snapshot()).phase, 'dead', 'bottom boundary ends round');
  await page.screenshot({ path: path.join(__dirname, '../preview/stage1-game-over.png') });
  await page.mouse.click(195, 422);
  assert.equal((await snapshot()).phase, 'ready', 'restart returns to ready');
  const result = await page.evaluate(async () => {
    const cc = await System.import('cc');
    const g = cc.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
    g.resetRound(); g.flight.start(); g.flight.y = g.height / 2 - 31; g.flight.velocity = 520;
    g.flight.held = true; g.simulate(1 / 120);
    const topDeath = g.flight.phase === 'dead';
    g.resetRound(); g.flight.start();
    const firstPair = g.course.active[0];
    firstPair.lower = 'pillar'; firstPair.x = g.playerX;
    g.flight.y = firstPair.center - firstPair.gap / 2 - 30;
    g.simulate(1 / 120);
    const obstacleDeath = g.flight.phase === 'dead';
    g.resetRound(); g.flight.start(); g.flight.held = true; g.touchId = 7;
    g.onHide(); const hidden = g.suspended && !g.flight.held && g.touchId === null;
    g.onShow(); const shown = !g.suspended && !g.flight.held && g.accumulator === 0;
    g.resetRound(); g.onPress({ getID: () => 1 });
    g.onPress({ getID: () => 2 }); g.onRelease({ getID: () => 2 });
    const secondaryTouchIgnored = g.flight.held && g.touchId === 1;
    g.onRelease({ getID: () => 1 });
    const activeTouchReleased = !g.flight.held && g.touchId === null;
    const results = [30, 60, 120].map(fps => {
      g.resetRound(); g.flight.start(); g.flight.held = true;
      for (let i = 0; i < fps; i++) g.update(1 / fps);
      return g.flight.y;
    });
    const frameRateStable = Math.max(...results) - Math.min(...results) < 0.01;
    g.resetRound();
    return { topDeath, obstacleDeath, hidden, shown, secondaryTouchIgnored, activeTouchReleased, frameRateStable };
  });
  assert.ok(Object.values(result).every(Boolean), JSON.stringify(result));
  await page.mouse.move(195, 422);
  await page.mouse.down();
  await page.mouse.move(-10, 422);
  await page.waitForTimeout(100);
  assert.equal((await snapshot()).held, false, 'leaving canvas clears mouse hold');
  await page.mouse.up();
  await page.setViewportSize({ width: 720, height: 1280 });
  await page.waitForTimeout(300);
  const resized = await snapshot();
  assert.equal(resized.phase, 'ready', 'resize resets the playfield safely');
  assert.ok(Math.abs(resized.width - 720) < 1, 'playfield follows viewport');
  assert.deepEqual(errors, [], 'no runtime errors');
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto(previewUrl);
  await mobile.waitForFunction(() => !!window.System);
  await mobile.evaluate(async () => { window.testCC = await System.import('cc'); });
  await mobile.waitForFunction(() =>
    !!window.testCC.director.getScene()?.getChildByName('Canvas')?.getComponent('GameDirector'));
  const cdp = await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 422, id: 1 }] });
  await mobile.waitForTimeout(300);
  const mobileRise = await mobile.evaluate(() => {
    const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
    return g.flight.held && g.flight.velocity > 0;
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await mobile.waitForTimeout(100);
  const mobileCancel = await mobile.evaluate(() => {
    const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
    return !g.flight.held && g.touchId === null;
  });
  assert.ok(mobileRise && mobileCancel, 'real browser touch input and cancellation');
  await mobile.evaluate(() => {
    const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
    g.resetRound();
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 422, id: 2 }] });
  await mobile.waitForTimeout(50);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await mobile.waitForTimeout(100);
  const mobileTap = await mobile.evaluate(() => {
    const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
    return g.flight.y > 0 && g.flight.velocity > 0 && !g.flight.held;
  });
  assert.ok(mobileTap, 'real short touch produces lift');
  assert.deepEqual(errors, [], 'no mobile runtime errors');
  console.log(JSON.stringify({ passed: true, firstTap, secondTap, rising, falling,
    checks: result, mobileRise, mobileCancel, mobileTap, errors }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
