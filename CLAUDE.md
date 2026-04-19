# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

实时监控仪表板，用于查看系统日志、舒曼共振图像（SOSRFF）和 ECMWF 天气预报。采用**类 app 单页设计**——侧边栏卡片切换内容区，不要改为多页路由。

技术栈：Next.js 16 App Router + React 19 + TypeScript，两个 Express 后端服务，Nginx 反向代理，Cloudflare CDN。

## 开发命令

所有前端命令在 `nextjs-app/` 目录下执行：

```bash
npm run dev          # 开发模式（热更新）
npm run build        # 构建生产版本
npm start            # 启动生产服务器
npm run lint         # Lint
```

首次开发需要 `cp .env.example .env.local`（已含默认值，指向线上 API）。

## 生产部署

`/home/yusteven/html` 是 `/var/www/html` 的软链接，两者指向同一目录，只需 build 一次：

```bash
# 1. build
cd /var/www/html/nextjs-app && npm run build

# 2. 重启
pm2 restart nextjs-app
```

后端服务通过 systemd 管理：`sudo systemctl restart weather-service` / `s3-service`

## 架构关键点

### 前端交互模型

- **单页应用**：`MainContent` → `Sidebar`（左侧卡片） + `DisplayArea`（右侧内容）
- **悬停预览 + 点击锁定**：hover 卡片预览内容，click 锁定选中
- `lib/constants.ts` 定义 4 个卡片配置，`lib/data.ts` 的 `getVisibleCards()` 根据日志文件是否有内容动态过滤
- `DisplayArea` 根据 `contentType` 动态加载：`LogViewer`、`VersionViewer`、`WeatherViewer`

### 数据获取

- **服务端**：`app/page.tsx` 预取天气和可见卡片数据，ISR 每 5 分钟重新验证
- **服务端模块**：`lib/weather.ts` 和 `lib/data.ts` 使用 `'server-only'` 保护
- **客户端**：组件内 `useEffect` + `fetch` 或 SWR
- **API 代理**：`next.config.js` rewrites `/api/weather/*` → 3001、`/api/image/*` → 3002

### 开发/生产环境差异

- 日志路径：开发用 `public/logs/*.log`（mock），生产用 `/home/yusteven/boluo/pyt/*.log`
- `lib/constants.ts` 根据环境自动切换日志 API 路径
- 开发环境（`NODE_ENV=development` 或 `NEXT_PUBLIC_DEV_MODE=true`）跳过文件存在检查，显示所有卡片

### 后端服务

| 服务 | 端口 | 功能 |
|---|---|---|
| weather-server.js | 3001 | ECMWF API 代理，文件缓存到 `backend/cache/` |
| s3-server.js | 3002 | AWS S3 图片版本列表 + 流式传输，临时 token 认证 |

### Nginx + Cloudflare

- Nginx 处理 HTTP→HTTPS 跳转、裸域→www 跳转、API 代理路由
- Cloudflare Flexible SSL（Cloudflare→服务器之间是 HTTP）
- Cloudflare Speed Brain 可能导致空闲后预加载路由器固件页面，如遇到 `/cgi-bin/cgi?req=twz` 跳转，在 Cloudflare 仪表板禁用 Speed Brain

## 重要路径

- 项目目录：`/var/www/html/nextjs-app/`（`/home/yusteven/html` 是其软链接，PM2 `cwd` 通过软链接指向此处）
- 日志文件：`/home/yusteven/boluo/pyt/urls.log`、`critical_errors.log`
- Nginx 配置：`/etc/nginx/sites-enabled/default`（对应项目根 `nginx.conf`）
- PM2 配置：`nextjs-app/ecosystem.config.js`

## 环境变量

前端 `nextjs-app/.env.local`：
```
NEXT_PUBLIC_BACKEND_URL=https://www.yusteven.com
```

后端 `backend/.env`：AWS S3 凭证（`AWS_ACCESS_KEY_ID`、`AWS_SECRET_ACCESS_KEY`、`AWS_REGION=ap-northeast-1`、`AWS_S3_BUCKET=sosrff`）
