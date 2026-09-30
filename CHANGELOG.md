# Changelog

## 2026-09-30 后台记账与前台结果恢复

### Changed
- 发送改用持久异步接收接口：服务器确认后显示“已发送 · 后台处理中”，退出页面或小程序不影响已接收任务。保留请求编号，回包丢失和重试不重复记账。
- 新增应用级请求状态管理：前台约每 2 秒查询，查询失败退避至 30 秒；进入后台暂停，返回立即补查，冷启动恢复身份后按原编号取回结果。聊天页卸载不停止提交或前台查询。
- 完成后自动展示回复/账单并刷新当前可见的明细、资产、统计；隐藏页再次显示时刷新。账号切换隔离迟到响应；旧历史不能覆盖新完成结果。
- 服务端失败可重试同一编号，也可修改后用新编号提交；未确认发送或仍处理中的消息不能直接丢弃。修复发送中退出并立即重进导致聊天页未初始化的问题。
- 后端复用 Celery/Redis 和消息表，使用独立数据库连接处理，回复和账单原子提交；增加漏投/过期租约恢复、有界重试和跨天日期保护。无需数据库迁移。

### Validation
- 前端全量 `node --test --experimental-test-isolation=none tests/*.test.cjs`：237 项中 236 项通过；唯一失败为既有 `tests/auth.test.cjs:91`，短信发送仍带空 `test` 字段，已核对 HEAD 原实现，本次未修改认证行为。
- 后端 `.venv/Scripts/python.exe -X utf8 -B -m pytest -p no:cacheprovider apps/ledger_mate/tests --confcutdir=apps/ledger_mate/tests -q`：71 项通过；使用内存 SQLite、模拟模型及队列，不连接业务数据库或真实模型。
- `npm run type-check`、`npm run build:mp-weixin`、`npm run build:h5`：通过；沿用已有 Sass 弃用和工具链循环依赖提示。
- 测试覆盖前台自动显示、退出/重启恢复、回包丢失、原编号重试、任务失败编辑重发、多任务交错、账号隔离、数据库事务、重复领取和过期 Worker 禁止写入；真实微信与 Redis/PostgreSQL 多进程验证尚未执行。

### Files
- 前端入口与接口：`src/App.vue`、`src/api/ledger.ts`、`src/types/api.ts`。
- 前端状态与数据：`src/stores/aiRequest.ts`（新增）、`src/utils/aiChat.ts`（新增）、`src/utils/navigation.ts`、`src/composables/useAiChat.ts`、`src/composables/useHomeLedger.ts`、`src/composables/useMonthAnalysis.ts`。
- 页面：`src/pages/ai-chat/index.vue`、`src/pages/home/index.vue`、`src/pages/assets/index.vue`、`src/pages/statistics/index.vue`。
- 前端测试：`tests/ai-chat.test.cjs`、`tests/ai-request.test.cjs`（新增）、`tests/guest-data.test.cjs`、`tests/ledger.test.cjs`、`tests/navigation.test.cjs`。
- 文档：`PRODUCT.md`、`DESIGN.md`、`docs/async-accounting.md`（新增）、`CHANGELOG.md`。
- `hope-service` 业务：`apps/ledger_mate/ai_requests.py`（新增）、`apps/ledger_mate/services.py`、`apps/ledger_mate/router.py`、`apps/ledger_mate/schemas.py`、`apps/ledger_mate/tasks.py`。
- `hope-service` 注册与测试：`core/apps_config.py`、`worker/scheduler.py`、`apps/ledger_mate/tests/test_ai_requests.py`（新增）、`apps/ledger_mate/tests/test_http_contract.py`、`apps/ledger_mate/tests/test_tasks.py`（新增）。
- `hope-service` 文档：`apps/ledger_mate/CHANGELOG.md`、根 `CHANGELOG.md`。

### Deployment
- 尚未部署。需先更新后端 API、Worker、Beat，再发布小程序；命令和验收步骤见 [后台记账说明](docs/async-accounting.md)。

## [Unreleased] - 2026-09-28

