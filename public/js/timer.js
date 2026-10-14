(function () {
  var since = document.body.getAttribute('data-since');
  if (!since) return;
  // 兼容纯日期（自动补零点）和完整日期时间两种格式
  var start = new Date(since.length === 10 ? since + 'T00:00:00' : since).getTime();
  if (isNaN(start)) return;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function show_date_time() {
    var timeold = Date.now() - start;
    var secondsold = Math.floor(timeold / 1000);
    var msPerDay = 24 * 60 * 60 * 1000;
    var daysold = Math.floor(timeold / msPerDay);
    var hrsold = Math.floor((timeold / msPerDay - daysold) * 24);
    var minsold = Math.floor(((timeold / msPerDay - daysold) * 24 - hrsold) * 60);
    var seconds = Math.floor((((timeold / msPerDay - daysold) * 24 - hrsold) * 60 - minsold) * 60);
    var el = document.getElementById('span_dt_dt');
    if (el !== null) {
      el.innerHTML = '这是我们一起走过的';
      document.getElementById('tian').innerHTML = daysold + '天';
      document.getElementById('shi').innerHTML = hrsold + '时';
      document.getElementById('fen').innerHTML = minsold + '分';
      if (seconds < 10) seconds = '0' + seconds;
      document.getElementById('miao').innerHTML = seconds + '秒';
    }
    // 纪念日页的纪念时钟（可选渲染）
    var ck = document.getElementById('ck-d');
    if (ck !== null) {
      document.getElementById('ck-d').textContent = daysold;
      document.getElementById('ck-h').textContent = pad(hrsold);
      document.getElementById('ck-m').textContent = pad(minsold);
      document.getElementById('ck-s').textContent = pad(seconds);
    }
    window.setTimeout(show_date_time, 1000);
  }

  show_date_time();
})();
