const express = require('express');
const bcrypt = require('bcryptjs');
const { db, getSettings } = require('../db');
const { upload, makeThumb } = require('../upload');
const { annivList, todayStr } = require('../dates');
const { createLimiter } = require('../util');

const router = express.Router();
const unlockLimiter = createLimiter();

// 首页：恋爱计时器 + 最近纪念日
router.get('/', (req, res) => {
  const s = getSettings();
  const upcoming = annivList(db.prepare('SELECT * FROM anniversaries').all()).slice(0, 3);
  res.render('index', { title: '首页', active: 'home', s, upcoming });
});

// 私密内容锁：照片墙 / 情书 共用一个密码，解锁一次 30 天内有效
function lockGuard(req, res, what) {
  const s = getSettings();
  const lockOn = what === 'photos' ? s.photo_lock === '1' : s.message_lock === '1';
  if (lockOn && !(req.session && req.session.photoUnlock)) {
    res.render('lock', { title: (what === 'photos' ? '相册已上锁' : '情书已上锁'), error: null, next: req.originalUrl });
    return false;
  }
  return true;
}

// 照片墙（上锁时先渲染密码页）
router.get('/photos', (req, res) => {
  if (!lockGuard(req, res, 'photos')) return;
  const photos = db.prepare('SELECT * FROM photos ORDER BY taken_at DESC, id DESC').all();
  res.render('photos', { title: '照片墙', active: 'photos', photos });
});

function doUnlock(req, res) {
  const ip = req.ip;
  const next = req.body.next && req.body.next.startsWith('/') ? req.body.next : '/';
  if (!unlockLimiter.allowed(ip)) {
    return res.render('lock', { title: '内容已上锁', error: '尝试次数太多，请 15 分钟后再试', next });
  }
  const s = getSettings();
  if (bcrypt.compareSync(String(req.body.password || ''), s.photo_lock_pass || '')) {
    unlockLimiter.reset(ip);
    req.session.photoUnlock = true;
    return res.redirect(next);
  }
  unlockLimiter.fail(ip);
  res.render('lock', { title: '内容已上锁', error: '密码不对哦，再想想～', next });
}

router.post('/unlock', doUnlock);
router.post('/photos/unlock', (req, res) => { req.body.next = '/photos'; doUnlock(req, res); });

// 情书列表（和照片墙一样可上锁）
router.get('/messages', (req, res) => {
  if (!lockGuard(req, res, 'messages')) return;
  const messages = db.prepare('SELECT * FROM messages ORDER BY id DESC').all();
  res.render('messages', { title: '情书', active: 'messages', messages });
});

// 发表情书（需要管理员会话；后台发布则回到后台）
router.post('/messages', upload.single('image'), async (req, res, next) => {
  try {
    if (!(req.session && req.session.admin)) return res.status(403).send('请先登录后台再写情书');
    const author = req.body.author === 'b' ? 'b' : 'a';
    const content = String(req.body.content || '').trim();
    if (!content && !req.file) return res.status(400).send('写点什么，或选一张照片');
    let image = null, imageThumb = null;
    if (req.file) {
      image = req.file.filename;
      imageThumb = await makeThumb(image);
    }
    db.prepare('INSERT INTO messages (author, content, image, image_thumb, created_at) VALUES (?,?,?,?,?)')
      .run(author, content.slice(0, 2000), image, imageThumb, new Date().toISOString());
    res.redirect(req.body.from === 'admin' ? '/admin#messages' : '/messages');
  } catch (e) { next(e); }
});

// 纪念日
router.get('/anniversaries', (req, res) => {
  const rows = db.prepare('SELECT * FROM anniversaries').all();
  const hasDate = (r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date || '');
  const list = annivList(rows.filter(hasDate));
  const pending = rows.filter((r) => !hasDate(r)); // 还没定日子的（如：正在路上）
  const s = getSettings();
  const together = {
    icon: '💞', name: '在一起的周年纪念', date: s.since_date, repeat_yearly: 1, fixed: true,
    days: annivList([{ name: '在一起', date: s.since_date, repeat_yearly: 1, icon: '💞' }])[0].days,
    // 在一起的总天数（用于"第 N 年"）
    totalDays: Math.max(0, Math.floor((Date.now() - new Date(s.since_date + 'T' + (s.since_time || '00:00') + ':00').getTime()) / 86400000)),
  };
  res.render('anniversaries', { title: '纪念日', active: 'anniv', list, pending, together, todayStr: todayStr() });
});

module.exports = router;