### Changed
- 将首页、我的页、底栏、H5 入口、快速记账页和账单详情中的 AI 宣传式文案改为中性功能描述，例如“快速记账”“整理后生成账单卡片”。保留现有功能行为和接口不变。
- 小程序分类读取兼容全局模板同步后的 `sort_order`、启用状态和图标字段别名。
- 新增统一 `CategoryIcon`，优先展示后台上传的 CDN/静态路径图标，加载失败或旧图标名称自动回退到本地 `AppIcon`。
- 首页、记账编辑、账单详情、分类设置、收支统计和 AI 记账卡片统一使用分类图标组件。
- 恢复冷启动静默微信登录：完整登录态自动进入首页，手机号未绑定、未同意协议或静默失败时进入访客预览；账单、统计、记账设置及 AI 等实际操作按需进入手动登录页。
- 将冷启动 Loading 页与手动登录页拆分：启动页只负责静默登录和进入访客首页，不显示返回按钮；登录页保留返回预览、手机号绑定和失败重试。
- 手动登录按钮显式调用登录函数，避免把微信 `tap` 事件对象误判为静默登录参数，收到 `PHONE_REQUIRED` 后稳定停留在手机号绑定步骤。
- 访客页面不请求或保留个人账单数据，使用占位内容展示基础功能；登录、退出和账号切换会清理异步请求与缓存，避免跨账号数据串联。

### Fixed
- 移除短信发送请求中无业务含义的空 `test` 字段，保持认证接口请求体与服务端契约一致。

### Validation
- 全量 `node --test --experimental-test-isolation=none tests/*.test.cjs`：通过（211 项），新增启动页分支和真实点击事件回归测试。
- `npm run type-check`、`npm run build:mp-weixin`、`npm run build:h5`：通过。

## [0.4.6] - 2026-09-27

### Changed
- 重构手动记账详情页为参考图中的单页编辑器：顶部提供关闭与支出/收入/转账/借款/AI 记入口，中部使用五列分类图标网格，底部固定黄色金额工作台。
- 新增本地数字键盘，支持金额、退格、小数、收入/支出方向切换、“再记”和“完成”；金额输入继续保持两位小数和后端金额上限校验。
- 日期继续通过 `CalendarSheet` 选择；账本、支付方式和预算入口改为工作台快捷项。编辑已有账单时选择“未指定”会明确提交 `payment_method_id: null`，可清空原支付方式。
- 未开放的转账、借款和 AI 记账标签保留参考图信息架构，并在点击时给出明确提示；保存结果待确认时锁定草稿，仅保留“重试”。
- 新增语义化退格 SVG 图标，并将图标生成器与 `AppIcon` 白名单同步到 33 个图标。

### Validation
- 定向 `tests/keypad.test.cjs`、`tests/record-editor.test.cjs`：通过，覆盖数字键盘约束、重试锁定和清空支付方式。
- 全量 `node --test --experimental-test-isolation=none tests/*.test.cjs`、`npm run type-check`、`npm run build:mp-weixin`、`npm run build:h5` 均通过；小程序产物包含自定义键盘与退格图标。
- 未进行微信真机视觉验收；仅检查编译产物和现有自动化行为。

### Files
- 页面：`src/pages/record-editor/index.vue`。
- 状态与校验：`src/composables/useRecordEditor.ts`、`src/utils/keypad.ts`、`src/types/api.ts`。
- 图标：`scripts/generate-icons.cjs`、`src/components/AppIcon.vue`、`src/static/icons/*/backspace.svg`。
- 测试与文档：`tests/keypad.test.cjs`、`tests/record-editor.test.cjs`、`DESIGN.md`、`CHANGELOG.md`。

## [0.4.5] - 2026-09-27

### Added
- 按用户提供的两张分类截图新增 45 个彩色 SVG：收入 17 个、支出 28 个。统一 64 × 64 画布、2.7 圆角深色描边、透明背景，货币符号用路径绘制，无外部字体或图片依赖。
- 图标存入 `src/static/icons/categories/income/` 和 `expense/`，访问路径为 `/static/icons/categories/...`。跨收支同名分类按目录区分；白色圆底与分类标签由使用页面提供。
- 新增可重复生成的本地脚本、中文分类文件对照表、JSON 索引和离线预览页；预览支持 32 / 48 / 64 px 尺寸切换与透明背景检查。全部文件采用 UTF-8。
- 本次交付独立素材，现有 `AppIcon` 白名单和 `categoryIcon` 分类映射尚未接入；README 提供直接通过 `<image>` 加载的用法。

