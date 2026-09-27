# 账伴 UI 规范

更新日期：2026-09-27。本文件按最终源码记录黄色鸭子记账界面；产品能力和未开放范围见 [PRODUCT.md](PRODUCT.md)。品牌风格采用用户最新参考，不继续沿用上一轮焦糖棕主色方向。

## 颜色、字体与素材

统一变量在 [theme.scss](src/styles/theme.scss)。浅黄色建立主要页面识别，奶油底承接白色卡片；正文和按钮文字使用深墨色，避免黄字落在白底上。

| 用途 | 实现颜色 |
| --- | --- |
| 页面底 `$canvas` | `#FAF7ED` |
| 卡片 `$paper` | `#FFFFFF` |
| 正文 `$ink` | `#292A25` |
| 辅助文字 `$muted` | `#75756B` |
| 金色边框 `$line` | `#DDCFA9` |
| 主按钮、选中背景 `$brand` | `#FFDA4A` |
| 主要黄色页头 | `#FFE477` |
| 聊天页头 / 聊天底 | `#FFE994` / `#FBF7E8` |
| 深色强调 `$brand-dark` | `#5B4A16` |
| 浅色强调 `$brand-soft` | `#FFF1AE` |
| 收入和支出文字 | `#188544` |
| 负数、错误 `$danger` | `#B94738` |

收支方向还通过标签和正负号表达；图表可使用独立绿色和彩色类别系列。公共卡片为 `32rpx` 圆角、`2rpx` 金色边框和向下 `5rpx` 的浅金投影，具体页面按内容调整。主按钮通常高 `96rpx`、圆角 `24rpx`，使用黄色背景与墨色文字。

[App.vue](src/App.vue) 继续使用系统无衬线字体，包括 `PingFang SC`、`Microsoft YaHei`；金额开启 `tabular-nums`。公共正文基准为 `28rpx`，页标题通常 `34–44rpx`，说明文字约 `21–26rpx`。没有外部字体下载。

本地 [assistant-duck.png](src/static/assistant-duck.png) 用于首页助手、中心加号、聊天头像和“我的”头像。[BrandWordmark.vue](src/components/BrandWordmark.vue) 仍是临时文字标识，圆体依赖系统字体；常规登录使用大号竖排，短信步骤缩为小号。它不等于最终定制 LOGO。

[generate-icons.cjs](scripts/generate-icons.cjs) 定义 33 个 `24 × 24`、`1.7` 线宽的圆端 SVG 图标，生成品牌深色、辅助色、墨色、收入、支出、白色和彩色 7 套，共 231 个文件。彩色版本根据类别添加填色；以 `node scripts/generate-icons.cjs` 重新生成。[AppIcon.vue](src/components/AppIcon.vue) 通过本地 `<image>` 加载，支持预定义名称和颜色，不依赖网络或 CSS mask。

## 导航、日期与刷新

路由配置见 [pages.json](src/pages.json)。真实 tab 只有“明细 / 资产 / 统计 / 我的”4 项。微信的 [custom-tab-bar](src/custom-tab-bar/index.js) 原生组件在中间额外放置鸭子加号操作；它调用 `navigateTo`，不属于 tab 选项，也不改变来源 tab 的选中状态。各页不再挂载旧 `BottomNav`。

H5 保留框架原生 4 tab，在底栏上方居中展示 [H5ChatEntry.vue](src/components/H5ChatEntry.vue) 浮动 AI 加号；组件仅在 H5 编译可见，微信端不重复显示入口。浮动按钮层级为 `90`，低于日历覆盖层的 `1000`。

导航工具在 [navigation.ts](src/utils/navigation.ts)：业务 tab 用 `switchTab`，AI 聊天、详情、编辑和分类设置用 `navigateTo`；AI 是独立非 tab 页面，返回优先 `navigateBack` 回来源页，无来源时回到明细。注销时清理认证并返回登录。

日历弹出期间临时隐藏 tab 页底栏，关闭后根据当前路由恢复。页面顶部使用状态栏高度和胶囊安全区。4 个 tab 页在各自根样式中引用 `tab-page-bottom`，且放在 padding 简写之后：先声明 `padding-bottom: 192rpx`，再声明 `calc(192rpx + env(safe-area-inset-bottom, 0px))`。统一留白覆盖微信固定底栏及 H5 浮动入口，不能只导入主题却不应用对应规则。常规内容最大宽度约 `960rpx`，左右内边距按页面使用 `26–36rpx`。

