# 《急刹车》技术文档

## 1. 技术栈

- React 18 + TypeScript 5 管理游戏状态、HUD、开始页与结算页。
- React Three Fiber + Three.js 渲染正交斜俯视的低多边形 3D 场景；Drei `ContactShadows` 提供接触阴影。
- Less 管理 DOM 界面、响应式缩放、状态动效与无障碍降级。
- Vite 5 构建，`base: './'`，产物可直接部署到任意子路径。
- Web Audio API 合成开始、刹车、停车、贴边与坠落音效；localStorage 保存最高分、最佳距离、最高连击、静音状态和语言覆盖。

## 2. 目录结构

- `src/main.tsx`：React 应用入口。
- `src/game-id.ts`：由同步脚本生成的永久游戏 UUID 注入文件，源码迭代时不得手动更换。
- `src/App.tsx` / `src/App.less`：全屏容器与视口基础样式。
- `src/EdgeBrake/EdgeBrake.tsx`：屏幕状态、HUD、输入层和结果界面组合。
- `src/EdgeBrake/components/EdgeBrakeScene.tsx`：3D 世界、企鹅、浮冰、海面、冰山、灯光、阴影和特效。
- `src/EdgeBrake/hooks/useEdgeBrake.ts`：游戏主循环、物理、评分、关卡推进、输入和本地记录。
- `src/EdgeBrake/types.ts`：画布尺寸、阶段、评分与视图状态类型。
- `src/EdgeBrake/i18n/index.ts`：中英文文案和语言检测。
- `src/EdgeBrake/utils/sounds.ts`：Web Audio 合成音效。
- `src/EdgeBrake/EdgeBrake.less`：HUD、按钮、覆盖层、响应式和动效视觉系统。
- `public/poster.png`：Aigram 平台生成并复验的 1024×1024 正式封面。
- `_production/`：封面生成、图生图修正脚本与平台请求来源记录。
- `_qa/ui/`：390×700 与 320×568 的首轮和修复后运行截图。
- `doc/`：玩法需求、视觉圣经和本技术文档。

## 3. 核心模块

- 状态与主循环：`useEdgeBrake` 用单实例 `requestAnimationFrame` 更新位置和速度；循环代数令牌防止 React StrictMode 或热更新留下重复动画循环。
- 游戏阶段：`cover → ready → playing → result` 组成成功回合；越过冰崖后进入 `falling → gameover`，结果层等待坠落动作完成后出现。
- 物理与评分：企鹅以 96 px/s 起步，未制动时按 70 px/s² 加速；玩家单击锁定制动后按 260 px/s² 持续减速，速度低于 3 px/s 并稳定 110 ms 后结算；依据企鹅前缘到冰崖的 0–8、9–22、23–52 和 53+ px 四档计算得分与连击。
- 3D 映射与镜头：逻辑层继续使用稳定的屏幕空间数值，场景层通过 `screenToWorld()` 映射到世界 X 轴。封面阶段的正交相机在 2.6 秒内从高位广角推进至游戏机位；进入回合后，`FollowCamera` 以阻尼跟随企鹅并向前预看，使企鹅保持在画面偏左、冰崖和海面持续可见。开启“减少动态效果”时跳过开场运镜。
- 渲染：场景资产由低段数基础几何拼装，全部使用 flat-shaded 高粗糙度材质；主光、填充光、轮廓光、雾和接触阴影统一体积感。
- 输入：游戏区域一次 `onPointerDown` 或一次 Space / Enter 锁定本回合制动；重复输入不会取消或重新触发，下一回合才恢复可点击状态。
- 适配：390×700 游戏场以视口中心为原点按宽高最小比例缩放，320×568 下完整显示；DOM HUD 和按钮的内部尺寸保持至少 44 px 触控目标。
- 音频与多语言：首次交互后创建 AudioContext，音频失败不影响玩法；所有可见文案通过轻量 `t()` 提供中文与英文。
- 平台身份：`src/game-id.ts` 将永久 UUID `5cc524e5-8b5b-48a2-bc0d-e8ecd80fa30a` 写入 `window.__GAME_UUID__`，为后续排行榜、存档与事件提供隔离锚点。
- 持久化：最高分、最佳停车距离、最高贴边连击和静音设置保存到 localStorage；当前版本尚未调用后端、排行榜或云存档接口。

## 4. 扩展点

- 调整速度、刹车力度、判定区间和关卡节奏：修改 `src/EdgeBrake/hooks/useEdgeBrake.ts` 的常量与 `finishRound()`。
- 修改企鹅、浮冰、灯光、镜头、粒子和环境资产：修改 `src/EdgeBrake/components/EdgeBrakeScene.tsx`。
- 修改 HUD、开始页、结果页、颜色、排版与动效：修改 `src/EdgeBrake/EdgeBrake.tsx`、`EdgeBrake.less` 和 `doc/visual.md`。
- 增加新文案或调整中英文：修改 `src/EdgeBrake/i18n/index.ts`。
- 调整声音频率、波形、时长和音量：修改 `src/EdgeBrake/utils/sounds.ts`，并同步更新 `doc/requirements.md`。
- 增加排行榜或云端存档：先为游戏注册永久 UUID，再在 hook 中接入共享 runtime；当前本地记录不要直接作为平台数据源。
- 更换正式封面：使用 `_production/generate_poster.py` 走 Aigram transit 接口，检查来源记录、1024 原图和 160×160 缩略图后替换 `public/poster.png`。
- 发布：补齐 `games.json` 条目、永久 UUID 与 zipurl，运行同步和 UUID 校验脚本后再执行发布流程。
