# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个实时监控系统，用于查看系统日志、舒曼共振图像（SHM/SRF/SRA）和 ECMWF 天气预报。项目采用 Next.js 16 App Router 架构，包含前端和两个后端服务。

## 项目结构

```
myfirstnextapp/
├── nextjs-app/                 # Next.js 前端应用 (端口 3000)
│   ├── app/                    # Next.js App Router 目录
│   ├── components/             # React 组件
│   ├── lib/                    # 工具函数和数据获取
│   ├── ecosystem.config.js     # PM2 配置（生产环境）
│   └── next.config.js          # Next.js 配置
│
├── backend/                    # Express 后端服务
│   ├── weather-server.js       # ECMWF 天气 API 代理 (端口 3001)
│   ├── s3-server.js            # AWS S3 图像服务 (端口 3002)
│   ├── weather-service.service # Systemd 服务配置
│   └── s3-service.service      # Systemd 服务配置
│
└── nginx.conf                  # Nginx 反向代理配置
```

## 开发命令

### 前端 (nextjs-app/)

```bash
# 开发模式（支持热更新）
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# Lint 代码
npm run lint
```

### 本地开发环境配置

首次开发前需要配置环境变量：

```bash
# 1. 创建环境变量文件（已包含在项目中）
cp .env.example .env.local

# 2. .env.local 内容：
# NEXT_PUBLIC_BACKEND_URL=https://www.yusteven.com
# NEXT_PUBLIC_DEV_MODE=true
```

**本地开发特性**：
- ✅ 自动显示所有侧边栏卡片（无需日志文件）
- ✅ 使用线上 API 获取真实天气和图片数据
- ✅ 使用本地 mock 日志文件展示日志查看器
- ✅ 支持热更新和快速开发迭代

**可选：启动本地后端服务**

如果需要使用本地后端（不依赖线上 API）：

```bash
# 终端 1：启动天气服务
cd backend
node weather-server.js  # 端口 3001

# 终端 2：启动 S3 服务（需要配置 .env）
node s3-server.js  # 端口 3002

# 然后修改 .env.local：
# NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
```

### 后端 (backend/)

```bash
# 启动天气服务
npm start  # 默认端口 3001

# 启动 S3 服务（需要单独配置环境变量）
node s3-server.js  # 默认端口 3002
```

### 生产环境部署

```bash
# 1. 前端：重新构建并重启 PM2
cd nextjs-app
npm run build
pm2 restart nextjs-app

# 2. 后端：systemd 服务自动重启
sudo systemctl restart weather-service
sudo systemctl restart s3-service

# 3. 检查服务状态
pm2 list
sudo systemctl status weather-service
sudo systemctl status s3-service
```

## 架构关键点

### 前端架构

1. **App Router + Server Components**
   - `app/page.tsx` 是服务端组件，负责数据预取
   - 使用 ISR (增量静态再生成)，每 5 分钟重新验证数据
   - 客户端组件使用 `'use client'` 指令

2. **数据获取模式**
   - 服务端：`lib/weather.ts` 和 `lib/data.ts`（使用 `'server-only'` 保护）
   - 客户端：组件内部使用 SWR 或 `useEffect` + `fetch`
   - API 代理：`next.config.js` 中配置 `/api/image` 重写到后端 3002 端口

3. **组件结构**
   - `MainContent` → `Sidebar` + `DisplayArea`
   - `Sidebar` 包含 4 个 `Card` 组件（常规日志、错误日志、SOSRFF、天气预报）
   - `DisplayArea` 根据选中卡片显示对应 Viewer（`LogViewer`、`VersionViewer`、`WeatherViewer`）

4. **侧边栏卡片配置**
   - `lib/constants.ts` 定义了 4 个卡片配置
   - `lib/data.ts` 的 `getVisibleCards()` 函数动态检查日志文件是否有内容，只显示有数据的卡片
   - 日志文件路径映射：
     - **开发环境**：`/api/logs?file=urls.log` → `public/logs/urls.log`（本地 mock 数据）
     - **生产环境**：`/logs/*.log` → `/home/yusteven/boluo/pyt/*.log`（服务器真实日志）

