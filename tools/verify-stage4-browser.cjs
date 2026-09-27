const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const [width, height] of [[390, 844], [320, 568], [428, 926]]) {
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error' && !message.location().url.endsWith('/favicon.ico')) errors.push(message.text());
      });
      await page.goto(process.env.GAME_PREVIEW_URL || 'http://127.0.0.1:8766/');
      await page.waitForFunction(() => !!window.System);
      await page.evaluate(async () => { window.testCC = await System.import('cc'); });
      await page.waitForFunction(() => {
        const g = window.testCC.director.getScene()?.getChildByName('Canvas')?.getComponent('GameDirector');
        return g?.assetsReady;
      }, { timeout: 30000 });
      const state = await page.evaluate(() => {
        const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
        const scene = g.layoutRoot;
        return {
          assetErrors: g.assetErrors,
          loaded: g.frames.size,
          phase: g.flight.phase,
          titleFrame: !!g.title.getComponent(window.testCC.Sprite).spriteFrame,
          heroFrame: !!g.heroSprite.spriteFrame,
          skyFrame: !!g.scenery.getChildByName('Sky').getComponent(window.testCC.Sprite).spriteFrame,
          pairCount: g.visuals.size,
          scoreActive: g.scoreBadge.active,
          visibleWidth: g.width,
          visibleHeight: g.height,
          root: scene.name,
        };
      });
      assert.deepEqual(state.assetErrors, [], `asset load ${width}x${height}`);
      assert.equal(state.loaded, 19);
      assert.equal(state.phase, 'ready');
      assert.ok(state.titleFrame && state.heroFrame && state.skyFrame && state.pairCount >= 2);
      assert.equal(state.scoreActive, false);
      await page.screenshot({ path: path.join(__dirname, `../preview/stage4-ready-${width}x${height}.png`) });
      await page.mouse.click(width / 2, height / 2);
      const playing = await page.evaluate(() => {
        const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
        return { phase: g.flight.phase, velocity: g.flight.velocity,
          title: g.title.active, score: g.scoreBadge.active };
      });
      assert.equal(playing.phase, 'playing');
      assert.equal(playing.title, false);
      assert.equal(playing.score, true);
      assert.ok(playing.velocity > 0);
      if (width === 390) {
        for (const [lower, upper] of [['mountain', 'cloud'], ['fireball', 'lightning'], ['pillar', 'wheel']]) {
          const art = await page.evaluate(([lowerKind, upperKind]) => {
            const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
            const pair = g.course.active[0];
            pair.lower = lowerKind; pair.upper = upperKind; pair.x = g.playerX + 260;
            pair.center = upperKind === 'lightning'
              ? Math.min(pair.center, g.height / 2 - 24 - pair.gap / 2 - 170) : pair.center;
            g.paintPair(g.visuals.get(pair.serial), pair);
            g.syncVisuals();
            const visual = g.visuals.get(pair.serial);
            return { lower: !!visual.lowerSprite.spriteFrame, upper: !!visual.upperSprite.spriteFrame,
              warning: visual.warning.active, safe: !g.course.hits(pair, pair.center) };
          }, [lower, upper]);
          assert.ok(art.lower && art.upper && art.safe, JSON.stringify(art));
          if (upper === 'lightning') assert.equal(art.warning, true);
          await page.screenshot({ path: path.join(__dirname,
            `../preview/stage4-${lower}-${upper}.png`) });
        }
      }
      await page.evaluate(() => {
        const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
        g.endRound();
      });
      const dead = await page.evaluate(() => {
        const g = window.testCC.director.getScene().getChildByName('Canvas').getComponent('GameDirector');
        return { phase: g.flight.phase, result: g.result.active,
          hitFrame: g.heroSprite.spriteFrame === g.frames.get('hit') };
      });
      assert.deepEqual(dead, { phase: 'dead', result: true, hitFrame: true });
      await page.screenshot({ path: path.join(__dirname, `../preview/stage4-results-${width}x${height}.png`) });
      assert.deepEqual(errors, [], `browser errors ${width}x${height}`);
      console.log(JSON.stringify({ viewport: `${width}x${height}`, ready: state, playing, dead }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
