const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieSession = require('cookie-session');

const { seed, getSettings, DATA_DIR } = require('./db');
const { shade } = require('./util');
const { fmtDate, fmtDateTime, todayStr } = require('./dates');
const siteRoutes = require('./routes/site');
const adminRoutes = require('./routes/admin');
const imageRoutes = require('./routes/images');

seed();

// 会话密钥：首次启动自动生成，保存在 data 目录，重启不失效
let secret = process.env.SESSION_SECRET;
if (!secret) {
  const sf = path.join(DATA_DIR, 'session-secret');
  if (fs.existsSync(sf)) secret = fs.readFileSync(sf, 'utf8').trim();
  else {
    secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(sf, secret, { mode: 0o600 });
  }
}

const app = express();
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieSession({
  name: 'love_site',
  keys: [secret],
  maxAge: 30 * 24 * 60 * 60 * 1000,
  sameSite: 'lax',
  httpOnly: true,
}));

// 全站模板公共变量
app.use((req, res, next) => {
  const s = getSettings();
  res.locals.s = s;
  res.locals.themeDark = shade(s.theme_color || '#ff6b95', -0.25);
  res.locals.isPhLocked = s.photo_lock === '1';
  res.locals.isAdmin = !!(req.session && req.session.admin);
  res.locals.fmtDate = fmtDate;
  res.locals.fmtDateTime = fmtDateTime;
  res.locals.todayStr = todayStr();
  // 未上传头像时，用名字首字生成渐变占位头像
  const letterAva = (ch) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb6c1"/><stop offset="1" stop-color="#ff6b95"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><text x="100" y="132" font-size="84" text-anchor="middle" fill="#fff" font-family="sans-serif">${ch}</text></svg>`
  );
  res.locals.avaA = s.avatar_a ? '/img/set/avatar_a' : letterAva(s.name_a.charAt(0));
  res.locals.avaB = s.avatar_b ? '/img/set/avatar_b' : letterAva(s.name_b.charAt(0));
  next();
});

app.get('/healthz', (req, res) => res.send('ok'));

// HTML 页面禁用浏览器启发式缓存（改版后强刷即可见；图片/静态资源有各自的长缓存策略）
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache');
  next();
});

app.use('/', siteRoutes);
app.use('/img', imageRoutes);
app.use('/admin', adminRoutes);
app.use(express.static(path.join(__dirname, '..', 'public')));

// 404
app.use((req, res) => res.status(404).send('页面不存在 🥺 <a href="/">回首页</a>'));

// 统一错误处理
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).send('出错了：' + (err.message || '服务器内部错误'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`love-site listening on :${PORT}`);
});
