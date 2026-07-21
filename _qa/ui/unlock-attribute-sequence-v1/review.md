# 新角色解锁与属性时序视觉 QA

## Context

- Review target：新角色解锁横幅与角色体重/速度的层级、时序和窄屏适配。
- Viewports：390×700、320×568。
- First-pass：`00-user-overlap-reference.jpg`。
- Recheck：`390-01-unlock-only.png`、`390-02-attributes-after.png`、`320-01-unlock-only.png`、`320-02-attributes-after.png`、`390-03-early-input-handoff.png`。

## Executive assessment

- Decision：Pass。
- First-pass P1：解锁横幅与姓名/体重/速度同时占用角色上方区域，文字互相遮挡，无法建立清晰阅读顺序。
- Fix：`newUnlock` 存在时不渲染属性；1700 ms 横幅退场后再挂载两行属性。属性移除重复姓名，数值放大到 21 px。提前开始蓄力时横幅立即让位。
- Recheck：两种尺寸的解锁帧均为 1 个横幅、0 个属性区；退场后为 0 个横幅、1 个属性区、0 个姓名节点；浏览器无应用错误。

## Scorecard

| Category | Score |
|---|---:|
| Hierarchy | 5 |
| Coherence | 5 |
| Readability | 5 |
| Game feel | 4 |
| Asset quality | 4 |
| Responsive UX | 5 |
| Polish | 4 |

Final average：4.6 / 5；无低于 3 的项目。

## Foundation audit

- 功能图标：未新增 emoji；沿用既有 SVG 图标。
- 触控与输入：属性和横幅均不接收指针；提前按住不会被 1700 ms 展示阻塞。
- 对比：标签使用冷灰白，21 px 数值使用奖励黄，并同时保留文字标签，不依赖颜色表达语义。
- 响应式：390×700 与 320×568 均无横向溢出、HUD/角色/蓄力控件遮挡。
- 动效：横幅 220 ms 退场、属性 220 ms 淡入上移；减少动态模式由全局规则压缩至 1 ms，信息仍通过文字完整表达。