全部页面通过 [useNavigationLayout.ts](src/composables/useNavigationLayout.ts) 将实测导航尺寸绑定到页面根节点，不使用编译器固定为 25px 的 `--status-bar-height`。状态栏取可信的 `statusBarHeight` 与 `safeArea.top` 较大值，微信导航行按 `胶囊高度 + 2 × (胶囊顶部 − 状态栏高度)` 计算且至少 44px；右侧按 `窗口宽度 − 胶囊左边界 + 8px` 留白。标题行使用 `.capsule-safe`，外层仅预留状态栏，月份等内容置于标题行之后。H5 不预留微信胶囊；接口失败保留回退布局。页面重新显示和窗口变化会重新测量，隐藏/卸载时移除监听。计算规则见 [navigationLayout.ts](src/utils/navigationLayout.ts)。

所有日期和月份选择统一使用 [CalendarSheet.vue](src/components/CalendarSheet.vue)，包括首页按日筛选、[MonthPicker.vue](src/components/MonthPicker.vue) 和记账表单。日历采用底部弹层，可逐日点选、切换月份/年份、回到今天并确认，支持日期与月份两种模式；没有日期滚轮或时分选择。支付方式仍可使用原生列表 `picker`。

记账日期只提交 `occurred_date: YYYY-MM-DD`；`occurred_at` 仅供旧数据兼容，不进入新表单。服务端筛选按 `start_date` 包含、`end_date` 不包含。**主账单流与支付方式展开明细按 `created_at` 倒序**，而非按消费日期排序；主账单流中相邻相同记账日期形成一组，因此补记旧账会出现在新创建的位置。工具见 [ledger.ts](src/utils/ledger.ts)。统计金额榜按金额排序。

[useHomeLedger.ts](src/composables/useHomeLedger.ts) 与 [useMonthAnalysis.ts](src/composables/useMonthAnalysis.ts) 只读取所选月份的完整分页。首次进入、月份变化、`ledgerRevision` 变化或用户主动刷新时请求数据；普通 tab 往返复用有效数据。新增/编辑/删除账单、AI 入账和设置新增通知修订号变化。旧响应不能覆盖新月份；失败显示重试，统计/资产保留旧数据时明确标注其月份。分页出现重复 ID 或总数变化时提示刷新，接口快照一致性仍需服务端支持。

## 页面与真实操作

**明细**：[home/index.vue](src/pages/home/index.vue) 使用黄色页头、月份/日历/搜索工具、白色月汇总卡和鸭子 AI 邀请入口。快捷区连接对话、统计、支付方式和分类管理。下方支持全部/支出/收入、日期与关键词组合筛选，显示分组收支小计和金额正负号。点击账单进入独立详情，空账本主要操作引导 AI 记账。

**AI 聊天**：[ai-chat/index.vue](src/pages/ai-chat/index.vue) 是独立页面，以“账伴小鸭”为助手，黄色头部配返回和会话历史入口，消息区使用双方气泡，不展示 tabBar。用户发送收支描述，后端识别并直接入账，前端展示真实返回的账单卡片；信息不足时由助手继续澄清。卡片可打开详情、编辑或二次确认删除。输入区注明“AI 识别后自动入账”，手动记账是快捷区的次入口。

聊天根容器保留静态 `100vh` 回退，并读取原生视口、胶囊与安全区；中部使用独立滚动容器，底部输入框固定高度。键盘出现时取实际可用视口，避免重复扣减高度，并收起快捷行。历史消息缺少或为空的账单数组归一化为 `[]`，非法响应进入可重试错误状态，避免渲染中断。

[useAiChat.ts](src/composables/useAiChat.ts) 接入真实会话与消息接口，保留最近 100 条历史消息展示；支持新会话与历史切换。未知结果的发送保留同一个 `client_message_id` 供重试，发送期间阻止并行提交，错误时不伪造成功卡片。输入文本可能包含个人收支信息；待确认消息按账号隔离保存在本地用于恢复。

