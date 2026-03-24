# 🌐 yusteven Monitoring System

Real-time system log and image viewer - Next.js version

---

## 📁 Project Structure

```
nextjs-app/
├── app/                        # Next.js app directory
│   ├── layout.tsx              # Page layout
│   ├── page.tsx                # Homepage
│   └── globals.css             # Global styles
│
├── components/                 # React components
│   ├── MainContent.tsx         # Main container
│   ├── Sidebar.tsx             # Sidebar (4 cards)
│   ├── Card.tsx                # Card component
│   ├── DisplayArea.tsx         # Content display area
│   ├── LogViewer.tsx           # Log viewer
│   ├── VersionViewer.tsx       # Image version viewer
│   ├── WeatherViewer.tsx       # Weather forecast
│   ├── RotateButton.tsx        # Rotate button
│   └── *.module.css            # Component styles
│
├── public/                     # Static files
│   ├── logs/                   # Log files
│   └── favicon.ico             # Website icon
│
├── logs/                       # PM2 logs
│
├── ecosystem.config.js         # PM2 configuration
├── package.json                # Project dependencies
├── next.config.js              # Next.js configuration
└── README.md                   # This file
```

---

## 🚀 Quick Start

### 1. Install Dependencies (first time)

```bash
npm install
```

### 2. Build Project

```bash
npm run build
```

### 3. Start Application

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Check status
pm2 list
```

### 4. Access Website

- **Local**: http://localhost:3000
- **Online**: https://www.yusteven.com

---

## 🔧 Common Commands

### PM2 Process Management

```bash
# Start application
pm2 start ecosystem.config.js

# Stop application
pm2 stop nextjs-app

# Restart application
pm2 restart nextjs-app

# Check status
pm2 list

# View logs
pm2 logs nextjs-app

# Real-time monitoring
pm2 monit
```

### Development Mode (with hot reload)

```bash
npm run dev
# Access http://localhost:3000
```

---

## 🔄 Update Code

After modifying code, rebuild and restart:

```bash
# 1. Rebuild
npm run build

# 2. Restart application
pm2 restart nextjs-app
```

---

## 📋 Main Features

| Feature | Description |
|---------|-------------|
| 📋 Regular Logs | View system operation logs |
| ⚠️ Error Logs | View error messages |
| 📜 SOSRFF | SHM/SRF/SRA image viewer |
| 🌦️ Weather Forecast | ECMWF weather forecast |

---

## 🌐 Deployment Information

- **Runtime**: Production environment
- **Process Manager**: PM2 (auto-start configured)
- **Web Server**: Nginx (reverse proxy)
- **Domain**: https://www.yusteven.com
- **Ports**: 3000 (internal), 443 (HTTPS)

---

## 📝 Development Notes

### Development Workflow

1. **Local Development**
   ```bash
   npm run dev
   ```

2. **Modify Code**
   - Edit components in `components/`
   - Modify pages in `app/`

3. **Deploy to Production**
   ```bash
   npm run build
   pm2 restart nextjs-app
   ```

### Development vs Production

| Mode | Command | Hot Reload | Performance | Purpose |
|------|---------|------------|-------------|---------|
| Development | `npm run dev` | ✅ | Slow | Local debugging |
| Production | `pm2 start ecosystem.config.js` | ❌ | Fast | Online runtime |

---

## 🔍 Troubleshooting

### Application Not Accessible

```bash
# 1. Check PM2 status
pm2 list

# 2. View logs
pm2 logs nextjs-app --lines 50

# 3. Restart application
pm2 restart nextjs-app
```

### Code Changes Not Taking Effect

```bash
# Rebuild (required!)
npm run build

# Restart application
pm2 restart nextjs-app
```

### Port Already in Use

```bash
# Check port usage
sudo lsof -i :3000

# Stop application
pm2 stop nextjs-app
```

---

## 📞 Help

### Important Files

- **PM2 Configuration**: `ecosystem.config.js`
- **Nginx Configuration**: `/home/yusteven/html/default`
- **PM2 Process List**: `/home/yusteven/.pm2/dump.pm2`

### Backend Services

- **Weather API**: Port 3001
- **Image API**: Port 3002

### PM2 Auto-Start

Application is configured for automatic startup on boot:

```bash
# View auto-start configuration
pm2 startup

# Save current process list
pm2 save

# Disable auto-start
pm2 unstartup systemd
```

---

## 📊 Current Status

✅ **Production Environment Running**

- **Framework**: Next.js 16.0.1
- **Version**: 0.1.0
- **Last Updated**: 2025-11-12

---

**© 2025 yusteven**
