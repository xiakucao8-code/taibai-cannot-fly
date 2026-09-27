# 《太白金星不会飞》首版素材使用说明

2026-09-26｜20 张 PNG（其中 19 张含透明通道）＋5 个 WAV  
美术依据：[美术规范](ART_DIRECTION.md)｜全部图片提示词：[生成记录](art_sources/generation_prompts.json)  
预览入口：[素材浏览与音频试听](preview/index.html)｜精确尺寸与文件信息：[素材清单](asset_manifest.json)

角色动态示意：[太白金星飞行 GIF](preview/taibai_flight_preview.gif)。它把四张独立姿态图按“待机 → 长按上升 → 松开下落 → 受击 → 再待机”组合成约 5.6 秒的无声循环，并加入轻微位移与倾斜，仅用于预览动作感觉。生成脚本在 `tools/build_taibai_gif.py`。

## 目录和命名

文件和文件夹均采用小写英文与下划线。角色以 `taibai_` 开头，障碍以 `obstacle_` 开头，背景用 `bg_`，界面用 `ui_`，音乐用 `bgm_`，音效用 `sfx_`。后续变体可增加 `_02`，经审阅的替换版本可增加 `_v2`。

```text
assets/
  art/
    characters/taibai/  太白金星四种姿态
    obstacles/ground/  山峰、石柱、火球
    obstacles/sky/     乌云、雷电、风火轮
    backgrounds/      天空、远景仙山、中景宫阙、薄云
    ui/               标题、结算木牌、主按钮
      icons/          声音开关、长按手势
  audio/
    music/            循环配乐
    sfx/              四类短音效
art_sources/
  references/         用户提供的原始风格参考
  generation_prompts.json
preview/index.html    本地素材预览页
tools/                音频生成、素材清单与预览页生成工具
```

`assets` 内只放可供游戏使用的素材；参考图、提示词、预览页面和制作工具在外部保存，避免作为游戏资源导入。

## 角色

| 文件（相对于 assets/art/characters/taibai/） | 用途 |
| --- | --- |
| `taibai_idle.png` | 待机横向悬浮 |
| `taibai_rise.png` | 按住提气上升 |
| `taibai_fall.png` | 松开后下落 |
| `taibai_hit.png` | 碰撞后短促反应 |

四张图是独立姿态图，均朝右，画布为 1536 × 1024。它们不是逐帧动画序列或骨骼动画文件。首版建议通过姿态切换，配合角色节点轻微浮动、倾斜和压缩实现动作。导入时以胸腹位置对齐四个姿态，物理判定固定在角色父节点上；不要随胡须、衣袖外形改变碰撞尺寸。

待机可先试上下 6–10 设计单位、周期约 2 秒；上升和下降倾角保持小幅度；受击姿态停留约 0.2 秒再结算。具体值仍需结合游戏手感调整。

## 障碍

| 相对于 assets/art/ 的路径 | 建议用法 |
| --- | --- |
| `obstacles/ground/obstacle_mountain.png` | 下侧山峰，底部可延伸到画面之外；保持尖峰轮廓 |
| `obstacles/ground/obstacle_stone_pillar.png` | 下侧石柱，按比例调整尺寸，不强行拉伸柱头 |
| `obstacles/ground/obstacle_fireball.png` | 下侧火球，整体小幅上下浮动、轻微缩放；外围碎火不单独造成碰撞 |
| `obstacles/sky/obstacle_storm_cloud.png` | 上侧乌云，深色云团主体作为判定依据 |
| `obstacles/sky/obstacle_lightning.png` | 上侧雷电，可小幅摆动与明暗变化；始终保留可见主体 |
| `obstacles/sky/obstacle_wind_fire_wheel.png` | 上侧风火轮，围绕轮毂旋转并小幅浮动 |

火球、雷电、风火轮目前为单张主体素材，可直接用于程序动效。火球不会仅靠旋转形成自然的逐帧火焰变化；若以后需要更细腻的火焰动画，可单独补充序列帧。

所有碰撞形状都要根据可见主体单独配置。风火轮按整个轮盘判定，轮辐之间的透明空隙不代表可以穿过。雷电、山峰适合沿轮廓配置简化形状，避免使用整张矩形图片判定。

## 背景

| 文件（相对于 assets/art/backgrounds/） | 使用层级 |
| --- | --- |
| `bg_tiangong_sky.png` | 唯一不透明底图，铺满游戏画面 |
| `bg_tiangong_far_islands.png` | 远景仙山与小型宫殿，低速移动，适当降低不透明度 |
| `bg_tiangong_mid_palace.png` | 中景宫阙和桥，放在画面外围或下方，避免抢占通道 |
| `bg_cloud_bank.png` | 薄云，可多实例分散摆放、缓慢移动 |

后三张是独立透明景物，不是经过接缝验证的无缝平铺纹理。建议以多个景物节点错开放置和循环回收，不把左右边缘硬拼成连续长卷。近景云层不遮挡角色、障碍和通道。

## 界面

| 文件（相对于 assets/art/ui/） | 用途 |
| --- | --- |
| `ui_title_taibai.png` | 两行标题“太白金星 / 不会飞” |
| `ui_panel_results.png` | 留空的结算木牌，顶部绳索可延伸出面板区域 |
| `ui_button_primary.png` | 留空的主按钮底图 |
| `icons/ui_sound_on.png` | 声音开启 |
| `icons/ui_sound_off.png` | 声音关闭，与开启图使用一致的底板 |
| `icons/ui_hint_hold.png` | 长按操作手势 |

按钮文字、分数、最高分和操作提示在 Cocos 中单独渲染，保持清晰和可修改。木牌和按钮先按原比例使用，若需要九宫格拉伸，须在编辑器里先确认边框和装饰区不会变形。

## 音频

| 相对于 assets/audio/ 的路径 | 用途与建议 |
| --- | --- |
| `music/bgm_tiangong_loop.wav` | 约 20.87 秒原创五声音阶铃音配乐，循环播放，先试音量 0.2 |
| `sfx/sfx_lift.wav` | 按下开始提气时播放一次，持续按住期间不逐帧重复 |
| `sfx/sfx_score.wav` | 通过一组障碍得分 |
| `sfx/sfx_hit.wav` | 受击或越界结算 |
| `sfx/sfx_ui_click.wav` | 按钮反馈 |

音频由项目内的 `tools/generate_audio.py` 原创程序合成，均为 22050 Hz、16-bit、单声道 WAV。背景音乐按循环边界叠加音尾；需在微信真机上确认播放器循环时是否平滑。音量以实际试听为准，本轮仅完成格式和波形检查。

## 导入与完成状态

- 图片使用内置 ImageGen 生成，文件保留原始 RGBA 数据，没有用脚本抠图或重绘。除天空底图外，全部包含透明像素；深色预览底不属于不透明背景。
- 全部图片原文件合计约 30.8 MiB。这是高分辨率美术源素材规模，并非微信发布包大小。接入时根据实际显示尺寸制作压缩设置和资源分包，不能直接承诺首包达标。
- 当前已完成独立素材、提示词记录、尺寸与透明通道检查、预览入口。尚未进行 Cocos 导入、锚点微调、碰撞配置和真机验收。
- 预览页的场景叠放用于美术审阅，不代表最终布局和难度。
