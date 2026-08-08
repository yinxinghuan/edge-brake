# 首屏布局修复视觉 QA

## Context

- Review target: 首屏天气卡、排行榜/远征队入口与蓄力条的定位和间距。
- Requirements and visual bible: `doc/requirements.md`, `doc/visual.md`。
- Viewports: 390×844、390×700、320×568。
- Evidence: 本目录中的 `platform-layout-cover-firstpass-*`、`platform-layout-cover-recheck-*` 与 `external-guest-cover-recheck-390x700.png`。

## Executive assessment

- Decision: Pass。
- First-pass P1: compact 天气卡错误继承绝对定位卡片的水平位移动画，左侧越出画面；新增内容高度把入口区压到蓄力条上。
- Recheck: 天气卡完整居中，标题、天气、角色、入口区和蓄力条在三个视口中均分层显示；320×568 下入口区底部与蓄力条顶部保留约 41 px。

## Scorecard

| Category | Score | Evidence |
|---|---:|---|
| Hierarchy | 4 | 首屏顺序可读，角色与蓄力动作仍是主焦点。 |
| Coherence | 4 | 天气卡、入口与蓄力条沿用既有极地视觉系统。 |
| Readability | 4 | 三种尺寸无文字或卡片裁切。 |
| Game feel | 4 | 天气卡进入动效保留，但不再产生横向跳位。 |
| Asset quality | 4 | 3D 角色和场景未受布局修复影响。 |
| Responsive UX | 5 | 390×844、390×700、320×568 的边界断言均通过。 |
| Polish | 4 | 组件间距清楚，无重叠或可见近失配。 |

Final average: 4.14 / 5；无低于 3 的分类。

## Foundation audit

- Functional emoji icons: 无。
- Icon-family consistency: 沿用现有 SVG 图标。
- Touch targets: 入口与蓄力区域未缩小。
- Contrast and color independence: 未改变语义颜色；天气仍有图标与文字双通道。
- Focus and input behavior: 未改变。
- Localization and overflow: 中文和英文仍使用原有内容宽度；英文窄屏截图无裁切。

## Iteration evidence

- First pass: 天气卡左边界为负值；390×700 与 320×568 的入口区分别与蓄力条相交约 21 px、17 px。
- Fix: compact 卡片改用无水平位移的独立进入动画；封面顶部 padding 从 104 px 调整为 72 px；角色留白从 220 px 调整为 180 px。
- Matched recheck: 所有 `platform-layout-cover-recheck-*` 截图；自动边界检查 `weatherInsideViewport=true`、`entriesClearCharge=true`。
- External guest: 访客栏可见时游戏仍可操作；其覆盖不用于反向调整平台内主构图。
- Exception: 本地预览访问平台排行榜与埋点接口产生预期 CORS 日志，不影响布局、输入或构建。
