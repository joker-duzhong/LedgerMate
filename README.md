<p align="center">
  <img src="logo.png" width="160" alt="账伴 LedgerMate Logo" />
</p>

<h1 align="center">账伴 · LedgerMate</h1>

<p align="center">一笔一记，生活有迹。</p>

<p align="center">
  <code>微信小程序</code> · <code>Vue 3</code> · <code>TypeScript</code> · <code>uni-app</code>
</p>

<p align="center">
  <a href="#快速开始">快速开始</a> ·
  <a href="PRODUCT.md">产品说明</a> ·
  <a href="docs/async-accounting.md">后台记账与部署</a> ·
  <a href="CHANGELOG.md">修订记录</a>
</p>

面向个人日常收支的微信记账小程序，支持手动记账、自然语言快速记账、账单查询和收支统计。采用黄色小鸭主题，提供 H5 页面用于开发预览。

## 主要功能

- 快速记账：输入“今天午饭 35 元”，由后端解析并保存账单；信息不足时继续补充。
- 后台处理：服务器确认接收后可离开小程序，重新打开自动恢复结果；停留前台时自动查询完成状态。
- 账单管理：新增、编辑、删除，按月份、日期、收支类型和关键词筛选。
- 收支分析：月度汇总、每日趋势、分类占比和支付方式收支统计。
- 微信登录、手机号验证，以及分类和支付方式管理。

## 技术栈

Vue 3 · TypeScript · uni-app · Pinia · Vite · Sass

本仓库为前端工程，业务接口由独立的 `hope-service` 提供。后台记账还需运行 Celery Worker、Beat 和 Redis。

## 快速开始

准备 Node.js、npm 和微信开发者工具。在项目根目录安装依赖并复制环境配置模板：

```powershell
npm ci
Copy-Item .env.example .env
```

在 `.env` 中配置 `VITE_API_BASE_URL`（后端完整 API 基址）和 `VITE_WECHAT_APP_ID`（微信小程序 AppID），并将 `src/manifest.json` 的 `mp-weixin.appid` 设置为相同 AppID。

启动微信小程序开发构建：

```sh
npm run dev:mp-weixin
```

在微信开发者工具中导入 `dist/dev/mp-weixin/`。H5 预览使用 `npm run dev:h5`，访问终端给出的地址；微信身份验证需在小程序环境中进行。

## 检查与构建

```sh
npm run type-check
node --test --experimental-test-isolation=none tests/*.test.cjs
npm run build:mp-weixin
npm run build:h5
```

构建产物分别位于 `dist/build/mp-weixin/` 和 `dist/build/h5/`。后台记账需先部署后端 API、Worker 和 Beat，再发布前端，详见[后台记账与部署说明](docs/async-accounting.md)。

## 目录

```text
src/pages/         页面
src/components/    公共组件
src/composables/   页面业务逻辑
src/stores/        登录与后台记账状态
src/api/           接口封装
src/utils/         通用工具
src/static/        图标与图片
tests/             自动化测试
docs/              功能与部署文档
```

更多信息：[产品说明](PRODUCT.md) · [设计说明](DESIGN.md) · [修订记录](CHANGELOG.md)。
