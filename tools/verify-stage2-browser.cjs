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
    await page.screenshot({ path: path.join(__dirname, '../preview/stage2-ready.png') });
    await page.evaluate(() => {
      const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
      g.flight.start();
      g.status.string = '';
      g.hint.string = '';
      g.course.active[0].x = g.width * 0.17;
      g.syncVisuals();
    });
    await page.screenshot({ path: path.join(__dirname, '../preview/stage2-obstacles.png') });
    await page.evaluate(() => {
      window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector').resetRound();
    });
    const result = await page.evaluate(() => {
      const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
      const initiallySafe = g.course.active.every(p => p.x - p.width / 2 > g.width / 2);
      const initialVisible = g.visuals.size === g.course.active.length
        && g.obstacleLayer.children.length === g.course.active.length;
      g.flight.start();
      const first = g.course.active[0];
      first.x = g.playerX - first.width / 2 - 1;
      g.flight.y = first.center;
      g.flight.velocity = 0;
      g.simulate(1 / 120);
      const scored = g.course.score === 1 && g.scoreLabel.string === '得分 1';
      g.simulate(1 / 120);
      const once = g.course.score === 1;
      const seen = new Set();
      for (let i = 0; i < 60; i++) {
        for (const pair of g.course.active) seen.add(`${pair.lower}+${pair.upper}`);
        g.course.active.forEach(pair => { pair.x = -10000; });
        g.flight.y = 0;
        g.flight.velocity = 0;
        g.simulate(1 / 120);
      }
      const bounded = g.obstacleLayer.children.length <= 5 && g.visuals.size <= 5;
      const nine = seen.size === 9;
      g.resetRound();
      const restarted = g.course.score === 0 && g.scoreLabel.string === '得分 0'
        && g.flight.phase === 'ready' && g.visuals.size === g.course.active.length;
      return { initiallySafe, initialVisible, scored, once, bounded, nine, restarted,
        combinations: [...seen].sort(), pooledNodes: g.obstacleLayer.children.length };
    });
    assert.ok(result.initiallySafe && result.initialVisible && result.scored && result.once
      && result.bounded && result.nine && result.restarted, JSON.stringify(result));
    assert.deepEqual(errors, [], 'no browser runtime errors');
    console.log(JSON.stringify({ passed: true, ...result, errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
