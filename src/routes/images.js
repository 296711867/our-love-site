const express = require('express');
const path = require('path');
const { db, getSetting } = require('../db');
const { origPath, thumbPath, compPath } = require('../upload');

const router = express.Router();

const IMMUTABLE = 'public, max-age=31536000, immutable';

function send(res, file) {
  res.setHeader('Cache-Control', IMMUTABLE);
  res.sendFile(file);
}

// 照片墙图片：上锁时需要解锁会话才能访问（缩略图和原图都挡住，防止直接猜 URL）
router.get(['/:kind(t|o)/:id'], (req, res) => {
  const p = db.prepare('SELECT * FROM photos WHERE id = ?').get(Number(req.params.id));
  if (!p) return res.status(404).send('not found');
  if (getSetting('photo_lock') === '1' && !(req.session && req.session.photoUnlock)) {
    return res.status(403).send('locked');
  }
  const file = req.params.kind === 't' ? thumbPath(p.thumb) : origPath(p.filename);
  send(res, file);
});

// 情书配图：情书上锁时同样需要解锁会话
router.get(['/:kind(mt|mo)/:id'], (req, res) => {
  const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(Number(req.params.id));
  if (!m || !m.image) return res.status(404).send('not found');
  if (getSetting('message_lock') === '1' && !(req.session && req.session.photoUnlock)) {
    return res.status(403).send('locked');
  }
  const file = req.params.kind === 'mt' ? thumbPath(m.image_thumb) : origPath(m.image);
  send(res, file);
});

// 设置里的图片（首页横幅 / 头像）——webp 为压缩版
router.get('/set/:key', (req, res) => {
  const key = req.params.key;
  if (!['hero', 'avatar_a', 'avatar_b'].includes(key)) return res.status(404).send('not found');
  const name = getSetting(key === 'hero' ? 'hero_image' : key);
  if (!name) return res.status(404).send('not found');
  send(res, name.endsWith('.webp') ? compPath(name) : origPath(name));
});

module.exports = router;
