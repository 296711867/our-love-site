/* 小站动效引擎 · 恋爱版
   配置：window.SITE_EFFECTS = { fall: 'sakuraImg'|'petals'|'sakura'|'ginkgo'|'snow'|'summer'|'rain'|'off', sparkle: bool, trail: bool }
   花瓣绘制参考 jhammann/sakura 的形态思路；爱心替换星光/彩虹拖尾，贴合情侣主题。
   遵循 prefers-reduced-motion；页面隐藏自动暂停；DPR 高清适配。 */
(function () {
  'use strict';
  var CFG = window.SITE_EFFECTS || {};
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fallMode = CFG.fall && CFG.fall !== 'off' ? CFG.fall : null;
  var needFall = !!fallMode, needPtr = !!CFG.sparkle || !!CFG.trail;
  if (reduced || (!needFall && !needPtr)) return;

  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  function makeCanvas(z) {
    var c = document.createElement('canvas');
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:' + z + ';';
    document.body.appendChild(c);
    var ctx = c.getContext('2d');
    function resize() {
      c.width = window.innerWidth * DPR;
      c.height = window.innerHeight * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    return ctx;
  }

  function themeColor() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--theme').trim();
    return /^#?[0-9a-fA-F]{6}$/.test(v) ? (v.charAt(0) === '#' ? v : '#' + v) : '#c8a27a';
  }

  var hidden = false;
  document.addEventListener('visibilitychange', function () { hidden = document.hidden; });

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  /* ============ 飘落层 ============ */
  var fctx = null, flakes = [];
  var petalColors = [
    { a: '#ffc2d1', b: '#ffe3ec' },
    { a: '#ffd6e0', b: '#fff0f5' },
    { a: '#ffb3c6', b: '#ffd9e4' },
    { a: '#ffffff', b: '#ffe9f0' }
  ];

  // 「樱飞」：真实花瓣贴图（LikeGirl 同款 sakura.png），按需加载
  var sakuraImg = new Image(), sakuraImgReady = false;
  if (fallMode === 'sakuraImg') {
    sakuraImg.onload = function () { sakuraImgReady = true; };
    sakuraImg.src = '/img/sakura.png';
  }

  function spawnFlake(init) {
    var W = window.innerWidth, H = window.innerHeight;
    var depth = rand(.45, 1); // 远近层次：小的在远处
    if (fallMode === 'sakuraImg') {
      // 樱飞：贴图花瓣，运动模型与银杏/花瓣等统一（竖直下落+定向缓移+摇摆+翻滚）
      var dirS = Math.random() < .5 ? -1 : 1;
      var fs2 = H * .007 + rand(0, 4.5);
      return {
        kind: 'sakuraPetal', depth: depth,
        x0: rand(0, W), y: init ? rand(0, H) : rand(-40, -10),
        vy: H / (fs2 * 60), windX: dirS * (W * rand(.35, .8)) / (fs2 * 60),
        swayA: rand(6, 15), swayS: (Math.PI * 2) / rand(2.2, 3.8), ph: rand(0, Math.PI * 2),
        rot: rand(0, Math.PI * 2), vr: rand(-.03, .05),
        flip: rand(0, Math.PI * 2), flipV: rand(.02, .05),
        w: rand(12, 20) * (.55 + .45 * depth),
        h: rand(10, 16) * (.55 + .45 * depth),
        al: rand(.55, .9)
      };
    }
    if (fallMode === 'petals') {
      // 三重运动（复刻 sakura）：①缓慢下落 ②横向吹过 0.5~1 个屏宽 ③2~4s 摇摆 ±15~45°
      var fallSec = H * .007 + rand(0, 5);           // 整屏下落耗时（秒）
      var dir = Math.random() < .5 ? -1 : 1;         // 风向
      return {
        kind: 'petal', depth: depth,
        x0: rand(0, W), y: init ? rand(0, H) : rand(-50, -15),
        vy: H / (fallSec * 60),                      // 每帧下落量
        windX: dir * (W * rand(.5, 1)) / (fallSec * 60),
        swayA: rand(7, 20),                          // 摇摆半径（像素）
        swayS: (Math.PI * 2) / rand(2, 4),           // 摇摆角速度
        ph: rand(0, Math.PI * 2),
        rot: rand(0, Math.PI * 2), vr: rand(-.03, .06),
        flip: rand(0, Math.PI * 2), flipV: rand(.02, .05),
        s: rand(5.5, 9.5) * depth + 1.5,
        al: rand(.55, .92),
        col: pick(petalColors)
      };
    }
    if (fallMode === 'sakura') {
      var dir2 = Math.random() < .5 ? -1 : 1;
      var fs = H * .008 + rand(0, 5);
      return {
        kind: 'sakura', depth: depth,
        x0: rand(0, W), y: init ? rand(0, H) : rand(-40, -10),
        vy: H / (fs * 60), windX: dir2 * (W * rand(.4, .9)) / (fs * 60),
        swayA: rand(6, 16), swayS: (Math.PI * 2) / rand(2.4, 4.2), ph: rand(0, Math.PI * 2),
        rot: rand(0, Math.PI * 2), vr: rand(-.025, .025),
        flip: rand(0, Math.PI * 2), flipV: rand(.02, .05),
        s: rand(5.5, 10) * depth + 3,
        al: rand(.6, .95), col: pick(['#ffd7e2', '#ffc9d9', '#ffe4ec', '#f9ccd8'])
      };
    }
    if (fallMode === 'summer') {
      // 炎炎夏日送你一场雪：细碎小雪 + 少量虚化光斑，飘得慢、会闪烁
      var bokeh = Math.random() < .16;
      return {
        kind: 'summer', depth: rand(.5, 1),
        x: rand(0, W), y: init ? rand(0, H) : rand(-8, -2),
        r: bokeh ? rand(2.4, 4.2) : rand(.5, 1.5),
        vy: bokeh ? rand(.12, .28) : rand(.22, .5),
        swayS: rand(.4, 1), ph: rand(0, Math.PI * 2), ph2: rand(0, Math.PI * 2),
        tw: rand(.8, 2.4),
        al: bokeh ? rand(.06, .16) : rand(.35, .75),
        bokeh: bokeh
      };
    }
    if (fallMode === 'ginkgo') {
      var dir4 = Math.random() < .5 ? -1 : 1;
      var fg = H * .007 + rand(0, 4.5);
      return {
        kind: 'ginkgo', depth: depth,
        x0: rand(0, W), y: init ? rand(0, H) : rand(-40, -10),
        vy: H / (fg * 60), windX: dir4 * (W * rand(.4, .85)) / (fg * 60),
        swayA: rand(6, 15), swayS: (Math.PI * 2) / rand(2.2, 3.8), ph: rand(0, Math.PI * 2),
        rot: rand(0, Math.PI * 2), vr: rand(-.05, .05),
        flip: rand(0, Math.PI * 2), flipV: rand(.03, .07),
        s: rand(6, 10) * depth + 3,
        al: rand(.65, .95),
        col: pick(['#f5c542', '#e8b52e', '#d9a521', '#edc94f', '#d4a017'])
      };
    }
    if (fallMode === 'snow') {
      return {
        kind: 'snow', depth: depth,
        x: rand(0, W), y: init ? rand(0, H) : -8,
        r: rand(1.1, 2.6) * depth + .4,
        vy: rand(.45, .95) * depth,
        windX: rand(-.12, .12),
        swayA: rand(.3, .7), swayS: rand(.4, .9), ph: rand(0, Math.PI * 2),
        al: rand(.4, .9)
      };
    }
    return {
      kind: 'rain',
      x: rand(-W * .05, W * 1.05), y: init ? rand(0, H) : -24,
      len: rand(9, 18), vy: rand(8.5, 14), vx: rand(-1.2, -.7),
      al: rand(.16, .34)
    };
  }

  function initFall() {
    fctx = makeCanvas(9990);
    var counts = { petals: 22, sakura: 14, ginkgo: 14, snow: 45, summer: 80, rain: 70 };
    if (fallMode === 'sakuraImg') counts.sakuraImg = window.innerWidth < 600 ? 14 : 20;
    var n = counts[fallMode] || 0;
    for (var i = 0; i < n; i++) flakes.push(spawnFlake(true));
  }

  function drawPetal(f) {
    var ctx = fctx;
    var sy = .35 + .65 * Math.abs(Math.sin(f.flip)); // 翻滚的立体感
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.scale(1, sy);
    ctx.globalAlpha *= (.35 + .65 * f.depth);
    var g = ctx.createLinearGradient(0, -f.s, 0, f.s);
    g.addColorStop(0, f.col.b);
    g.addColorStop(1, f.col.a);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, f.s);
    ctx.bezierCurveTo(-.55 * f.s, .6 * f.s, -.85 * f.s, .05 * f.s, -.5 * f.s, -.45 * f.s);
    ctx.bezierCurveTo(-.25 * f.s, -.78 * f.s, -.08 * f.s, -.9 * f.s, 0, -.78 * f.s);
    ctx.bezierCurveTo(.08 * f.s, -.9 * f.s, .25 * f.s, -.78 * f.s, .5 * f.s, -.45 * f.s);
    ctx.bezierCurveTo(.85 * f.s, .05 * f.s, .55 * f.s, .6 * f.s, 0, f.s);
    ctx.fill();
    // 高光
    ctx.globalAlpha = f.al * .35;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-.18 * f.s, -.1 * f.s, .22 * f.s, .4 * f.s, -.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 樱飞：真实花瓣贴图，旋转 + 翻滚压扁（运动与绘制节奏和其他飘落一致）
  function drawSakuraPetal(f) {
    if (!sakuraImgReady) return; // 贴图未就绪时照常移动，就绪后自然入画
    var ctx = fctx;
    var sq = .78 + .22 * Math.abs(Math.sin(f.flip));
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.drawImage(sakuraImg, -f.w / 2, -f.h * sq / 2, f.w, f.h * sq);
    ctx.restore();
  }

  // 整朵樱花：五片花瓣 + 花蕊
  function drawSakura(f) {
    var ctx = fctx;
    var sy = .5 + .5 * Math.abs(Math.sin(f.flip));
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.scale(1, .55 + .45 * sy);
    ctx.globalAlpha = f.al;
    for (var k = 0; k < 5; k++) {
      ctx.save();
      ctx.rotate(k * Math.PI * 2 / 5);
      ctx.translate(0, -f.s * .6);
      var g = ctx.createLinearGradient(0, -f.s * .5, 0, f.s * .45);
      g.addColorStop(0, '#fff0f5'); g.addColorStop(1, f.col);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, f.s * .48);
      ctx.bezierCurveTo(-f.s * .38, f.s * .12, -f.s * .3, -f.s * .42, 0, -f.s * .48);
      ctx.bezierCurveTo(f.s * .3, -f.s * .42, f.s * .38, f.s * .12, 0, f.s * .48);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#f6c26b';
    ctx.beginPath();
    ctx.arc(0, 0, f.s * .15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 银杏叶：金黄扇形 + 中央缺口 + 放射叶脉，翻转变幻
  function drawGinkgo(f) {
    var ctx = fctx;
    var sy = .3 + .7 * Math.abs(Math.sin(f.flip));
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot + Math.sin(f.flip) * .25);
    ctx.scale(1, .3 + .7 * sy);
    ctx.globalAlpha = f.al;
    var g = ctx.createLinearGradient(0, -f.s * .55, 0, f.s * .55);
    g.addColorStop(0, '#f0c94f'); g.addColorStop(.6, f.col); g.addColorStop(1, '#c9921a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, f.s * .5);
    ctx.bezierCurveTo(-.1 * f.s, .34 * f.s, -.55 * f.s, .3 * f.s, -.62 * f.s, -.05 * f.s);
    ctx.bezierCurveTo(-.68 * f.s, -.35 * f.s, -.35 * f.s, -.55 * f.s, -.05 * f.s, -.52 * f.s);
    ctx.lineTo(0, -.34 * f.s);
    ctx.lineTo(.05 * f.s, -.52 * f.s);
    ctx.bezierCurveTo(.35 * f.s, -.55 * f.s, .68 * f.s, -.35 * f.s, .62 * f.s, -.05 * f.s);
    ctx.bezierCurveTo(.55 * f.s, .3 * f.s, .1 * f.s, .34 * f.s, 0, f.s * .5);
    ctx.fill();
    // 放射叶脉
    ctx.strokeStyle = 'rgba(160, 115, 30, .45)';
    ctx.lineWidth = 1;
    for (var v = -1; v <= 1; v++) {
      ctx.beginPath();
      ctx.moveTo(0, f.s * .45);
      ctx.lineTo(v * f.s * .38, -f.s * .38);
      ctx.stroke();
    }
    // 叶柄
    ctx.strokeStyle = '#a5761f';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, f.s * .5);
    ctx.lineTo(0, f.s * .68);
    ctx.stroke();
    ctx.restore();
  }

  function drawFall(t) {
    var W = window.innerWidth, H = window.innerHeight;
    fctx.clearRect(0, 0, W, H);
    flakes.sort(function (a, b) { return (a.depth || 1) - (b.depth || 1); }); // 远的先画
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      if (f.kind === 'petal' || f.kind === 'sakura' || f.kind === 'ginkgo' || f.kind === 'sakuraPetal') {
        var sway = Math.sin(t * f.swayS + f.ph);
        f.y += f.vy;
        f.x0 += f.windX;
        f.x = f.x0 + sway * f.swayA;
        f.rot += f.vr + sway * .012;
        f.flip += f.flipV;
        var prog = Math.min(1, f.y / H);
        if (f.y > H + 30 || f.x < -80 || f.x > W + 80) { flakes[i] = spawnFlake(false); continue; }
        fctx.globalAlpha = f.al * (.9 - .6 * prog);
        if (f.kind === 'petal') drawPetal(f);
        else if (f.kind === 'sakura') drawSakura(f);
        else if (f.kind === 'ginkgo') drawGinkgo(f);
        else drawSakuraPetal(f);
      } else if (f.kind === 'summer') {
        f.y += f.vy;
        f.x += Math.sin(t * f.swayS + f.ph) * .35;
        if (f.y > H + 6) { flakes[i] = spawnFlake(false); continue; }
        var tw = f.al * (.55 + .45 * Math.sin(t * f.tw + f.ph2));
        fctx.globalAlpha = Math.max(.04, tw);
        fctx.fillStyle = '#fff';
        if (f.bokeh) { fctx.shadowColor = 'rgba(255,255,255,.9)'; fctx.shadowBlur = 8; }
        fctx.beginPath();
        fctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        fctx.fill();
        fctx.shadowBlur = 0;
      } else if (f.kind === 'snow') {
        f.y += f.vy;
        f.x += f.windX + Math.sin(t * f.swayS + f.ph) * .5;
        if (f.y > H + 10) { flakes[i] = spawnFlake(false); continue; }
        fctx.globalAlpha = f.al * f.depth;
        fctx.fillStyle = '#fff';
        fctx.shadowColor = 'rgba(255,255,255,.8)'; fctx.shadowBlur = 4;
        fctx.beginPath();
        fctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        fctx.fill();
        fctx.shadowBlur = 0;
      } else {
        f.x += f.vx; f.y += f.vy;
        if (f.y > H + 26) { flakes[i] = spawnFlake(false); continue; }
        fctx.globalAlpha = f.al;
        fctx.strokeStyle = 'rgba(175, 205, 235, .9)';
        fctx.lineWidth = 1.1;
        fctx.beginPath();
        fctx.moveTo(f.x, f.y);
        fctx.lineTo(f.x + f.vx * 2.4, f.y + f.len);
        fctx.stroke();
      }
    }
    fctx.globalAlpha = 1;
  }

  /* ============ 指针层：爱心 ============ */
  var pctx = null, hearts = [], rings = [], trailAcc = 0, lastPt = null;

  function heartPath(ctx, s) {
    ctx.beginPath();
    ctx.moveTo(0, .38 * s);
    ctx.bezierCurveTo(-.62 * s, -.08 * s, -.4 * s, -.55 * s, 0, -.22 * s);
    ctx.bezierCurveTo(.4 * s, -.55 * s, .62 * s, -.08 * s, 0, .38 * s);
    ctx.closePath();
  }

  function drawHeart(h) {
    pctx.save();
    pctx.translate(h.x, h.y);
    pctx.rotate(h.rot);
    pctx.globalAlpha = Math.max(0, h.life) * (h.glow ? .95 : .85);
    pctx.fillStyle = h.col;
    if (h.glow) { pctx.shadowColor = h.col; pctx.shadowBlur = 7; }
    heartPath(pctx, h.s);
    pctx.fill();
    pctx.restore();
  }

  function spawnHeart(x, y, big) {
    var t = themeColor();
    var cols = ['#ff8fab', '#ffb3c6', t, '#ffc9d4'];
    hearts.push({
      x: x + rand(-6, 6), y: y + rand(-4, 4),
      s: big ? rand(9, 15) : rand(4, 7.5),
      vx: rand(-.25, .25), vy: big ? rand(-1.1, -.55) : rand(-.7, -.3),
      rot: rand(-.45, .45), vr: rand(-.02, .02),
      life: 1, decay: big ? rand(.006, .011) : rand(.012, .022),
      col: pick(cols), glow: big
    });
  }

  function initPointer() {
    pctx = makeCanvas(9991);
    window.addEventListener('pointermove', function (e) {
      if (!CFG.trail) return;
      if (lastPt) {
        var dx = e.clientX - lastPt.x, dy = e.clientY - lastPt.y;
        trailAcc += Math.sqrt(dx * dx + dy * dy);
        if (trailAcc > 26) {
          trailAcc = 0;
          spawnHeart(e.clientX + rand(-4, 4), e.clientY + rand(-2, 6), false);
          if (hearts.length > 40) hearts.shift();
        }
      }
      lastPt = { x: e.clientX, y: e.clientY };
    }, { passive: true });

    window.addEventListener('pointerdown', function (e) {
      if (!CFG.sparkle) return;
      var n = 4 + Math.floor(Math.random() * 3);
      for (var i = 0; i < n; i++) spawnHeart(e.clientX, e.clientY, true);
      rings.push({ x: e.clientX, y: e.clientY, r: 6, life: 1 });
      if (rings.length > 4) rings.shift();
    });
  }

  function drawPointer() {
    var W = window.innerWidth, H = window.innerHeight;
    pctx.clearRect(0, 0, W, H);
    for (var i = rings.length - 1; i >= 0; i--) {
      var rg = rings[i];
      rg.r += 2.6; rg.life -= .03;
      if (rg.life <= 0) { rings.splice(i, 1); continue; }
      pctx.globalAlpha = rg.life * .5;
      pctx.strokeStyle = themeColor();
      pctx.lineWidth = 1.6;
      pctx.beginPath();
      pctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
      pctx.stroke();
    }
    pctx.globalAlpha = 1;
    for (var j = hearts.length - 1; j >= 0; j--) {
      var h = hearts[j];
      h.x += h.vx + Math.sin(h.life * 7) * .3;
      h.y += h.vy;
      h.rot += h.vr;
      h.life -= h.decay;
      if (h.life <= 0 || h.y < -30) { hearts.splice(j, 1); continue; }
      drawHeart(h);
    }
    pctx.globalAlpha = 1;
  }

  /* ============ 主循环 ============ */
  if (!needFall && !needPtr) return;
  if (needFall) initFall();
  if (needPtr) initPointer();

  var frame = 0;
  function loop(t) {
    if (!hidden) {
      frame += 1;
      if (needFall && fctx && frame % 2 === 0) drawFall(t * .001);
      if (needPtr && pctx) drawPointer();
    }
    window.requestAnimationFrame(loop);
  }
  window.requestAnimationFrame(loop);
})();
