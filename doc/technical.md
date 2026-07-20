# 《急刹车》技术文档

## 1. 技术栈

- React 18 + TypeScript 5 管理游戏状态、HUD、开始页与结算页。
- React Three Fiber + Three.js 渲染正交斜俯视的低多边形 3D 场景；Drei `useGLTF` 加载共享角色模型。
- Less 管理 DOM 界面、响应式缩放、状态动效与无障碍降级。
- Vite 5 构建，`base: './'`，产物可直接部署到任意子路径。
- Web Audio API 合成开始、刹车、停车、金币、解锁与坠落音效；localStorage 保存成绩、收藏、金币、当前角色、静音状态和语言覆盖。

## 2. 目录结构

- `src/main.tsx`：React 应用入口。
- `src/game-id.ts`：由同步脚本生成的永久游戏 UUID 注入文件，源码迭代时不得手动更换。
- `src/App.tsx` / `src/App.less`：全屏容器与视口基础样式。
- `src/EdgeBrake/EdgeBrake.tsx`：屏幕状态、HUD、输入层、Google Material `touch_app` 标准引导图标和结果界面组合。
- `src/EdgeBrake/characters.ts`：从本地素材目录生成 52 名角色清单，计算名称、分类、动作组、素材 URL、体型缩放、抓地系数、价格、顺序与天气关卡表。
- `src/EdgeBrake/assets/characters/`：从共享 low-poly 素材库复制的 52 个 GLB、52 张 PNG 缩略图和同版本 `ASSETS.json` 清单；构建产物不依赖仓库外路径。
- `src/EdgeBrake/components/EdgeBrakeScene.tsx`：3D 世界、角色加载与动作、分层冰舌、断崖、海面、冰山、天气、镜头、灯光、阴影和特效。
- `src/EdgeBrake/hooks/useEdgeBrake.ts`：游戏主循环、物理、评分、关卡推进、输入和本地记录。
- `src/EdgeBrake/rules.ts`：100 分制停车边界、过关条件、连击和金币的纯规则函数。
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
- 游戏阶段：首局使用 `cover → ready → playing`；0–220 px 的成功停车进入 1550 ms `success` 英雄镜头，定时结束后才进入不限时 `result`。超过 220 px 的停车进入 1450 ms `earlyFail` 俯视测距镜头，之后才进入不限时 `result`；只有“下一位角色”或“本关重试”按钮才调用 `advanceResult()`。通过后自动换角并进入下一关的 520 ms `ready`；过早停车则保留分数、金币、角色与关卡，先进入 `awaiting`，玩家再次点击才发车。越过冰崖进入 `falling → gameover`，失败结算的“再来一次”同样只进入 `awaiting`。
- 物理与评分：角色以 160 px/s 起步，起点 x=40、随机崖口 x=1820–1940；未制动时按跑道进度使用 65 / 160 / 95 px/s² 三段加速度，第 1 关最高速度 390 px/s、逐关增加并封顶 480 px/s；单击后以 `225 × 当前角色抓地系数` px/s² 持续减速，速度低于 3 px/s 并稳定 110 ms 后结算。`evaluateStop()` 按 0–10、11–35、36–80、81–140、141–220、221+ px 返回 100/90/75/60/45/20 分；前五档通过，最后一档重试。单局总分直接累加每次停车分数，不加入隐藏分。
- 角色与动作：角色数据由本地 `ASSETS.json` 的 8 个可扮演分类筛出并强校验为 52 名；Vite `import.meta.glob` 将同目录 GLB/PNG 转成可移植构建 URL。40 个带具名 `rig_legL/rig_legR/rig_armL/rig_armR` 节点的人形直接驱动素材库肩/髋枢轴，避免旧版空间猜测导致手脚错绑；幽灵使用无腿悬浮动作，机甲使用较慢步频与较小形变，8 个常规四足动物使用对角足组，鸡/鸭重建双腿与双翼枢轴，青蛙使用同步后腿蹬伸。人形本地 +Z 以 `headingYaw = π/2` 对齐跑道 +X，动物本地 +X 保持 `headingYaw = 0`。失败统一冻结 140 ms 后隐藏原模型，并按 8 个角色分类色板生成 14 个 BoxGeometry 碎块，完成 1250 ms 慢动作散落。
- 收藏经济：永久金币、已解锁角色、当前角色与最高关卡存入 localStorage；旧版企鹅存档会安全回退到“店主”。每次通过后解锁清单中第一名尚未拥有的角色并自动选中；52 名全部拥有后按清单循环换角。角色也可用 12–260 金币提前购买，停车按 20–100 分发放 2–10 枚基础金币并叠加最多 3 枚贴边连击奖励。
- 3D 映射与镜头：逻辑层使用屏幕空间数值，场景层通过 `screenToWorld()` 映射到世界 X 轴。cover、`awaiting` 与每关 520 ms 的 ready 使用角色前方约 35°、zoom 64 的起点近景；playing 在 1050 ms 内拉到 zoom 6.8 全跑道机位，固定至 2050 ms 后按危险距离推近。成功时 `FollowCamera` 记录刹车机位，120 ms 定格后在 980 ms 内插值到 `(characterX+4.7, 4.25, -4.6)`、zoom 78，`VictoryBurst` 同步生成 20 枚按评分着色的八面体冰晶、扩散 Torus 光环和局部点光，`result` 保留 zoom 74 的英雄构图。过早停车时记录刹车机位，110 ms 定格后在 930 ms 内升高并拉远到剩余赛道中心上方 `(remainingCenter-4, 14.5, 21)`、zoom 7.4；`EarlyFailureMeasure` 从人物延伸至崖口，绘制珊瑚红虚线与两端 X 标记，低分 `result` 保留该俯视构图。坠崖失败记录越崖机位，140 ms 冻结后只沿崖壁下移，观察点降至 y=-1.35，zoom 先推至 84 再拉至 62；没有横向绕人或相机侧滚。所有 zoom 乘以实际渲染尺寸相对 390×700 的比例，320×568 保持同一构图。
- 场景与天气：冰舌由深层冰、浅层冰、错位雪帽、裂缝、雪脊、分段崖壁、冰柱、浪脊和漂浮碎冰组成；顶面额外按三段速度曲线绘制低对比冰带与逐渐加密的短划纹。`weatherForLevel()` 按 6 关周期选择晴朗、飘雪、薄雾或风雪；`Atmosphere` 阻尼调整天空与雾距，`WeatherFx` 更新跟随角色的点状雪粒子，天气不参与摩擦计算。
- 渲染：场景与角色使用 flat-shaded 高粗糙度材质；主光使用 2048² 阴影贴图和覆盖 60u×40u 的投影相机，使角色沿加长跑道移动时仍有稳定阴影。冰舌本体只接收光影，不向海面投下夸张的整块黑影；角色、冰柱和近景地貌继续使用 Three.js 实时投影保持贴地感。
- 输入：首屏透明语义按钮和封面空白区域的 `onPointerDown` 启动游戏，幽灵手指不接收输入；`result` 只接受结算按钮的 `onClick` 或 Space / Enter，不会由画布触摸或计时器自动推进；低分“本关重试”和 gameover“再来一次”都进入 `awaiting`，`retryUnlockAtRef` 提供 500 ms 发车锁，随后需再次点击。playing 阶段游戏区域一次 `onPointerDown` 或 Space / Enter 锁定本回合制动，重复输入不会取消或重新触发。远征队位于滚动容器内，52 张卡片使用 `onClick`，避免触摸滚动误购买。
- 适配：390×700 游戏场以视口中心为原点按宽高最小比例缩放；R3F 外层与内部 canvas 固定使用 390×700 逻辑尺寸，正交相机再根据实际渲染尺寸补偿 zoom，320×568 下不会发生画布二次缩小。DOM HUD 和按钮的内部尺寸保持至少 44 px 触控目标。
- 音频与多语言：首次交互后创建 AudioContext，音频失败不影响玩法；所有可见文案通过轻量 `t()` 提供中文与英文。
- 平台身份：`src/game-id.ts` 将永久 UUID `5cc524e5-8b5b-48a2-bc0d-e8ecd80fa30a` 写入 `window.__GAME_UUID__`，为后续排行榜、存档与事件提供隔离锚点。
- 持久化：最高分、最佳停车距离、最高贴边连击、静音、永久金币、已解锁角色、当前角色与最高关卡保存到 localStorage；当前版本尚未调用后端、排行榜或云存档接口。

