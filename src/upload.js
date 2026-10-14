const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const multer = require('multer');
const { randName } = require('./util');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const ORIG_DIR = path.join(UPLOAD_DIR, 'originals');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbs');
const COMP_DIR = path.join(UPLOAD_DIR, 'compressed');
fs.mkdirSync(ORIG_DIR, { recursive: true });
fs.mkdirSync(THUMB_DIR, { recursive: true });
fs.mkdirSync(COMP_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ORIG_DIR),
    filename: (req, file, cb) => cb(null, randName(file.mimetype)),
  }),
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('只支持 JPG / PNG / WEBP / GIF 图片'));
  },
  limits: { fileSize: 25 * 1024 * 1024 },
});

// 生成 webp 缩略图，返回缩略图文件名
async function makeThumb(origName) {
  const base = origName.replace(/\.[^.]+$/, '');
  const thumbName = base + '.webp';
  await sharp(path.join(ORIG_DIR, origName))
    .rotate() // 按相机 EXIF 方向摆正
    .resize({ width: 640, withoutEnlargement: true })
    .webp({ quality: 78 })
    .toFile(path.join(THUMB_DIR, thumbName));
  return thumbName;
}

function origPath(name) { return path.join(ORIG_DIR, path.basename(name)); }
function thumbPath(name) { return path.join(THUMB_DIR, path.basename(name)); }
function compPath(name) { return path.join(COMP_DIR, path.basename(name)); }

// 生成压缩版（webp），原图保留在 originals 不动
// opts: { width, height, quality } — height 省略时按比例缩放
async function makeCompressed(origName, opts = {}) {
  const base = origName.replace(/\.[^.]+$/, '');
  const outName = base + '.webp';
  let p = sharp(path.join(ORIG_DIR, origName)).rotate();
  if (opts.width && opts.height) {
    // 头像类：居中裁方，attention 优先对准画面主体（人脸）
    p = p.resize({
      width: opts.width, height: opts.height, fit: 'cover',
      position: sharp.strategy.attention,
    });
  } else {
    p = p.resize({ width: opts.width || 1920, withoutEnlargement: true });
  }
  await p.webp({ quality: opts.quality || 82 }).toFile(compPath(outName));
  return outName;
}

module.exports = { upload, makeThumb, makeCompressed, origPath, thumbPath, compPath, UPLOAD_DIR };
