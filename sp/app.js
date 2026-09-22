/* =========================================================
 * sp/app.js —— スマートフォン版アプリケーション
 *   下部タブバー／アコーディオン／全画面ウィザード形式の投票
 * ========================================================= */
(function () {
  'use strict';

  var D = UmaData, B = UmaBet, S = UmaStore;

  // 端末が違えば専用ページへ差し替える
  if (S.enforceDevice('sp')) return;

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

  function sheet(title, body, footer) {
    document.getElementById('sheet-root').innerHTML =
      '<div class="sheet-bg"><div class="sheet"><h3>' + title + '</h3>' +
      '<div class="sb">' + body + '</div>' +
      '<div class="sf">' + (footer || '<button class="btn btn-ghost" data-sclose="1">閉じる</button>') + '</div></div></div>';
    on('#sheet-root [data-sclose]', 'click', closeSheet);
  }
  function closeSheet() { document.getElementById('sheet-root').innerHTML = ''; }

  function statusBadge(st) { return '<span class="badge badge-' + st + '">' + S.STATUS_LABEL[st] + '</span>'; }
  function hnum(n) { return '<span class="hnum">' + n + '</span>'; }
  function kv(k, v) { return '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }

  function deviceLabel(d) {
    return { pc: 'PC版', tablet: 'タブレット版', sp: 'スマートフォン版' }[d] || d;
  }

  /* ------------------------------------------------ ヘッダー */

  function renderHeader() {
    var sel = $('#hd-clock');
    if (!sel.options.length) {
      var h, html = '';
      for (h = 9; h <= 18; h++) html += '<option value="' + h + '">' + ('0' + h).slice(-2) + ':00</option>';
      sel.innerHTML = html;
      sel.addEventListener('change', function () {
        S.setVirtualHour(this.value); render(); toast('仮想時刻 ' + S.nowLabel());
      });
    }
    sel.value = S.virtualHour();

    var u = S.currentUser();
    if (u) {
      $('#hd-balance-box').style.display = '';
      $('#hd-balance').textContent = yen(u.balance);
      $('#hd-user').innerHTML = '';
    } else {
      $('#hd-balance-box').style.display = 'none';
      $('#hd-user').innerHTML = '<button class="sp-hd-btn" id="hd-login">ログイン</button>';
      $('#hd-login').addEventListener('click', function () { location.hash = '#/login'; });
    }
  }

  function markNav(name) {
    $$('#sp-tabbar a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === name); });
  }

  function clearCta() { var c = $('.sp-cta'); if (c) c.remove(); }

  /* ------------------------------------------------ ルーター */

  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var qi = h.indexOf('?'), q = {};
    if (qi >= 0) {
      h.slice(qi + 1).split('&').forEach(function (kvs) {
        var p = kvs.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
      h = h.slice(0, qi);
    }
    return { path: h.split('/').filter(Boolean), query: q };
  }

  function render() {
    S.settle();
    renderHeader();
    clearCta();
    closeSheet();
    var r = parseHash(), p0 = r.path[0] || '';
    window.scrollTo(0, 0);

    switch (p0) {
      case '': markNav('home'); return viewHome();
      case 'race': markNav('home'); return viewRace(Number(r.path[1]), r.query.tab || 'entries');
      case 'history': markNav('history'); return needLogin() || viewHistory();
      case 'wallet': markNav('wallet'); return needLogin() || viewWallet(r.query.mode || 'deposit');
      case 'mypage': markNav('mypage'); return needLogin() || viewMypage();
      case 'login': markNav(''); return viewLogin();
      case 'register': markNav(''); return viewRegister();
      case 'help': markNav('help'); return viewHelp();
      default: view.innerHTML = '<div class="box"><div class="empty">ページが見つかりません。</div></div>';
    }
  }

  function needLogin() {
    if (S.isLoggedIn()) return false;
    view.innerHTML = '<div class="ttl">ログインが必要です</div>' +
      '<div class="box"><div class="box-body">' +
      '<p style="font-size:13px">この機能のご利用にはログインが必要です。</p>' +
      '<a class="btn btn-main" href="#/login" style="margin-bottom:9px">ログイン</a>' +
      '<a class="btn btn-ghost" href="#/register">新規会員登録</a>' +
      '</div></div>';
    return true;
  }

  /* ================================================ ホーム */

  var openVenue = 0;

  function viewHome() {
    var html = '<div class="ttl">本日のレース</div>' +
      '<div class="sub">' + D.RACE_DATE_LABEL + '／現在 ' + S.nowLabel() + '</div>';

    html += D.VENUES.map(function (v) {
      var races = D.venueRaces(v.idx);
      var onsale = races.filter(function (r) { return S.raceStatus(r) === 'onsale'; }).length;
      var open = v.idx === openVenue;
      return '<div class="acc">' +
        '<button class="acc-hd" data-acc="' + v.idx + '">' +
        '<span class="bar" style="background:' + v.color + '"></span>' + v.name +
        '<span class="cnt">発売中 ' + onsale + 'R</span><span class="arw">' + (open ? '▲' : '▼') + '</span></button>' +
        (open ? '<div class="acc-bd">' + races.map(raceRow).join('') + '</div>' : '') +
        '</div>';
    }).join('');

    html += '<div class="box"><h2>重賞・特別レース</h2><div class="box-body flush">' +
      D.featuredRaces().map(raceRow).join('') + '</div></div>';

    view.innerHTML = html;
    on('[data-acc]', 'click', function (b) {
      var i = Number(b.getAttribute('data-acc'));
      openVenue = openVenue === i ? -1 : i;
      viewHome();
    });
  }

  function raceRow(race) {
    var st = S.raceStatus(race);
    return '<a class="race-row" href="#/race/' + race.key + '">' +
      '<span class="rno" style="color:' + race.venueColor + '">' + race.round + 'R</span>' +
      '<span class="mid"><span class="nm">' +
      (race.grade ? '<span class="badge badge-grade">' + race.grade + '</span> ' : '') + esc(race.name) + '</span>' +
      '<span class="mt">' + race.venueName + '　' + race.courseLabel + '　' + race.count + '頭</span></span>' +
      '<span class="rt"><span class="tm">' + race.startTime + '</span><br>' + statusBadge(st) + '</span></a>';
  }

  /* ================================================ レース詳細 */

  function viewRace(key, tab) {
    var race = D.getRace(key);
    if (!race) { view.innerHTML = '<div class="box"><div class="empty">レースが見つかりません。</div></div>'; return; }
    var st = S.raceStatus(race);

    var html = '<div class="race-head">' +
      '<div class="l1"><span class="vt" style="background:' + race.venueColor + '">' + race.venueName + ' ' + race.round + 'R</span>' +
      statusBadge(st) + '<span style="margin-left:auto;font-size:11px;color:#76867e">発走 ' + race.startTime + '</span></div>' +
      '<h1>' + (race.grade ? '<span class="badge badge-grade">' + race.grade + '</span> ' : '') + esc(race.name) + '</h1>' +
      '<div class="mt">' + race.courseLabel + '　' + race.count + '頭立て　現在 ' + S.nowLabel() + '</div></div>';

    html += '<div class="seg">' +
      '<a class="' + (tab === 'entries' ? 'on' : '') + '" href="#/race/' + key + '?tab=entries">出馬表</a>' +
      '<a class="' + (tab === 'odds' ? 'on' : '') + '" href="#/race/' + key + '?tab=odds">オッズ</a>' +
      '<a class="' + (tab === 'result' ? 'on' : '') + '" href="#/race/' + key + '?tab=result">結果</a></div>';

    if (tab === 'odds') { view.innerHTML = html + oddsHtml(race); return; }
    if (tab === 'result') { view.innerHTML = html + resultHtml(race, st); return; }

    var result = st === 'confirmed' ? D.getResult(race.key) : null;
    html += '<div class="box"><h2>出馬表<span style="font-size:11px;color:#76867e">' + race.count + '頭</span></h2>' +
      '<div class="box-body flush">' + race.horses.map(function (h) {
        var pos = result ? result.order.indexOf(h.num) + 1 : 0;
        return '<div class="horse-row">' +
          '<span class="waku w' + h.waku + '">' + h.waku + '</span>' + hnum(h.num) +
          '<span class="info"><span class="nm">' + esc(h.name) +
          (pos && pos <= 3 ? ' <span class="pos-' + pos + '">' + pos + '着</span>' : '') + '</span>' +
          '<span class="sb">' + h.sex + h.age + '／' + esc(h.jockey) + '</span></span>' +
          '<span class="od"><b class="' + (h.odds < 10 ? 'odds-hot' : '') + '">' + h.odds.toFixed(1) + '</b>' +
          '<span>' + h.popularity + '人気</span></span></div>';
      }).join('') + '</div></div>';

    var mine = S.betsFor(race.key);
    if (mine.length) {
      html += '<div class="box"><h2>このレースへの投票（' + mine.length + '件）</h2>' +
        '<div class="box-body">' + mine.map(betItemHtml).join('') + '</div></div>';
    }

    view.innerHTML = html;
    drawCta(race, st);
  }

  function drawCta(race, st) {
    clearCta();
    var cta = document.createElement('div');
    cta.className = 'sp-cta';
    if (st !== 'onsale') {
      cta.innerHTML = '<div class="info">このレースは' + S.STATUS_LABEL[st] + 'です</div>' +
        '<button class="btn btn-ghost" disabled>投票できません</button>';
    } else if (!S.isLoggedIn()) {
      cta.innerHTML = '<a class="btn btn-gold" href="#/login">ログインして投票する</a>';
    } else {
      cta.innerHTML = '<div class="info">購入可能額 ' + yen(S.currentUser().balance) + '</div>' +
        '<button class="btn btn-main" id="cta-bet">このレースに投票する</button>';
    }
    document.body.appendChild(cta);
    var b = $('#cta-bet');
    if (b) b.addEventListener('click', function () { openWizard(race); });
  }

  /* -------------------- オッズ・結果 */

  function oddsHtml(race) {
    var html = '<div class="box"><h2>単勝・複勝</h2><div class="box-body flush">' +
      race.horses.slice().sort(function (a, b) { return a.popularity - b.popularity; }).map(function (h) {
        return '<div class="horse-row">' + hnum(h.num) +
          '<span class="info"><span class="nm">' + esc(h.name) + '</span>' +
          '<span class="sb">' + h.popularity + '番人気</span></span>' +
          '<span class="od"><b class="' + (h.odds < 10 ? 'odds-hot' : '') + '">' + h.odds.toFixed(1) + '</b>' +
          '<span>複 ' + h.fukuOdds.toFixed(1) + '</span></span></div>';
      }).join('') + '</div></div>';

    var nums = race.horses.map(function (h) { return h.num; });
    html += oddsTop('馬連 人気上位20点', B.combinations(nums, 2), 'umaren', race, 20);
    html += oddsTop('三連複 人気上位20点', B.combinations(nums, 3), 'sanrenpuku', race, 20);
    return html;
  }

  function oddsTop(title, combos, typeId, race, limit) {
    var list = combos.map(function (c) { return { c: c, o: B.oddsFor(race, typeId, c) }; })
      .sort(function (a, b) { return a.o - b.o; }).slice(0, limit);
    return '<div class="box"><h2>' + title + '</h2><div class="box-body flush">' +
      list.map(function (x, i) {
        return '<div class="kv"><span class="k">' + (i + 1) + '番人気　<b style="color:#1c2722">' + x.c.join(' - ') + '</b></span>' +
          '<span class="v ' + (x.o < 100 ? 'odds-hot' : '') + '">' + x.o.toFixed(1) + '倍</span></div>';
      }).join('') + '</div></div>';
  }

  function resultHtml(race, st) {
    if (st !== 'confirmed') {
      return '<div class="box"><div class="empty">まだ確定していません。<br>' +
        'ヘッダーの仮想時刻を ' + race.startTime + ' より後にすると結果が表示されます。</div></div>';
    }
    var res = D.getResult(race.key);
    var html = '<div class="box"><h2>着順</h2><div class="box-body flush">' +
      res.order.map(function (n, i) {
        var h = race.horses[n - 1];
        return '<div class="horse-row">' +
          '<span style="width:26px;flex:0 0 26px;text-align:center;font-weight:800" class="' + (i < 3 ? 'pos-' + (i + 1) : '') + '">' + (i + 1) + '</span>' +
          '<span class="waku w' + h.waku + '">' + h.waku + '</span>' + hnum(h.num) +
          '<span class="info"><span class="nm">' + esc(h.name) + '</span>' +
          '<span class="sb">' + esc(h.jockey) + '</span></span>' +
          '<span class="od"><b>' + h.odds.toFixed(1) + '</b><span>単勝</span></span></div>';
      }).join('') + '</div></div>';

    html += '<div class="box"><h2>払戻金（100円あたり）</h2><div class="box-body flush">' +
      B.racePayouts(race.key).map(function (p) {
        return kv(p.type + '　<b style="color:#1c2722">' + p.label + '</b>', yen(p.payout));
      }).join('') + '</div></div>';

    var mine = S.betsFor(race.key);
    if (mine.length) {
      html += '<div class="box"><h2>あなたの投票結果</h2><div class="box-body">' +
        mine.map(betItemHtml).join('') + '</div></div>';
    }
    return html;
  }

  /* ================================================ 投票ウィザード */

  var wiz = null;

  function openWizard(race) {
    wiz = {
      race: race, step: 1, typeId: 'tan', methodId: 'normal',
      picks: [], axis: [], amount: 100, pickMode: 'pick'
    };
    drawWizard();
  }
  function closeWizard() { wiz = null; document.getElementById('wiz-root').innerHTML = ''; }

  function wizCombos() {
    return B.buildCombos(wiz.typeId, wiz.methodId, { picks: wiz.picks, axis: wiz.axis });
  }

  var STEP_NAMES = ['式別を選ぶ', '馬を選ぶ', '金額を決める', '内容を確認'];

  function drawWizard() {
    if (!wiz) return;
    var race = wiz.race, t = D.betType(wiz.typeId);
    var combos = wizCombos(), total = combos.length * wiz.amount;
    var u = S.currentUser();

    var body = '';
    if (wiz.step === 1) body = wizStep1(t);
    else if (wiz.step === 2) body = wizStep2(race, t);
    else if (wiz.step === 3) body = wizStep3(race, combos);
    else body = wizStep4(race, t, combos, total, u);

    var next = '';
    if (wiz.step < 4) {
      var disabled = (wiz.step === 2 && !combos.length) ? ' disabled' : '';
      next = '<button class="btn btn-main" id="wz-next"' + disabled + '>次へ進む</button>';
    } else {
      next = '<button class="btn btn-gold" id="wz-buy">この内容で購入する</button>';
    }

    document.getElementById('wiz-root').innerHTML =
      '<div class="wiz"><div class="wiz-hd">' +
      '<button class="x" id="wz-close">×</button>' +
      '<span class="t">' + race.venueName + race.round + 'R 投票</span>' +
      '<span class="st">発走 ' + race.startTime + '</span></div>' +
      '<div class="wiz-steps">' + STEP_NAMES.map(function (n, i) {
        return '<div class="' + (wiz.step === i + 1 ? 'on' : '') + '">' + (i + 1) + '. ' + n + '</div>';
      }).join('') + '</div>' +
      '<div class="wiz-bd">' + body + '</div>' +
      '<div class="wiz-ft">' +
      '<div class="sum"><span>' + t.name + '　' + combos.length + '点 × ' + yen(wiz.amount) + '</span><b>' + yen(total) + '</b></div>' +
      '<div class="btn-row">' +
      (wiz.step > 1 ? '<button class="btn btn-ghost" id="wz-prev">戻る</button>' : '') +
      next + '</div></div></div>';

    bindWizard();
  }

  function wizStep1(t) {
    var html = '<label class="fl">式別を選択してください</label><div class="chips">' +
      D.BET_TYPES.map(function (x) {
        return '<button class="chip ' + (x.id === wiz.typeId ? 'on' : '') + '" data-type="' + x.id + '">' + x.name + '</button>';
      }).join('') + '</div>' +
      '<div class="msg msg-info" style="margin-top:12px">' + t.name + '：' + t.desc + '</div>';

    if (t.size > 1) {
      html += '<label class="fl" style="margin-top:6px">買い方</label><div class="chips">' +
        D.BET_METHODS.map(function (m) {
          return '<button class="chip ' + (m.id === wiz.methodId ? 'on' : '') + '" data-method="' + m.id + '">' + m.name + '</button>';
        }).join('') + '</div>' +
        '<div class="hint">' + (D.BET_METHODS.filter(function (m) { return m.id === wiz.methodId; })[0] || {}).desc +
        (wiz.methodId === 'normal' && t.ordered ? '（選んだ順が着順になります）' : '') + '</div>';
    }
    return html;
  }

  function wizStep2(race, t) {
    var nagashi = wiz.methodId === 'nagashi' && t.size > 1;
    var html = '';

    if (nagashi) {
      html += '<div class="seg" id="wz-mode">' +
        '<button class="' + (wiz.pickMode === 'axis' ? 'on' : '') + '" data-mode="axis">軸を選ぶ（' + wiz.axis.length + '）</button>' +
        '<button class="' + (wiz.pickMode === 'pick' ? 'on' : '') + '" data-mode="pick">相手を選ぶ（' + wiz.picks.length + '）</button>' +
        '</div>';
    } else {
      html += '<label class="fl">馬を選択してください' +
        (wiz.methodId === 'normal' ? '（' + t.size + '頭）' : '（' + t.size + '頭以上）') + '</label>';
    }

    html += '<div class="num-grid">' + race.horses.map(function (h) {
      var picked = wiz.picks.indexOf(h.num) >= 0;
      var isAxis = wiz.axis.indexOf(h.num) >= 0;
      var ord = t.ordered && wiz.methodId === 'normal' && picked ? wiz.picks.indexOf(h.num) + 1 : 0;
      return '<button class="num-btn ' + (isAxis ? 'axis' : picked ? 'on' : '') + '" data-num="' + h.num + '">' +
        (ord ? '<span class="ord">' + ord + '着</span>' : '') +
        h.num + '<small>' + h.odds.toFixed(1) + '</small></button>';
    }).join('') + '</div>';

    html += '<div class="box" style="margin-top:13px"><h2>選択中</h2><div class="box-body">' +
      (wiz.axis.length ? '<div style="font-size:12.5px;margin-bottom:6px">軸：' + wiz.axis.map(hnum).join(' ') + '</div>' : '') +
      (wiz.picks.length ? '<div style="font-size:12.5px">' + (nagashi ? '相手：' : '') + wiz.picks.map(hnum).join(' ') + '</div>'
        : '<div style="font-size:12.5px;color:#76867e">まだ選択されていません</div>') +
      '<button class="btn btn-ghost btn-sm" id="wz-clear" style="margin-top:10px">選択をクリア</button>' +
      '</div></div>';

    html += '<div class="box"><h2>馬名一覧</h2><div class="box-body flush">' +
      race.horses.map(function (h) {
        return '<div class="kv"><span class="k">' + hnum(h.num) + ' ' + esc(h.name) + '</span>' +
          '<span class="v">' + h.odds.toFixed(1) + '</span></div>';
      }).join('') + '</div></div>';
    return html;
  }

  function wizStep3(race, combos) {
    return '<label class="fl">1点あたりの金額</label>' +
      '<div class="chips" style="margin-bottom:10px">' +
      [100, 500, 1000, 5000, 10000].map(function (a) {
        return '<button class="chip ' + (a === wiz.amount ? 'on' : '') + '" data-amount="' + a + '">' + B.num(a) + '円</button>';
      }).join('') + '</div>' +
      '<input type="number" id="wz-amount" value="' + wiz.amount + '" min="100" step="100">' +
      '<div class="hint">100円単位／1点あたり ' + yen(S.MIN_BET_UNIT) + '〜' + yen(S.MAX_BET_UNIT) + '</div>' +
      '<div class="box" style="margin-top:14px"><h2>買い目（' + combos.length + '点）</h2><div class="box-body">' +
      '<div class="combo-box">' + combos.map(function (c) {
        return '<span>' + B.comboLabel(wiz.typeId, c) + '<b style="margin-left:6px;color:#76867e">' +
          B.oddsFor(race, wiz.typeId, c).toFixed(1) + '</b></span>';
      }).join('') + '</div></div></div>';
  }

  function wizStep4(race, t, combos, total, u) {
    return '<div class="box"><h2>購入内容</h2><div class="box-body flush">' +
      kv('レース', race.label) +
      kv('レース名', esc(race.name)) +
      kv('発走時刻', race.startTime) +
      kv('式別', t.name) +
      kv('買い方', (D.BET_METHODS.filter(function (m) { return m.id === wiz.methodId; })[0] || {}).name) +
      kv('点数', combos.length + ' 点') +
      kv('1点あたり', yen(wiz.amount)) +
      kv('合計金額', '<span style="color:#cc3b2c;font-size:17px">' + yen(total) + '</span>') +
      kv('購入前残高', yen(u.balance)) +
      kv('購入後残高', yen(u.balance - total)) +
      '</div></div>' +
      '<div class="box"><h2>買い目</h2><div class="box-body">' +
      '<div class="combo-box">' + combos.map(function (c) {
        return '<span>' + B.comboLabel(wiz.typeId, c) + '</span>';
      }).join('') + '</div></div></div>' +
      '<div class="msg msg-info">購入後の取り消しはできません。内容をご確認ください。</div>';
  }

  function bindWizard() {
    var race = wiz.race;
    $('#wz-close').addEventListener('click', closeWizard);

    on('#wiz-root [data-type]', 'click', function (b) {
      wiz.typeId = b.getAttribute('data-type');
      var t = D.betType(wiz.typeId);
      if (t.size === 1) wiz.methodId = 'normal';
      if (wiz.methodId === 'normal' && wiz.picks.length > t.size) wiz.picks = wiz.picks.slice(0, t.size);
      wiz.axis = [];
      drawWizard();
    });
    on('#wiz-root [data-method]', 'click', function (b) {
      wiz.methodId = b.getAttribute('data-method');
      wiz.axis = [];
      wiz.pickMode = wiz.methodId === 'nagashi' ? 'axis' : 'pick';
      var t = D.betType(wiz.typeId);
      if (wiz.methodId === 'normal' && wiz.picks.length > t.size) wiz.picks = wiz.picks.slice(0, t.size);
      drawWizard();
    });
    on('#wiz-root [data-mode]', 'click', function (b) {
      wiz.pickMode = b.getAttribute('data-mode'); drawWizard();
    });
    on('#wiz-root [data-num]', 'click', function (b) {
      togglePick(Number(b.getAttribute('data-num')));
    });
    on('#wiz-root [data-amount]', 'click', function (b) {
      wiz.amount = Number(b.getAttribute('data-amount')); drawWizard();
    });
    var amt = $('#wz-amount');
    if (amt) amt.addEventListener('change', function () {
      wiz.amount = Math.max(100, Number(this.value) || 100); drawWizard();
    });
    var clr = $('#wz-clear');
    if (clr) clr.addEventListener('click', function () { wiz.picks = []; wiz.axis = []; drawWizard(); });

    var prev = $('#wz-prev');
    if (prev) prev.addEventListener('click', function () { wiz.step--; drawWizard(); });
    var next = $('#wz-next');
    if (next) next.addEventListener('click', function () {
      if (wiz.step === 2 && !wizCombos().length) { toast('買い目が確定していません', true); return; }
      wiz.step++; drawWizard();
    });

    var buy = $('#wz-buy');
    if (buy) buy.addEventListener('click', function () {
      var combos = wizCombos();
      var res = S.placeBet(race.key, wiz.typeId, wiz.methodId, combos, wiz.amount);
      if (!res.ok) { toast(res.error, true); return; }
      closeWizard();
      renderHeader();
      sheet('購入が完了しました',
        '<div class="msg msg-ok">馬券の購入が完了しました。</div>' +
        '<div class="box" style="margin:0"><div class="box-body flush">' +
        kv('受付番号', '<span style="font-family:monospace;font-size:11px">' + res.bet.id + '</span>') +
        kv('レース', race.label) +
        kv('式別', res.bet.typeName + '（' + res.bet.methodName + '）') +
        kv('点数 / 合計', res.bet.combos.length + '点 / ' + yen(res.bet.total)) +
        kv('購入後残高', yen(res.balance)) +
        '</div></div>',
        '<a class="btn btn-main" href="#/history" style="margin-bottom:9px">投票履歴を見る</a>' +
        '<button class="btn btn-ghost" data-sclose="1">閉じる</button>');
      viewRace(race.key, 'entries');
      toast('馬券を購入しました');
    });
  }

  function togglePick(n) {
    var t = D.betType(wiz.typeId);
    var nagashi = wiz.methodId === 'nagashi' && t.size > 1;

    if (nagashi && wiz.pickMode === 'axis') {
      var ai = wiz.axis.indexOf(n);
      if (ai >= 0) wiz.axis.splice(ai, 1);
      else {
        if (wiz.axis.length >= t.size - 1) wiz.axis.shift();
        wiz.axis.push(n);
        wiz.picks = wiz.picks.filter(function (x) { return x !== n; });
      }
    } else {
      var pi = wiz.picks.indexOf(n);
      if (pi >= 0) wiz.picks.splice(pi, 1);
      else {
        if (wiz.methodId === 'normal' && wiz.picks.length >= t.size) wiz.picks.shift();
        wiz.picks.push(n);
        wiz.axis = wiz.axis.filter(function (x) { return x !== n; });
      }
    }
    drawWizard();
  }

  /* ================================================ 投票履歴 */

  function viewHistory() {
    var u = S.currentUser(), sm = S.summary();
    view.innerHTML = '<div class="ttl">投票履歴</div>' +
      '<div class="sub">' + esc(u.name) + ' 様</div>' +
      '<div class="stat2">' +
      stat('購入件数', sm.count + ' 件') + stat('的中率', sm.hitRate + ' %') +
      stat('購入金額', yen(sm.total)) + stat('払戻金額', yen(sm.payout)) +
      '</div>' +
      '<div class="box" style="margin-bottom:12px"><div class="box-body flush">' +
      kv('収支', '<span class="' + (sm.profit >= 0 ? 'pos-3' : 'pos-1') + '">' +
        (sm.profit >= 0 ? '+' : '−') + yen(Math.abs(sm.profit)) + '</span>') + '</div></div>' +
      '<div class="seg" id="hist-seg">' +
      ['all|すべて', 'pending|未確定', 'hit|的中', 'lose|不的中'].map(function (x, i) {
        var p = x.split('|');
        return '<button class="' + (i === 0 ? 'on' : '') + '" data-f="' + p[0] + '">' + p[1] + '</button>';
      }).join('') + '</div><div id="hist-body"></div>';

    function draw(f) {
      var list = u.bets.filter(function (b) { return f === 'all' || b.status === f; });
      $('#hist-body').innerHTML = list.length ? list.map(betItemHtml).join('')
        : '<div class="box"><div class="empty">該当する投票履歴がありません。</div></div>';
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
      '<a href="#/race/' + b.raceKey + '?tab=result"><b>' + b.raceLabel + '</b></a>' +
      '<span style="font-size:11.5px;color:#76867e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
      esc(b.raceName) + '</span></div><div class="bd">' +
      '<div class="row"><span><b>' + b.typeName + '</b>　' + b.methodName + '</span><span>' + b.combos.length + '点</span></div>' +
      '<div class="combo-box" style="margin:7px 0;max-height:120px">' + b.combos.map(function (c) {
        return '<span class="' + (hitKeys[c.join('-')] ? 'hit' : '') + '">' + B.comboLabel(b.typeId, c) + '</span>';
      }).join('') + '</div>' +
      '<div class="row"><span>購入金額</span><b>' + yen(b.total) + '</b></div>' +
      '<div class="row"><span>払戻金</span><span class="' + (b.payout ? 'pay' : '') + '">' + yen(b.payout) + '</span></div>' +
      '<div class="row" style="font-size:10.5px;color:#76867e"><span>' + b.id + '</span><span>' + b.createdAt + '</span></div>' +
      '</div></div>';
  }

  /* ================================================ 入出金 */

  function viewWallet(mode) {
    var u = S.currentUser();
    var html = '<div class="ttl">入出金</div>' +
      '<div class="bal-card"><div class="k">ご購入可能額</div><div class="v">' + yen(u.balance) + '</div>' +
      '<div class="s">登録口座：' + esc(u.bank) + '</div></div>' +
      '<div class="seg">' +
      '<a class="' + (mode === 'deposit' ? 'on' : '') + '" href="#/wallet?mode=deposit">入金</a>' +
      '<a class="' + (mode === 'withdraw' ? 'on' : '') + '" href="#/wallet?mode=withdraw">出金</a></div>' +
      '<div class="box"><div class="box-body" id="wallet-form"></div></div>' +
      '<div class="box"><h2>入出金・購入履歴</h2><div class="box-body flush" id="txn-list">' +
      (u.txns.length ? u.txns.map(function (t) {
        return '<div style="padding:10px 13px;border-bottom:1px solid #f0f4f2">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
          '<b style="font-size:13px">' + t.label + '</b>' +
          '<b style="color:' + (t.amount >= 0 ? '#17935f' : '#cc3b2c') + ';font-size:15px">' +
          (t.amount >= 0 ? '+' : '−') + yen(Math.abs(t.amount)) + '</b></div>' +
          '<div style="font-size:10.5px;color:#76867e">' + t.createdAt + '　' + esc(t.method || '') +
          (t.fee ? '（手数料' + yen(t.fee) + '）' : '') + '</div>' +
          '<div style="font-size:11px;color:#76867e">残高 ' + yen(t.balanceAfter) + '</div></div>';
      }).join('') : '<div class="empty">入出金履歴はまだありません。</div>') +
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
      '<label class="fl" style="margin-top:14px">入金額</label>' +
      '<div class="chips" style="margin-bottom:9px">' +
      [1000, 5000, 10000, 30000, 50000].map(function (a) {
        return '<button class="chip" data-dep="' + a + '">' + B.num(a) + '円</button>';
      }).join('') + '</div>' +
      '<input type="number" id="dep-amount" value="10000" step="100" min="1000" max="500000">' +
      '<div class="hint">100円単位／1回 ' + yen(S.MIN_DEPOSIT) + '〜' + yen(S.MAX_DEPOSIT) + '</div>' +
      '<button class="btn btn-main" id="dep-go" style="margin-top:14px">入金する</button>';

    on('#dep-methods .chip', 'click', function (b) {
      $$('#dep-methods .chip').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
    });
    on('[data-dep]', 'click', function (b) { $('#dep-amount').value = b.getAttribute('data-dep'); });
    $('#dep-go').addEventListener('click', function () {
      var res = S.deposit($('#dep-amount').value, $('#dep-methods .chip.on').getAttribute('data-m'));
      if (!res.ok) { $('#wallet-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>'; return; }
      sheet('入金が完了しました',
        '<div class="msg msg-ok">' + yen(res.amount) + ' を入金しました。</div>' +
        '<div class="box" style="margin:0"><div class="box-body flush">' +
        kv('入金方法', res.method) + kv('入金額', yen(res.amount)) +
        kv('購入可能額', yen(res.balance)) + '</div></div>',
        '<button class="btn btn-main" data-sclose="1">閉じる</button>');
      toast('入金が完了しました');
      render();
    });
  }

  function drawWithdraw() {
    var u = S.currentUser();
    $('#wallet-form').innerHTML = '<div id="wallet-msg"></div>' +
      '<label class="fl">出金先口座</label>' +
      '<div style="font-size:13px;margin-bottom:13px">' + esc(u.bank) + '</div>' +
      '<label class="fl">出金額</label>' +
      '<div class="chips" style="margin-bottom:9px">' +
      [1000, 5000, 10000, 50000].map(function (a) {
        return '<button class="chip" data-wd="' + a + '">' + B.num(a) + '円</button>';
      }).join('') + '<button class="chip" data-wd="all">全額</button></div>' +
      '<input type="number" id="wd-amount" value="1000" step="100" min="1000">' +
      '<div class="hint">100円単位／出金手数料 ' + yen(S.WITHDRAW_FEE) + ' が別途かかります。</div>' +
      '<button class="btn btn-main" id="wd-go" style="margin-top:14px">出金する</button>';

    on('[data-wd]', 'click', function (b) {
      var v = b.getAttribute('data-wd');
      $('#wd-amount').value = v === 'all'
        ? Math.max(0, Math.floor((u.balance - S.WITHDRAW_FEE) / 100) * 100) : v;
    });
    $('#wd-go').addEventListener('click', function () {
      var res = S.withdraw($('#wd-amount').value);
      if (!res.ok) { $('#wallet-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>'; return; }
      sheet('出金手続きが完了しました',
        '<div class="msg msg-ok">' + yen(res.amount) + ' の出金手続きを受け付けました。</div>' +
        '<div class="box" style="margin:0"><div class="box-body flush">' +
        kv('出金額', yen(res.amount)) + kv('手数料', yen(res.fee)) +
        kv('購入可能額', yen(res.balance)) + '</div></div>',
        '<button class="btn btn-main" data-sclose="1">閉じる</button>');
      toast('出金手続きが完了しました');
      render();
    });
  }

  /* ================================================ マイページ */

  function viewMypage() {
    var u = S.currentUser(), sm = S.summary();
    view.innerHTML = '<div class="ttl">マイページ</div>' +
      '<div class="bal-card"><div class="k">ご購入可能額</div><div class="v">' + yen(u.balance) + '</div>' +
      '<div class="s">' + esc(u.name) + ' 様（' + u.id.toUpperCase() + '）</div></div>' +
      '<div class="btn-row" style="margin-bottom:12px">' +
      '<a class="btn btn-main" href="#/wallet?mode=deposit">入金</a>' +
      '<a class="btn btn-ghost" href="#/wallet?mode=withdraw">出金</a></div>' +
      '<div class="stat2">' +
      stat('購入件数', sm.count + ' 件') + stat('的中率', sm.hitRate + ' %') +
      stat('購入金額', yen(sm.total)) + stat('払戻金額', yen(sm.payout)) + '</div>' +
      '<div class="box"><h2>会員情報</h2><div class="box-body flush">' +
      kv('ユーザーID', esc(u.loginId)) + kv('お名前', esc(u.name)) + kv('フリガナ', esc(u.kana)) +
      kv('生年月日', u.birthday) + kv('メール', '<span style="font-size:11px">' + esc(u.email) + '</span>') +
      kv('電話番号', esc(u.tel)) + kv('登録口座', '<span style="font-size:11px">' + esc(u.bank) + '</span>') +
      kv('区分', u.registered ? '新規登録' : 'テストユーザー') +
      '</div></div>' +
      '<div class="box"><h2>最近の投票<a href="#/history">すべて見る</a></h2><div class="box-body">' +
      (u.bets.length ? u.bets.slice(0, 2).map(betItemHtml).join('')
        : '<div class="empty">まだ投票がありません。</div>') + '</div></div>' +
      '<button class="btn btn-danger" id="mp-logout">ログアウト</button>';

    $('#mp-logout').addEventListener('click', function () {
      S.logout(); location.hash = '#/'; render(); toast('ログアウトしました');
    });
  }

  /* ================================================ ログイン */

  function viewLogin() {
    if (S.isLoggedIn()) { location.hash = '#/mypage'; return; }
    view.innerHTML = '<div class="ttl">ログイン</div>' +
      '<div class="box"><div class="box-body">' +
      '<div id="login-msg"></div>' +
      '<div class="field"><label class="fl">ユーザーID<span class="req">必須</span></label>' +
      '<input type="text" id="lg-id" placeholder="user01"></div>' +
      '<div class="field"><label class="fl">パスワード<span class="req">必須</span></label>' +
      '<input type="password" id="lg-pw" placeholder="test1234"></div>' +
      '<button class="btn btn-main" id="lg-go">ログイン</button>' +
      '<div style="text-align:center;margin-top:12px;font-size:12.5px">' +
      'はじめての方は <a href="#/register">新規会員登録</a></div></div></div>' +
      testUserBox();

    $('#lg-go').addEventListener('click', doLogin);
    on('[data-fill]', 'click', function (b) {
      $('#lg-id').value = b.getAttribute('data-fill'); $('#lg-pw').value = 'test1234';
      toast(b.getAttribute('data-fill') + ' を入力しました');
    });

    function doLogin() {
      var res = S.login($('#lg-id').value.trim(), $('#lg-pw').value);
      if (!res.ok) { $('#login-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>'; return; }
      toast('ようこそ ' + res.user.name + ' 様');
      location.hash = '#/'; render();
    }
  }

  function testUserBox() {
    return '<div class="box"><h2>テストアカウント<span style="font-size:10.5px;color:#76867e">PW共通 test1234</span></h2>' +
      '<div class="box-body flush">' + D.TEST_USERS.map(function (u) {
        return '<div style="display:flex;align-items:center;gap:9px;padding:10px 13px;border-bottom:1px solid #f0f4f2">' +
          '<div style="flex:1;min-width:0"><b style="font-size:13px">' + u.loginId + '</b>' +
          '<div style="font-size:11px;color:#76867e">' + esc(u.name) + '／' + yen(u.balance) + '</div>' +
          '<div style="font-size:10px;color:#76867e">' + esc(u.memo) + '</div></div>' +
          '<button class="btn btn-ghost btn-sm" data-fill="' + u.loginId + '">入力</button></div>';
      }).join('') + '</div></div>';
  }

  /* ================================================ 会員登録 */

  function viewRegister() {
    view.innerHTML = '<div class="ttl">新規会員登録</div>' +
      '<div class="sub">デモサイトです。実在の個人情報は入力しないでください</div>' +
      '<div class="box"><div class="box-body"><div id="reg-msg"></div>' +
      f('ユーザーID', '必須', 'loginId', 'text', '半角英数字4〜20文字') +
      f('パスワード', '必須', 'password', 'password', '8文字以上') +
      f('パスワード（確認）', '必須', 'passwordConfirm', 'password') +
      f('お名前', '必須', 'name', 'text', '競馬 太郎') +
      f('フリガナ', '必須', 'kana', 'text', 'ケイバ タロウ') +
      f('生年月日', '必須', 'birthday', 'date', '', '1990-01-01') +
      f('メールアドレス', '必須', 'email', 'email', 'taro@example.test') +
      f('電話番号', '必須', 'tel', 'tel', '090-0000-0000') +
      f('出金先口座', '', 'bank', 'text', '○○銀行 ○○支店 普通 1234567') +
      '<label style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;margin:4px 0 14px">' +
      '<input type="checkbox" id="rg-agree" style="width:auto;margin-top:3px">' +
      '<span>本サイトが架空のデモサイトであることを理解し、利用規約に同意します</span></label>' +
      '<button class="btn btn-main" id="rg-go">この内容で登録する</button>' +
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
      renderHeader();
      sheet('会員登録が完了しました',
        '<div class="msg msg-ok">ご登録ありがとうございます。そのままログインしました。</div>' +
        '<div class="box" style="margin:0"><div class="box-body flush">' +
        kv('会員番号', res.user.id.toUpperCase()) + kv('ユーザーID', esc(res.user.loginId)) +
        kv('お名前', esc(res.user.name)) + kv('購入可能額', yen(res.user.balance)) +
        '</div></div>',
        '<a class="btn btn-main" href="#/wallet?mode=deposit" style="margin-bottom:9px">入金する</a>' +
        '<button class="btn btn-ghost" data-sclose="1">閉じる</button>');
      toast('会員登録が完了しました');
    });
  }

  function f(label, req, id, type, ph, val) {
    return '<div class="field"><label class="fl">' + label +
      (req ? '<span class="req">' + req + '</span>' : '') + '</label>' +
      '<input type="' + type + '" id="rg-' + id + '"' +
      (ph ? ' placeholder="' + ph + '"' : '') + (val ? ' value="' + val + '"' : '') + '></div>';
  }

  /* ================================================ ヘルプ */

  function viewHelp() {
    view.innerHTML = '<div class="ttl">ヘルプ・テスト情報</div>' +
      '<div class="box"><h2>このサイトについて</h2><div class="box-body" style="font-size:12.5px">' +
      '<p>ウマチケはテスト自動化・UI検証のための<b>架空の競馬投票サイト</b>です。実在の競馬場・競走・団体とは関係ありません。</p>' +
      '<p>PC・タブレット・スマートフォンで<b>別々のHTML / CSS / JavaScript</b>を配信しています（レスポンシブではありません）。' +
      '現在の表示は<b>スマホ版</b>（<code>/sp/index.html</code>）です。</p>' +
      '</div><div class="box-body flush">' +
      kv('自動判定結果', deviceLabel(S.naturalDevice())) +
      kv('表示の固定', S.getDeviceOverride() ? deviceLabel(S.getDeviceOverride()) + 'に固定中' : 'なし（自動判定）') +
      '</div><div class="box-body" style="padding-top:0">' +
      '<div style="font-size:10.5px;color:#76867e;word-break:break-all;margin-bottom:10px">UA: ' + esc(navigator.userAgent) + '</div>' +
      '<p style="font-size:12.5px">端末専用ページのURLを直接開いた場合も、判定結果と違えば自動的に正しいページへ移動します。</p>' +
      '<a class="btn btn-ghost" href="../pc/index.html?device=pc" style="margin-bottom:8px">PC版を開く</a>' +
      '<a class="btn btn-ghost" href="../tablet/index.html?device=tablet" style="margin-bottom:8px">タブレット版を開く</a>' +
      '<a class="btn btn-ghost" href="../index.html?select=1">端末選択画面</a>' +
      '</div></div>' +
      testUserBox() +
      '<div class="box"><h2>仮想時刻とレースの状態</h2><div class="box-body flush">' +
      kv('発売中', '発走10分前まで（投票可）') +
      kv('締切', '発走10分前〜5分後') +
      kv('確定', '発走5分後以降（自動精算）') +
      '</div><div class="box-body" style="font-size:11.5px;color:#76867e;padding-top:0">' +
      'ヘッダーのプルダウンで 9:00〜18:00 を切り替えられます。発走は1R 10:00から30分間隔です。' +
      '</div></div>' +
      '<div class="box"><h2>式別</h2><div class="box-body flush">' +
      D.BET_TYPES.map(function (t) {
        return '<div style="padding:9px 13px;border-bottom:1px solid #f0f4f2">' +
          '<b style="font-size:13px">' + t.name + '</b>' +
          '<div style="font-size:11.5px;color:#76867e">' + t.desc + '</div></div>';
      }).join('') + '</div></div>' +
      '<div class="box"><h2>入出金ルール</h2><div class="box-body flush">' +
      kv('入金額', yen(S.MIN_DEPOSIT) + '〜' + yen(S.MAX_DEPOSIT)) +
      kv('出金額', yen(S.MIN_WITHDRAW) + '以上') +
      kv('出金手数料', yen(S.WITHDRAW_FEE) + '／回') +
      kv('馬券購入', '1点 ' + yen(S.MIN_BET_UNIT) + '〜' + yen(S.MAX_BET_UNIT)) +
      '</div></div>' +
      '<div class="box"><h2>データのリセット</h2><div class="box-body">' +
      '<p style="font-size:12.5px">会員情報・残高・投票履歴は localStorage（<code>umatiket_state_v1</code>）に保存されます。</p>' +
      '<button class="btn btn-danger" id="help-reset">デモデータを初期化する</button></div></div>';

    $('#help-reset').addEventListener('click', function () {
      sheet('デモデータの初期化',
        '<p style="font-size:13px">すべての会員情報・残高・投票履歴を初期状態に戻します。よろしいですか？</p>',
        '<button class="btn btn-danger" id="reset-go" style="margin-bottom:9px">初期化する</button>' +
        '<button class="btn btn-ghost" data-sclose="1">キャンセル</button>');
      $('#reset-go').addEventListener('click', function () {
        S.resetAll(); closeSheet(); location.hash = '#/'; render(); toast('初期化しました');
      });
    });
  }

  /* ------------------------------------------------ 起動 */

  window.addEventListener('hashchange', function () {
    if (wiz) closeWizard();
    render();
  });
  render();
})();
