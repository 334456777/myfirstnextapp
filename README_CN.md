# 🌐 yusteven 监控系统

实时监控系统日志和图像查看器 - Next.js 版本

---

## 📁 项目结构

```
nextjs-app/
├── app/                        # Next.js 应用目录
│   ├── layout.tsx              # 页面布局
│   ├── page.tsx                # 首页
│   └── globals.css             # 全局样式
│
├── components/                 # React 组件
│   ├── MainContent.tsx         # 主容器
│   ├── Sidebar.tsx             # 侧边栏（4个卡片）
│   ├── Card.tsx                # 卡片组件
│   ├── DisplayArea.tsx         # 内容显示区
│   ├── LogViewer.tsx           # 日志查看器
│   ├── VersionViewer.tsx       # 图片版本查看器
│   ├── WeatherViewer.tsx       # 天气预报
│   ├── RotateButton.tsx        # 旋转按钮
│   └── *.module.css            # 组件样式
│
├── public/                     # 静态文件
│   ├── logs/                   # 日志文件
│   └── favicon.ico             # 网站图标
│
├── logs/                       # PM2 日志
│
├── ecosystem.config.js         # PM2 配置
├── package.json                # 项目依赖
├── next.config.js              # Next.js 配置
└── README.md                   # 本文件
```

---

## 🚀 快速开始

### 1. 安装依赖（首次使用）

```bash
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 启动应用

```bash
# 使用 PM2 启动
pm2 start ecosystem.config.js

# 查看状态
pm2 list
```

### 4. 访问网站

- **本地**: http://localhost:3000
- **线上**: https://www.yusteven.com

---

## 🔧 常用命令

### PM2 进程管理

```bash
# 启动应用
pm2 start ecosystem.config.js

# 停止应用
pm2 stop nextjs-app

# 重启应用
pm2 restart nextjs-app

# 查看状态
pm2 list

# 查看日志
pm2 logs nextjs-app

# 实时监控
pm2 monit
```

### 开发模式（支持热更新）

```bash
npm run dev
# 访问 http://localhost:3000
```

---

## 🔄 更新代码

修改代码后，需要重新构建并重启：

```bash
# 1. 重新构建
npm run build

# 2. 重启应用
pm2 restart nextjs-app
```

---

## 📋 主要功能

| 功能 | 说明 |
|------|------|
| 📋 常规日志 | 查看系统运行日志 |
| ⚠️ 错误日志 | 查看错误信息 |
| 📜 SOSRFF | SHM/SRF/SRA 图像查看 |
| 🌦️ 天气预报 | ECMWF 天气预报 |

---

## 🌐 部署信息

- **运行环境**: 生产环境
- **进程管理**: PM2 (开机自启动已配置)
- **Web 服务器**: Nginx (反向代理)
- **域名**: https://www.yusteven.com
- **端口**: 3000 (内部), 443 (HTTPS)

---

## 📝 开发说明

### 开发流程

1. **本地开发**
   ```bash
   npm run dev
   ```

2. **修改代码**
   - 编辑 `components/` 下的组件
   - 修改 `app/` 下的页面

3. **部署到生产**
   ```bash
   npm run build
   pm2 restart nextjs-app
   ```

### 开发 vs 生产

| 模式 | 命令 | 热更新 | 性能 | 用途 |
|------|------|--------|------|------|
| 开发 | `npm run dev` | ✅ | 慢 | 本地调试 |
| 生产 | `pm2 start ecosystem.config.js` | ❌ | 快 | 线上运行 |

---

## 🔍 故障排查

### 应用无法访问

```bash
# 1. 检查 PM2 状态
pm2 list

# 2. 查看日志
pm2 logs nextjs-app --lines 50

# 3. 重启应用
pm2 restart nextjs-app
```

### 修改代码不生效

```bash
# 重新构建（必须！）
npm run build

# 重启应用
pm2 restart nextjs-app
```

### 端口被占用

```bash
# 查看端口占用
sudo lsof -i :3000

# 停止应用
pm2 stop nextjs-app
```

---

## 📞 帮助

### 重要文件

- **PM2 配置**: `ecosystem.config.js`
- **Nginx 配置**: `/home/yusteven/html/default`
- **PM2 进程列表**: `/home/yusteven/.pm2/dump.pm2`

### 后端服务

- **天气 API**: Port 3001
- **图片 API**: Port 3002

### PM2 开机自启动

应用已配置为开机自动启动：

```bash
# 查看自启动配置
pm2 startup

# 保存当前进程列表
pm2 save

# 取消自启动
pm2 unstartup systemd
```

---

## 📊 当前状态

✅ **生产环境运行中**

- **框架**: Next.js 16.0.1
- **版本**: 0.1.0
- **最后更新**: 2025-11-12

---

**© 2025 yusteven**