### Validation
- 核对截图分类名称、顺序与数量：收入 17 / 17、支出 28 / 28；45 个 SVG 的 XML、预览图片路径、README 链接及 UTF-8 检查通过。
- 使用临时目录的 Resvg 将全部图标以 64 px 和 32 px 渲染并目视检查，90 次渲染均有有效图形、外边缘透明；未发现裁切。图标原文件不包含白圆底或中文标签。
- 生成源与预览页脚本语法检查、重复生成一致性检查通过。`npm run build:mp-weixin` 通过，构建产物包含全部 45 个分类 SVG；保留工具链原有 Sass 弃用与循环依赖提示。
- 未进行浏览器交互和微信真机视觉验收；本次没有业务行为变更，未新增业务测试或修改项目依赖。

### Files
- 生成入口：`scripts/generate-category-icons.cjs`。
- 图形定义：`scripts/category-icons/income.cjs`、`scripts/category-icons/expense-daily.cjs`、`scripts/category-icons/expense-life.cjs`。
- 素材：`src/static/icons/categories/income/*.svg`（17 个）、`src/static/icons/categories/expense/*.svg`（28 个）；逐项文件清单见 `src/static/icons/categories/README.md`。
- 索引与预览：`src/static/icons/categories/manifest.json`、`src/static/icons/categories/README.md`、`src/static/icons/categories/preview.html`。
- 修订记录：`CHANGELOG.md`。

## [0.4.4] - 2026-09-27

### Fixed
- 修复自定义页头依赖 `--status-bar-height` 导致刘海屏顶部空间不足的问题。当前 uni-app 微信编译器注入的是固定 25px，并非设备实时状态栏高度；全部 10 个页面改用共享导航尺寸。
- 从 `getWindowInfo` 读取状态栏和安全区，必要时兼容 `getSystemInfoSync`；微信结合胶囊的 top/height 计算导航行高度，右侧按胶囊实际 left 预留。导航栏单独占行，月份与其他内容排在其下。
- 页面显示和窗口变化时重新测量，隐藏/卸载时清理监听；缺失、无效数据与 API 异常使用安全回退。聊天页共用导航尺寸，同时保留原有视口与键盘处理。
- 修复登录与未开放页同一元素的 padding 简写覆盖胶囊右侧留白；移除其他页头的固定胶囊宽度和重复顶部间距。

### Validation
- 全量 `node --test --experimental-test-isolation=none tests/*.test.cjs`：180 / 180 通过，含 20 项新导航尺寸测试；`npm run type-check` 通过。
- `npm run build:mp-weixin`、`npm run build:h5` 均通过。核对 10 个微信页面产物：根节点绑定动态尺寸，导航行使用新变量，页头均不再依赖旧 `--status-bar-height`。
- 已验证普通屏、刘海屏、安卓间距、横向窗口变化、缺失/无效尺寸、接口异常和监听清理；这些为自动化验证，尚未进行微信真机截图验收。

### Files
- 新增：`src/utils/navigationLayout.ts`、`src/composables/useNavigationLayout.ts`、`tests/navigation-layout.test.cjs`。
- 样式：`src/styles/theme.scss`。
- 页面：`src/pages/home/index.vue`、`src/pages/assets/index.vue`、`src/pages/statistics/index.vue`、`src/pages/manage/index.vue`、`src/pages/category-settings/index.vue`、`src/pages/record-editor/index.vue`、`src/pages/record-detail/index.vue`、`src/pages/unavailable/index.vue`、`src/pages/login/index.vue`、`src/pages/ai-chat/index.vue`。
- 回归与文档：`tests/unavailable.test.cjs`、`DESIGN.md`、`CHANGELOG.md`。

## [0.4.3] - 2026-09-27

### Fixed
- 修复微信真机图表盖住自定义 TabBar 的层级问题：微信端改用 `canvas type="2d"` 同层渲染，通过节点获取 2D context；其余端继续沿用 uni Canvas 绘制。
- 复用柱状、折线、环形绘图逻辑；微信按设备像素比设置位图尺寸，每次重绘重置缩放。节点不可用时显示文字数据，不回退到旧原生画布。
- 图表保留画布节点以便绘制失败后恢复，补齐标签/高度变化重绘及销毁/旧请求保护；日期点选区分画布局部坐标和视口坐标。

