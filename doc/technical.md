# 《急刹车》技术文档

## 1. 技术栈

- React 18 + TypeScript 5 管理游戏状态、HUD、开始页与结算页。
- React Three Fiber + Three.js 渲染正交斜俯视的低多边形 3D 场景；Drei `ContactShadows` 提供接触阴影。
- Less 管理 DOM 界面、响应式缩放、状态动效与无障碍降级。
- Vite 5 构建，`base: './'`，产物可直接部署到任意子路径。
- Web Audio API 合成开始、刹车、停车、金币、解锁与坠落音效；localStorage 保存成绩、收藏、金币、当前角色、静音状态和语言覆盖。

## 2. 目录结构

- `src/main.tsx`：React 应用入口。
- `src/game-id.ts`：由同步脚本生成的永久游戏 UUID 注入文件，源码迭代时不得手动更换。
- `src/App.tsx` / `src/App.less`：全屏容器与视口基础样式。
- `src/EdgeBrake/EdgeBrake.tsx`：屏幕状态、HUD、输入层和结果界面组合。
- `src/EdgeBrake/characters.ts`：7 名角色的素材 URL、体型缩放、抓地系数、价格、里程碑与天气关卡表。
- `src/EdgeBrake/assets/characters/`：从共享 low-poly 素材库复制的 6 个 GLB 模型及其商店 PNG 缩略图；企鹅仍由本游戏基础图元构建。
- `src/EdgeBrake/components/EdgeBrakeScene.tsx`：3D 世界、角色加载与动作、分层冰舌、断崖、海面、冰山、天气、镜头、灯光、阴影和特效。
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
- 物理与评分：角色以 96 px/s 起步，起点 x=48、崖口 x=520–560；未制动时按跑道进度使用 28 / 74 / 42 px/s² 三段加速度；单击后以 `250 × 当前角色抓地系数` px/s² 持续减速，速度低于 3 px/s 并稳定 110 ms 后结算；依据角色前缘到冰崖的 0–8、9–22、23–52 和 53+ px 四档计算得分、连击和金币。
- 角色与动作：`useGLTF` 加载共享素材库 GLB 并 clone 当前角色；人物 GLB 的扁平网格按空间位置重建肩/髋枢轴，动物低位网格按空间象限重建四足枢轴。动作状态机使用独立外层位移与内层姿态节点，支持待机重心转移、780 ms 下蹲起步、速度驱动且带落脚停顿的滑行动作、对角足组、急停脚掌前撑和坠落。企鹅的双鳍和双脚使用独立 ref 动画，不再只做整体摇摆。
- 收藏经济：永久金币、已解锁角色、当前角色与最高关卡存入 localStorage。成功停车按评价发放 1–7 枚基础金币并叠加最多 3 枚贴边连击奖励；第 3/5 关自动解锁小孩/狐狸，其余角色由 `buyCharacter()` 扣币解锁，`selectCharacter()` 负责选择并持久化。
- 3D 映射与镜头：逻辑层继续使用屏幕空间数值，场景层通过 `screenToWorld()` 映射到世界 X 轴。封面相机使用 zoom 64 的近距离角色机位并轻微侧向漂移；点击后在 780 ms ready 阶段阻尼拉远到 zoom 28、以起点和崖口中点为观察中心的整条跑道机位。playing 阶段从第一帧开放刹车，`FollowCamera` 根据危险进度把相机从跑道侧后方连续移动到角色前侧，同时将 zoom 推至 60、观察点锁定角色胸口；falling 阶段继续推至 zoom 68 并跟随下降，形成近正面坠落特写。成功结算阶段相机提前回收；“减少动态效果”会取消首屏漂移与幽灵手指循环。
- 场景与天气：冰舌由深层冰、浅层冰、错位雪帽、裂缝、雪脊、分段崖壁、冰柱、浪脊和漂浮碎冰组成；顶面额外按三段速度曲线绘制低对比冰带与逐渐加密的短划纹。`weatherForLevel()` 按 6 关周期选择晴朗、飘雪、薄雾或风雪；`Atmosphere` 阻尼调整天空与雾距，`WeatherFx` 更新跟随角色的点状雪粒子，天气不参与摩擦计算。
- 渲染：场景与角色使用 flat-shaded 高粗糙度材质；共享 GLB 与本地基础图元共用主光、填充光、轮廓光、雾和接触阴影，保持三值体积感。
- 输入：首屏透明语义按钮和封面空白区域的 `onPointerDown` 启动游戏，幽灵手指不接收输入；playing 阶段游戏区域一次 `onPointerDown` 或一次 Space / Enter 锁定本回合制动，ready 阶段输入被忽略，重复输入不会取消或重新触发。
- 适配：390×700 游戏场以视口中心为原点按宽高最小比例缩放，320×568 下完整显示；DOM HUD 和按钮的内部尺寸保持至少 44 px 触控目标。
- 音频与多语言：首次交互后创建 AudioContext，音频失败不影响玩法；所有可见文案通过轻量 `t()` 提供中文与英文。
- 平台身份：`src/game-id.ts` 将永久 UUID `5cc524e5-8b5b-48a2-bc0d-e8ecd80fa30a` 写入 `window.__GAME_UUID__`，为后续排行榜、存档与事件提供隔离锚点。
- 持久化：最高分、最佳停车距离、最高贴边连击、静音、永久金币、已解锁角色、当前角色与最高关卡保存到 localStorage；当前版本尚未调用后端、排行榜或云存档接口。

## 4. 扩展点

- 调整速度、刹车力度、判定区间和关卡节奏：修改 `src/EdgeBrake/hooks/useEdgeBrake.ts` 的常量与 `finishRound()`。
- 增减角色、调整抓地力、价格、缩放和里程碑：修改 `src/EdgeBrake/characters.ts`，并将同源 GLB/PNG 放入 `src/EdgeBrake/assets/characters/`。
- 修改角色动作、冰舌、天气、灯光、镜头、粒子和环境资产：修改 `src/EdgeBrake/components/EdgeBrakeScene.tsx`。
- 修改 HUD、开始页、结果页、颜色、排版与动效：修改 `src/EdgeBrake/EdgeBrake.tsx`、`EdgeBrake.less` 和 `doc/visual.md`。
- 增加新文案或调整中英文：修改 `src/EdgeBrake/i18n/index.ts`。
- 调整声音频率、波形、时长和音量：修改 `src/EdgeBrake/utils/sounds.ts`，并同步更新 `doc/requirements.md`。
- 增加排行榜或云端存档：先为游戏注册永久 UUID，再在 hook 中接入共享 runtime；当前本地记录不要直接作为平台数据源。
- 更换正式封面：使用 `_production/generate_poster.py` 走 Aigram transit 接口，检查来源记录、1024 原图和 160×160 缩略图后替换 `public/poster.png`。
- 发布：补齐 `games.json` 条目、永久 UUID 与 zipurl，运行同步和 UUID 校验脚本后再执行发布流程。
