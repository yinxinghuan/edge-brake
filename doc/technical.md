# 《急刹车》技术文档

## 1. 技术栈

- React 18 + TypeScript 5 管理游戏阶段、HUD、收藏与结算界面。
- React Three Fiber + Three.js 以正交相机渲染低多边形 3D 场景；Drei `useGLTF` 加载本地角色模型。
- Less 管理固定 390×700 逻辑画布、缩放适配、状态样式和动效降级。
- Vite 5 构建，`base: './'`，`npm run build` 输出可部署到任意子路径的 `dist/`。
- Web Audio API 合成蓄力、满力、发车、停车、金币、解锁和失败音效；localStorage 保存成绩、收藏、金币、当前角色、静音与语言覆盖。

## 2. 目录结构

- `src/EdgeBrake/EdgeBrake.tsx`：DOM 界面、按住/松手输入层、两行角色属性、解锁横幅、力度槽、HUD、收藏与结算。
- `src/EdgeBrake/hooks/useEdgeBrake.ts`：阶段状态机、RAF 主循环、蓄力计时、自动滑行、结算、关卡与本地记录。
- `src/EdgeBrake/physics.ts`：力度曲线、角色速度系数、发车初速度、体重与天气共同决定的减速度。
- `src/EdgeBrake/rules.ts`：100 分制距离区间、过关条件、连击与金币规则。
- `src/EdgeBrake/characters.ts`：从本地清单生成 52 名角色，提供名称、动作组、体重、速度、缩放、朝向、价格与素材 URL。
- `src/EdgeBrake/components/EdgeBrakeScene.tsx`：3D 世界、角色骨骼动作、方块浮岛跑道、天气、巨物彩蛋、镜头、灯光、阴影和结果特效。
- `src/assets/characters/`：共享素材库消费者的标准目录，包含 52 个 GLB、52 张 PNG 缩略图和 `ASSETS.json`，构建不依赖仓库外路径，并可由实时 inventory 完整性脚本直接审计。
- `src/EdgeBrake/i18n/index.ts`：中英文文案和语言检测。
- `src/EdgeBrake/utils/sounds.ts`：Web Audio 合成音效。
- `src/EdgeBrake/EdgeBrake.less`：HUD、蓄力控制、两行角色属性、解锁横幅时序、结果层、收藏卡和响应式视觉系统。
- `src/game-id.ts`：永久游戏 UUID 注入文件，迭代时不得更换。
- `public/poster.png`、`meta.json`：正式封面与游戏元数据。
- `_qa/ui/`：390×700、320×568 的运行截图与交互复验记录。
- `doc/requirements.md`、`doc/visual.md`、`doc/technical.md`：需求、视觉和技术文档。

## 3. 核心模块