### Validation
- `node --test --experimental-test-isolation=none tests/chart.test.cjs`：18 / 18 通过，覆盖真实组件脚本的微信/H5 绘制分支、DPR 重绘、三类图形、负值、失败恢复、异步销毁与点击坐标。
- `node --test --experimental-test-isolation=none tests/statistics.test.cjs`：8 / 8 通过；`npm run type-check`、`npm run build:mp-weixin`、`npm run build:h5` 均通过。
- 核对微信构建产物：仅一个 `type="2d"` canvas，使用节点 context，无旧 `createCanvasContext` 分支。未进行微信真机视觉验收；保留现有工具链弃用提示。

### Files
- `src/components/LedgerChart.vue`
- `src/utils/chartCanvas.ts`
- `tests/chart.test.cjs`
- `DESIGN.md`
- `CHANGELOG.md`

## [0.4.2] - 2026-09-26

### Fixed
- 修复“暂未开放”页把 URI 编码的功能名直接作为标题显示的问题。入口仍编码参数，接收页单次解码，正确匹配账单导入、数据导出、隐私与账户设置文案及旧 AI 入口。
- 兼容已解码中文；损坏的编码使用“这项功能”作为默认标题，避免页面抛错或显示编码串。

### Validation
- `node --test --experimental-test-isolation=none tests/unavailable.test.cjs`：3 / 3 通过，覆盖编码中文、已解码中文、旧 AI 跳转与缺失/损坏参数。
- `npm run type-check`、`npm run build:mp-weixin` 通过，生成最新 `dist/build/mp-weixin/`；未进行真机截图验收。

### Files
- `src/pages/unavailable/index.vue`
- `tests/unavailable.test.cjs`
- `CHANGELOG.md`

## [0.4.1] - 2026-09-26

### Fixed
- 修复资产、统计、我的页未使用公共底距而被固定底栏遮挡的问题。4 个 tab 页统一使用 `192rpx` 的独立底距与安全区补偿，并提供静态回退值；不再依赖页面是否包含 `page-shell`。
- AI 聊天从 `tabBar.list` 移出，成为独立页面。微信原生底栏保留 4 个 tab，中间加号通过 `navigateTo` 打开聊天，不改变原 tab 选中项；返回沿原页面栈返回，直接进入聊天时可回退首页。H5 保留框架 4 tab，并增加独立浮动 AI 入口。
- 聊天页增加静态整屏高度、可滚动消息容器与固定高度输入框，结合原生视口、胶囊、底部安全区及键盘高度调整布局，避免已经缩小的视口重复扣除键盘。
- 兼容旧聊天消息缺失或为空的 `records`，避免历史消息使整页渲染抛错；异常列表/回复显示可重试错误，未知发送结果保留原请求编号。
- 独立聊天页关闭后，已确认的入账/删除仍使原账号的账本缓存失效；通过账号与会话版本检查隔离其他登录状态。
- 初始化先展示品牌与轻量 Loading；自动微信验证及打开账本期间隐藏登录操作卡，仅在需要协议、手机号验证或发生错误时展示原登录流程。导航失败、异常或超时后可重试，继续保留既有短信验证。

### Validation
- `node --test --experimental-test-isolation=none tests/*.test.cjs`：139 / 139 通过，其中认证 50 项、聊天/布局 28 项、导航 14 项；`npm run type-check` 通过。
- `npm run build:mp-weixin` 与 `npm run build:h5` 均通过；核对微信产物确认 4 个 tab、独立聊天路由、4 页底距、启动动画及没有重复的 H5 加号；机械样式检查无报告项。保留工具链已有 Sass 弃用和循环依赖提示。
- 回归测试覆盖 4 tab 与独立聊天路由、返回路径、重复点击、初始化/登录/导航失败、历史消息兼容及键盘高度计算。
- 对比源文件与微信编译 WXSS，已定位 3 个页面底距仅为 36 / 36 / 38rpx；实际编译 render 在旧消息缺少账单数组时可复现异常，经消息归一化后可正常运行。这不等于已确认截图中的服务器返回内容。
- 当前工具没有可连接的浏览器或微信窗口，未完成截图与真机键盘验收；本轮没有修改后端或发送真实短信。

### Files
- 导航：`src/pages.json`、`src/utils/navigation.ts`、`src/custom-tab-bar/index.js`、`src/custom-tab-bar/index.wxml`、`src/components/BottomNav.vue`。
- 底距与入口：`src/styles/theme.scss`、`src/components/H5ChatEntry.vue`、`src/pages/home/index.vue`、`src/pages/assets/index.vue`、`src/pages/statistics/index.vue`、`src/pages/manage/index.vue`。
- 对话：`src/pages/ai-chat/index.vue`、`src/composables/useAiChat.ts`、`src/utils/chatLayout.ts`。
- 启动登录：`src/pages/login/index.vue`、`src/composables/useLogin.ts`。
- 测试：`tests/navigation.test.cjs`、`tests/ai-chat.test.cjs`、`tests/auth.test.cjs`。
- 文档：`PRODUCT.md`、`DESIGN.md`、`CHANGELOG.md`。

