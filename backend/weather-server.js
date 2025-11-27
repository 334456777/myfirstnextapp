require('dotenv').config();

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.WEATHER_PORT || 3001;

// ECMWF API 基础地址
const ECMWF_BASE_URL = 'https://charts.ecmwf.int/opencharts-api/v1/products/medium-mslp-rain/';

// ECMWF 配置
const ECMWF_CONFIG = {
  projection: 'opencharts_eastern_asia',
  interval: 6,
  maxRetries: 20
};

// ============ 文件缓存配置 ============
const CACHE_DIR = path.join(__dirname, 'cache');

// 确保缓存目录存在
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * 生成缓存文件名
 */
function getCacheFileName(baseTime, validTime) {
  const base = baseTime.replace(/:/g, '-').replace(/\.(\d+)Z$/, 'Z');
  const valid = validTime.replace(/:/g, '-').replace(/\.(\d+)Z$/, 'Z');
  return path.join(CACHE_DIR, `${base}_${valid}.json`);
}

/**
 * 计算下一个 Valid Time（用于确定缓存过期时间）
 */
function getNextValidTime(currentValidTime) {
  const validHours = [0, 3, 6, 9, 12, 15, 18, 21];
  const current = new Date(currentValidTime);
  const currentHour = current.getUTCHours();
  const currentIndex = validHours.indexOf(currentHour);

  if (currentIndex !== -1 && currentIndex < validHours.length - 1) {
    current.setUTCHours(validHours[currentIndex + 1], 0, 0, 0);
  } else {
    current.setUTCDate(current.getUTCDate() + 1);
    current.setUTCHours(validHours[0], 0, 0, 0);
  }

  const now = Date.now();
  while (current.getTime() <= now) {
    const hour = current.getUTCHours();
    const idx = validHours.indexOf(hour);
    if (idx !== -1 && idx < validHours.length - 1) {
      current.setUTCHours(validHours[idx + 1], 0, 0, 0);
    } else {
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(validHours[0], 0, 0, 0);
    }
  }

  return current;
}

/**
 * 从文件缓存中读取数据
 */
