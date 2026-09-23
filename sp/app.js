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

  // マイページの会員情報行（テストから一意に特定できるようクラスを付ける）
  function mrow(key, k, v) {
    return '<div class="kv uma-mypage-row uma-mypage-' + key + '" data-field="' + key + '">' +
      '<span class="k uma-mypage-label">' + k + '</span>' +
      '<span class="v uma-mypage-value uma-mypage-' + key + '-value">' + v + '</span></div>';
  }

  function deviceLabel(d) {
    return { pc: 'PC版', tablet: 'タブレット版', sp: 'スマートフォン版' }[d] || d;
  }

  // ログインIDからテストユーザーのパスワードを引く
  function testUserPassword(loginId) {
    var u = D.TEST_USERS.filter(function (x) { return x.loginId === loginId; })[0];
    return u ? u.password : '';
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
      $('#hd-user').innerHTML = '<span class="uma-user-name" hidden>' + esc(u.name) + '</span>';
    } else {
      $('#hd-balance-box').style.display = 'none';
      $('#hd-user').innerHTML = '<button class="sp-hd-btn uma-login-nav" id="hd-login">ログイン</button>';
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
      case 'disclaimer': markNav('help'); return viewDisclaimer();
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
    return '<a class="race-row uma-race-link" href="#/race/' + race.key +
      '" data-race-key="' + race.key + '" data-status="' + st + '">' +
      '<span class="rno uma-race-round" style="color:' + race.venueColor + '">' + race.round + 'R</span>' +
      '<span class="mid"><span class="nm uma-race-name">' +
      (race.grade ? '<span class="badge badge-grade uma-race-grade">' + race.grade + '</span> ' : '') +
      esc(race.name) + '</span>' +
      '<span class="mt"><span class="uma-race-venue">' + race.venueName + '</span>　' +
      '<span class="uma-race-course">' + race.courseLabel + '</span>　' +
      '<span class="uma-race-count">' + race.count + '頭</span></span></span>' +
      '<span class="rt"><span class="tm uma-race-start">' + race.startTime + '</span><br>' +
      '<span class="uma-race-status">' + statusBadge(st) + '</span></span></a>';
  }

  /* ================================================ レース詳細 */

  function viewRace(key, tab) {
    var race = D.getRace(key);
    if (!race) { view.innerHTML = '<div class="box"><div class="empty">レースが見つかりません。</div></div>'; return; }
    var st = S.raceStatus(race);

    var html = '<div class="race-head uma-race-head" data-race-key="' + race.key + '">' +
      '<div class="l1"><span class="vt uma-race-venue" style="background:' + race.venueColor + '">' +
      race.venueName + ' <span class="uma-race-round">' + race.round + 'R</span></span>' +
      '<span class="uma-race-status">' + statusBadge(st) + '</span>' +
      '<span style="margin-left:auto;font-size:11px;color:#76867e">発走 ' +
      '<span class="uma-race-start">' + race.startTime + '</span></span></div>' +
      '<h1 class="uma-race-name">' +
      (race.grade ? '<span class="badge badge-grade uma-race-grade">' + race.grade + '</span> ' : '') + esc(race.name) + '</h1>' +
      '<div class="mt"><span class="uma-race-course">' + race.courseLabel + '</span>　' +
      '<span class="uma-race-count">' + race.count + '頭立て</span>　現在 ' + S.nowLabel() + '</div></div>';

    html += '<div class="seg uma-race-tabs">' +
      '<a class="uma-race-tab uma-tab-entries ' + (tab === 'entries' ? 'on' : '') + '" data-tab="entries" href="#/race/' + key + '?tab=entries">出馬表</a>' +
      '<a class="uma-race-tab uma-tab-odds ' + (tab === 'odds' ? 'on' : '') + '" data-tab="odds" href="#/race/' + key + '?tab=odds">オッズ</a>' +
      '<a class="uma-race-tab uma-tab-result ' + (tab === 'result' ? 'on' : '') + '" data-tab="result" href="#/race/' + key + '?tab=result">結果</a></div>';

    if (tab === 'odds') { view.innerHTML = html + oddsHtml(race); return; }
    if (tab === 'result') { view.innerHTML = html + resultHtml(race, st); return; }

    var result = st === 'confirmed' ? D.getResult(race.key) : null;
    html += '<div class="box"><h2>出馬表<span style="font-size:11px;color:#76867e">' + race.count + '頭</span></h2>' +
      '<div class="box-body flush uma-entry-list">' + race.horses.map(function (h) {
        var pos = result ? result.order.indexOf(h.num) + 1 : 0;
        return '<div class="horse-row uma-entry-row" data-horse="' + h.num + '">' +
          '<span class="waku uma-entry-waku w' + h.waku + '">' + h.waku + '</span>' +
          '<span class="hnum uma-entry-num">' + h.num + '</span>' +
          '<span class="info"><span class="nm"><span class="uma-entry-name">' + esc(h.name) + '</span>' +
          (pos && pos <= 3 ? ' <span class="uma-entry-rank pos-' + pos + '">' + pos + '着</span>' : '') + '</span>' +
          '<span class="sb"><span class="uma-entry-sexage">' + h.sex + h.age + '</span>／' +
          '<span class="uma-entry-jockey">' + esc(h.jockey) + '</span></span></span>' +
          '<span class="od"><b class="uma-entry-odds ' + (h.odds < 10 ? 'odds-hot' : '') + '">' + h.odds.toFixed(1) + '</b>' +
          '<span class="uma-entry-pop">' + h.popularity + '人気</span></span></div>';
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
    cta.className = 'sp-cta uma-bet-cta';
    if (st !== 'onsale') {
      cta.innerHTML = '<div class="info">このレースは' + S.STATUS_LABEL[st] + 'です</div>' +
        '<button class="btn btn-ghost uma-bet-closed" disabled>投票できません</button>';
    } else if (!S.isLoggedIn()) {
      cta.innerHTML = '<a class="btn btn-gold uma-bet-login" href="#/login">ログインして投票する</a>';
    } else {
      cta.innerHTML = '<div class="info">購入可能額 <span class="uma-balance">' + yen(S.currentUser().balance) + '</span></div>' +
        '<button class="btn btn-main uma-bet-start" id="cta-bet">このレースに投票する</button>';
    }
    document.body.appendChild(cta);
    var b = $('#cta-bet');
    if (b) b.addEventListener('click', function () { openWizard(race); });
  }

  /* -------------------- オッズ・結果 */

  function oddsHtml(race) {
    var html = '<div class="box"><h2>単勝・複勝</h2><div class="box-body flush">' +
      race.horses.slice().sort(function (a, b) { return a.popularity - b.popularity; }).map(function (h) {
        return '<div class="horse-row uma-odds-row" data-horse="' + h.num + '">' +
          '<span class="hnum uma-odds-num">' + h.num + '</span>' +
          '<span class="info"><span class="nm uma-odds-name">' + esc(h.name) + '</span>' +
          '<span class="sb uma-odds-pop">' + h.popularity + '番人気</span></span>' +
          '<span class="od"><b class="uma-odds-win ' + (h.odds < 10 ? 'odds-hot' : '') + '">' + h.odds.toFixed(1) + '</b>' +
          '<span>複 <span class="uma-odds-place">' + h.fukuOdds.toFixed(1) + '</span></span></span></div>';
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
        return '<div class="horse-row uma-result-row" data-rank="' + (i + 1) + '" data-horse="' + h.num + '">' +
          '<span style="width:26px;flex:0 0 26px;text-align:center;font-weight:800" class="uma-result-rank ' +
          (i < 3 ? 'pos-' + (i + 1) : '') + '">' + (i + 1) + '</span>' +
          '<span class="waku uma-result-waku w' + h.waku + '">' + h.waku + '</span>' +
          '<span class="hnum uma-result-num">' + h.num + '</span>' +
          '<span class="info"><span class="nm uma-result-name">' + esc(h.name) + '</span>' +
          '<span class="sb uma-result-jockey">' + esc(h.jockey) + '</span></span>' +
          '<span class="od"><b class="uma-result-odds">' + h.odds.toFixed(1) + '</b><span>単勝</span></span></div>';
      }).join('') + '</div></div>';

    html += '<div class="box uma-payout-table"><h2>払戻金（100円あたり）</h2><div class="box-body flush">' +
      B.racePayouts(race.key).map(function (p) {
        return '<div class="kv uma-payout-row" data-type="' + p.type + '" data-combo="' + p.combo.join('-') + '">' +
          '<span class="k"><span class="uma-payout-type">' + p.type + '</span>　' +
          '<b class="uma-payout-combo" style="color:#1c2722">' + p.label + '</b></span>' +
          '<span class="v uma-payout-amount">' + yen(p.payout) + '</span></div>';
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
      next = '<button class="btn btn-main uma-bet-next" id="wz-next"' + disabled + '>次へ進む</button>';
    } else {
      next = '<button class="btn btn-gold uma-bet-confirm" id="wz-buy">この内容で購入する</button>';
    }

    document.getElementById('wiz-root').innerHTML =
      '<div class="wiz uma-bet-panel" data-step="' + wiz.step + '" data-race-key="' + race.key + '">' +
      '<div class="wiz-hd">' +
      '<button class="x uma-bet-close" id="wz-close">×</button>' +
      '<span class="t">' + race.venueName + race.round + 'R 投票</span>' +
      '<span class="st">発走 ' + race.startTime + '</span></div>' +
      '<div class="wiz-steps uma-bet-steps">' + STEP_NAMES.map(function (n, i) {
        return '<div class="uma-bet-step uma-bet-step-' + (i + 1) + ' ' + (wiz.step === i + 1 ? 'on' : '') + '">' +
          (i + 1) + '. ' + n + '</div>';
      }).join('') + '</div>' +
      '<div class="wiz-bd">' + body + '</div>' +
      '<div class="wiz-ft uma-bet-summary">' +
      '<div class="sum"><span><span class="uma-bet-type-name">' + t.name + '</span>　' +
      '<span class="uma-bet-count">' + combos.length + '点</span> × ' +
      '<span class="uma-bet-unit">' + yen(wiz.amount) + '</span></span>' +
      '<b class="uma-bet-total">' + yen(total) + '</b></div>' +
      '<div class="btn-row">' +
      (wiz.step > 1 ? '<button class="btn btn-ghost uma-bet-prev" id="wz-prev">戻る</button>' : '') +
      next + '</div></div></div>';

    bindWizard();
  }

  function wizStep1(t) {
    var html = '<label class="fl">式別を選択してください</label><div class="chips uma-bet-types">' +
      D.BET_TYPES.map(function (x) {
        return '<button class="chip uma-bet-type ' + (x.id === wiz.typeId ? 'on' : '') +
          '" data-type="' + x.id + '">' + x.name + '</button>';
      }).join('') + '</div>' +
      '<div class="msg msg-info" style="margin-top:12px">' + t.name + '：' + t.desc + '</div>';

    if (t.size > 1) {
      html += '<label class="fl" style="margin-top:6px">買い方</label><div class="chips uma-bet-methods">' +
        D.BET_METHODS.map(function (m) {
          return '<button class="chip uma-bet-method ' + (m.id === wiz.methodId ? 'on' : '') +
            '" data-method="' + m.id + '">' + m.name + '</button>';
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

    html += '<div class="num-grid uma-bet-numbers">' + race.horses.map(function (h) {
      var picked = wiz.picks.indexOf(h.num) >= 0;
      var isAxis = wiz.axis.indexOf(h.num) >= 0;
      var ord = t.ordered && wiz.methodId === 'normal' && picked ? wiz.picks.indexOf(h.num) + 1 : 0;
      return '<button class="num-btn uma-entry-pick ' + (isAxis ? 'axis' : picked ? 'on' : '') +
        '" data-num="' + h.num + '" data-horse="' + h.num + '" data-selected="' + (picked || isAxis ? '1' : '0') + '">' +
        (ord ? '<span class="ord uma-entry-order">' + ord + '着</span>' : '') +
        h.num + '<small class="uma-entry-odds">' + h.odds.toFixed(1) + '</small></button>';
    }).join('') + '</div>';

    html += '<div class="box" style="margin-top:13px"><h2>選択中</h2><div class="box-body uma-bet-picks">' +
      (wiz.axis.length ? '<div class="uma-bet-axis-list" style="font-size:12.5px;margin-bottom:6px">軸：' +
        wiz.axis.map(hnum).join(' ') + '</div>' : '') +
      (wiz.picks.length ? '<div class="uma-bet-pick-list" style="font-size:12.5px">' + (nagashi ? '相手：' : '') +
        wiz.picks.map(hnum).join(' ') + '</div>'
        : '<div style="font-size:12.5px;color:#76867e">まだ選択されていません</div>') +
      '<button class="btn btn-ghost btn-sm uma-bet-clear" id="wz-clear" style="margin-top:10px">選択をクリア</button>' +
      '</div></div>';

    html += '<div class="box"><h2>馬名一覧</h2><div class="box-body flush">' +
      race.horses.map(function (h) {
        return '<div class="kv uma-entry-row" data-horse="' + h.num + '">' +
          '<span class="k"><span class="hnum uma-entry-num">' + h.num + '</span> ' +
          '<span class="uma-entry-name">' + esc(h.name) + '</span></span>' +
          '<span class="v uma-entry-odds">' + h.odds.toFixed(1) + '</span></div>';
      }).join('') + '</div></div>';
    return html;
  }

  function wizStep3(race, combos) {
    return '<label class="fl">1点あたりの金額</label>' +
      '<div class="chips" style="margin-bottom:10px">' +
      [100, 500, 1000, 5000, 10000].map(function (a) {
        return '<button class="chip uma-bet-amount-chip ' + (a === wiz.amount ? 'on' : '') +
          '" data-amount="' + a + '">' + B.num(a) + '円</button>';
      }).join('') + '</div>' +
      '<input type="number" id="wz-amount" class="uma-bet-amount" value="' + wiz.amount + '" min="100" step="100">' +
      '<div class="hint">100円単位／1点あたり ' + yen(S.MIN_BET_UNIT) + '〜' + yen(S.MAX_BET_UNIT) + '</div>' +
      '<div class="box" style="margin-top:14px"><h2>買い目（' + combos.length + '点）</h2><div class="box-body">' +
      '<div class="combo-box uma-bet-combos">' + combos.map(function (c) {
        return '<span class="uma-bet-combo" data-combo="' + c.join('-') + '">' +
          B.comboLabel(wiz.typeId, c) + '<b style="margin-left:6px;color:#76867e">' +
          B.oddsFor(race, wiz.typeId, c).toFixed(1) + '</b></span>';
      }).join('') + '</div></div></div>';
  }

  function wizStep4(race, t, combos, total, u) {
    return '<div class="box uma-bet-review"><h2>購入内容</h2><div class="box-body flush">' +
      kv('レース', '<span class="uma-race-label">' + race.label + '</span>') +
      kv('レース名', '<span class="uma-race-name">' + esc(race.name) + '</span>') +
      kv('発走時刻', '<span class="uma-race-start">' + race.startTime + '</span>') +
      kv('式別', '<span class="uma-bet-type-name">' + t.name + '</span>') +
      kv('買い方', '<span class="uma-bet-method-name">' +
        (D.BET_METHODS.filter(function (m) { return m.id === wiz.methodId; })[0] || {}).name + '</span>') +
      kv('点数', '<span class="uma-bet-count">' + combos.length + ' 点</span>') +
      kv('1点あたり', '<span class="uma-bet-unit">' + yen(wiz.amount) + '</span>') +
      kv('合計金額', '<span class="uma-bet-total" style="color:#cc3b2c;font-size:17px">' + yen(total) + '</span>') +
      kv('購入前残高', '<span class="uma-bet-before">' + yen(u.balance) + '</span>') +
      kv('購入後残高', '<span class="uma-bet-after">' + yen(u.balance - total) + '</span>') +
      '</div></div>' +
      '<div class="box"><h2>買い目</h2><div class="box-body">' +
      '<div class="combo-box uma-bet-combos">' + combos.map(function (c) {
        return '<span class="uma-bet-combo" data-combo="' + c.join('-') + '">' + B.comboLabel(wiz.typeId, c) + '</span>';
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
        '<div class="msg msg-ok uma-bet-done">馬券の購入が完了しました。</div>' +
        '<div class="box uma-bet-receipt" style="margin:0"><div class="box-body flush">' +
        kv('受付番号', '<span class="uma-bet-receipt-id" style="font-family:monospace;font-size:11px">' + res.bet.id + '</span>') +
        kv('レース', '<span class="uma-bet-receipt-race">' + race.label + '</span>') +
        kv('式別', '<span class="uma-bet-receipt-type">' + res.bet.typeName + '（' + res.bet.methodName + '）</span>') +
        kv('点数 / 合計', '<span class="uma-bet-receipt-total">' + res.bet.combos.length + '点 / ' + yen(res.bet.total) + '</span>') +
        kv('購入後残高', '<span class="uma-bet-receipt-balance">' + yen(res.balance) + '</span>') +
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
      '<div class="sub"><span class="uma-user-name">' + esc(u.name) + '</span> 様</div>' +
      '<div class="stat2 uma-summary">' +
      stat('購入件数', sm.count + ' 件', '', 'count') + stat('的中率', sm.hitRate + ' %', '', 'hitrate') +
      stat('購入金額', yen(sm.total), '', 'total') + stat('払戻金額', yen(sm.payout), '', 'payout') +
      '</div>' +
      '<div class="box uma-summary-profit" style="margin-bottom:12px"><div class="box-body flush">' +
      kv('収支', '<span class="uma-summary-profit-value ' + (sm.profit >= 0 ? 'pos-3' : 'pos-1') + '">' +
        (sm.profit >= 0 ? '+' : '−') + yen(Math.abs(sm.profit)) + '</span>') + '</div></div>' +
      '<div class="seg uma-history-filter" id="hist-seg">' +
      ['all|すべて', 'pending|未確定', 'hit|的中', 'lose|不的中'].map(function (x, i) {
        var p = x.split('|');
        return '<button class="uma-history-filter-' + p[0] + ' ' + (i === 0 ? 'on' : '') +
          '" data-f="' + p[0] + '">' + p[1] + '</button>';
      }).join('') + '</div><div id="hist-body" class="uma-bet-list"></div>';

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

  function stat(k, v, cls, key) {
    return '<div class="stat' + (key ? ' uma-summary-' + key : '') + '"><div class="k">' + k + '</div>' +
      '<div class="v ' + (cls || '') + (key ? ' uma-summary-' + key + '-value' : '') + '">' + v + '</div></div>';
  }

  function betItemHtml(b) {
    var badge = b.status === 'hit' ? '<span class="badge badge-hit uma-bet-status">的中</span>'
      : b.status === 'lose' ? '<span class="badge badge-lose uma-bet-status">不的中</span>'
        : '<span class="badge badge-pending uma-bet-status">未確定</span>';
    var hitKeys = {};
    (b.hitCombos || []).forEach(function (c) { hitKeys[c.join('-')] = 1; });

    return '<div class="bet-item uma-bet-item" data-bet-id="' + b.id + '" data-status="' + b.status +
      '" data-race-key="' + b.raceKey + '"><div class="hd">' + badge +
      '<a class="uma-bet-race" href="#/race/' + b.raceKey + '?tab=result">' +
      '<b class="uma-bet-race-label">' + b.raceLabel + '</b></a>' +
      '<span class="uma-bet-race-name" style="font-size:11.5px;color:#76867e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
      esc(b.raceName) + '</span></div><div class="bd">' +
      '<div class="row"><span><b class="uma-bet-type-name">' + b.typeName + '</b>　' +
      '<span class="uma-bet-method-name">' + b.methodName + '</span></span>' +
      '<span class="uma-bet-count">' + b.combos.length + '点</span></div>' +
      '<div class="combo-box uma-bet-combos" style="margin:7px 0;max-height:120px">' + b.combos.map(function (c) {
        return '<span class="uma-bet-combo ' + (hitKeys[c.join('-')] ? 'hit' : '') +
          '" data-combo="' + c.join('-') + '">' + B.comboLabel(b.typeId, c) + '</span>';
      }).join('') + '</div>' +
      '<div class="row"><span>購入金額</span><b class="uma-bet-total">' + yen(b.total) + '</b></div>' +
      '<div class="row"><span>払戻金</span><span class="uma-bet-payout ' + (b.payout ? 'pay' : '') + '">' + yen(b.payout) + '</span></div>' +
      '<div class="row" style="font-size:10.5px;color:#76867e">' +
      '<span class="uma-bet-id">' + b.id + '</span><span class="uma-bet-date">' + b.createdAt + '</span></div>' +
      '</div></div>';
  }

  /* ================================================ 入出金 */

  function viewWallet(mode) {
    var u = S.currentUser();
    var html = '<div class="ttl">入出金</div>' +
      '<div class="bal-card"><div class="k">ご購入可能額</div>' +
      '<div class="v uma-wallet-balance">' + yen(u.balance) + '</div>' +
      '<div class="s">登録口座：<span class="uma-wallet-bank">' + esc(u.bank) + '</span></div></div>' +
      '<div class="seg uma-wallet-tabs">' +
      '<a class="uma-wallet-tab-deposit ' + (mode === 'deposit' ? 'on' : '') + '" href="#/wallet?mode=deposit">入金</a>' +
      '<a class="uma-wallet-tab-withdraw ' + (mode === 'withdraw' ? 'on' : '') + '" href="#/wallet?mode=withdraw">出金</a></div>' +
      '<div class="box"><div class="box-body" id="wallet-form"></div></div>' +
      '<div class="box"><h2>入出金・購入履歴</h2><div class="box-body flush uma-txn-table" id="txn-list">' +
      (u.txns.length ? u.txns.map(function (t) {
        return '<div class="uma-txn-row" data-txn-type="' + t.type + '" style="padding:10px 13px;border-bottom:1px solid #f0f4f2">' +
          '<div style="display:flex;justify-content:space-between;align-items:baseline">' +
          '<b class="uma-txn-label" style="font-size:13px">' + t.label + '</b>' +
          '<b class="uma-txn-amount" style="color:' + (t.amount >= 0 ? '#17935f' : '#cc3b2c') + ';font-size:15px">' +
          (t.amount >= 0 ? '+' : '−') + yen(Math.abs(t.amount)) + '</b></div>' +
          '<div style="font-size:10.5px;color:#76867e"><span class="uma-txn-date">' + t.createdAt + '</span>　' +
          '<span class="uma-txn-method">' + esc(t.method || '') + '</span>' +
          (t.fee ? '<span class="uma-txn-fee">（手数料' + yen(t.fee) + '）</span>' : '') + '</div>' +
          '<div style="font-size:11px;color:#76867e">残高 <span class="uma-txn-balance">' + yen(t.balanceAfter) + '</span></div></div>';
      }).join('') : '<div class="empty">入出金履歴はまだありません。</div>') +
      '</div></div>';

    view.innerHTML = html;
    mode === 'withdraw' ? drawWithdraw() : drawDeposit();
  }

  function drawDeposit() {
    $('#wallet-form').innerHTML = '<div class="uma-deposit-form">' +
      '<div id="wallet-msg" class="uma-form-error"></div>' +
      '<label class="fl">入金方法</label><div class="chips" id="dep-methods">' +
      S.DEPOSIT_METHODS.map(function (m, i) {
        return '<button class="chip uma-deposit-method ' + (i === 0 ? 'on' : '') +
          '" data-m="' + m.id + '" data-method="' + m.id + '">' + m.name + '</button>';
      }).join('') + '</div>' +
      '<label class="fl" style="margin-top:14px">入金額</label>' +
      '<div class="chips" style="margin-bottom:9px">' +
      [1000, 5000, 10000, 30000, 50000].map(function (a) {
        return '<button class="chip uma-deposit-amount-chip" data-dep="' + a + '">' + B.num(a) + '円</button>';
      }).join('') + '</div>' +
      '<input type="number" id="dep-amount" class="uma-deposit-amount" value="10000" step="100" min="1000" max="500000">' +
      '<div class="hint">100円単位／1回 ' + yen(S.MIN_DEPOSIT) + '〜' + yen(S.MAX_DEPOSIT) + '</div>' +
      '<button class="btn btn-main uma-deposit-submit" id="dep-go" style="margin-top:14px">入金する</button></div>';

    on('#dep-methods .chip', 'click', function (b) {
      $$('#dep-methods .chip').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
    });
    on('[data-dep]', 'click', function (b) { $('#dep-amount').value = b.getAttribute('data-dep'); });
    $('#dep-go').addEventListener('click', function () {
      var res = S.deposit($('#dep-amount').value, $('#dep-methods .chip.on').getAttribute('data-m'));
      if (!res.ok) { $('#wallet-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>'; return; }
      sheet('入金が完了しました',
        '<div class="msg msg-ok uma-deposit-done">' + yen(res.amount) + ' を入金しました。</div>' +
        '<div class="box uma-deposit-receipt" style="margin:0"><div class="box-body flush">' +
        kv('入金方法', '<span class="uma-deposit-receipt-method">' + res.method + '</span>') +
        kv('入金額', '<span class="uma-deposit-receipt-amount">' + yen(res.amount) + '</span>') +
        kv('購入可能額', '<span class="uma-deposit-receipt-balance">' + yen(res.balance) + '</span>') + '</div></div>',
        '<button class="btn btn-main" data-sclose="1">閉じる</button>');
      toast('入金が完了しました');
      render();
    });
  }

  function drawWithdraw() {
    var u = S.currentUser();
    $('#wallet-form').innerHTML = '<div class="uma-withdraw-form">' +
      '<div id="wallet-msg" class="uma-form-error"></div>' +
      '<label class="fl">出金先口座</label>' +
      '<div class="uma-withdraw-bank" style="font-size:13px;margin-bottom:13px">' + esc(u.bank) + '</div>' +
      '<label class="fl">出金額</label>' +
      '<div class="chips" style="margin-bottom:9px">' +
      [1000, 5000, 10000, 50000].map(function (a) {
        return '<button class="chip uma-withdraw-amount-chip" data-wd="' + a + '">' + B.num(a) + '円</button>';
      }).join('') + '<button class="chip uma-withdraw-all" data-wd="all">全額</button></div>' +
      '<input type="number" id="wd-amount" class="uma-withdraw-amount" value="1000" step="100" min="1000">' +
      '<div class="hint">100円単位／出金手数料 ' + yen(S.WITHDRAW_FEE) + ' が別途かかります。</div>' +
      '<button class="btn btn-main uma-withdraw-submit" id="wd-go" style="margin-top:14px">出金する</button></div>';

    on('[data-wd]', 'click', function (b) {
      var v = b.getAttribute('data-wd');
      $('#wd-amount').value = v === 'all'
        ? Math.max(0, Math.floor((u.balance - S.WITHDRAW_FEE) / 100) * 100) : v;
    });
    $('#wd-go').addEventListener('click', function () {
      var res = S.withdraw($('#wd-amount').value);
      if (!res.ok) { $('#wallet-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>'; return; }
      sheet('出金手続きが完了しました',
        '<div class="msg msg-ok uma-withdraw-done">' + yen(res.amount) + ' の出金手続きを受け付けました。</div>' +
        '<div class="box uma-withdraw-receipt" style="margin:0"><div class="box-body flush">' +
        kv('出金額', '<span class="uma-withdraw-receipt-amount">' + yen(res.amount) + '</span>') +
        kv('手数料', '<span class="uma-withdraw-receipt-fee">' + yen(res.fee) + '</span>') +
        kv('購入可能額', '<span class="uma-withdraw-receipt-balance">' + yen(res.balance) + '</span>') + '</div></div>',
        '<button class="btn btn-main" data-sclose="1">閉じる</button>');
      toast('出金手続きが完了しました');
      render();
    });
  }

  /* ================================================ マイページ */

  function viewMypage() {
    var u = S.currentUser(), sm = S.summary();
    view.innerHTML = '<div class="ttl">マイページ</div>' +
      '<div class="bal-card"><div class="k">ご購入可能額</div>' +
      '<div class="v uma-wallet-balance">' + yen(u.balance) + '</div>' +
      '<div class="s"><span class="uma-user-name">' + esc(u.name) + '</span> 様（' +
      '<span class="uma-mypage-memberno-value">' + u.id.toUpperCase() + '</span>）</div></div>' +
      '<div class="btn-row" style="margin-bottom:12px">' +
      '<a class="btn btn-main uma-goto-deposit" href="#/wallet?mode=deposit">入金</a>' +
      '<a class="btn btn-ghost uma-goto-withdraw" href="#/wallet?mode=withdraw">出金</a></div>' +
      '<div class="stat2 uma-summary">' +
      stat('購入件数', sm.count + ' 件', '', 'count') + stat('的中率', sm.hitRate + ' %', '', 'hitrate') +
      stat('購入金額', yen(sm.total), '', 'total') + stat('払戻金額', yen(sm.payout), '', 'payout') + '</div>' +
      '<div class="box"><h2>会員情報</h2><div class="box-body flush uma-mypage-table">' +
      mrow('loginid', 'ユーザーID', esc(u.loginId)) +
      mrow('name', 'お名前', esc(u.name)) +
      mrow('kana', 'フリガナ', esc(u.kana)) +
      mrow('birthday', '生年月日', u.birthday) +
      mrow('email', 'メール', '<span style="font-size:11px">' + esc(u.email) + '</span>') +
      mrow('tel', '電話番号', esc(u.tel)) +
      mrow('bank', '登録口座', '<span style="font-size:11px">' + esc(u.bank) + '</span>') +
      mrow('type', '区分', u.registered ? '新規登録' : 'テストユーザー') +
      '</div></div>' +
      '<div class="box"><h2>最近の投票<a href="#/history">すべて見る</a></h2><div class="box-body uma-bet-list">' +
      (u.bets.length ? u.bets.slice(0, 2).map(betItemHtml).join('')
        : '<div class="empty">まだ投票がありません。</div>') + '</div></div>' +
      '<button class="btn btn-danger uma-logout" id="mp-logout">ログアウト</button>';

    $('#mp-logout').addEventListener('click', function () {
      S.logout(); location.hash = '#/'; render(); toast('ログアウトしました');
    });
  }

  /* ================================================ ログイン */

  function viewLogin() {
    if (S.isLoggedIn()) { location.hash = '#/mypage'; return; }
    view.innerHTML = '<div class="ttl">ログイン</div>' +
      '<div class="box uma-login-form"><div class="box-body">' +
      '<div id="login-msg" class="uma-form-error"></div>' +
      '<div class="field"><label class="fl">ユーザーID<span class="req">必須</span></label>' +
      '<input type="text" id="lg-id" class="uma-login-id" placeholder="user01"></div>' +
      '<div class="field"><label class="fl">パスワード<span class="req">必須</span></label>' +
      '<input type="password" id="lg-pw" class="uma-login-pw" placeholder="パスワード"></div>' +
      '<button class="btn btn-main uma-login-submit" id="lg-go">ログイン</button>' +
      '<div style="text-align:center;margin-top:12px;font-size:12.5px">' +
      'はじめての方は <a href="#/register" class="uma-register-nav">新規会員登録</a></div></div></div>' +
      testUserBox();

    $('#lg-go').addEventListener('click', doLogin);
    on('[data-fill]', 'click', function (b) {
      var id = b.getAttribute('data-fill');
      $('#lg-id').value = id;
      $('#lg-pw').value = testUserPassword(id);
      toast(id + ' を入力しました');
    });

    function doLogin() {
      var res = S.login($('#lg-id').value.trim(), $('#lg-pw').value);
      if (!res.ok) { $('#login-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>'; return; }
      toast('ようこそ ' + res.user.name + ' 様');
      location.hash = '#/'; render();
    }
  }

  function testUserBox() {
    return '<div class="box"><h2>テストアカウント<span style="font-size:10.5px;color:#76867e">PWは個別</span></h2>' +
      '<div class="box-body flush uma-testuser-table">' + D.TEST_USERS.map(function (u) {
        return '<div class="uma-testuser-row" data-login-id="' + u.loginId + '"' +
          ' style="display:flex;align-items:center;gap:9px;padding:10px 13px;border-bottom:1px solid #f0f4f2">' +
          '<div style="flex:1;min-width:0"><b class="uma-testuser-id" style="font-size:13px">' + u.loginId + '</b>' +
          '<div style="font-size:11px;color:#76867e"><span class="uma-testuser-name">' + esc(u.name) + '</span>／' +
          '<span class="uma-testuser-balance">' + yen(u.balance) + '</span></div>' +
          '<div style="font-size:10.5px;word-break:break-all">PW: ' +
          '<code class="uma-testuser-password">' + esc(u.password) + '</code></div>' +
          '<div class="uma-testuser-memo" style="font-size:10px;color:#76867e">' + esc(u.memo) + '</div></div>' +
          '<button class="btn btn-ghost btn-sm uma-testuser-fill" data-fill="' + u.loginId + '">入力</button></div>';
      }).join('') + '</div></div>';
  }

  /* ================================================ 会員登録 */

  function viewRegister() {
    view.innerHTML = '<div class="ttl">新規会員登録</div>' +
      '<div class="sub">デモサイトです。実在の個人情報は入力しないでください</div>' +
      '<div class="box uma-register-form"><div class="box-body"><div id="reg-msg" class="uma-form-error"></div>' +
      f('ユーザーID', '必須', 'loginId', 'text', '半角英数字4〜20文字') +
      f('パスワード', '必須', 'password', 'password', S.MIN_PASSWORD + '文字以上') +
      '<div class="hint" style="margin:-8px 0 12px">' + S.MIN_PASSWORD +
      '文字以上で、英大文字・英小文字・数字・記号のうち3種類以上を含めてください。' +
      'ユーザーIDや推測されやすい文字列は使用できません。</div>' +
      f('パスワード（確認）', '必須', 'passwordConfirm', 'password') +
      f('お名前', '必須', 'name', 'text', '競馬 太郎') +
      f('フリガナ', '必須', 'kana', 'text', 'ケイバ タロウ') +
      f('生年月日', '必須', 'birthday', 'date', '', '1990-01-01') +
      f('メールアドレス', '必須', 'email', 'email', 'taro@example.test') +
      f('電話番号', '必須', 'tel', 'tel', '090-0000-0000') +
      f('出金先口座', '', 'bank', 'text', '○○銀行 ○○支店 普通 1234567') +
      '<label style="display:flex;gap:8px;align-items:flex-start;font-size:12.5px;margin:4px 0 14px">' +
      '<input type="checkbox" id="rg-agree" class="uma-register-agree" style="width:auto;margin-top:3px">' +
      '<span>本サイトが架空のデモサイトであり、日本中央競馬会（JRA）等の実在の団体とは無関係であることを理解し、利用規約に同意します</span></label>' +
      '<button class="btn btn-main uma-register-submit" id="rg-go">この内容で登録する</button>' +
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
        '<div class="msg msg-ok uma-register-done">ご登録ありがとうございます。そのままログインしました。</div>' +
        '<div class="box uma-register-receipt" style="margin:0"><div class="box-body flush">' +
        mrow('memberno', '会員番号', res.user.id.toUpperCase()) +
        mrow('loginid', 'ユーザーID', esc(res.user.loginId)) +
        mrow('name', 'お名前', esc(res.user.name)) +
        mrow('balance', '購入可能額', yen(res.user.balance)) +
        '</div></div>',
        '<a class="btn btn-main" href="#/wallet?mode=deposit" style="margin-bottom:9px">入金する</a>' +
        '<button class="btn btn-ghost" data-sclose="1">閉じる</button>');
      toast('会員登録が完了しました');
    });
  }

  function f(label, req, id, type, ph, val) {
    return '<div class="field"><label class="fl">' + label +
      (req ? '<span class="req">' + req + '</span>' : '') + '</label>' +
      '<input type="' + type + '" id="rg-' + id + '" class="uma-register-' + id + '"' +
      (ph ? ' placeholder="' + ph + '"' : '') + (val ? ' value="' + val + '"' : '') + '></div>';
  }

  /* ================================================ 免責事項 */

  function viewDisclaimer() {
    view.innerHTML = '<div class="ttl">免責事項</div>' +
      '<div class="sub">ご利用の前に必ずお読みください</div>' +
      '<div class="box uma-disclaimer-page"><div class="box-body">' +
      '<div class="msg msg-err" style="font-weight:700">' +
      '本サイトは架空のデモサイトです。<br>日本中央競馬会（JRA）とは一切関係がありません。</div>' +
      '<ol class="uma-disclaimer-list">' +
      D.DISCLAIMER_LINES.map(function (t) { return '<li>' + t + '</li>'; }).join('') +
      '</ol></div></div>' +
      '<div class="box"><h2>架空データについて</h2><div class="box-body flush">' +
      kv('競馬場', D.VENUES.map(function (v) { return v.name; }).join(' / ') + '（すべて架空）') +
      kv('レース名', 'すべて架空') +
      kv('競走馬名', '自動生成の架空名') +
      kv('騎手・調教師', 'すべて架空の人物') +
      kv('オッズ・払戻金', '架空の計算値') +
      kv('入出金・馬券購入', '演出のみ・金銭の移動なし') +
      '</div></div>' +
      '<a class="btn btn-ghost" href="#/help">ヘルプへ</a>';
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
      '<p style="font-size:12.5px">会員情報・残高・投票履歴は localStorage（<code>umatiket_state_v2</code>）に保存されます。</p>' +
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
