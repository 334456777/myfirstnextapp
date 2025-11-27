# 后端服务说明

本项目包含两个独立的后端服务：

## 服务列表

### 1. Weather Service (天气预报服务)
- **文件**: `weather-server.js`
- **端口**: 3001
- **功能**: 提供 ECMWF 天气预报数据
- **端点**:
  - `GET /health` - 健康检查
  - `GET /api/weather?t=N` - 获取天气数据（N个时间段）
  - `GET /api/weather/all` - 获取所有时间段数据

### 2. S3 Image Service (AWS S3 图片服务)
- **文件**: `s3-server.js`
- **端口**: 3002
- **功能**: 提供 AWS S3 图片版本管理
- **端点**:
  - `GET /health` - 健康检查
  - `GET /api/image` - 获取图片信息
  - `GET /api/image/versions` - 获取图片版本列表

## 快速开始

### 1. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填入你的 AWS 凭证
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置 systemd 服务

首次使用需要配置 systemd 服务：

```bash
# 复制 service 文件到 systemd 目录
sudo cp /home/yusteven/html/backend/weather-service.service /etc/systemd/system/
sudo cp /home/yusteven/html/backend/s3-service.service /etc/systemd/system/

# 重新加载 systemd
sudo systemctl daemon-reload

# 启用开机自启（可选）
sudo systemctl enable weather-service.service
sudo systemctl enable s3-service.service
```

### 4. 服务管理命令

#### 启动服务
```bash
sudo systemctl start weather-service.service
sudo systemctl start s3-service.service
```

#### 停止服务
```bash
sudo systemctl stop weather-service.service
sudo systemctl stop s3-service.service
```

#### 重启服务
```bash
sudo systemctl restart weather-service.service
sudo systemctl restart s3-service.service
```

#### 查看服务状态
```bash
sudo systemctl status weather-service.service
sudo systemctl status s3-service.service
```

#### 禁用开机自启
```bash
sudo systemctl disable weather-service.service
sudo systemctl disable s3-service.service
```

#### 查看日志
```bash
# 实时查看天气服务日志
tail -f /home/yusteven/html/backend/weather-service.log

# 实时查看 S3 服务日志
tail -f /home/yusteven/html/backend/s3-service.log

# 查看最近 100 行日志
tail -n 100 /home/yusteven/html/backend/weather-service.log
tail -n 100 /home/yusteven/html/backend/s3-service.log

# 查看 systemd 日志
sudo journalctl -u weather-service.service -f
sudo journalctl -u s3-service.service -f
```

### 5. 直接运行（用于开发调试）
```bash
# 启动天气服务
node weather-server.js

# 启动 S3 服务
node s3-server.js
```

## 依赖包

主要依赖：
- `express` - Web 框架
- `axios` - HTTP 客户端
- `@aws-sdk/client-s3` - AWS S3 客户端
- `@aws-sdk/s3-request-presigner` - S3 URL 签名
- `dotenv` - 环境变量管理
- `cors` - 跨域支持

## 缓存机制

Weather Service 使用文件缓存系统：
- 缓存目录：`./cache/`
- 缓存策略：每个时间段的数据会缓存到下一个时间段发布前 5 分钟
- 自动清理：每周自动清理过期缓存文件

## 环境变量说明

- `AWS_REGION`: AWS 区域（如：us-east-1）
- `AWS_ACCESS_KEY_ID`: AWS 访问密钥 ID
- `AWS_SECRET_ACCESS_KEY`: AWS 密钥
- `AWS_S3_BUCKET`: S3 存储桶名称
- `WEATHER_PORT`: 天气服务端口（默认：3001）
- `S3_PORT`: S3 服务端口（默认：3002）
- `NODE_ENV`: Node 环境（development/production）

## 故障排查

### 服务无法启动
1. 检查端口是否被占用：`sudo netstat -tulpn | grep :3001`
2. 检查环境变量是否配置正确
3. 查看服务日志：`sudo journalctl -u weather-service.service -f`

### AWS S3 连接失败
1. 确认 AWS 凭证是否正确
2. 检查 S3 存储桶权限
3. 验证网络连接

### 天气数据获取失败
1. 检查 ECMWF API 是否可访问
2. 查看缓存目录权限
3. 检查日志中的错误信息

## 原始服务

原始的 `server.js` 文件包含了两个服务的所有功能，现在已经被分离为：
- `weather-server.js` - 天气预报功能
- `s3-server.js` - AWS S3 图片功能

如果需要保留原始的单一服务器模式，可以继续使用 `server.js` 和 `weather-proxy.service`。
