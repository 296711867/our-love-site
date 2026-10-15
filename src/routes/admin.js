const fs = require('fs');
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, getSettings, setSetting } = require('../db');
const { upload, makeThumb, makeCompressed, origPath, thumbPath, compPath } = require('../upload');
const { todayStr } = require('../dates');
const { createLimiter } = require('../util');

const router = express.Router();
const loginLimiter = createLimiter();

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login?next=' + encodeURIComponent(req.originalUrl || '/admin'));
}

function safeUnlink(p) { try { if (p) fs.unlinkSync(p); } catch (_) {} }

// ---------- 登录 / 登出 ----------
router.get('/login', (req, res) => {
  res.render('admin/login', { title: '登录', active: '', error: null, next: req.query.next || '/admin' });
});

router.post('/login', (req, res) => {
  const ip = req.ip;
  if (!loginLimiter.allowed(ip)) {
    return res.render('admin/login', { title: '登录', active: '', error: '尝试次数太多，请 15 分钟后再试', next: '/admin' });
  }
  const s = getSettings();
  if (bcrypt.compareSync(String(req.body.password || ''), s.admin_pass || '')) {
    loginLimiter.reset(ip);
    req.session.admin = true;
    const next = req.body.next && req.body.next.startsWith('/') ? req.body.next : '/admin';
    return res.redirect(next);
  }
  loginLimiter.fail(ip);
  res.render('admin/login', { title: '登录', active: '', error: '密码不对哦', next: req.body.next || '/admin' });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.redirect('/');
});

// ---------- 后台首页 ----------
router.get('/', requireAdmin, (req, res) => {
  const counts = {
    photos: db.prepare('SELECT COUNT(*) c FROM photos').get().c,
    messages: db.prepare('SELECT COUNT(*) c FROM messages').get().c,
    anniversaries: db.prepare('SELECT COUNT(*) c FROM anniversaries').get().c,
  };
  const photos = db.prepare('SELECT * FROM photos ORDER BY taken_at DESC, id DESC').all();
  const messages = db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 50').all();
  const annivs = db.prepare('SELECT * FROM anniversaries ORDER BY date').all();
  const s = getSettings();
  let flash = req.query.msg || null;
  res.render('admin/dashboard', {
    title: '管理', active: 'admin', counts, photos, messages, annivs, s, flash,
  });
});

// ---------- 照片管理 ----------
router.post('/photos/upload', requireAdmin, upload.array('photos', 20), async (req, res, next) => {
  try {
    if (!req.files || !req.files.length) return res.redirect('/admin?msg=' + encodeURIComponent('没有收到图片'));
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.taken_at || '') ? req.body.taken_at : todayStr();
    for (const f of req.files) {
      const thumb = await makeThumb(f.filename);
      db.prepare('INSERT INTO photos (filename, thumb, caption, taken_at, created_at) VALUES (?,?,?,?,?)')
        .run(f.filename, thumb, String(req.body.caption || '').slice(0, 100), date, new Date().toISOString());
    }
    res.redirect('/admin?msg=' + encodeURIComponent(`成功上传 ${req.files.length} 张照片 💕`));
  } catch (e) { next(e); }
});

router.post('/photos/:id', requireAdmin, (req, res) => {
  const p = db.prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.id));
  if (p) {
    const caption = String(req.body.caption || '').slice(0, 100);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.taken_at || '') ? req.body.taken_at : p.taken_at;
    db.prepare('UPDATE photos SET caption = ?, taken_at = ? WHERE id = ?').run(caption, date, p.id);
  }
  res.redirect('/admin#photos');
});

router.post('/photos/:id/delete', requireAdmin, (req, res) => {
  const p = db.prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.id));
  if (p) {
    safeUnlink(origPath(p.filename));
    safeUnlink(thumbPath(p.thumb));
    db.prepare('DELETE FROM photos WHERE id = ?').run(p.id);
  }
  res.redirect('/admin#photos');
});

// ---------- 情话管理 ----------
router.post('/messages/:id/edit', requireAdmin, (req, res) => {
  const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(req.params.id));
  if (!m) return res.redirect('/messages');
  const content = String(req.body.content || '').trim();
  if (!content && !m.image) return res.redirect('/messages'); // 没图没字就别存空信
  const author = req.body.author === 'b' ? 'b' : 'a';
  db.prepare('UPDATE messages SET author = ?, content = ? WHERE id = ?')
    .run(author, content.slice(0, 2000), m.id);
  res.redirect('/messages');
});

router.post('/messages/:id/delete', requireAdmin, (req, res) => {
  const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(req.params.id));
  if (m) {
    if (m.image) { safeUnlink(origPath(m.image)); safeUnlink(thumbPath(m.image_thumb)); }
    db.prepare('DELETE FROM messages WHERE id = ?').run(m.id);
  }
  res.redirect('/admin#messages');
});