- 状态机：首局为 `cover → charging → playing`；重试和下一关停在 `awaiting`，再次按住才进入 `charging`。自然停止后按成绩进入 `success` 或 `earlyFail`，镜头表演结束后进入不限时 `result`；越崖进入 `falling → gameover`。结算不会自动开始下一局。
- 输入：封面或等待阶段在游戏区域 `pointerdown` 开始蓄力，`pointerup`/`pointercancel` 松手发车；Space/Enter 使用 `keydown`/`keyup` 等价操作。发车后不再接受控制。按钮拦截冒泡，收藏滚动列表使用 `onClick`，避免触摸滚动误选。
- 蓄力与物理：80 ms 为最短有效输入，1600 ms 充满；力度为 `0.12 + 0.88 × normalized^1.35`。初速度为 `(335 + 365 × power) × speedFactor`，角色速度 2.6–5.0 映射为 0.86–1.14。每帧使用匀减速更新，减速度为 `clamp(126 × surfaceFactor × (75 / weight)^0.22, 92, 166)`；晴、雪、雾、风雪系数分别为 1.00、1.07、0.96、1.03。`velocity / deceleration <= 1.8` 或 `remainingToCliff / velocity <= 1.3` 时把 `isAutoBraking` 置为 true，只切换动作、雪屑和声音，不修改减速度。速度低于 3 px/s 并稳定 140 ms 后结算。
- 判定：角色前缘距崖口 0–10、11–35、36–80、81–140、141–220、221–320、321+ px 分别得到 100/90/75/60/45/30/20 分；前六档通过，最后一档原关重试。越过崖口 12 px 直接坠落。随机崖口位于 x=1820–1940，起点 x=40。
- 角色属性与收藏：`ASSETS.json` 的 8 类素材强校验为 52 名。体重范围 18–240 kg，速度范围 2.6–5.0；特殊角色使用显式表，其余从 footprint 和动作类型推导。金币、解锁列表、当前角色和最高关卡存入 localStorage；通过后自动解锁并换到下一名角色，也可在商店提前购买。
- 属性与解锁时序：`newUnlock` 非空时只渲染包含姓名的解锁横幅，1700 ms 定时清空后才挂载无姓名的体重/速度两行属性；玩家在横幅存在时开始蓄力会同步把 `newUnlock` 清空，保证横幅不残留到滑行阶段。根节点的 `data-character-stats` 提供 `delayed / visible / hidden` 三种可测试状态。
- 角色动作：人形/机甲驱动 `rig_legL/rig_legR/rig_armL/rig_armR`，四足、鸟、蛙与悬浮角色使用独立动作组。蓄力随力度连续下蹲和前后错步，82% 以上加入轻颤；松手前 360 ms 加强蹬地步幅和前倾，随后把步态摆幅压到 8%，过渡为滑行平衡。自动刹车在预计自然停止前 1.8 秒或距崖 1.3 秒时切换为后仰与四肢外撑，按动作组分别处理双臂、翼和四足，并让 `SnowSpray` 在脚后持续循环；刹车阈值只影响表演，不参与物理积分。失败冻结后隐藏原模型，按角色色板生成 14 个方块碎片完成 1250 ms 慢动作散落。
- 镜头：封面、`awaiting`、`charging` 使用 zoom 64–70 英雄近景。发车后相机跟随角色保持 280 ms 起跑特写，再用 920 ms 拉到 zoom 6.8 的整条跑道全景，并停留到发车后 2100 ms；随后按接近崖口的危险进度推近。成功镜头绕至崖外正面 zoom 78；动力不足升高到剩余跑道俯视 zoom 7.4；坠崖沿崖壁垂直追随，zoom 84→62。
- 场景：`IcePlatform` 用不同长度和厚度的 BoxGeometry 形成方块浮岛跑道；天气按 6 关循环；远景从熊、牛、猪、狐狸、幽灵、僵尸、狼人、木乃伊、骷髅、战斗机甲和牛头怪中随机抽取巨大局部剪影。巨物按发车时间控制透明度，在 1200–2100 ms 的最远全景和停留段保持可见，2300–3400 ms 才淡出。角色使用实时阴影，跑道不生成额外矩形假阴影。
- 适配与可访问性：390×700 游戏场按视口宽高最小比例整体缩放；R3F 画布保持逻辑尺寸，正交相机按真实渲染比例补偿 zoom。功能按钮不小于 44×44 CSS px，焦点有可见外框，`prefers-reduced-motion` 会取消非必要循环和震动。
- 平台身份：`src/game-id.ts` 把永久 UUID `5cc524e5-8b5b-48a2-bc0d-e8ecd80fa30a` 写入 `window.__GAME_UUID__`。当前版本尚未接入排行榜或云存档接口。

## 4. 扩展点

- 调整蓄力曲线、速度映射、体重惯性或天气阻力：修改 `src/EdgeBrake/physics.ts`；调整起点、崖口随机范围与阶段时长：修改 `hooks/useEdgeBrake.ts`。
- 调整评分、通过范围、金币与连击：修改 `src/EdgeBrake/rules.ts`。
- 新增或同步角色：把同源 GLB/PNG 与清单放入 `src/assets/characters/`；调整体重、速度、价格、缩放、朝向或动作分组：修改 `characters.ts`。
- 修改角色动作、浮岛、天气、灯光、镜头、粒子或远景巨物：修改 `components/EdgeBrakeScene.tsx`，并同步 `doc/visual.md`。
- 修改 HUD、蓄力控件、两行角色属性、解锁横幅时序、结果页、颜色、排版与动效：修改 `EdgeBrake.tsx`、`EdgeBrake.less`、`hooks/useEdgeBrake.ts` 和 `doc/visual.md`。
- 修改中英文文案或声音：分别修改 `i18n/index.ts`、`utils/sounds.ts`，并同步需求文档的事件映射。
- 增加排行榜或云存档：基于现有永久 UUID 接入共享 runtime，保留本地数据作为离线回退而非平台数据源。
- 发布：按 game-publish 流程检查 `meta.json`、海报来源、UUID、相对资源路径、构建产物与线上 bundle；本次玩法改造未自动发布。