**详情与手动表单**：[record-detail/index.vue](src/pages/record-detail/index.vue) 以票据卡显示分类、金额、备注、支付方式、记账日期与记账方式，并提供编辑/删除。[record-editor/index.vue](src/pages/record-editor/index.vue) 按参考图重构为单页编辑器：顶部是关闭与五种记账类型，中部是五列彩色分类圆标，底部是固定黄色工作台，包含账本/支付方式/预算快捷项、金额卡和四列自定义数字键盘。转账、借款和 AI 记账标签目前保留入口但会明确提示未开放。金额大于零、不超过 100 万元，最多两位小数，以整数分提交；退格、小数、加减方向切换和“再记/完成”均由页面键盘处理。日期继续使用 `CalendarSheet`，编辑时选择“未指定”会提交空支付方式；保存结果未确认时锁定草稿，仅允许重试。未保存离开、删除和未知提交结果均有明确反馈与保护。

**统计**：[statistics/index.vue](src/pages/statistics/index.vue) 使用 6 格概览：收入、支出、结余及对应日均。当前月份按已过自然日计算日均，历史月份按全月天数，未来月份日均分母为零；页面显示分母。每日趋势在支出/收入/结余之间切换，柱状/折线实际改变绘图；支持点选日期和日期按钮读取金额。

分类区可切换支出/收入，展示环形图、分类金额、笔数、占比；分母为对应方向总金额。明细金额榜默认前三，支持展开与收起，点击先进入账单详情，再由详情编辑。图形由 [LedgerChart.vue](src/components/LedgerChart.vue) 绘制：微信使用 `canvas type="2d"` 的节点 context 实现同层渲染，使图表位于 TabBar 和日历之下；H5 等其他端保留 uni Canvas。共用绘图适配器在 [chartCanvas.ts](src/utils/chartCanvas.ts)，失败时提供文本数据且保留画布节点便于恢复，不退回微信旧原生画布。相关计算与负数处理在 [statistics.ts](src/utils/statistics.ts)。趋势由完整当月真实账单聚合，无账单的自然日为零，不以未知方向的金额猜测收入或支出。

**资产**：[assets/index.vue](src/pages/assets/index.vue) 当前展示所选月份总收入、总支出和净流入，再按支付方式汇总并展开真实账单。未指定和已停用/缺失的支付方式仍保留对应记录。点击账单进入详情；空状态的记账入口进入 AI 聊天。页面明确注明“净流入不等于账户余额”和“不包含期初余额”，不提供虚构的真实资产余额。

**我的与分类设置**：[manage/index.vue](src/pages/manage/index.vue) 显示鸭子头像、真实昵称或默认账本名、脱敏手机号，以及 AI、统计、分类和支付方式入口。[category-settings/index.vue](src/pages/category-settings/index.vue) 是独立非 tab 页面，保留 `section/type/add` 进入状态、分类收支切换、支付方式列表、内联新增和返回路径。名称最多 30 字，成功新增通知其他 tab 更新；没有新增分类编辑、删除和启停能力。导入、导出、隐私账户入口仍标注未开放；退出登录需确认。

**登录与未开放页**：[login/index.vue](src/pages/login/index.vue) 初始 `initializing` 阶段仅呈现黄色品牌页、文字字标与“正在打开你的账本”加载提示。自动身份验证成功后直接进入账本，不先闪出登录按钮；确实需要协议确认、手动登录、短信验证或错误重试时，才显示淡黄品牌区和白色验证卡。手机号和 4 位短信验证码绑定、发送冷却、限流与重新验证保持现有流程；H5 不支持微信身份验证时仍说明应在微信打开。协议正文尚未发布，点击如实说明。[unavailable/index.vue](src/pages/unavailable/index.vue) 返回失败时用 `goHome`；旧 AI 未开放入口会转至独立聊天页。

## 验证边界

前端与后端真实 AI 接口已经集成；本轮尚未完成真实模型调用、真实账号的短信送达和微信真机端到端验证。自动化用例覆盖认证、账单、设置、统计、导航和 AI 等行为，但不等于模型解析质量或视觉验收。

最新 183 项测试、类型检查、H5 与微信小程序构建通过；已核对编译产物的动态导航尺寸、微信 Canvas 2D 分支和手动记账自定义键盘。**尚未完成截图视觉 QA**。微信原生 tabBar、H5 浮动入口、CalendarSheet 覆盖层、Canvas/SVG、软键盘、安全区及不同设备字体仍需实机检查。
