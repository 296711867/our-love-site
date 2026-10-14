const crypto = require('crypto');

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// 上传文件名全部由服务端随机生成，杜绝路径注入
function randName(mime) {
  const ext = MIME_EXT[mime] || 'bin';
  return crypto.randomBytes(16).toString('hex') + '.' + ext;
}

// 颜色加深/变浅，用于从主题色派生渐变色
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// 简易登录限流：同一 IP 连续失败 8 次后锁定 15 分钟
function createLimiter() {
  const m = new Map();
  return {
    allowed(ip) {
      const e = m.get(ip);
      return !(e && e.until > Date.now());
    },
    remainingLockMs(ip) {
      const e = m.get(ip);
      return e && e.until > Date.now() ? e.until - Date.now() : 0;
    },
    fail(ip) {
      const e = m.get(ip) || { n: 0, until: 0 };
      e.n += 1;
      if (e.n >= 8) { e.until = Date.now() + 15 * 60 * 1000; e.n = 0; }
      m.set(ip, e);
    },
    reset(ip) { m.delete(ip); },
  };
}

module.exports = { MIME_EXT, randName, shade, createLimiter };
