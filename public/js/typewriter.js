// 打字机效果：给 .type-loop 元素循环打出 data-lines 里的句子（用 | 分隔）
(function () {
  var els = document.querySelectorAll('.type-loop');
  if (!els.length) return;

  Array.prototype.forEach.call(els, function (el) {
    var lines = (el.getAttribute('data-lines') || '').split('|').filter(function (s) { return s.trim(); });
    var textEl = el.querySelector('.type-text') || el;
    if (!lines.length) return;

    var li = 0, ci = 0, deleting = false;

    function tick() {
      var line = lines[li];
      if (!deleting) {
        ci += 1;
        textEl.textContent = line.slice(0, ci);
        if (ci >= line.length) {
          deleting = true;
          window.setTimeout(tick, 2200); // 打完停留
          return;
        }
        window.setTimeout(tick, 170);
      } else {
        ci -= 1;
        textEl.textContent = line.slice(0, ci);
        if (ci <= 0) {
          deleting = false;
          li = (li + 1) % lines.length;
          window.setTimeout(tick, 450); // 删完换句
          return;
        }
        window.setTimeout(tick, 55);
      }
    }

    tick();
  });
})();
