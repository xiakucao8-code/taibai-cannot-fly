# 《太白金星不会飞》阶段 0：工程基线

状态：工程文件与微信小游戏构建已完成；微信工具模拟器验证受本机基础库下载错误影响。

## 环境与项目

| 项目 | 约定 |
| --- | --- |
| 游戏名称 | 太白金星不会飞 |
| 工程标识 | `taibai-cannot-fly`（ASCII，适合构建路径和包名） |
| Cocos 工程目录 | `game/` |
| 引擎 | Cocos Creator 3.8.8，官方 Empty(2D) 模板 |
| 语言 | TypeScript |
| 目标平台 | 微信小游戏，Portrait 竖屏 |
| 设计基准 | 720 × 1280；适配高度，实际可视宽度由设备决定 |
| 首场景 | `game/assets/scenes/main.scene` |

本机已找到的工具：

- Cocos Creator：`C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe`
- 微信开发者工具：`D:\微信web开发者工具\微信开发者工具.exe`
- 微信开发者工具 CLI：`D:\微信web开发者工具\cli.bat`

## 目录职责

```text
太白金星不会飞/
├─ GDD.md、TECH_DESIGN.md、ART_DIRECTION.md、ASSET_GUIDE.md
├─ assets/                  美术与音频源素材，不由 Cocos 直接打包
├─ art_sources/             素材生成记录和参考
├─ preview/                 角色动画预览
├─ tools/                   素材处理脚本
└─ game/                    唯一的 Cocos Creator 工程
   ├─ assets/
   │  ├─ scenes/            场景：main.scene
   │  ├─ scripts/           TypeScript 代码，阶段 1 开始加入
   │  ├─ prefabs/           可复用节点，按功能划分
   │  ├─ textures/          经裁切、压缩、适配的入包图片
   │  └─ audio/             经处理的入包音频
   ├─ settings/             Cocos 项目设置，须保留
   └─ build/                构建输出，不作为源文件维护
```

`assets/` 中的高分辨率原图保持原样。阶段 4 才按实际场景需求选图、裁切和压缩，导入 `game/assets/textures/`；不直接复制整套源图，以免微信小游戏首包膨胀。

## 命名与代码约定

- 文件夹和资源文件用小写英文 `kebab-case`；Cocos 场景固定 `main.scene`。角色或障碍资源按 `类别-对象-状态-序号` 命名，例如 `character-taibai-idle-01.png`。
- TypeScript 类、组件与文件名使用 `PascalCase`，例如 `PlayerFlight.ts`；变量和函数用 `camelCase`；常量用 `UPPER_SNAKE_CASE`。
- 一个脚本负责一个模块；场景只引用进入首版所需资源。可调飞行、通道和难度参数集中管理，避免散在场景节点上。
- Cocos 生成的 `.meta` 文件与源资源一同保留；`library/`、`temp/`、`local/`、`build/` 不纳入源文件。
- 统一 UTF-8、LF。JSON 和 TypeScript 缩进两个空格。

## 打开与构建

1. 在 Cocos Creator 3.8.8 中打开 `game/`，确认 `assets/scenes/main.scene` 可打开，Canvas 基准为 720 × 1280。
2. 在“构建发布”中选择“微信小游戏”，设备方向选 Portrait，首场景设 `main.scene`。
3. 测试构建可使用 Cocos 提供的测试 AppID `wx6ac3f5090a6b99c5`；正式发布前换成项目自己的 AppID。
4. 构建后，用微信开发者工具打开 `game/build/wechatgame/`，确认 `game.json`、`project.config.json` 存在且画面为竖屏。

阶段 0 不包含飞行、障碍和正式素材接入。构建联调的实际验证结果记录在下方，不以文件存在代替运行验证。

## 验证记录

| 项目 | 结果 |
| --- | --- |
| 官方 Empty(2D) 模板复制、工程标识和版本 | 已完成 |
| 主场景结构和 JSON 可解析 | 已完成 |
| 720 × 1280 默认设计分辨率 | 已配置，待编辑器确认 |
| Cocos 编辑器打开场景 | 待完成：交互编辑器停在 Cocos Developer Login；命令行仍可完成构建 |
| 微信小游戏构建 | 已完成：`game/build/wechatgame/`，约 2.97 MB、30 个文件；构建包包含 `main.scene` |
| 构建配置检查 | 已完成：`game.json` 为 `portrait`，`project.config.json` 为测试 AppID |
| 微信开发者工具导入 | 已完成：工具已打开 `taibai-cannot-fly` 项目 |
| 微信开发者工具模拟器 | 未通过：本机下载基础库 3.17.3 时出现 `EBADF: bad file descriptor, rename ... wxvpkg`；重试一次结果相同 |

微信开发者工具的 CLI 还提示本机“服务端口已关闭”；这不影响工程文件和 Cocos 构建，但 CLI 自动化暂不可用。当前未更改工具的安全设置，也未上传或发布游戏。模拟器显示黑屏时不能据此认定空场景运行成功，须在基础库恢复后重新编译验证。

参考：[Cocos 3.8 项目设置](https://docs.cocos.com/creator/3.8/manual/en/editor/project/)、[微信小游戏发布](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-wechatgame.html)。
