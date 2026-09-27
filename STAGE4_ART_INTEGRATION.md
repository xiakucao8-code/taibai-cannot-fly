# 阶段 4：正式素材接入

## 已接入内容

- **天宫背景**：蓝天、远景仙山、中景宫门、近景云海四层。远、中、近景以不同幅度缓慢漂移；所有装饰层位于障碍与角色之后，不参与碰撞。
- **太白金星**：待机、上升、下落、受击四张姿态图按飞行状态切换；待机有悬浮呼吸，飞行保留物理倾斜并加入轻微衣袂起伏。角色碰撞圆保持半径 30 设计单位。
- **障碍**：山峰、石柱、火球与乌云、雷电、风火轮，沿用阶段 2、3 的九种组合与对象池。静态障碍延伸到屏幕边界，山峰尖端使用三角形碰撞以贴近画面；火球、风火轮继续运动；雷电仍按“预警—落雷”显示。
- **特效**：触摸抬升微粒、得分亮点、受击光点与短暂闪光。特效无伤害判定。
- **界面**：正式标题、操作提示、游戏中计分牌、结算木牌和重开按钮；结算仍沿用当前“点屏幕重新开始”的阶段 1 流程。
- **适配**：720×1280 为设计分辨率，Canvas 适配高度；运行时按可见宽高布局背景、分数、标题、提示和结算面板，并在画布尺寸变化时重建场景。

## 资源目录与生成

原图保存在 `assets/art/`，不直接进入小游戏包。运行图在 `game/assets/resources/stage4/`，分为 `backgrounds/`、`characters/`、`obstacles/`、`ui/`。`asset-manifest.json` 记录源图、资源路径、尺寸和体积。

运行图由 `node tools/prepare-stage4-assets.cjs` 从原图确定性裁切、缩放并压缩生成。脚本不会修改原图，也不会批量删除文件。当前 19 张运行图约 7.18 MiB。

## 微信小游戏包

微信小游戏主包有 4 MiB 限制，分包允许把素材移出主包。[Cocos Creator 3.8 分包文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/subpackage.html)；[腾讯云小游戏分包说明](https://intl.cloud.tencent.com/zh/document/product/1219/68072)。

构建配置为 `game/build-configs/wechatgame-stage4.json`。Cocos 构建后执行 `node tools/package-wechat-stage4.cjs`，把生成的 `assets/resources` 包移动到 `subpackages/resources`，同步 `game.json` 与 `src/settings.json`，并检查包大小。脚本遇到源目录和目标目录同时存在时会停止，不清理已有文件。当前构建结果：主包约 2.85 MiB，素材分包约 7.21 MiB，总量约 10.06 MiB。

该目录移动遵循 Cocos 微信适配器对 `settings.assets.subpackages` 与 `subpackages/<包名>` 的加载路径约定。**微信开发者工具与真机运行仍需验收**；本机未找到微信开发者工具。

## 验证

- TypeScript 类型检查通过。
- 阶段 1–3 模型测试通过：点击/长按飞行、对象池、九种组合、动态障碍与安全通道。
- Web Mobile 构建成功；`tools/verify-stage4-browser.cjs` 在 390×844、320×568、428×926 三种竖屏下确认 19 张素材加载、待机/游玩/结算状态与无浏览器错误。
- 代表性障碍画面保存在 `preview/stage4-mountain-cloud.png`、`preview/stage4-fireball-lightning.png`、`preview/stage4-pillar-wheel.png`。

## 下一阶段的边界

目前角色状态动画由四张姿态图和程序变换组成；若要逐帧衣袂、胡须或完整表情动画，需要补充可分层原画或帧序列。音频、完整首页/教学/暂停和最高分存档属于后续阶段。