5. **开发环境适配**
   - `lib/data.ts` 检测 `NODE_ENV=development` 或 `NEXT_PUBLIC_DEV_MODE=true` 时跳过文件检查
   - `lib/constants.ts` 根据环境自动切换日志 API 路径
   - `app/api/logs/route.ts` 提供本地开发环境的日志读取接口

### 后端架构

1. **weather-server.js (端口 3001)**
   - ECMWF API 代理：`https://charts.ecmwf.int/opencharts-api/v1/products/medium-mslp-rain/`
   - 文件缓存机制：缓存到 `backend/cache/` 目录
   - 缓存过期：根据下一个 valid time 自动计算

2. **s3-server.js (端口 3002)**
   - AWS S3 集成：获取图像的所有版本
   - Token 认证：临时 token（10 分钟有效期）
   - 流式传输：`/api/image/stream` 端点
   - 版本列表：`/api/image` 端点返回所有版本信息

### Nginx 配置

- HTTP 自动跳转 HTTPS
- 根域名跳转 www
- API 代理：
  - `/api/weather/*` → `localhost:3001`
  - `/api/image/*` → `localhost:3002`
  - `/bot/*` → Bot 服务端口
- 静态资源缓存策略：1 年

## 环境变量

### 前端 (.env.local)

```bash
NEXT_PUBLIC_BACKEND_URL=https://www.yusteven.com
```

### 后端 (.env)

```bash
# AWS S3 配置
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=ap-northeast-1
AWS_S3_BUCKET=sosrff
HOST_URL=https://www.yusteven.com
S3_PORT=3002

# 天气服务
WEATHER_PORT=3001
```

## 重要文件路径

- 生产环境部署路径：`/home/yusteven/html/nextjs-app/`
- 日志文件：`/home/yusteven/boluo/pyt/urls.log`、`/home/yusteven/boluo/pyt/critical_errors.log`
- Nginx 配置：`/etc/nginx/sites-enabled/default`（使用项目根目录的 `nginx.conf`）
- PM2 配置：`nextjs-app/ecosystem.config.js`（注意 `cwd` 指向生产路径）

## 常见问题

### 本地开发无法启动

确保已配置环境变量：
```bash
cd nextjs-app
# 检查 .env.local 是否存在
cat .env.local
# 如果不存在，从 .env.example 复制
cp .env.example .env.local
```

### 本地开发时卡片不显示

开发环境应自动显示所有卡片，如果没有显示：
1. 检查 `.env.local` 中是否设置了 `NEXT_PUBLIC_DEV_MODE=true`
2. 查看终端日志，确认看到 "🔧 开发环境模式：显示所有卡片"
3. 重启开发服务器：`npm run dev`

### 本地开发时 API 调用失败

默认配置使用线上 API，需要网络连接。如果要离线开发：
1. 启动本地后端服务（参考上文"本地开发环境配置"）
2. 修改 `.env.local` 中的 `NEXT_PUBLIC_BACKEND_URL=http://localhost:3001`

### 修改代码后不生效

生产环境需要重新构建：
```bash
cd nextjs-app && npm run build && pm2 restart nextjs-app
```

### 日志卡片不显示

检查日志文件是否有内容（`getVisibleCards` 会过滤空文件）：
```bash
ls -lh /home/yusteven/boluo/pyt/*.log
```

### 图片无法加载

检查后端服务和环境变量：
```bash
sudo systemctl status s3-service
tail -f /home/yusteven/html/backend/s3-service.log
```

### 天气预报不显示

检查天气服务：
```bash
sudo systemctl status weather-service
curl http://localhost:3001/api/weather/all
```

## 技术栈

- **前端**: Next.js 16、React 19、TypeScript、SWR
- **后端**: Express.js、AWS SDK v3、Axios
- **部署**: PM2、systemd、Nginx
- **图像**: PhotoSwipe、react-photoswipe-gallery