## 4. 扩展点

- 调整速度、刹车力度和关卡节奏：修改 `src/EdgeBrake/hooks/useEdgeBrake.ts`；调整判定区间、100 分制和金币档位：修改 `src/EdgeBrake/rules.ts`。
- 同步或新增角色：从共享库复制同源 GLB/PNG 和最新清单到 `src/EdgeBrake/assets/characters/`；调整抓地、价格、缩放、朝向和动作分组时修改 `src/EdgeBrake/characters.ts`。
- 修改角色动作、冰舌、天气、灯光、镜头、粒子和环境资产：修改 `src/EdgeBrake/components/EdgeBrakeScene.tsx`。
- 修改 HUD、开始页、结果页、颜色、排版与动效：修改 `src/EdgeBrake/EdgeBrake.tsx`、`EdgeBrake.less` 和 `doc/visual.md`。
- 增加新文案或调整中英文：修改 `src/EdgeBrake/i18n/index.ts`。
- 调整声音频率、波形、时长和音量：修改 `src/EdgeBrake/utils/sounds.ts`，并同步更新 `doc/requirements.md`。
- 增加排行榜或云端存档：先为游戏注册永久 UUID，再在 hook 中接入共享 runtime；当前本地记录不要直接作为平台数据源。
- 更换正式封面：使用 `_production/generate_poster.py` 走 Aigram transit 接口，检查来源记录、1024 原图和 160×160 缩略图后替换 `public/poster.png`。
- 发布：补齐 `games.json` 条目、永久 UUID 与 zipurl，运行同步和 UUID 校验脚本后再执行发布流程。