function getCacheFromFile(baseTime, validTime) {
  try {
    const cacheFile = getCacheFileName(baseTime, validTime);
    if (!fs.existsSync(cacheFile)) {
      return null;
    }

    const fileContent = fs.readFileSync(cacheFile, 'utf8');
    const cached = JSON.parse(fileContent);

    const now = Date.now();
    if (now < cached.expiresAt) {
      return cached.data;
    }

    fs.unlinkSync(cacheFile);
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 将数据保存到文件缓存
 */
function saveCacheToFile(baseTime, validTime, data) {
  try {
    const cacheFile = getCacheFileName(baseTime, validTime);
    const validTimeDate = new Date(validTime);
    const nextValidTime = getNextValidTime(validTimeDate);
    const expiresAt = nextValidTime.getTime() + 5 * 60 * 1000;

    const cacheData = {
      data: data,
      baseTime: baseTime,
      validTime: validTime,
      createdAt: Date.now(),
      expiresAt: expiresAt
    };

    fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to save cache to file:', error);
    return false;
  }
}

/**
 * 清理过期的缓存文件
 */
function cleanExpiredCache() {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    const now = Date.now();
    let cleaned = 0;

    files.forEach(file => {
      if (!file.endsWith('.json')) return;
      const filePath = path.join(CACHE_DIR, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const cached = JSON.parse(content);
        if (now >= cached.expiresAt) {
          fs.unlinkSync(filePath);
          cleaned++;
        }
      } catch (err) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    });

    if (cleaned > 0) {
      console.log(`[Cache Cleanup] Removed ${cleaned} expired cache files`);
    }
  } catch (error) {
    console.error('Failed to clean cache:', error);
  }
}

// 每天清理一次过期缓存
setInterval(cleanExpiredCache, 24 * 60 * 60 * 1000);

/**
 * 格式化日期为 ISO 8601 格式
 */
function formatDateToISO(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:00:00Z`;
}

/**
 * 从错误响应中提取可用的时间列表
 */
function parseAvailableTimesFromError(errorMessage) {
  try {
    const match = errorMessage.match(/Current available (?:base_time|valid_time) \[(.*?)\]/);
    if (match && match[1]) {
      const timesStr = match[1];
      const times = timesStr.match(/'([^']+)'/g).map(t => t.replace(/'/g, ''));
      return times;
    }
    return null;
  } catch (error) {
    console.error('Failed to parse available times from error:', error);
    return null;
  }
}

/**
 * 智能获取天气数据 - 自动处理时间错误并批量请求
 */
async function fetchWeatherSmart(count = 1) {
  const now = new Date();

  if (count < 1) {
    throw new Error('count must be at least 1');
  }

  let currentBaseTime = formatDateToISO(now);
  const targetTime3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  let currentValidTime = formatDateToISO(targetTime3h);

  console.log(`[Initial Request] base_time=${currentBaseTime}, valid_time=${currentValidTime}, count=${count}`);

  try {
    const params1 = new URLSearchParams({
      base_time: currentBaseTime,
      valid_time: currentValidTime,
      projection: ECMWF_CONFIG.projection,
      interval: ECMWF_CONFIG.interval
    });

    const response1 = await axios.get(`${ECMWF_BASE_URL}?${params1.toString()}`, {
      timeout: 100000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (response1.data && response1.data.data && response1.data.data.link) {
      console.log('[Success on first try]');

      saveCacheToFile(currentBaseTime, currentValidTime, response1.data);

      if (count === 1) {
        return [{
          success: true,
          data: response1.data,
          usedBaseTime: currentBaseTime,
          usedValidTime: currentValidTime,
          timeOffset: 3,
          fromCache: false
        }];
      }

      return await fetchMultipleValidTimes(currentBaseTime, currentValidTime, count);
    }
  } catch (error1) {
    console.log('[First attempt failed] Trying to fix base_time...');

    if (error1.response && error1.response.data && error1.response.data.error) {
      const errorMsg = JSON.stringify(error1.response.data.error);
      const availableBaseTimes = parseAvailableTimesFromError(errorMsg);

      if (availableBaseTimes && availableBaseTimes.length > 0) {
        currentBaseTime = availableBaseTimes[0];
        console.log(`[Fixed base_time] Using: ${currentBaseTime}`);

        try {
          const params2 = new URLSearchParams({
            base_time: currentBaseTime,
            valid_time: currentValidTime,
            projection: ECMWF_CONFIG.projection,
            interval: ECMWF_CONFIG.interval
          });

          const response2 = await axios.get(`${ECMWF_BASE_URL}?${params2.toString()}`, {
            timeout: 100000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });

          if (response2.data && response2.data.data && response2.data.data.link) {
            console.log('[Success on second try]');
            saveCacheToFile(currentBaseTime, currentValidTime, response2.data);

            if (count === 1) {
              return [{
                success: true,
                data: response2.data,
                usedBaseTime: currentBaseTime,
                usedValidTime: currentValidTime,
                timeOffset: 3,
                fromCache: false
              }];
            }

            return await fetchMultipleValidTimes(currentBaseTime, currentValidTime, count);
          }
        } catch (error2) {
          console.log('[Second attempt failed] Trying to fix valid_time...');

          if (error2.response && error2.response.data && error2.response.data.error) {
            const errorMsg2 = JSON.stringify(error2.response.data.error);
            const availableValidTimes = parseAvailableTimesFromError(errorMsg2);

            if (availableValidTimes && availableValidTimes.length > 0) {
              const targetTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);

              let selectedValidTime = null;
              for (const vt of availableValidTimes) {
                const vtDate = new Date(vt);
                if (vtDate >= targetTime) {
                  selectedValidTime = vt;
                  break;
                }
              }

              if (selectedValidTime) {
                currentValidTime = selectedValidTime;
                console.log(`[Fixed valid_time] Using: ${currentValidTime} (3 hours ahead)`);

                return await fetchMultipleValidTimesDirectly(
                  currentBaseTime,
                  availableValidTimes,
                  selectedValidTime,
                  count
                );
              }
            }
          }
          throw error2;
        }
      }
    }
    throw error1;
  }

  throw new Error('Failed to fetch weather data after all attempts');
}

/**
 * 辅助函数：基于第一个成功的请求，继续请求其他时间段
 */
async function fetchMultipleValidTimes(baseTime, firstValidTime, count) {
  const results = [];
  const firstDate = new Date(firstValidTime);

  const cachedFirst = getCacheFromFile(baseTime, firstValidTime);
  if (cachedFirst) {
    results.push({
      success: true,
      data: cachedFirst,
      usedBaseTime: baseTime,
      usedValidTime: firstValidTime,
      timeOffset: 3,
      fromCache: true
    });
  }

  const validTimes = [firstValidTime];
  for (let i = 1; i < count; i++) {
    const nextTime = new Date(firstDate.getTime() + i * 3 * 60 * 60 * 1000);
    validTimes.push(formatDateToISO(nextTime));
  }

  const promises = validTimes.map(async (validTime, index) => {
    const offset = (index + 1) * 3;

    const cached = getCacheFromFile(baseTime, validTime);
    if (cached) {
      console.log(`[Cache Hit] ${validTime}`);
      return {
        success: true,
        data: cached,
        usedBaseTime: baseTime,
        usedValidTime: validTime,
        timeOffset: offset,
        fromCache: true
      };
    }

    try {
      const params = new URLSearchParams({
        base_time: baseTime,
        valid_time: validTime,
        projection: ECMWF_CONFIG.projection,
        interval: ECMWF_CONFIG.interval
      });

      const response = await axios.get(`${ECMWF_BASE_URL}?${params.toString()}`, {
        timeout: 100000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      if (response.data && response.data.data && response.data.data.link) {
        saveCacheToFile(baseTime, validTime, response.data);
        return {
          success: true,
          data: response.data,
          usedBaseTime: baseTime,
          usedValidTime: validTime,
          timeOffset: offset,
          fromCache: false
        };
      }
    } catch (error) {
      console.error(`[Fetch Error] ${validTime}:`, error.message);
      return {
        success: false,
        error: error.message,
        usedBaseTime: baseTime,
        usedValidTime: validTime,
        timeOffset: offset
      };
    }
  });

  return await Promise.all(promises);
}

/**
 * 辅助函数：在已知可用的valid_times列表时，直接批量请求
 */
async function fetchMultipleValidTimesDirectly(baseTime, availableValidTimes, firstValidTime, count) {
  const firstIndex = availableValidTimes.indexOf(firstValidTime);
  if (firstIndex === -1) {
    throw new Error('First valid time not found in available times');
  }

  const selectedValidTimes = availableValidTimes.slice(firstIndex, firstIndex + count);

  console.log(`[Batch Request] Requesting ${selectedValidTimes.length} time periods:`, selectedValidTimes);

  const promises = selectedValidTimes.map(async (validTime, index) => {
    const offset = (index + 1) * 3;

    const cached = getCacheFromFile(baseTime, validTime);
    if (cached) {
      console.log(`[Cache Hit] ${validTime}`);
      return {
        success: true,
        data: cached,
        usedBaseTime: baseTime,
        usedValidTime: validTime,
        timeOffset: offset,
        fromCache: true
      };
    }

    try {
      const params = new URLSearchParams({
        base_time: baseTime,
        valid_time: validTime,
        projection: ECMWF_CONFIG.projection,
        interval: ECMWF_CONFIG.interval
      });

      const response = await axios.get(`${ECMWF_BASE_URL}?${params.toString()}`, {
        timeout: 100000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });

      if (response.data && response.data.data && response.data.data.link) {
        saveCacheToFile(baseTime, validTime, response.data);
        console.log(`[Success] ${validTime}`);
        return {
          success: true,
          data: response.data,
          usedBaseTime: baseTime,
          usedValidTime: validTime,
          timeOffset: offset,
          fromCache: false
        };
      }
    } catch (error) {
      console.error(`[Fetch Error] ${validTime}:`, error.message);
      return {
        success: false,
        error: error.message,
        usedBaseTime: baseTime,
        usedValidTime: validTime,
        timeOffset: offset
      };
    }
  });

  return await Promise.all(promises);
}

// ============ API 端点 ============

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Weather service is running',
    timestamp: new Date().toISOString()
  });
});

/**
 * 天气API端点 - 使用智能批量请求逻辑
 */
app.get('/api/weather', async (req, res) => {
  try {
    const now = new Date();
    const nowStr = formatDateToISO(now);

    const count = parseInt(req.query.t) || 1;

    if (count < 1 || isNaN(count)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid t parameter',
        message: 'Parameter t must be a positive integer',
        timestamp: new Date().toISOString()
      });
    }

    console.log(`\n=== New Weather Request at ${nowStr} with t=${count} ===`);

    const results = await fetchWeatherSmart(count);

    const cacheFiles = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));

    const responseData = {};
    const responseMeta = {
      requestedAt: nowStr,
      count: count,
      cacheSize: cacheFiles.length,
      timestamp: new Date().toISOString(),
      details: []
    };

    results.forEach((result, index) => {
      if (result.success) {
        const key = `t${result.timeOffset}`;
        responseData[key] = result.data;
        responseMeta.details.push({
          timeOffset: result.timeOffset,
          usedBaseTime: result.usedBaseTime,
          usedValidTime: result.usedValidTime,
          fromCache: result.fromCache
        });
      }
    });

    res.json({
      success: true,
      data: count === 1 ? results[0].data : responseData,
      meta: responseMeta
    });

  } catch (error) {
    console.error('[Weather API Error]:', error.message);

    const errorResponse = {
      success: false,
      error: 'Failed to fetch weather data',
      message: error.message,
      timestamp: new Date().toISOString()
    };

    if (error.response && error.response.data) {
      errorResponse.apiError = error.response.data;
    }

    res.status(500).json(errorResponse);
  }
});

/**
 * API端点 - 一次性获取所有时间段的天气数据
 */
app.get('/api/weather/all', async (req, res) => {
  try {
    const now = new Date();
    const nowStr = formatDateToISO(now);

    console.log(`\n=== New Weather All Request at ${nowStr} ===`);

    const results = await fetchWeatherSmart(10);

    const cacheFiles = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));

    const responseData = {};
    const responseMeta = {
      requestedAt: nowStr,
      cacheSize: cacheFiles.length,
      timestamp: new Date().toISOString()
    };

    results.forEach((result) => {
      if (result.success) {
        const key = `t${result.timeOffset}`;
        responseData[key] = result.data;
        responseMeta[key] = {
          usedBaseTime: result.usedBaseTime,
          usedValidTime: result.usedValidTime,
          fromCache: result.fromCache
        };
      }
    });

    res.json({
      success: true,
      data: responseData,
      meta: responseMeta
    });

  } catch (error) {
    console.error('[Weather All API Error]:', error.message);

    const errorResponse = {
      success: false,
      error: 'Failed to fetch weather data for all time periods',
      message: error.message,
      timestamp: new Date().toISOString()
    };

    if (error.response && error.response.data) {
      errorResponse.apiError = error.response.data;
    }

    res.status(500).json(errorResponse);
  }
});

// 代理特定路径的请求
app.get('/api/weather/*', async (req, res) => {
  try {
    const path = req.params[0];
    const url = `${ECMWF_BASE_URL}${path}`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    res.json({
      success: true,
      data: response.data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to proxy request',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: [
      'GET /health',
      'GET /api/weather?t=N',
      'GET /api/weather/all',
      'GET /api/weather/*'
    ]
  });
});

// 启动服务器
app.listen(port, '0.0.0.0', () => {
  console.log(`Weather Service is running on http://0.0.0.0:${port}`);
  console.log('Available endpoints:');
  console.log('  - GET /health');
  console.log('  - GET /api/weather?t=N');
  console.log('  - GET /api/weather/all');
  console.log('  - GET /api/weather/*');
});

module.exports = { app };