## [0.4.0] - 2026-09-26

### Changed
- 按最新参考重做黄色鸭子记账界面：淡黄页头、奶油底、浅金边白卡、彩色分类图标；统一明细、资产、统计、我的、对话、详情、表单及登录视觉，保留现有短信认证。
- 底部注册为 5 个真实 tab 页面，微信使用原生 `custom-tab-bar` 和 `switchTab`；普通切换复用页面与缓存，不再通过重建页面切换。中心加号直接进入 AI 对话，手动记账收进聊天快捷区。
- AI 对话接入真实会话、消息和自动入账接口，显示分类、类型、金额、日期、备注及可编辑/删除的账单卡；缺少信息时继续澄清。未知结果持久化同一请求标识，重试不另起记账请求。
- 修复聊天恢复待确认消息没有重试入口、新会话混入旧历史、存储失败仍继续发送及缓存修订号竞态；离开页面后保留未知结果供恢复。
- 全部日期/月选择统一为底部 `CalendarSheet`：周一开始的日期网格、相邻月日期、今天标记、月/年网格、左右翻页和确认；移除日期滚轮及精确时间选择/显示。前端新建、编辑、查询仅使用日期字符串。
- 主账单流与支付方式明细按 `created_at` 倒序，补记旧日期不改变创建顺序；相邻相同日期形成分组。列表按服务端月份范围完整分页，修改成功后使相关 tab 缓存失效。
- 统计新增真实每日柱状/折线图、分类环形图、收支分类榜和明细金额榜；“资产”展示支付方式的月收支与净流入，明确不代表实际账户余额。
- 新增独立账单详情与分类设置页；从明细、统计、资产打开账单先查看详情，再编辑。日历弹层期间隐藏底栏，关闭/销毁时恢复。

### Backend
- 仅修改 `E:\code\hope\hope-service\apps\ledger_mate`：日期兼容、创建时间倒序、日期范围查询、AI 自动入账事务及幂等、最新关联账单回执、统计字段与隔离测试。
- 沿用现有模型供应商配置，不修改其他 app 或数据库结构；详细文件清单与测试命令见后端 app 的 `CHANGELOG.md`。

### Validation
- `node --test --experimental-test-isolation=none tests/*.test.cjs`：124 / 124 通过，包括 19 项 AI 对话和 15 项原生导航测试。
- `npm run type-check`：通过；随后入口微调由两端最终构建验证。
- `npm run build:mp-weixin`、`npm run build:h5`：最终构建均通过，原生 custom-tab-bar 文件与 5 个 tab 已输出；保留工具链已有的 Sass 弃用及循环依赖提示。
- 后端 app 隔离测试：28 / 28 通过；覆盖真实 HTTP 路由、日期、排序、AI 澄清、重试、事务回滚、权限和锁语句，不调用真实模型。
- 已检查本地图标与助手图片打包。当前无可用浏览器或微信工具窗口，尚未完成截图验收、真机无闪屏/软键盘验证、真实模型端到端及 PostgreSQL 并发压力验证；未部署或重启服务。

