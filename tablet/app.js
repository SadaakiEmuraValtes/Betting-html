/* =========================================================
 * tablet/app.js —— タブレット版アプリケーション
 *   上部タブナビ＋カードUI＋下部固定の投票バー
 * ========================================================= */
(function () {
  'use strict';

  var D = UmaData, B = UmaBet, S = UmaStore;
  var view = document.getElementById('view');

  /* ------------------------------------------------ 小道具 */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function yen(n) { return B.yen(n); }
  function on(sel, ev, fn) { $$(sel).forEach(function (e) { e.addEventListener(ev, fn.bind(null, e)); }); }

  function toast(msg, err) {
    var d = document.createElement('div');
    d.className = 'toast' + (err ? ' err' : '');
    d.textContent = msg;
    document.getElementById('toast-root').appendChild(d);
    setTimeout(function () { d.remove(); }, 3000);
  }

  function modal(title, body, footer) {
    document.getElementById('modal-root').innerHTML =
      '<div class="modal-bg"><div class="modal"><h3>' + title + '</h3>' +
      '<div class="mb">' + body + '</div>' +
      '<div class="mf">' + (footer || '<button class="btn btn-ghost" data-close="1">閉じる</button>') + '</div></div></div>';
    on('#modal-root [data-close]', 'click', closeModal);
  }
  function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

  function sheet(title, body, footer) {
    document.getElementById('sheet-root').innerHTML =
      '<div class="sheet-bg"><div class="sheet"><h3>' + title + '</h3>' +
      '<div class="sb">' + body + '</div>' +
      '<div class="sf">' + (footer || '<button class="btn btn-ghost btn-block" data-sclose="1">閉じる</button>') + '</div></div></div>';
    on('#sheet-root [data-sclose]', 'click', closeSheet);
  }
  function closeSheet() { document.getElementById('sheet-root').innerHTML = ''; }

  function statusBadge(st) { return '<span class="badge badge-' + st + '">' + S.STATUS_LABEL[st] + '</span>'; }
  function hnum(n) { return '<span class="horse-num">' + n + '</span>'; }

  /* ------------------------------------------------ ヘッダー */

  function renderHeader() {
    var sel = $('#hd-clock');
    if (!sel.options.length) {
      var h, html = '';
      for (h = 9; h <= 18; h++) html += '<option value="' + h + '">' + ('0' + h).slice(-2) + ':00</option>';
      sel.innerHTML = html;
      sel.addEventListener('change', function () {
        S.setVirtualHour(this.value); render(); toast('仮想時刻を ' + S.nowLabel() + ' に変更');
      });
    }
    sel.value = S.virtualHour();

    var u = S.currentUser();
    if (u) {
      $('#hd-balance-box').style.display = '';
      $('#hd-balance').textContent = yen(u.balance);
      $('#hd-user').innerHTML = '<a class="tb-avatar" href="#/mypage" title="' + esc(u.name) + '">' +
        esc(u.name.slice(0, 1)) + '</a>';
    } else {
      $('#hd-balance-box').style.display = 'none';
      $('#hd-user').innerHTML = '<button class="tb-login-btn" id="hd-login">ログイン</button>';
      $('#hd-login').addEventListener('click', function () { location.hash = '#/login'; });
    }
  }

  function markNav(name) {
    $$('#tb-nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === name); });
  }

  function clearFixed() {
    var bar = $('.bet-bar');
    if (bar) bar.remove();
  }

  /* ------------------------------------------------ ルーター */

  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var qi = h.indexOf('?'), q = {};
    if (qi >= 0) {
      h.slice(qi + 1).split('&').forEach(function (kv) {
        var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
      h = h.slice(0, qi);
    }
    return { path: h.split('/').filter(Boolean), query: q };
  }

  function render() {
    S.settle();
    renderHeader();
    clearFixed();
    closeSheet();
    var r = parseHash(), p0 = r.path[0] || '';
    window.scrollTo(0, 0);

    switch (p0) {
      case '': markNav('home'); return viewHome(Number(r.query.v || 0));
      case 'race': markNav('home'); return viewRace(Number(r.path[1]), r.query.tab || 'entries');
      case 'history': markNav('history'); return needLogin() || viewHistory();
      case 'wallet': markNav('wallet'); return needLogin() || viewWallet(r.query.mode || 'deposit');
      case 'mypage': markNav('mypage'); return needLogin() || viewMypage();
      case 'login': markNav(''); return viewLogin();
      case 'register': markNav(''); return viewRegister();
      case 'help': markNav('help'); return viewHelp();
      default: view.innerHTML = '<div class="card"><div class="empty">ページが見つかりません。</div></div>';
    }
  }

  function needLogin() {
    if (S.isLoggedIn()) return false;
    view.innerHTML = '<div class="page-title"><h1>ログインが必要です</h1></div>' +
      '<div class="card"><div class="card-body">' +
      '<p>この機能のご利用にはログインが必要です。</p>' +
      '<div class="grid2"><a class="btn btn-main" href="#/login">ログイン</a>' +
      '<a class="btn btn-ghost" href="#/register">新規会員登録</a></div></div></div>';
    return true;
  }

  /* ================================================ ホーム */

  function viewHome(v) {
    if (!D.VENUES[v]) v = 0;
    var venue = D.VENUES[v];

    var html = '<div class="page-title"><h1>本日のレース</h1>' +
      '<p>' + D.RACE_DATE_LABEL + '／現在 ' + S.nowLabel() + '</p></div>';

    html += '<div class="venue-tabs">' + D.VENUES.map(function (x) {
      var onsale = D.venueRaces(x.idx).filter(function (r) { return S.raceStatus(r) === 'onsale'; }).length;
      return '<button data-venue="' + x.idx + '" class="' + (x.idx === v ? 'on' : '') + '"' +
        (x.idx === v ? ' style="background:' + x.color + ';border-color:' + x.color + '"' : '') + '>' +
        x.name + '<small>発売中 ' + onsale + 'R</small></button>';
    }).join('') + '</div>';

    html += '<div class="card"><h2>' + venue.name + '　全12レース<span style="font-size:11.5px;color:#708278">' +
      'タップで出馬表・投票へ</span></h2><div class="card-body">' +
      '<div class="grid2">' + D.venueRaces(v).map(raceCardHtml).join('') + '</div></div></div>';

    html += '<div class="card"><h2>重賞・特別レース</h2><div class="card-body">' +
      '<div class="grid2">' + D.featuredRaces().map(raceCardHtml).join('') + '</div></div></div>';

    view.innerHTML = html;
    on('[data-venue]', 'click', function (b) { location.hash = '#/?v=' + b.getAttribute('data-venue'); });
  }

  function raceCardHtml(race) {
    var st = S.raceStatus(race);
    return '<a class="race-card ' + (race.grade ? 'grade' : '') + '" href="#/race/' + race.key + '">' +
      '<div class="top"><span class="rno" style="color:' + race.venueColor + '">' + race.round + 'R</span>' +
      '<span class="time">' + race.startTime + ' 発走</span>' +
      '<span class="st">' + statusBadge(st) + '</span></div>' +
      '<div class="nm">' + (race.grade ? '<span class="badge badge-grade">' + race.grade + '</span> ' : '') +
      esc(race.name) + '</div>' +
      '<div class="meta">' + race.venueName + '　' + race.courseLabel + '　' + race.count + '頭</div></a>';
  }

  /* ================================================ レース詳細 */

  var betUI = {};
  function uiFor(k) {
    if (!betUI[k]) betUI[k] = { typeId: 'tan', methodId: 'normal', picks: [], axis: [], amount: 100 };
    return betUI[k];
  }

  function viewRace(key, tab) {
    var race = D.getRace(key);
    if (!race) { view.innerHTML = '<div class="card"><div class="empty">レースが見つかりません。</div></div>'; return; }
    var st = S.raceStatus(race);

    var html = '<div class="race-hero">' +
      '<div class="l1"><span class="vtag" style="background:' + race.venueColor + '">' + race.venueName + ' ' + race.round + 'R</span>' +
      statusBadge(st) +
      '<span style="margin-left:auto;font-size:12.5px;color:#708278">発走 ' + race.startTime + '／現在 ' + S.nowLabel() + '</span></div>' +
      '<h1>' + (race.grade ? '<span class="badge badge-grade">' + race.grade + '</span> ' : '') + esc(race.name) + '</h1>' +
      '<div class="meta">' + D.RACE_DATE_LABEL + '　' + race.courseLabel + '　' + race.count + '頭立て</div></div>';

    html += '<div class="seg">' +
      segLink(key, 'entries', '出馬表・投票', tab) +
      segLink(key, 'odds', 'オッズ', tab) +
      segLink(key, 'result', '結果・払戻', tab) + '</div>';

    if (tab === 'odds') { view.innerHTML = html + oddsHtml(race); return; }
    if (tab === 'result') { view.innerHTML = html + resultHtml(race, st); return; }

    html += '<div class="card"><h2>投票条件</h2><div class="card-body" id="bet-cond"></div></div>' +
      '<div class="card"><h2>出馬表<span style="font-size:11.5px;color:#708278" id="pick-hint"></span></h2>' +
      '<div class="card-body flush" id="entry-area"></div></div>' +
      '<div id="mine-area"></div>';

    view.innerHTML = html;
    drawCond(race, st);
    drawEntries(race, st);
    drawMine(race);
    drawBar(race, st);
  }

  function segLink(key, id, label, cur) {
    return '<a class="' + (cur === id ? 'on' : '') + '" href="#/race/' + key + '?tab=' + id + '">' + label + '</a>';
  }

  function drawCond(race, st) {
    var ui = uiFor(race.key);
    var t = D.betType(ui.typeId);

    var html = '<label class="fl">式別</label><div class="chips">' +
      D.BET_TYPES.map(function (x) {
        return '<button class="chip ' + (x.id === ui.typeId ? 'on' : '') + '" data-type="' + x.id + '">' + x.name + '</button>';
      }).join('') + '</div>' +
      '<div class="hint">' + t.desc + '</div>';

    if (t.size > 1) {
      html += '<label class="fl" style="margin-top:14px">方式</label><div class="chips">' +
        D.BET_METHODS.map(function (m) {
          return '<button class="chip ' + (m.id === ui.methodId ? 'on' : '') + '" data-method="' + m.id + '">' + m.name + '</button>';
        }).join('') + '</div>' +
        '<div class="hint">' + (D.BET_METHODS.filter(function (m) { return m.id === ui.methodId; })[0] || {}).desc +
        (ui.methodId === 'normal' && t.ordered ? '（選択した順が着順になります）' : '') + '</div>';
    }

    html += '<label class="fl" style="margin-top:14px">1点あたりの金額</label><div class="chips">' +
      [100, 500, 1000, 5000, 10000].map(function (a) {
        return '<button class="chip ' + (a === ui.amount ? 'on' : '') + '" data-amount="' + a + '">' + B.num(a) + '円</button>';
      }).join('') +
      '</div><div style="margin-top:9px;display:flex;gap:10px;align-items:center">' +
      '<input type="number" id="amt" value="' + ui.amount + '" min="100" step="100" style="width:180px">' +
      '<button class="btn btn-ghost btn-sm" id="clear-pick">選択をクリア</button></div>';

    $('#bet-cond').innerHTML = html;

    on('#bet-cond [data-type]', 'click', function (b) {
      ui.typeId = b.getAttribute('data-type');
      var tt = D.betType(ui.typeId);
      if (tt.size === 1) ui.methodId = 'normal';
      if (ui.methodId === 'normal' && ui.picks.length > tt.size) ui.picks = ui.picks.slice(0, tt.size);
      ui.axis = [];
      redraw(race, st);
    });
    on('#bet-cond [data-method]', 'click', function (b) {
      ui.methodId = b.getAttribute('data-method');
      ui.axis = [];
      var tt = D.betType(ui.typeId);
      if (ui.methodId === 'normal' && ui.picks.length > tt.size) ui.picks = ui.picks.slice(0, tt.size);
      redraw(race, st);
    });
    on('#bet-cond [data-amount]', 'click', function (b) {
      ui.amount = Number(b.getAttribute('data-amount')); redraw(race, st);
    });
    $('#amt').addEventListener('change', function () {
      ui.amount = Math.max(100, Number(this.value) || 100); redraw(race, st);
    });
    $('#clear-pick').addEventListener('click', function () {
      ui.picks = []; ui.axis = []; redraw(race, st);
    });
  }

  function redraw(race, st) {
    drawCond(race, st); drawEntries(race, st); drawBar(race, st);
  }

  function drawEntries(race, st) {
    var ui = uiFor(race.key);
    var t = D.betType(ui.typeId);
    var nagashi = ui.methodId === 'nagashi' && t.size > 1;
    var result = st === 'confirmed' ? D.getResult(race.key) : null;

    $('#pick-hint').textContent = nagashi ? '「軸」と「相」を選んでください' : '馬をタップして選択';

    $('#entry-area').innerHTML = race.horses.map(function (h) {
      var picked = ui.picks.indexOf(h.num) >= 0;
      var isAxis = ui.axis.indexOf(h.num) >= 0;
      var order = t.ordered && ui.methodId === 'normal' && picked ? ui.picks.indexOf(h.num) + 1 : 0;
      var pos = result ? result.order.indexOf(h.num) + 1 : 0;

      var btns = nagashi
        ? '<button class="pick-btn axis ' + (isAxis ? 'on' : '') + '" data-axis="' + h.num + '">軸</button>' +
        '<button class="pick-btn ' + (picked ? 'on' : '') + '" data-pick="' + h.num + '">相</button>'
        : '<button class="pick-btn ' + (picked ? 'on' : '') + '" data-pick="' + h.num + '">' + (picked ? '✓' : '選択') + '</button>';

      return '<div class="entry-item ' + (picked || isAxis ? 'sel' : '') + '">' +
        '<span class="waku w' + h.waku + '">' + h.waku + '</span>' + hnum(h.num) +
        '<div class="info"><div class="nm">' + esc(h.name) +
        (order ? '<span class="order-tag">' + order + '着指定</span>' : '') +
        (pos ? '<span class="order-tag" style="background:#e4ece7;color:#1d2a24">' + pos + '着</span>' : '') + '</div>' +
        '<div class="sub">' + h.sex + h.age + '／' + h.weight + '.0kg／' + esc(h.jockey) + '</div></div>' +
        '<div class="od"><b class="' + (h.odds < 10 ? 'odds-hot' : '') + '">' + h.odds.toFixed(1) + '</b>' +
        '<span>' + h.popularity + '番人気</span></div>' +
        '<div class="pick-col">' + btns + '</div></div>';
    }).join('');

    on('#entry-area [data-pick]', 'click', function (b) { togglePick(race, st, Number(b.getAttribute('data-pick')), false); });
    on('#entry-area [data-axis]', 'click', function (b) { togglePick(race, st, Number(b.getAttribute('data-axis')), true); });
  }

  function togglePick(race, st, n, isAxis) {
    var ui = uiFor(race.key), t = D.betType(ui.typeId);
    if (isAxis) {
      var ai = ui.axis.indexOf(n);
      if (ai >= 0) ui.axis.splice(ai, 1);
      else {
        if (ui.axis.length >= t.size - 1) ui.axis.shift();
        ui.axis.push(n);
        ui.picks = ui.picks.filter(function (x) { return x !== n; });
      }
    } else {
      var pi = ui.picks.indexOf(n);
      if (pi >= 0) ui.picks.splice(pi, 1);
      else {
        if (ui.methodId === 'normal' && ui.picks.length >= t.size) ui.picks.shift();
        ui.picks.push(n);
        ui.axis = ui.axis.filter(function (x) { return x !== n; });
      }
    }
    drawEntries(race, st); drawBar(race, st); drawCond(race, st);
  }

  function combosOf(race) {
    var ui = uiFor(race.key);
    return B.buildCombos(ui.typeId, ui.methodId, { picks: ui.picks, axis: ui.axis });
  }

  /* -------------------- 下部の投票バー */

  function drawBar(race, st) {
    clearFixed();
    var ui = uiFor(race.key);
    var combos = combosOf(race);
    var total = combos.length * ui.amount;
    var u = S.currentUser();

    var right;
    if (st !== 'onsale') right = '<span class="btn btn-ghost" style="pointer-events:none">' + S.STATUS_LABEL[st] + '</span>';
    else if (!u) right = '<a class="btn btn-gold" href="#/login">ログインして投票</a>';
    else right = '<button class="btn btn-gold" id="bar-buy"' + (combos.length ? '' : ' disabled') + '>購入する</button>';

    var bar = document.createElement('div');
    bar.className = 'bet-bar';
    bar.innerHTML = '<div class="bet-bar-inner">' +
      '<div class="sum">' + D.betType(ui.typeId).name + '　' + combos.length + '点 × ' + yen(ui.amount) + '<b>' + yen(total) + '</b></div>' +
      '<button class="btn open btn-sm" id="bar-list">買い目を見る</button>' +
      '<div style="margin-left:auto">' + right + '</div></div>';
    document.body.appendChild(bar);

    $('#bar-list').addEventListener('click', function () { showCombos(race); });
    var buy = $('#bar-buy');
    if (buy) buy.addEventListener('click', function () { confirmBet(race); });
  }

  function showCombos(race) {
    var ui = uiFor(race.key), combos = combosOf(race);
    sheet('買い目一覧（' + combos.length + '点）',
      combos.length
        ? '<div class="combo-box" style="max-height:340px">' + combos.map(function (c) {
          return '<span>' + B.comboLabel(ui.typeId, c) + '<b style="margin-left:8px;color:#708278">' +
            B.oddsFor(race, ui.typeId, c).toFixed(1) + '</b></span>';
        }).join('') + '</div>' +
        '<div class="total-row"><span>1点あたり</span><b>' + yen(ui.amount) + '</b></div>' +
        '<div class="total-row grand"><span>合計</span><b>' + yen(combos.length * ui.amount) + '</b></div>'
        : '<div class="empty">まだ買い目が確定していません。<br>出馬表から馬を選択してください。</div>');
  }

  function confirmBet(race) {
    var ui = uiFor(race.key), combos = combosOf(race), t = D.betType(ui.typeId);
    var total = combos.length * ui.amount, u = S.currentUser();

    modal('購入内容の確認',
      '<table class="table"><tbody>' +
      tr('レース', race.label + '　' + esc(race.name)) +
      tr('式別 / 方式', t.name + ' / ' + (D.BET_METHODS.filter(function (m) { return m.id === ui.methodId; })[0] || {}).name) +
      tr('点数', combos.length + ' 点') +
      tr('1点あたり', yen(ui.amount)) +
      tr('合計金額', '<b style="font-size:19px;color:#c0392b">' + yen(total) + '</b>') +
      tr('購入後残高', yen(u.balance - total)) +
      '</tbody></table>' +
      '<div class="hint" style="margin:12px 0 6px">買い目</div>' +
      '<div class="combo-box">' + combos.map(function (c) {
        return '<span>' + B.comboLabel(ui.typeId, c) + '</span>';
      }).join('') + '</div>' +
      '<div class="msg msg-info" style="margin-top:14px">購入後の取り消しはできません。</div>',
      '<button class="btn btn-ghost" data-close="1">キャンセル</button>' +
      '<button class="btn btn-main" id="do-bet">購入する</button>');

    $('#do-bet').addEventListener('click', function () {
      var res = S.placeBet(race.key, ui.typeId, ui.methodId, combos, ui.amount);
      if (!res.ok) { closeModal(); toast(res.error, true); return; }
      ui.picks = []; ui.axis = [];
      modal('購入が完了しました',
        '<div class="msg msg-ok">馬券の購入が完了しました。</div>' +
        '<table class="table"><tbody>' +
        tr('受付番号', '<span style="font-family:monospace">' + res.bet.id + '</span>') +
        tr('レース', race.label + '　' + esc(race.name)) +
        tr('式別', res.bet.typeName + '（' + res.bet.methodName + '）') +
        tr('点数 / 合計', res.bet.combos.length + '点 / ' + yen(res.bet.total)) +
        tr('購入後残高', '<b>' + yen(res.balance) + '</b>') +
        '</tbody></table>',
        '<button class="btn btn-ghost" data-close="1">続けて投票</button>' +
        '<button class="btn btn-main" id="to-hist">投票履歴へ</button>');
      $('#to-hist').addEventListener('click', function () { closeModal(); location.hash = '#/history'; });
      renderHeader();
      drawEntries(race, S.raceStatus(race));
      drawCond(race, S.raceStatus(race));
      drawBar(race, S.raceStatus(race));
      drawMine(race);
      toast('馬券を購入しました');
    });
  }

  function tr(k, v) { return '<tr><th style="width:130px">' + k + '</th><td>' + v + '</td></tr>'; }

  function drawMine(race) {
    var mine = S.betsFor(race.key);
    $('#mine-area').innerHTML = mine.length
      ? '<div class="card"><h2>このレースへの投票（' + mine.length + '件）</h2>' +
      '<div class="card-body">' + mine.map(betItemHtml).join('') + '</div></div>'
      : '';
  }

  /* -------------------- オッズ・結果 */

  function oddsHtml(race) {
    var hs = race.horses;
    var html = '<div class="card"><h2>単勝・複勝オッズ</h2><div class="card-body flush">' +
      '<table class="table"><thead><tr><th style="width:50px">馬番</th><th>馬名</th>' +
      '<th class="num" style="width:90px">単勝</th><th class="num" style="width:90px">複勝</th>' +
      '<th class="center" style="width:70px">人気</th></tr></thead><tbody>' +
      hs.map(function (h) {
        return '<tr><td>' + hnum(h.num) + '</td><td>' + esc(h.name) + '</td>' +
          '<td class="num ' + (h.odds < 10 ? 'odds-hot' : '') + '">' + h.odds.toFixed(1) + '</td>' +
          '<td class="num">' + h.fukuOdds.toFixed(1) + '</td>' +
          '<td class="center">' + h.popularity + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    var nums = hs.map(function (h) { return h.num; });
    html += oddsListCard('馬連 人気上位30点', B.combinations(nums, 2), 'umaren', race, 30);
    html += oddsListCard('ワイド 人気上位20点', B.combinations(nums, 2), 'wide', race, 20);
    html += oddsListCard('三連複 人気上位30点', B.combinations(nums, 3), 'sanrenpuku', race, 30);
    return html;
  }

  function oddsListCard(title, combos, typeId, race, limit) {
    var list = combos.map(function (c) { return { c: c, o: B.oddsFor(race, typeId, c) }; })
      .sort(function (a, b) { return a.o - b.o; }).slice(0, limit);
    return '<div class="card"><h2>' + title + '</h2><div class="card-body">' +
      '<div class="grid4">' + list.map(function (x, i) {
        return '<div style="border:1px solid #dbe5df;border-radius:9px;padding:7px 9px;font-size:13px">' +
          '<div style="font-size:10.5px;color:#708278">' + (i + 1) + '番人気</div>' +
          '<b>' + x.c.join('-') + '</b>' +
          '<div class="' + (x.o < 100 ? 'odds-hot' : '') + '">' + x.o.toFixed(1) + '倍</div></div>';
      }).join('') + '</div></div></div>';
  }

  function resultHtml(race, st) {
    if (st !== 'confirmed') {
      return '<div class="card"><div class="empty">このレースはまだ確定していません。<br>' +
        'ヘッダーの仮想時刻を ' + race.startTime + ' より後にすると結果が表示されます。</div></div>';
    }
    var res = D.getResult(race.key);
    var html = '<div class="card"><h2>着順</h2><div class="card-body flush">' +
      '<table class="table"><thead><tr><th class="center" style="width:60px">着</th><th style="width:44px">枠</th>' +
      '<th style="width:50px">馬番</th><th>馬名</th><th style="width:110px">騎手</th>' +
      '<th class="num" style="width:80px">単勝</th></tr></thead><tbody>' +
      res.order.map(function (n, i) {
        var h = race.horses[n - 1];
        return '<tr><td class="center ' + (i < 3 ? 'pos-' + (i + 1) : '') + '"><b>' + (i + 1) + '</b></td>' +
          '<td><span class="waku w' + h.waku + '">' + h.waku + '</span></td><td>' + hnum(h.num) + '</td>' +
          '<td>' + esc(h.name) + '</td><td>' + esc(h.jockey) + '</td>' +
          '<td class="num">' + h.odds.toFixed(1) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    html += '<div class="card"><h2>払戻金（100円あたり）</h2><div class="card-body flush">' +
      '<table class="table"><thead><tr><th style="width:110px">式別</th><th style="width:150px">組み合わせ</th>' +
      '<th class="num">払戻金</th></tr></thead><tbody>' +
      B.racePayouts(race.key).map(function (p) {
        return '<tr><td>' + p.type + '</td><td><b>' + p.label + '</b></td>' +
          '<td class="num" style="font-weight:700">' + yen(p.payout) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    var mine = S.betsFor(race.key);
    if (mine.length) {
      html += '<div class="card"><h2>あなたの投票結果</h2><div class="card-body">' +
        mine.map(betItemHtml).join('') + '</div></div>';
    }
    return html;
  }

  /* ================================================ 投票履歴 */

  function viewHistory() {
    var u = S.currentUser(), sm = S.summary();
    view.innerHTML = '<div class="page-title"><h1>投票履歴</h1><p>' + esc(u.name) + ' 様</p></div>' +
      '<div class="stat-grid">' +
      stat('購入件数', sm.count + ' 件') + stat('購入金額', yen(sm.total)) +
      stat('払戻金額', yen(sm.payout)) +
      stat('収支', (sm.profit >= 0 ? '+' : '−') + yen(Math.abs(sm.profit)), sm.profit >= 0 ? 'plus' : 'minus') +
      '</div>' +
      '<div class="seg" id="hist-seg">' +
      ['all|すべて', 'pending|未確定', 'hit|的中', 'lose|不的中'].map(function (x, i) {
        var p = x.split('|');
        return '<button class="' + (i === 0 ? 'on' : '') + '" data-f="' + p[0] + '">' + p[1] + '</button>';
      }).join('') + '</div>' +
      '<div id="hist-body"></div>';

    function draw(f) {
      var list = u.bets.filter(function (b) { return f === 'all' || b.status === f; });
      $('#hist-body').innerHTML = list.length
        ? list.map(betItemHtml).join('')
        : '<div class="card"><div class="empty">該当する投票履歴がありません。</div></div>';
    }
    on('#hist-seg button', 'click', function (b) {
      $$('#hist-seg button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      draw(b.getAttribute('data-f'));
    });
    draw('all');
  }

  function stat(k, v, cls) {
    return '<div class="stat"><div class="k">' + k + '</div><div class="v ' + (cls || '') + '">' + v + '</div></div>';
  }

  function betItemHtml(b) {
    var badge = b.status === 'hit' ? '<span class="badge badge-hit">的中</span>'
      : b.status === 'lose' ? '<span class="badge badge-lose">不的中</span>'
        : '<span class="badge badge-pending">未確定</span>';
    var hitKeys = {};
    (b.hitCombos || []).forEach(function (c) { hitKeys[c.join('-')] = 1; });

    return '<div class="bet-item"><div class="hd">' + badge +
      '<a href="#/race/' + b.raceKey + '?tab=result"><b>' + b.raceLabel + '</b> ' + esc(b.raceName) + '</a>' +
      '<span class="id">' + b.id + '</span></div><div class="bd">' +
      '<div class="row"><span><b>' + b.typeName + '</b>　' + b.methodName + '</span><span>' + b.combos.length + '点</span></div>' +
      '<div class="combo-box" style="margin:8px 0">' + b.combos.map(function (c) {
        return '<span class="' + (hitKeys[c.join('-')] ? 'hit' : '') + '">' + B.comboLabel(b.typeId, c) + '</span>';
      }).join('') + '</div>' +
      '<div class="row"><span>購入金額</span><b>' + yen(b.total) + '</b></div>' +
      '<div class="row"><span>払戻金</span><span class="' + (b.payout ? 'pay' : '') + '">' + yen(b.payout) + '</span></div>' +
      '<div class="row" style="font-size:11.5px;color:#708278"><span>購入日時</span><span>' + b.createdAt + '</span></div>' +
      '</div></div>';
  }

  /* ================================================ 入出金 */

  function viewWallet(mode) {
    var u = S.currentUser();
    var html = '<div class="page-title"><h1>入出金</h1><p>購入可能額の入金・出金</p></div>' +
      '<div class="balance-card"><div class="k">ご購入可能額</div><div class="v">' + yen(u.balance) + '</div>' +
      '<div class="sub">登録口座：' + esc(u.bank) + '</div></div>' +
      '<div class="seg">' +
      '<a class="' + (mode === 'deposit' ? 'on' : '') + '" href="#/wallet?mode=deposit">入金</a>' +
      '<a class="' + (mode === 'withdraw' ? 'on' : '') + '" href="#/wallet?mode=withdraw">出金</a></div>' +
      '<div class="card"><div class="card-body" id="wallet-form"></div></div>' +
      '<div class="card"><h2>入出金・購入履歴</h2><div class="card-body flush">' +
      (u.txns.length
        ? '<table class="table"><thead><tr><th style="width:150px">日時</th><th style="width:90px">区分</th>' +
        '<th>内容</th><th class="num" style="width:110px">金額</th><th class="num" style="width:110px">残高</th>' +
        '</tr></thead><tbody>' + u.txns.map(function (t) {
          return '<tr><td style="font-size:11.5px">' + t.createdAt + '</td><td>' + t.label + '</td>' +
            '<td style="font-size:12.5px">' + esc(t.method || '') +
            (t.fee ? '<span style="color:#708278">（手数料' + yen(t.fee) + '）</span>' : '') + '</td>' +
            '<td class="num" style="font-weight:700;color:' + (t.amount >= 0 ? '#18855a' : '#c0392b') + '">' +
            (t.amount >= 0 ? '+' : '−') + yen(Math.abs(t.amount)) + '</td>' +
            '<td class="num">' + yen(t.balanceAfter) + '</td></tr>';
        }).join('') + '</tbody></table>'
        : '<div class="empty">入出金履歴はまだありません。</div>') +
      '</div></div>';

    view.innerHTML = html;
    mode === 'withdraw' ? drawWithdraw() : drawDeposit();
  }

  function drawDeposit() {
    $('#wallet-form').innerHTML = '<div id="wallet-msg"></div>' +
      '<label class="fl">入金方法</label><div class="chips" id="dep-methods">' +
      S.DEPOSIT_METHODS.map(function (m, i) {
        return '<button class="chip ' + (i === 0 ? 'on' : '') + '" data-m="' + m.id + '">' + m.name + '</button>';
      }).join('') + '</div>' +
      '<label class="fl" style="margin-top:16px">入金額</label>' +
      '<div class="chips" style="margin-bottom:10px">' +
      [1000, 5000, 10000, 30000, 50000, 100000].map(function (a) {
        return '<button class="chip" data-dep="' + a + '">' + B.num(a) + '円</button>';
      }).join('') + '</div>' +
      '<input type="number" id="dep-amount" value="10000" step="100" min="1000" max="500000">' +
      '<div class="hint">100円単位／1回 ' + yen(S.MIN_DEPOSIT) + '〜' + yen(S.MAX_DEPOSIT) + '</div>' +
      '<button class="btn btn-main btn-block btn-lg" id="dep-go" style="margin-top:18px">入金する</button>';

    on('#dep-methods .chip', 'click', function (b) {
      $$('#dep-methods .chip').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
    });
    on('[data-dep]', 'click', function (b) { $('#dep-amount').value = b.getAttribute('data-dep'); });
    $('#dep-go').addEventListener('click', function () {
      var m = $('#dep-methods .chip.on').getAttribute('data-m');
      var res = S.deposit($('#dep-amount').value, m);
      if (!res.ok) { $('#wallet-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>'; return; }
      modal('入金が完了しました',
        '<div class="msg msg-ok">' + yen(res.amount) + ' を入金しました。</div>' +
        '<table class="table"><tbody>' + tr('入金方法', res.method) + tr('入金額', yen(res.amount)) +
        tr('購入可能額', '<b>' + yen(res.balance) + '</b>') + '</tbody></table>');
      toast('入金が完了しました');
      render();
    });
  }

  function drawWithdraw() {
    var u = S.currentUser();
    $('#wallet-form').innerHTML = '<div id="wallet-msg"></div>' +
      '<label class="fl">出金先口座</label><div style="margin-bottom:14px">' + esc(u.bank) + '</div>' +
      '<label class="fl">出金額</label>' +
      '<div class="chips" style="margin-bottom:10px">' +
      [1000, 5000, 10000, 50000].map(function (a) {
        return '<button class="chip" data-wd="' + a + '">' + B.num(a) + '円</button>';
      }).join('') + '<button class="chip" data-wd="all">全額</button></div>' +
      '<input type="number" id="wd-amount" value="1000" step="100" min="1000">' +
      '<div class="hint">100円単位／出金手数料 ' + yen(S.WITHDRAW_FEE) + ' が別途かかります。</div>' +
      '<button class="btn btn-main btn-block btn-lg" id="wd-go" style="margin-top:18px">出金する</button>';

    on('[data-wd]', 'click', function (b) {
      var v = b.getAttribute('data-wd');
      $('#wd-amount').value = v === 'all'
        ? Math.max(0, Math.floor((u.balance - S.WITHDRAW_FEE) / 100) * 100) : v;
    });
    $('#wd-go').addEventListener('click', function () {
      var res = S.withdraw($('#wd-amount').value);
      if (!res.ok) { $('#wallet-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>'; return; }
      modal('出金手続きが完了しました',
        '<div class="msg msg-ok">' + yen(res.amount) + ' の出金手続きを受け付けました。</div>' +
        '<table class="table"><tbody>' + tr('出金額', yen(res.amount)) + tr('手数料', yen(res.fee)) +
        tr('出金先', esc(u.bank)) + tr('購入可能額', '<b>' + yen(res.balance) + '</b>') + '</tbody></table>');
      toast('出金手続きが完了しました');
      render();
    });
  }

  /* ================================================ マイページ */

  function viewMypage() {
    var u = S.currentUser(), sm = S.summary();
    view.innerHTML = '<div class="page-title"><h1>マイページ</h1></div>' +
      '<div class="balance-card"><div class="k">ご購入可能額</div><div class="v">' + yen(u.balance) + '</div>' +
      '<div class="sub">' + esc(u.name) + ' 様（会員番号 ' + u.id.toUpperCase() + '）</div></div>' +
      '<div class="grid2" style="margin-bottom:14px">' +
      '<a class="btn btn-main" href="#/wallet?mode=deposit">入金する</a>' +
      '<a class="btn btn-ghost" href="#/wallet?mode=withdraw">出金する</a></div>' +
      '<div class="stat-grid">' +
      stat('購入件数', sm.count + ' 件') + stat('購入金額', yen(sm.total)) +
      stat('払戻金額', yen(sm.payout)) +
      stat('収支', (sm.profit >= 0 ? '+' : '−') + yen(Math.abs(sm.profit)), sm.profit >= 0 ? 'plus' : 'minus') +
      '</div>' +
      '<div class="card"><h2>会員情報</h2><div class="card-body flush"><table class="table"><tbody>' +
      tr('ユーザーID', esc(u.loginId)) + tr('お名前', esc(u.name) + '（' + esc(u.kana) + '）') +
      tr('生年月日', u.birthday) + tr('メール', esc(u.email)) + tr('電話番号', esc(u.tel)) +
      tr('登録口座', esc(u.bank)) +
      tr('区分', u.registered ? '新規登録ユーザー' : 'テストユーザー（' + esc(u.memo) + '）') +
      '</tbody></table></div></div>' +
      '<div class="card"><h2>最近の投票<span><a href="#/history">すべて見る</a></span></h2><div class="card-body">' +
      (u.bets.length ? u.bets.slice(0, 3).map(betItemHtml).join('')
        : '<div class="empty">まだ投票がありません。</div>') + '</div></div>' +
      '<button class="btn btn-danger btn-block" id="mp-logout">ログアウト</button>';

    $('#mp-logout').addEventListener('click', function () {
      S.logout(); location.hash = '#/'; render(); toast('ログアウトしました');
    });
  }

  /* ================================================ ログイン */

  function viewLogin() {
    if (S.isLoggedIn()) { location.hash = '#/mypage'; return; }
    view.innerHTML = '<div class="page-title"><h1>ログイン</h1></div>' +
      '<div class="card"><div class="card-body">' +
      '<div id="login-msg"></div>' +
      '<div class="field-block"><label class="fl">ユーザーID<span class="req">必須</span></label>' +
      '<input type="text" id="lg-id" placeholder="user01"></div>' +
      '<div class="field-block"><label class="fl">パスワード<span class="req">必須</span></label>' +
      '<input type="password" id="lg-pw" placeholder="test1234"></div>' +
      '<button class="btn btn-main btn-block btn-lg" id="lg-go">ログイン</button>' +
      '<div style="text-align:center;margin-top:14px;font-size:13px">' +
      'アカウントをお持ちでない方は <a href="#/register">新規会員登録</a></div>' +
      '</div></div>' + testUserCard();

    $('#lg-go').addEventListener('click', doLogin);
    $('#lg-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    on('[data-fill]', 'click', function (b) {
      $('#lg-id').value = b.getAttribute('data-fill'); $('#lg-pw').value = 'test1234';
    });

    function doLogin() {
      var res = S.login($('#lg-id').value.trim(), $('#lg-pw').value);
      if (!res.ok) { $('#login-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>'; return; }
      toast('ようこそ ' + res.user.name + ' 様');
      location.hash = '#/'; render();
    }
  }

  function testUserCard() {
    return '<div class="card"><h2>テストアカウント（パスワード共通：test1234）</h2><div class="card-body flush">' +
      '<table class="table"><thead><tr><th style="width:100px">ID</th><th>お名前</th>' +
      '<th class="num" style="width:110px">残高</th><th style="width:80px"></th></tr></thead><tbody>' +
      D.TEST_USERS.map(function (u) {
        return '<tr><td><code>' + u.loginId + '</code></td>' +
          '<td>' + esc(u.name) + '<div style="font-size:11px;color:#708278">' + esc(u.memo) + '</div></td>' +
          '<td class="num">' + yen(u.balance) + '</td>' +
          '<td><button class="btn btn-ghost btn-sm" data-fill="' + u.loginId + '">入力</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  /* ================================================ 会員登録 */

  function viewRegister() {
    view.innerHTML = '<div class="page-title"><h1>新規会員登録</h1>' +
      '<p>デモサイトです。実在の個人情報は入力しないでください</p></div>' +
      '<div class="card"><div class="card-body"><div id="reg-msg"></div>' +
      '<div class="grid2">' +
      fb('ユーザーID', '必須', 'loginId', 'text', '半角英数字4〜20文字') +
      fb('生年月日', '必須', 'birthday', 'date', '', '1990-01-01') +
      fb('パスワード', '必須', 'password', 'password', '8文字以上') +
      fb('パスワード（確認）', '必須', 'passwordConfirm', 'password') +
      fb('お名前', '必須', 'name', 'text', '競馬 太郎') +
      fb('フリガナ', '必須', 'kana', 'text', 'ケイバ タロウ') +
      fb('メールアドレス', '必須', 'email', 'email', 'taro@example.test') +
      fb('電話番号', '必須', 'tel', 'tel', '090-0000-0000') +
      '</div>' +
      fb('出金先口座', '', 'bank', 'text', '○○銀行 ○○支店 普通 1234567') +
      '<label style="display:flex;gap:9px;align-items:center;margin:10px 0 18px">' +
      '<input type="checkbox" id="rg-agree" style="width:auto">' +
      '本サイトが架空のデモサイトであることを理解し、利用規約に同意します</label>' +
      '<button class="btn btn-main btn-block btn-lg" id="rg-go">この内容で登録する</button>' +
      '</div></div>';

    $('#rg-go').addEventListener('click', function () {
      var form = {};
      ['loginId', 'password', 'passwordConfirm', 'name', 'kana', 'birthday', 'email', 'tel', 'bank']
        .forEach(function (k) { form[k] = $('#rg-' + k).value.trim(); });
      form.agree = $('#rg-agree').checked;
      var res = S.register(form);
      if (!res.ok) {
        $('#reg-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>';
        window.scrollTo(0, 0); return;
      }
      modal('会員登録が完了しました',
        '<div class="msg msg-ok">ご登録ありがとうございます。そのままログインしました。</div>' +
        '<table class="table"><tbody>' + tr('会員番号', res.user.id.toUpperCase()) +
        tr('ユーザーID', esc(res.user.loginId)) + tr('お名前', esc(res.user.name)) +
        tr('購入可能額', '<b>' + yen(res.user.balance) + '</b>') + '</tbody></table>',
        '<button class="btn btn-ghost" data-close="1">閉じる</button>' +
        '<button class="btn btn-main" id="rg-wallet">入金画面へ</button>');
      $('#rg-wallet').addEventListener('click', function () { closeModal(); location.hash = '#/wallet?mode=deposit'; });
      renderHeader();
      toast('会員登録が完了しました');
    });
  }

  function fb(label, req, id, type, ph, val) {
    return '<div class="field-block"><label class="fl">' + label +
      (req ? '<span class="req">' + req + '</span>' : '') + '</label>' +
      '<input type="' + type + '" id="rg-' + id + '"' +
      (ph ? ' placeholder="' + ph + '"' : '') + (val ? ' value="' + val + '"' : '') + '></div>';
  }

  /* ================================================ ヘルプ */

  function viewHelp() {
    view.innerHTML = '<div class="page-title"><h1>ヘルプ・テスト情報</h1></div>' +
      '<div class="card"><h2>このサイトについて</h2><div class="card-body">' +
      '<p>ウマチケはテスト自動化・UI検証のための<b>架空の競馬投票サイト</b>です。実在の競馬場・競走・団体とは関係ありません。</p>' +
      '<p>PC・タブレット・スマートフォンで<b>別々のHTML / CSS / JavaScript</b>を配信しています（レスポンシブではありません）。' +
      '現在の表示は<b>タブレット版</b>（<code>/tablet/index.html</code>）です。</p>' +
      '<div class="grid3" style="margin-top:12px">' +
      '<a class="btn btn-ghost" href="../pc/index.html?device=pc">PC版</a>' +
      '<a class="btn btn-ghost" href="../sp/index.html?device=sp">スマホ版</a>' +
      '<a class="btn btn-ghost" href="../index.html?select=1">端末選択</a></div>' +
      '</div></div>' +
      testUserCard() +
      '<div class="card"><h2>仮想時刻とレースの状態</h2><div class="card-body flush">' +
      '<table class="table"><thead><tr><th style="width:100px">状態</th><th>条件</th><th>できること</th></tr></thead><tbody>' +
      '<tr><td>' + statusBadge('onsale') + '</td><td>発走10分前まで</td><td>投票できます</td></tr>' +
      '<tr><td>' + statusBadge('closed') + '</td><td>発走10分前〜5分後</td><td>投票不可・結果未確定</td></tr>' +
      '<tr><td>' + statusBadge('confirmed') + '</td><td>発走5分後以降</td><td>結果確定・自動精算</td></tr>' +
      '</tbody></table></div></div>' +
      '<div class="card"><h2>式別</h2><div class="card-body flush"><table class="table"><tbody>' +
      D.BET_TYPES.map(function (t) { return tr(t.name, t.desc); }).join('') + '</tbody></table></div></div>' +
      '<div class="card"><h2>入出金ルール</h2><div class="card-body flush"><table class="table"><tbody>' +
      tr('入金額', yen(S.MIN_DEPOSIT) + '〜' + yen(S.MAX_DEPOSIT) + '（100円単位）') +
      tr('出金額', yen(S.MIN_WITHDRAW) + '以上（100円単位）') +
      tr('出金手数料', yen(S.WITHDRAW_FEE) + '／回') +
      tr('馬券購入', '1点 ' + yen(S.MIN_BET_UNIT) + '〜' + yen(S.MAX_BET_UNIT)) +
      '</tbody></table></div></div>' +
      '<div class="card"><h2>データのリセット</h2><div class="card-body">' +
      '<p>会員情報・残高・投票履歴は localStorage（<code>umatiket_state_v1</code>）に保存されます。</p>' +
      '<button class="btn btn-danger btn-block" id="help-reset">デモデータを初期化する</button></div></div>';

    $('#help-reset').addEventListener('click', function () {
      modal('デモデータの初期化', '<p>すべての会員情報・残高・投票履歴を初期状態に戻します。よろしいですか？</p>',
        '<button class="btn btn-ghost" data-close="1">キャンセル</button>' +
        '<button class="btn btn-danger" id="reset-go">初期化する</button>');
      $('#reset-go').addEventListener('click', function () {
        S.resetAll(); closeModal(); location.hash = '#/'; render(); toast('初期化しました');
      });
    });
  }

  /* ------------------------------------------------ 起動 */

  window.addEventListener('hashchange', render);
  render();
})();
