require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios'); // <--- 引入 axios 用于请求 sos70.ru
const { S3Client, ListObjectVersionsCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const port = process.env.S3_PORT || 3002;

app.use(cors());

// 生成API密钥
const API_SECRET = crypto.randomBytes(32).toString('hex');
const API_TOKENS = new Set();

// 生成新token
function generateToken() {
  const token = crypto.randomBytes(16).toString('hex');
  API_TOKENS.add(token);
  setTimeout(() => API_TOKENS.delete(token), 10 * 60 * 1000);
  return token;
}

// 验证token
function validateToken(token) {
  return API_TOKENS.has(token);
}

// AWS S3 客户端配置
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// 核心函数：获取图片版本列表
async function getImageVersionIds(imageKey) {
  try {
    const command = new ListObjectVersionsCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Prefix: imageKey,
    });
    const response = await s3Client.send(command);

    if (!response.Versions || response.Versions.length === 0) {
      return [];
    }

    const versions = response.Versions
      .filter(version => version.Key === imageKey)
      .map(version => ({
        versionId: version.VersionId,
        lastModified: version.LastModified,
        isLatest: version.IsLatest || false,
      }))
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

    return versions;
  } catch (error) {
    console.error('Error fetching image versions:', error);
    return [];
  }
}

// ============ API 端点 ============

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'S3 Image service is running (Streaming Mode)',
    timestamp: new Date().toISOString()
  });
});

// API 端点：获取图片信息 (修改版)
app.get('/api/image', async (req, res) => {
  try {
    const { key, versionId, token } = req.query;

    if (token && !validateToken(token)) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    const clientToken = token || generateToken();

    if (!key) {
      return res.status(400).json({ success: false, error: 'Missing required parameter: key' });
    }

    const versions = await getImageVersionIds(key);

    // 构造基础 URL
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = process.env.HOST_URL || req.get('host');
    const baseUrl = `${protocol}://${host}`;

    let streamUrl;
    let currentVersionInfo = {};

    if (!versionId) {
      // Case A: 用户请求“最新版” (不带 versionId)
      // 逻辑：生成一个不带 versionId 的 stream 链接 -> 触发后端去 fetch sos70.ru
      // !!! 修改点 1: /api/stream -> /api/image/stream
      streamUrl = `${baseUrl}/api/image/stream?key=${encodeURIComponent(key)}&token=${clientToken}`;

      // 对于最新版，我们在元数据里给一个标识
      currentVersionInfo = {
        versionId: 'latest', // 虚拟 ID
        lastModified: new Date().toISOString(), // 或者是 versions[0]?.lastModified
      };
    } else {
      // Case B: 用户请求“历史版本” (S3)
      const found = versions.find(v => v.versionId === versionId);
      if (!found) {
        return res.status(404).json({ success: false, error: 'Version not found' });
      }

      // !!! 修改点 2: /api/stream -> /api/image/stream
      streamUrl = `${baseUrl}/api/image/stream?key=${encodeURIComponent(key)}&versionId=${found.versionId}&token=${clientToken}`;
      currentVersionInfo = found;
    }

    res.json({
      success: true,
      token: clientToken,
      data: {
        imageKey: key,
        currentVersionId: currentVersionInfo.versionId,
        imageUrl: streamUrl, // <--- 这里是统一的流地址
        lastModified: currentVersionInfo.lastModified,
        totalVersions: versions.length,
        // 返回完整版本列表供前端下拉框使用
        versions: versions.map(v => ({
          versionId: v.versionId,
          lastModified: v.lastModified
        }))
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Error in /api/image:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
});

// 新增 API 端点：流式传输
// !!! 修改点 3: /api/stream -> /api/image/stream
app.get('/api/image/stream', async (req, res) => {
  const { key, versionId, token } = req.query;

  if (!token || !validateToken(token)) {
    return res.status(401).send('Unauthorized Token');
  }

  if (!key) return res.status(400).send('Missing Key');

  // === 分支 1: 如果有 versionId -> 走 S3 (历史版本) ===
  if (versionId && versionId !== 'latest') {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        VersionId: versionId
      });

      const s3Response = await s3Client.send(command);

      if (s3Response.ContentType) res.setHeader('Content-Type', s3Response.ContentType);
      if (s3Response.ContentLength) res.setHeader('Content-Length', s3Response.ContentLength);

      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

      s3Response.Body.pipe(res);

      s3Response.Body.on('error', (err) => {
        console.error('S3 Stream Error:', err);
        if (!res.headersSent) res.status(500).send('Stream Error');
      });

    } catch (error) {
      console.error('Error in /api/image/stream (S3):', error);
      if (!res.headersSent) {
        if (error.name === 'NoSuchKey') {
          res.status(404).send('Image Not Found');
        } else {
          res.status(500).send('Server Error');
        }
      }
    }
  } else {
    // === 分支 2: 如果没有 versionId -> 走 sos70.ru (最新版本) ===
    try {
      const externalUrl = `https://sos70.ru/provider.php?file=${key}`;
      console.log(`Proxying external image: ${externalUrl}`);

      // 使用 axios 以流的方式请求外部图片
      const response = await axios({
        method: 'get',
        url: externalUrl,
        responseType: 'stream', // 关键：告诉 axios 返回流
        timeout: 10000 // 10秒超时
      });

      // 转发 Headers (Content-Type, Content-Length)
      if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
      }
      if (response.headers['content-length']) {
        res.setHeader('Content-Length', response.headers['content-length']);
      }

      // 最新版缓存时间设短一点 (例如 10 分钟)，因为它可能会变
      res.setHeader('Cache-Control', 'public, max-age=600');

      // 管道传输：sos70 -> 你的服务器 -> 用户
      response.data.pipe(res);

      response.data.on('error', (err) => {
        console.error('External Stream Error:', err);
        if (!res.headersSent) res.status(502).send('Bad Gateway (External Source Failed)');
      });

    } catch (error) {
      console.error('External Proxy Error in /api/image/stream:', error.message);
      if (!res.headersSent) {
        res.status(502).send('Failed to fetch external image');
      }
    }
  }
});

// API 端点：获取图片版本列表 (保持不变)
app.get('/api/image/versions', async (req, res) => {
  try {
    const { key, token } = req.query;
    if (!token || !validateToken(token)) return res.status(401).json({ success: false, error: 'Invalid token' });
    if (!key) return res.status(400).json({ success: false, error: 'Missing key' });

    const versions = await getImageVersionIds(key);
    if (versions.length === 0) return res.status(404).json({ success: false, error: 'No versions found' });

    res.json({
      success: true,
      data: {
        imageKey: key,
        versions: versions.map(v => ({
          versionId: v.versionId,
          lastModified: v.lastModified.toISOString(),
          isLatest: v.isLatest
        })),
        totalVersions: versions.length
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (error) {
    console.error('Error in /api/image/versions:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 404 处理 (已更新可用路由)
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    availableRoutes: ['GET /health', 'GET /api/image', 'GET /api/image/stream', 'GET /api/image/versions']
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`S3 Image Service running on http://0.0.0.0:${port}`);
});

module.exports = { app, generateToken, validateToken, getImageVersionIds };