### Files
- 路由与主题：`src/pages.json`、`src/styles/theme.scss`。
- 原生底栏：`src/custom-tab-bar/index.js`、`src/custom-tab-bar/index.json`、`src/custom-tab-bar/index.wxml`、`src/custom-tab-bar/index.wxss`。
- 组件：`src/components/AppIcon.vue`、`src/components/BrandWordmark.vue`、`src/components/BottomNav.vue`、`src/components/MonthPicker.vue`、`src/components/CalendarSheet.vue`、`src/components/LedgerChart.vue`。
- 页面：`src/pages/home/index.vue`、`src/pages/assets/index.vue`、`src/pages/ai-chat/index.vue`、`src/pages/statistics/index.vue`、`src/pages/manage/index.vue`、`src/pages/category-settings/index.vue`、`src/pages/record-editor/index.vue`、`src/pages/record-detail/index.vue`、`src/pages/login/index.vue`、`src/pages/unavailable/index.vue`。
- 交互逻辑：`src/composables/useHomeLedger.ts`、`src/composables/useAiChat.ts`、`src/composables/useMonthAnalysis.ts`、`src/composables/useRecordEditor.ts`、`src/composables/useRecordDetail.ts`、`src/composables/useLedgerSettings.ts`、`src/composables/useLogin.ts`。
- 接口与工具：`src/api/ledger.ts`、`src/types/api.ts`、`src/utils/navigation.ts`、`src/utils/calendar.ts`、`src/utils/ledger.ts`、`src/utils/recordEditor.ts`、`src/utils/statistics.ts`。
- 测试：`tests/helpers.cjs`、`tests/ai-chat.test.cjs`、`tests/navigation.test.cjs`、`tests/ledger.test.cjs`、`tests/record-editor.test.cjs`、`tests/record-detail.test.cjs`、`tests/settings.test.cjs`、`tests/statistics.test.cjs`。
- 助手素材：`src/static/assistant-duck.png`；图标生成器：`scripts/generate-icons.cjs`。
- 图标资源：`src/static/icons/` 下 `brand`、`muted`、`ink`、`income`、`expense`、`white`、`color` 七个目录，每个包含以下 32 个 `.svg` 文件：`ledger`、`chart`、`plus`、`settings`、`chevron-left`、`chevron-right`、`chevron-down`、`search`、`close`、`check`、`calendar`、`clock`、`wallet`、`trash`、`edit`、`arrow-up`、`arrow-down`、`food`、`shopping`、`transport`、`home`、`health`、`education`、`gift`、`salary`、`more`、`refresh`、`leaf`、`download`、`upload`、`shield`、`logout`。
- 文档：`PRODUCT.md`、`DESIGN.md`、`CHANGELOG.md`；重新生成已忽略的 `dist/build/h5/` 与 `dist/build/mp-weixin/`。

## [0.3.1] - 2026-09-26

### Changed
- 针对个人版小程序，将首次手机号验证改为手动输入中国大陆手机号与 4 位短信验证码，接入 `/auth/sms/send` 和 `/auth/identity/complete/sms`，保留微信身份识别和已绑定用户自动登录。
- 增加手机号与验证码校验、发送提示、60 秒重发倒计时和重复提交保护；验证码错误时允许原票据重试，票据失效或提交结果不明时重新验证微信身份。
- 短信发送失败保留验证票据，并考虑后端发送失败仍占用冷却的行为；沿用现有登录页视觉样式，手机号输入步骤采用紧凑布局。

### Tests
- 更新短信接口、输入校验、倒计时、验证码重试、票据过期、并发操作与页面离开后的回归测试。
- `node --test --test-isolation=none tests/*.test.cjs`：75 / 75 通过，其中认证测试 43 项；类型检查、小程序与 H5 构建通过。
- 未发送真实短信；当前无可用浏览器或应用窗口，短信送达、微信真机输入及软键盘交互需实机验证。

## [0.3.0] - 2026-09-26

### Changed
- 根据“甜时 SWEET TASTE”参考重构全部六个页面，采用奶油白、焦糖棕、圆润控件和本地圆端线性图标；新增可替换文字品牌组件，等待用户提供正式 LOGO。
- 导航调整为账单、统计、我的与常驻记一笔；首页支持历史/未来月份选择、收支筛选、分类/备注/金额搜索、按日分组和小计。
- 完整分页加载后计算月汇总，显示加载进度；分页总数改变、重复数据和中途失败均不展示不完整结果，防止旧请求覆盖新状态。
- 记账改为分类宫格、大金额输入、原生日期/时间/支付选择及固定保存区，支持保存并再记、返回未保存确认、分类管理返回保留草稿。
- 修复金额精度与安全整数校验、编辑日期的时区转换、清空备注、重复提交与失败重试幂等问题。
- 统计支持月份切换、真实分类占比与每日收支点选；未知收支方向不做推测，不伪造缺失数据。
- 管理支持分类/支付方式切换、内联新增、重名校验和退出确认；未开放服务明确标注状态，登录保留原有微信身份与手机号验证。

### Added
- 新增 32 个线性 SVG 图标及 6 色本地资源（共 192 个），附可重复生成脚本。
- 新增 32 项行为测试；连同既有认证测试共 65 项通过。
- 新增 PRODUCT.md 和 DESIGN.md，记录产品边界、视觉规则及验证限制。

