(function () {
  var items = Array.prototype.slice.call(document.querySelectorAll('.lb-item'));
  if (!items.length) return;

  var box = document.createElement('div');
  box.className = 'lb';
  box.hidden = true;
  box.innerHTML =
    '<button class="lb-close" aria-label="关闭">✕</button>' +
    '<button class="lb-btn lb-prev" aria-label="上一张">‹</button>' +
    '<img alt="">' +
    '<button class="lb-btn lb-next" aria-label="下一张">›</button>' +
    '<div class="lb-cap"></div>';
  document.body.appendChild(box);

  var img = box.querySelector('img');
  var cap = box.querySelector('.lb-cap');
  var cur = -1;
  var touchX = null;

  function show(i) {
    cur = (i + items.length) % items.length;
    var it = items[cur];
    img.src = it.getAttribute('data-src') || (it.tagName === 'IMG' ? it.src : '');
    var text = it.getAttribute('data-cap') || '';
    var date = it.getAttribute('data-date') || '';
    cap.innerHTML = '';
    if (text) cap.appendChild(document.createTextNode(text));
    if (date) {
      var sm = document.createElement('small');
      sm.textContent = date;
      cap.appendChild(sm);
    }
    box.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function hide() {
    box.hidden = true;
    document.body.style.overflow = '';
    img.src = '';
  }

  items.forEach(function (it, i) {
    it.addEventListener('click', function (e) {
      e.preventDefault();
      show(i);
    });
  });

  box.querySelector('.lb-close').addEventListener('click', hide);
  box.querySelector('.lb-prev').addEventListener('click', function () { show(cur - 1); });
  box.querySelector('.lb-next').addEventListener('click', function () { show(cur + 1); });
  box.addEventListener('click', function (e) { if (e.target === box) hide(); });

  document.addEventListener('keydown', function (e) {
    if (box.hidden) return;
    if (e.key === 'Escape') hide();
    if (e.key === 'ArrowLeft') show(cur - 1);
    if (e.key === 'ArrowRight') show(cur + 1);
  });

  box.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (dx > 40) show(cur - 1);
    else if (dx < -40) show(cur + 1);
    touchX = null;
  }, { passive: true });
})();
