require('dotenv').config();

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const axios = require('axios');
const { S3Client, ListObjectVersionsCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const port = process.env.S3_PORT || 3002;

app.use(cors());

// --- 工具函数与验证 (保持不变) ---
const API_TOKENS = new Set();
function generateToken() {
  const token = crypto.randomBytes(16).toString('hex');
  API_TOKENS.add(token);
  setTimeout(() => API_TOKENS.delete(token), 10 * 60 * 1000);
  return token;
}
function validateToken(token) {
  return API_TOKENS.has(token);
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function getImageVersionIds(imageKey) {
  try {
    const command = new ListObjectVersionsCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Prefix: imageKey,
    });
    const response = await s3Client.send(command);
    if (!response.Versions || response.Versions.length === 0) return [];
    return response.Versions
      .filter(version => version.Key === imageKey)
      .map(version => ({
        versionId: version.VersionId,
        lastModified: version.LastModified,
        isLatest: version.IsLatest || false,
      }))
      .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
  } catch (error) {
    console.error('Error fetching image versions:', error);
    return [];
  }
}

// ============ API 端点 ============

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/image', async (req, res) => {
  try {
    const { key, versionId, token } = req.query;
    if (token && !validateToken(token)) {
      return res.status(401).json({ success: false, error: 'Invalid token' });
    }

    const clientToken = token || generateToken();
    if (!key) return res.status(400).json({ success: false, error: 'Missing key' });

    const versions = await getImageVersionIds(key);
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = process.env.HOST_URL || req.get('host');
    const baseUrl = `${protocol}://${host}`;

    let streamUrl;
    let currentVersionInfo = {};

    if (!versionId) {
      streamUrl = `${baseUrl}/api/image/stream?key=${encodeURIComponent(key)}&token=${clientToken}`;
      currentVersionInfo = { versionId: 'latest', lastModified: new Date().toISOString() };
    } else {
      const found = versions.find(v => v.versionId === versionId);
      if (!found) return res.status(404).json({ success: false, error: 'Version not found' });
      streamUrl = `${baseUrl}/api/image/stream?key=${encodeURIComponent(key)}&versionId=${found.versionId}&token=${clientToken}`;
      currentVersionInfo = found;
    }

    res.json({
      success: true,
      token: clientToken,
      data: {
        imageKey: key,
        currentVersionId: currentVersionInfo.versionId,
        imageUrl: streamUrl,
        lastModified: currentVersionInfo.lastModified,
        totalVersions: versions.length,
        versions: versions.map(v => ({ versionId: v.versionId, lastModified: v.lastModified }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 流式传输：已移除所有 setHeader
app.get('/api/image/stream', async (req, res) => {
  const { key, versionId, token } = req.query;

  if (!token || !validateToken(token)) return res.status(401).send('Unauthorized Token');
  if (!key) return res.status(400).send('Missing Key');

  // 分支 1: S3 (历史版本)
  if (versionId && versionId !== 'latest') {
    try {
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        VersionId: versionId
      });
      const s3Response = await s3Client.send(command);
      
      // 直接 pipe，不手动设置 Content-Type，交给 Nginx 或由浏览器自动检测
      s3Response.Body.pipe(res);

      s3Response.Body.on('error', (err) => {
        console.error('S3 Stream Error:', err);
        if (!res.headersSent) res.status(500).end();
      });
    } catch (error) {
      if (!res.headersSent) res.status(error.name === 'NoSuchKey' ? 404 : 500).end();
    }
  } else {
    // 分支 2: 外部 Proxy (最新版本)
    try {
      const externalUrl = `https://sos70.ru/provider.php?file=${key}`;
      const response = await axios({
        method: 'get',
        url: externalUrl,
        responseType: 'stream',
        timeout: 10000
      });

      // 直接 pipe，所有 Header 交给 Nginx 处理
      response.data.pipe(res);

      response.data.on('error', (err) => {
        if (!res.headersSent) res.status(502).end();
      });
    } catch (error) {
      if (!res.headersSent) res.status(502).end();
    }
  }
});

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
          lastModified: v.lastModified.toISOString()
        })),
        totalVersions: versions.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`S3 Image Service running on port ${port}`);
});