### Validation
- `node --test --experimental-test-isolation=none tests/*.test.cjs`：65 / 65 通过。
- `npm run type-check`：通过。
- `npm run type-check`、`npm run build:mp-weixin`、`npm run build:h5`：通过。
- `npm run build:h5`、`npm run build:mp-weixin`：通过，两端均包含 192 个图标文件。
- 机械设计检查无报告项，已检查主要文字配色对比度；保留现有 Sass API / @import 弃用提示。
- 当前环境无可用浏览器或应用窗口，未完成截图视觉验收、微信真机登录及软键盘交互验证。

### Files
- 基础：`src/App.vue`、`src/pages.json`、`src/styles/theme.scss`。
- 组件：`src/components/AppIcon.vue`、`src/components/BrandWordmark.vue`、`src/components/MonthPicker.vue`、`src/components/BottomNav.vue`。
- 页面：`src/pages/home/index.vue`、`src/pages/login/index.vue`、`src/pages/record-editor/index.vue`、`src/pages/statistics/index.vue`、`src/pages/manage/index.vue`、`src/pages/unavailable/index.vue`。
- 交互逻辑：`src/composables/useHomeLedger.ts`、`src/composables/useRecordEditor.ts`、`src/composables/useLedgerSettings.ts`。
- 工具：`src/utils/icons.ts`、`src/utils/ledger.ts`、`src/utils/recordEditor.ts`、`src/utils/statistics.ts`。
- 测试：`tests/ledger.test.cjs`、`tests/record-editor.test.cjs`、`tests/settings.test.cjs`、`tests/statistics.test.cjs`。
- 图标：`scripts/generate-icons.cjs`；`src/static/icons/` 下 `brand`、`muted`、`ink`、`income`、`expense`、`white` 六个目录，每个目录均含以下 32 个 `.svg` 文件：`ledger`、`chart`、`plus`、`settings`、`chevron-left`、`chevron-right`、`chevron-down`、`search`、`close`、`check`、`calendar`、`clock`、`wallet`、`trash`、`edit`、`arrow-up`、`arrow-down`、`food`、`shopping`、`transport`、`home`、`health`、`education`、`gift`、`salary`、`more`、`refresh`、`leaf`、`download`、`upload`、`shield`、`logout`。
- 文档：`PRODUCT.md`、`DESIGN.md`、`CHANGELOG.md`。
- 构建产物：重新生成已忽略的 `dist/build/h5/` 与 `dist/build/mp-weixin/`。

## [0.2.0] - 2026-09-26

### Changed
- 按在线 OpenAPI 与 hope-service 实现迁移至两阶段小程序登录：先验证微信身份，首次使用通过微信手机号授权完成账号创建或关联。
- 临时登录票据仅存于内存，未完成手机号验证时禁止访问业务接口；处理授权拒绝、票据过期、重复提交、限流和页面离开后的异步回调。
- 冷启动重新获取微信 code，清理旧版缓存凭证，仅接受 hope_ledger_mate 范围且已验证手机号的正式会话。
- 请求层改为按 HTTP 401 刷新，并发共用一次凭证轮换；登录请求不自动重试，旧会话请求不覆盖新账号状态。

### Added
- 增加登录状态与请求刷新流程回归测试，使用 Node.js 内置测试工具及现有 TypeScript 编译器，无新增依赖。

## [0.1.0] - 2026-07-16

### Added
- 初始化账伴微信小程序前端工程，提供微信登录、首次引导、账单列表、记账编辑、统计、分类和支付方式管理。
- 接入账伴与小程序登录 OpenAPI，覆盖登录态持久化、Token 刷新、加载、空状态和服务错误提示。
- 采用品牌深青绿与珊瑚橙视觉系统，并为右上角原生胶囊保留安全区。`n- 为账单详情/编辑页增加返回入口；支付方式改为选填，时间默认空且可清除。`n- 登录成功后直接进入首页；已同意协议的用户启动时自动使用微信 code 换取登录凭证。`n- 移除首次引导页面，在账本管理中增加导入账单与导出数据入口。`n- 按最新设计稿重构登录页、账单首页与通用悬浮 TabBar，并预留统一图标占位。

### Changed
- 移除未使用且与 uni-app Vite 版本冲突的 `vue-router`，将类型工具链固定为 TypeScript `5.9.3`。