// ---------- 纪念日管理 ----------
router.post('/anniversaries', requireAdmin, (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 50);
  const date = req.body.date || '';
  // 日期可留空（表示"正在路上"）；填了就必须是合法格式
  if (!name || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return res.redirect('/admin?msg=' + encodeURIComponent('名称要填哦；日期可以不填，但填了得是合法日期'));
  }
  db.prepare('INSERT INTO anniversaries (name, date, repeat_yearly, icon) VALUES (?,?,?,?)')
    .run(name, date, req.body.repeat_yearly ? 1 : 0, String(req.body.icon || '💖').slice(0, 4));
  res.redirect('/admin#anniv');
});

router.post('/anniversaries/:id/delete', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM anniversaries WHERE id = ?').run(Number(req.params.id));
  res.redirect('/admin#anniv');
});

// ---------- 设置 ----------
router.post('/settings', requireAdmin, upload.fields([
  { name: 'hero_image', maxCount: 1 },
  { name: 'avatar_a', maxCount: 1 },
  { name: 'avatar_b', maxCount: 1 },
]), async (req, res, next) => {
  try {
    const s = getSettings();
    const body = req.body;

    if (req.body.theme_color && /^#[0-9a-fA-F]{6}$/.test(req.body.theme_color)) setSetting('theme_color', req.body.theme_color);
    ['site_name', 'slogan', 'name_a', 'name_b'].forEach((k) => {
      if (body[k] !== undefined) setSetting(k, String(body[k]).trim().slice(0, 60) || s[k]);
    });
    if (/^\d{4}-\d{2}-\d{2}$/.test(body.since_date || '')) setSetting('since_date', body.since_date);
    if (/^\d{2}:\d{2}$/.test(body.since_time || '')) setSetting('since_time', body.since_time);

    // 私密锁开关（照片墙 / 情书，共用一个密码）
    const wantLock = body.photo_lock === 'on';
    const wantMsgLock = body.message_lock === 'on';
    if ((wantLock || wantMsgLock) && !s.photo_lock_pass) {
      return res.redirect('/admin?msg=' + encodeURIComponent('请先在「修改密码」里设置私密密码'));
    }
    // 锁与动效开关：仅当表单里出现该字段时才更新（避免部分提交误重置）
    if (body.photo_lock !== undefined) setSetting('photo_lock', body.photo_lock === 'on' ? '1' : '0');
    if (body.message_lock !== undefined) setSetting('message_lock', body.message_lock === 'on' ? '1' : '0');
    if (['off', 'random', 'sakuraImg', 'sakura', 'ginkgo', 'petals', 'snow', 'summer', 'rain'].indexOf(body.fx_fall) !== -1) setSetting('fx_fall', body.fx_fall);
    if (body.fx_sparkle !== undefined) setSetting('fx_sparkle', body.fx_sparkle === 'on' ? '1' : '0');
    if (body.fx_trail !== undefined) setSetting('fx_trail', body.fx_trail === 'on' ? '1' : '0');

    // 图片：上传新的就压缩成 webp 使用（原图保留在 originals）
    for (const field of ['hero_image', 'avatar_a', 'avatar_b']) {
      const f = req.files && req.files[field] && req.files[field][0];
      if (f) {
        if (s[field] && s[field].endsWith('.webp')) safeUnlink(compPath(s[field]));
        const comp = field === 'hero_image'
          ? await makeCompressed(f.filename, { width: 1920, quality: 80 })
          : await makeCompressed(f.filename, { width: 480, height: 480, quality: 85 });
        setSetting(field, comp);
      } else if (body['clear_' + field] === 'on' && s[field]) {
        if (s[field].endsWith('.webp')) safeUnlink(compPath(s[field]));
        setSetting(field, '');
      }
    }

    res.redirect('/admin?msg=' + encodeURIComponent('设置已保存 ✅'));
  } catch (e) { next(e); }
});

// 单独应用主题色（色卡/取色器即时生效，无需保存整个表单）
router.post('/theme', requireAdmin, (req, res) => {
  const c = String(req.body.color || '');
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) return res.status(400).json({ ok: false, msg: '颜色格式不对' });
  setSetting('theme_color', c);
  res.json({ ok: true, color: c });
});

// 修改密码（后台密码 / 相册密码）
router.post('/settings/passwords', requireAdmin, (req, res) => {
  const s = getSettings();
  const { old_password, new_admin_pass, new_lock_pass } = req.body;
  if (!bcrypt.compareSync(String(old_password || ''), s.admin_pass || '')) {
    return res.redirect('/admin?msg=' + encodeURIComponent('当前后台密码不对，未做任何修改'));
  }
  const msg = [];
  if (new_admin_pass) {
    if (String(new_admin_pass).length < 4) return res.redirect('/admin?msg=' + encodeURIComponent('新后台密码至少 4 位'));
    setSetting('admin_pass', bcrypt.hashSync(String(new_admin_pass), 10));
    msg.push('后台密码已更新');
  }
  if (new_lock_pass) {
    if (String(new_lock_pass).length < 4) return res.redirect('/admin?msg=' + encodeURIComponent('相册密码至少 4 位'));
    setSetting('photo_lock_pass', bcrypt.hashSync(String(new_lock_pass), 10));
    msg.push('相册密码已更新');
  }
  res.redirect('/admin?msg=' + encodeURIComponent(msg.length ? msg.join('，') + ' ✅' : '没有要修改的密码'));
});

module.exports = router;
