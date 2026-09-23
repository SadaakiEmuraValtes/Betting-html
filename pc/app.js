/* =========================================================
 * pc/app.js —— PC版アプリケーション
 *   ハッシュルーティングで各画面を #view に描画する
 * ========================================================= */
(function () {
  'use strict';

  var D = UmaData, B = UmaBet, S = UmaStore;

  // 端末が違えば専用ページへ差し替える（スマホでPC版URLを開いた場合など）
  if (S.enforceDevice('pc')) return;

  var view = document.getElementById('view');

  /* ------------------------------------------------ 小道具 */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function yen(n) { return B.yen(n); }

  function toast(msg, isErr) {
    var root = document.getElementById('toast-root');
    var d = document.createElement('div');
    d.className = 'toast' + (isErr ? ' err' : '');
    d.textContent = msg;
    root.appendChild(d);
    setTimeout(function () { d.remove(); }, 3200);
  }

  function modal(title, bodyHtml, footerHtml) {
    var root = document.getElementById('modal-root');
    root.innerHTML = '<div class="modal-bg"><div class="modal">' +
      '<h3>' + title + '</h3><div class="mb">' + bodyHtml + '</div>' +
      '<div class="mf">' + (footerHtml || '<button class="btn btn-ghost" data-close="1">閉じる</button>') + '</div>' +
      '</div></div>';
    $$('[data-close]', root).forEach(function (b) {
      b.addEventListener('click', closeModal);
    });
    return root;
  }
  function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

  function wakuClass(w) { return 'waku w' + w; }
  function statusBadge(st) {
    return '<span class="badge badge-' + st + '">' + S.STATUS_LABEL[st] + '</span>';
  }

  /* ------------------------------------------------ ヘッダー描画 */

  function renderHeader() {
    $('#hd-date').textContent = D.RACE_DATE_LABEL;

    var sel = $('#hd-clock');
    if (!sel.options.length) {
      var html = '';
      for (var h = 9; h <= 18; h++) html += '<option value="' + h + '">' + ('0' + h).slice(-2) + ':00</option>';
      sel.innerHTML = html;
      sel.addEventListener('change', function () {
        S.setVirtualHour(this.value);
        render();
        toast('現在時刻を ' + S.nowLabel() + ' に変更しました');
      });
    }
    sel.value = S.virtualHour();

    var u = S.currentUser();
    if (u) {
      $('#hd-balance-box').style.display = '';
      $('#hd-balance').textContent = yen(u.balance);
      $('#hd-user').innerHTML = '<b class="uma-user-name">' + esc(u.name) + '</b> 様<br>' +
        '<a href="#/mypage">マイページ</a> / <a href="#" id="hd-logout" class="uma-logout">ログアウト</a>';
      $('#hd-logout').addEventListener('click', function (e) {
        e.preventDefault();
        S.logout();
        location.hash = '#/';
        render();
        toast('ログアウトしました');
      });
    } else {
      $('#hd-balance-box').style.display = 'none';
      $('#hd-user').innerHTML = '<button class="pc-btn-login uma-login-nav" id="hd-login">ログイン</button>' +
        '<div style="margin-top:4px"><a href="#/register" class="uma-register-nav">新規会員登録</a></div>';
      $('#hd-login').addEventListener('click', function () { location.hash = '#/login'; });
    }

    $('#side-venues').innerHTML = D.VENUES.map(function (v) {
      var rs = D.venueRaces(v.idx);
      var onsale = rs.filter(function (r) { return S.raceStatus(r) === 'onsale'; }).length;
      return '<div style="display:flex;justify-content:space-between">' +
        '<span style="color:' + v.color + ';font-weight:700">' + v.name + '</span>' +
        '<span>発売中 ' + onsale + ' / 12R</span></div>';
    }).join('');
  }

  function markNav(name) {
    $$('#pc-nav a').forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('data-nav') === name);
    });
  }

  /* ------------------------------------------------ ルーター */

  function parseHash() {
    var h = location.hash.replace(/^#/, '') || '/';
    var qi = h.indexOf('?');
    var q = {};
    if (qi >= 0) {
      h.slice(qi + 1).split('&').forEach(function (kv) {
        var p = kv.split('=');
        q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
      });
      h = h.slice(0, qi);
    }
    return { path: h.split('/').filter(Boolean), query: q };
  }

  function render() {
    S.settle();
    renderHeader();
    var r = parseHash();
    var p0 = r.path[0] || '';
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
      case 'disclaimer': markNav('disclaimer'); return viewDisclaimer();
      default: markNav(''); view.innerHTML = '<div class="panel"><div class="empty">ページが見つかりません。</div></div>';
    }
  }

  function needLogin() {
    if (S.isLoggedIn()) return false;
    view.innerHTML =
      '<div class="pc-page-head"><h1>ログインが必要です</h1></div>' +
      '<div class="panel"><div class="panel-body">' +
      '<p>この機能のご利用にはログインが必要です。</p>' +
      '<p><a class="btn btn-main" href="#/login">ログイン画面へ</a> ' +
      '<a class="btn btn-ghost" href="#/register">新規会員登録</a></p>' +
      '</div></div>';
    return true;
  }

  /* ================================================ ホーム */

  function viewHome() {
    var html =
      '<div class="pc-page-head"><h1>本日のレース</h1>' +
      '<p>' + D.RACE_DATE_LABEL + '／現在時刻 ' + S.nowLabel() + '（発走10分前に締め切ります）</p></div>';

    html += '<div class="panel"><h2>開催一覧<span style="font-size:11px;font-weight:400;color:#6b7a72">' +
      'レースをクリックすると出馬表・投票画面へ移動します</span></h2><div class="panel-body">' +
      '<table class="venue-grid"><thead><tr><th class="vname" style="background:#6b7a72">競馬場</th>';
    for (var r = 1; r <= 12; r++) html += '<th>' + r + 'R</th>';
    html += '</tr></thead><tbody>';

    D.VENUES.forEach(function (v) {
      html += '<tr><th class="vname" style="background:' + v.color + '">' + v.name + '</th>';
      D.venueRaces(v.idx).forEach(function (race) {
        var st = S.raceStatus(race);
        html += '<td><a class="race-cell uma-race-link is-' + st + (race.grade ? ' is-grade' : '') +
          '" href="#/race/' + race.key + '" data-race-key="' + race.key + '" data-status="' + st + '">' +
          '<span class="r uma-race-round">' + race.round + 'R</span>' +
          '<span class="t uma-race-start">' + race.startTime + '</span>' +
          '<span class="s uma-race-status">' + S.STATUS_LABEL[st] + '</span></a></td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';

    // 重賞ピックアップ
    html += '<div class="panel"><h2>重賞・特別レース</h2><div class="panel-body" style="padding:0">' +
      '<table class="table"><thead><tr>' +
      '<th style="width:110px">レース</th><th style="width:70px">発走</th><th>レース名</th>' +
      '<th style="width:110px">コース</th><th style="width:70px" class="center">頭数</th>' +
      '<th style="width:80px" class="center">状態</th><th style="width:110px"></th>' +
      '</tr></thead><tbody>';
    D.featuredRaces().forEach(function (race) {
      var st = S.raceStatus(race);
      html += '<tr class="uma-featured-row" data-race-key="' + race.key + '">' +
        '<td><b class="uma-race-label" style="color:' + race.venueColor + '">' + race.label + '</b></td>' +
        '<td class="uma-race-start">' + race.startTime + '</td>' +
        '<td class="uma-race-name">' + (race.grade ? '<span class="badge badge-grade uma-race-grade">' + race.grade + '</span> ' : '') +
        esc(race.name) + '</td>' +
        '<td class="uma-race-course">' + race.courseLabel + '</td>' +
        '<td class="center uma-race-count">' + race.count + '頭</td>' +
        '<td class="center uma-race-status">' + statusBadge(st) + '</td>' +
        '<td class="center"><a class="btn btn-sm uma-race-link ' + (st === 'onsale' ? 'btn-main' : 'btn-ghost') +
        '" href="#/race/' + race.key + '" data-race-key="' + race.key + '">' +
        (st === 'onsale' ? '投票する' : '詳細') + '</a></td>' +
        '</tr>';
    });
    html += '</tbody></table></div></div>';

    view.innerHTML = html;
  }

  /* ================================================ レース詳細 */

  var betUI = {};   // raceKey -> 選択状態

  function uiFor(key) {
    if (!betUI[key]) betUI[key] = { typeId: 'tan', methodId: 'normal', picks: [], axis: [], amount: 100 };
    return betUI[key];
  }

  function viewRace(key, tab) {
    var race = D.getRace(key);
    if (!race) { view.innerHTML = '<div class="panel"><div class="empty">レースが見つかりません。</div></div>'; return; }
    var st = S.raceStatus(race);

    var html =
      '<div class="race-hero uma-race-head" data-race-key="' + race.key + '">' +
      '<div class="rno" style="background:' + race.venueColor + '"><b class="uma-race-round">' + race.round + '</b><span>R</span></div>' +
      '<div><h1 class="uma-race-name">' +
      (race.grade ? '<span class="badge badge-grade uma-race-grade">' + race.grade + '</span> ' : '') + esc(race.name) + '</h1>' +
      '<div class="meta">' + D.RACE_DATE_LABEL + '　<span class="uma-race-venue">' + race.venueName + '</span>' +
      '　発走 <span class="uma-race-start">' + race.startTime + '</span>' +
      '　<span class="uma-race-course">' + race.courseLabel + '</span>' +
      '　<span class="uma-race-count">' + race.count + '頭立て</span></div></div>' +
      '<div class="right"><span class="uma-race-status">' + statusBadge(st) + '</span>' +
      '<div style="font-size:11px;color:#6b7a72;margin-top:6px">現在時刻 ' + S.nowLabel() + '</div></div>' +
      '</div>';

    html += '<div class="tabs uma-race-tabs">' +
      tabLink(key, 'entries', '出馬表・投票', tab) +
      tabLink(key, 'odds', 'オッズ', tab) +
      tabLink(key, 'result', '結果・払戻', tab) +
      '</div>';

    if (tab === 'odds') {
      html += '<div class="panel" style="border-radius:0 8px 8px 8px">' + oddsHtml(race) + '</div>';
      view.innerHTML = html;
      return;
    }
    if (tab === 'result') {
      html += '<div class="panel" style="border-radius:0 8px 8px 8px">' + resultHtml(race, st) + '</div>';
      view.innerHTML = html;
      return;
    }

    // 出馬表 ＋ 投票パネル
    html += '<div class="race-layout">' +
      '<div class="col-main"><div class="panel" style="border-radius:0 8px 8px 8px;margin-bottom:0">' +
      '<div class="panel-body" style="padding:0" id="entry-area"></div></div></div>' +
      '<div class="col-bet" id="bet-area"></div></div>';

    view.innerHTML = html;
    drawEntries(race, st);
    drawBetPanel(race, st);
  }

  function tabLink(key, id, label, cur) {
    return '<a class="uma-race-tab uma-tab-' + id + ' ' + (cur === id ? 'on' : '') +
      '" href="#/race/' + key + '?tab=' + id + '" data-tab="' + id + '">' + label + '</a>';
  }

  /* -------------------- 出馬表 */

  function drawEntries(race, st) {
    var ui = uiFor(race.key);
    var t = D.betType(ui.typeId);
    var nagashi = ui.methodId === 'nagashi' && t.size > 1;
    var result = st === 'confirmed' ? D.getResult(race.key) : null;

    var head = '<table class="table entry-table uma-entry-table"><thead><tr>';
    head += nagashi ? '<th class="center" style="width:92px">軸 / 相手</th>' : '<th class="center" style="width:56px">選択</th>';
    head += '<th style="width:38px">枠</th><th style="width:42px">馬番</th><th>馬名</th>' +
      '<th style="width:48px">性齢</th><th style="width:92px">騎手</th>' +
      '<th class="num" style="width:66px">単勝</th><th class="center" style="width:44px">人気</th>';
    if (result) head += '<th class="center" style="width:52px">着順</th>';
    head += '</tr></thead><tbody>';

    var rows = race.horses.map(function (h) {
      var picked = ui.picks.indexOf(h.num) >= 0;
      var isAxis = ui.axis.indexOf(h.num) >= 0;
      var order = t.ordered && ui.methodId === 'normal' && picked ? (ui.picks.indexOf(h.num) + 1) : 0;
      var cell;
      if (nagashi) {
        cell = '<td class="pick2">' +
          '<button class="pick-btn axis uma-entry-axis ' + (isAxis ? 'on' : '') + '" data-axis="' + h.num + '">軸</button> ' +
          '<button class="pick-btn uma-entry-pick ' + (picked ? 'on' : '') + '" data-pick="' + h.num + '">相</button></td>';
      } else {
        cell = '<td class="pick"><button class="pick-btn uma-entry-pick ' + (picked ? 'on' : '') + '" data-pick="' + h.num + '">' +
          (picked ? '✓' : '＋') + '</button>' +
          (order ? '<span class="pick-order uma-entry-order">' + order + '着</span>' : '') + '</td>';
      }
      var pos = result ? result.order.indexOf(h.num) + 1 : 0;
      return '<tr class="uma-entry-row ' + (picked || isAxis ? 'selected' : '') + '"' +
        ' data-horse="' + h.num + '" data-selected="' + (picked || isAxis ? '1' : '0') + '">' + cell +
        '<td><span class="uma-entry-waku ' + wakuClass(h.waku) + '">' + h.waku + '</span></td>' +
        '<td><span class="horse-num uma-entry-num">' + h.num + '</span></td>' +
        '<td class="hname"><b class="uma-entry-name">' + esc(h.name) + '</b><div class="hsub">' +
        '<span class="uma-entry-weight">' + h.weight + '.0kg</span>　' +
        '<span class="uma-entry-bodyweight">' + h.bodyWeight + 'kg(' + (h.bodyDiff >= 0 ? '+' : '') + h.bodyDiff + ')</span>　' +
        '<span class="uma-entry-trainer">' + esc(h.trainer) + '</span></div></td>' +
        '<td class="uma-entry-sexage">' + h.sex + h.age + '</td>' +
        '<td class="hjockey uma-entry-jockey">' + esc(h.jockey) + '</td>' +
        '<td class="num uma-entry-odds ' + (h.odds < 10 ? 'odds-hot' : '') + '">' + h.odds.toFixed(1) + '</td>' +
        '<td class="center uma-entry-pop">' + h.popularity + '</td>' +
        (result ? '<td class="center uma-entry-rank ' + (pos <= 3 ? 'pos-' + pos : '') + '">' + pos + '</td>' : '') +
        '</tr>';
    }).join('');

    $('#entry-area').innerHTML = head + rows + '</tbody></table>';

    $$('#entry-area [data-pick]').forEach(function (b) {
      b.addEventListener('click', function () { togglePick(race, Number(b.getAttribute('data-pick')), false); });
    });
    $$('#entry-area [data-axis]').forEach(function (b) {
      b.addEventListener('click', function () { togglePick(race, Number(b.getAttribute('data-axis')), true); });
    });
  }

  function togglePick(race, numHorse, isAxis) {
    var ui = uiFor(race.key);
    var t = D.betType(ui.typeId);
    if (isAxis) {
      var ai = ui.axis.indexOf(numHorse);
      if (ai >= 0) ui.axis.splice(ai, 1);
      else {
        if (ui.axis.length >= t.size - 1) ui.axis.shift();
        ui.axis.push(numHorse);
        ui.picks = ui.picks.filter(function (n) { return n !== numHorse; });
      }
    } else {
      var pi = ui.picks.indexOf(numHorse);
      if (pi >= 0) ui.picks.splice(pi, 1);
      else {
        if (ui.methodId === 'normal' && ui.picks.length >= t.size) ui.picks.shift();
        ui.picks.push(numHorse);
        ui.axis = ui.axis.filter(function (n) { return n !== numHorse; });
      }
    }
    drawEntries(race, S.raceStatus(race));
    drawBetPanel(race, S.raceStatus(race));
  }

  /* -------------------- 投票パネル */

  function currentCombos(race) {
    var ui = uiFor(race.key);
    return B.buildCombos(ui.typeId, ui.methodId, { picks: ui.picks, axis: ui.axis });
  }

  function drawBetPanel(race, st) {
    var ui = uiFor(race.key);
    var t = D.betType(ui.typeId);
    var combos = currentCombos(race);
    var user = S.currentUser();
    var total = combos.length * ui.amount;

    var html = '<div class="bet-panel uma-bet-panel"><h3>投票（馬券購入）</h3>';

    html += '<div class="sec"><label>式別</label><div class="chips uma-bet-types">' +
      D.BET_TYPES.map(function (x) {
        return '<button class="chip uma-bet-type ' + (x.id === ui.typeId ? 'on' : '') +
          '" data-type="' + x.id + '">' + x.name + '</button>';
      }).join('') + '</div>' +
      '<div style="font-size:11px;color:#6b7a72;margin-top:6px">' + t.desc + '</div></div>';

    if (t.size > 1) {
      html += '<div class="sec"><label>方式</label><div class="chips uma-bet-methods">' +
        D.BET_METHODS.map(function (m) {
          return '<button class="chip uma-bet-method ' + (m.id === ui.methodId ? 'on' : '') +
            '" data-method="' + m.id + '">' + m.name + '</button>';
        }).join('') + '</div>' +
        '<div style="font-size:11px;color:#6b7a72;margin-top:6px">' +
        (D.BET_METHODS.filter(function (m) { return m.id === ui.methodId; })[0] || {}).desc +
        (ui.methodId === 'normal' && t.ordered ? '（選択した順が着順になります）' : '') +
        '</div></div>';
    }

    html += '<div class="sec"><label>選択中の馬</label>' +
      '<div style="font-size:12px" class="uma-bet-picks">' +
      (ui.axis.length ? '<div class="uma-bet-axis-list">軸：' + ui.axis.map(chipNum).join(' ') + '</div>' : '') +
      (ui.picks.length ? '<div class="uma-bet-pick-list">' + (ui.methodId === 'nagashi' ? '相手：' : '') +
        ui.picks.map(chipNum).join(' ') + '</div>'
        : '<div style="color:#6b7a72">出馬表から馬を選択してください</div>') +
      '</div>' +
      '<button class="btn btn-ghost btn-sm uma-bet-clear" style="margin-top:8px" data-clear="1">選択をクリア</button></div>';

    html += '<div class="sec"><label>買い目（<span class="uma-bet-count">' + combos.length + '</span>点）</label>';
    if (combos.length) {
      html += '<div class="combo-list uma-bet-combos"><table>' +
        combos.slice(0, 200).map(function (c) {
          return '<tr class="uma-bet-combo" data-combo="' + c.join('-') + '">' +
            '<td class="uma-bet-combo-label">' + B.comboLabel(ui.typeId, c) + '</td>' +
            '<td class="o uma-bet-combo-odds">' + B.oddsFor(race, ui.typeId, c).toFixed(1) + '倍</td></tr>';
        }).join('') +
        (combos.length > 200 ? '<tr><td colspan="2" style="color:#6b7a72">ほか ' + (combos.length - 200) + ' 点</td></tr>' : '') +
        '</table></div>';
    } else {
      html += '<div style="font-size:12px;color:#6b7a72">条件を満たす買い目がありません。</div>';
    }
    html += '</div>';

    html += '<div class="sec"><label>1点あたりの金額</label>' +
      '<input type="number" id="bet-amount" class="uma-bet-amount" value="' + ui.amount + '" min="100" step="100" max="100000">' +
      '<div class="chips" style="margin-top:7px">' +
      [100, 500, 1000, 5000, 10000].map(function (a) {
        return '<button class="chip uma-bet-amount-chip" data-amount="' + a + '">' + B.num(a) + '円</button>';
      }).join('') + '</div></div>';

    html += '<div class="sec uma-bet-summary">' +
      '<div class="bet-total"><span>点数</span><b class="uma-bet-count">' + combos.length + ' 点</b></div>' +
      '<div class="bet-total"><span>1点あたり</span><b class="uma-bet-unit">' + yen(ui.amount) + '</b></div>' +
      '<div class="bet-total grand"><span>合計金額</span><b class="uma-bet-total">' + yen(total) + '</b></div>' +
      (user ? '<div class="bet-total" style="color:#6b7a72"><span>購入後の残高</span>' +
        '<span class="uma-bet-after">' + yen(user.balance - total) + '</span></div>' : '') +
      '</div>';

    html += '<div class="sec" style="border-bottom:0">';
    if (st !== 'onsale') {
      html += '<div class="msg msg-info uma-bet-closed" style="margin:0">このレースは' +
        S.STATUS_LABEL[st] + 'のため購入できません。</div>';
    } else if (!user) {
      html += '<a class="btn btn-gold btn-block uma-bet-login" href="#/login">ログインして投票する</a>';
    } else {
      html += '<button class="btn btn-main btn-block btn-lg uma-bet-submit" id="bet-go"' +
        (combos.length ? '' : ' disabled') + '>購入内容を確認する</button>';
    }
    html += '</div></div>';

    // 自分の投票
    var mine = S.betsFor(race.key);
    if (mine.length) {
      html += '<div class="panel" style="margin-top:14px"><h2>このレースへの投票（' + mine.length + '件）</h2>' +
        '<div class="panel-body" style="font-size:12px">' +
        mine.map(function (b) {
          return '<div style="border-bottom:1px solid #eef3f0;padding:6px 0">' +
            '<b>' + b.typeName + '</b> ' + b.methodName + ' ' + b.combos.length + '点 / ' + yen(b.total) +
            '<div style="color:#6b7a72">' + b.combos.slice(0, 6).map(function (c) {
              return B.comboLabel(b.typeId, c);
            }).join('、') + (b.combos.length > 6 ? ' ほか' : '') + '</div>' +
            (b.status === 'pending' ? '' :
              '<div>' + (b.status === 'hit' ? '<span class="badge badge-hit">的中</span> 払戻 ' + yen(b.payout)
                : '<span class="badge badge-lose">不的中</span>') + '</div>') +
            '</div>';
        }).join('') + '</div></div>';
    }

    $('#bet-area').innerHTML = html;
    bindBetPanel(race, st);
  }

  function chipNum(n) { return '<span class="horse-num">' + n + '</span>'; }

  function bindBetPanel(race, st) {
    var ui = uiFor(race.key);

    $$('#bet-area [data-type]').forEach(function (b) {
      b.addEventListener('click', function () {
        ui.typeId = b.getAttribute('data-type');
        var t = D.betType(ui.typeId);
        if (t.size === 1) ui.methodId = 'normal';
        if (ui.methodId === 'normal' && ui.picks.length > t.size) ui.picks = ui.picks.slice(0, t.size);
        ui.axis = [];
        drawEntries(race, st); drawBetPanel(race, st);
      });
    });
    $$('#bet-area [data-method]').forEach(function (b) {
      b.addEventListener('click', function () {
        ui.methodId = b.getAttribute('data-method');
        ui.axis = [];
        var t = D.betType(ui.typeId);
        if (ui.methodId === 'normal' && ui.picks.length > t.size) ui.picks = ui.picks.slice(0, t.size);
        drawEntries(race, st); drawBetPanel(race, st);
      });
    });
    $$('#bet-area [data-amount]').forEach(function (b) {
      b.addEventListener('click', function () {
        ui.amount = Number(b.getAttribute('data-amount'));
        drawBetPanel(race, st);
      });
    });
    var inp = $('#bet-amount');
    if (inp) {
      inp.addEventListener('change', function () {
        ui.amount = Math.max(100, Number(inp.value) || 100);
        drawBetPanel(race, st);
      });
    }
    var clr = $('#bet-area [data-clear]');
    if (clr) {
      clr.addEventListener('click', function () {
        ui.picks = []; ui.axis = [];
        drawEntries(race, st); drawBetPanel(race, st);
      });
    }
    var go = $('#bet-go');
    if (go) go.addEventListener('click', function () { confirmBet(race); });
  }

  function confirmBet(race) {
    var ui = uiFor(race.key);
    var combos = currentCombos(race);
    var t = D.betType(ui.typeId);
    var total = combos.length * ui.amount;
    var u = S.currentUser();

    var body =
      '<table class="table"><tbody>' +
      '<tr><th style="width:130px">レース</th><td>' + race.label + '　' + esc(race.name) + '（発走 ' + race.startTime + '）</td></tr>' +
      '<tr><th>式別 / 方式</th><td>' + t.name + ' / ' + (D.BET_METHODS.filter(function (m) { return m.id === ui.methodId; })[0] || {}).name + '</td></tr>' +
      '<tr><th>点数</th><td>' + combos.length + ' 点</td></tr>' +
      '<tr><th>1点あたり</th><td>' + yen(ui.amount) + '</td></tr>' +
      '<tr><th>合計金額</th><td style="font-size:19px;font-weight:800;color:#b42318">' + yen(total) + '</td></tr>' +
      '<tr><th>購入後残高</th><td>' + yen(u.balance - total) + '</td></tr>' +
      '</tbody></table>' +
      '<div style="margin-top:14px;font-size:12px;color:#6b7a72">買い目</div>' +
      '<div style="max-height:180px;overflow:auto;border:1px solid #d9e2dc;border-radius:5px;padding:8px;font-size:12px">' +
      combos.map(function (c) {
        return '<span style="display:inline-block;border:1px solid #d9e2dc;border-radius:4px;padding:2px 8px;margin:0 5px 5px 0">' +
          B.comboLabel(ui.typeId, c) + '</span>';
      }).join('') + '</div>' +
      '<div class="msg msg-info" style="margin-top:14px">購入後の取り消しはできません。内容をご確認ください。</div>';

    modal('購入内容の確認', body,
      '<button class="btn btn-ghost uma-bet-cancel" data-close="1">キャンセル</button>' +
      '<button class="btn btn-main btn-lg uma-bet-confirm" id="do-bet">この内容で購入する</button>');

    $('#do-bet').addEventListener('click', function () {
      var res = S.placeBet(race.key, ui.typeId, ui.methodId, combos, ui.amount);
      if (!res.ok) { closeModal(); toast(res.error, true); return; }
      ui.picks = []; ui.axis = [];
      modal('購入が完了しました',
        '<div class="msg msg-ok uma-bet-done">馬券の購入が完了しました。</div>' +
        '<table class="table uma-bet-receipt"><tbody>' +
        '<tr><th style="width:130px">受付番号</th><td class="uma-bet-receipt-id" style="font-family:monospace">' + res.bet.id + '</td></tr>' +
        '<tr><th>レース</th><td class="uma-bet-receipt-race">' + race.label + '　' + esc(race.name) + '</td></tr>' +
        '<tr><th>式別</th><td class="uma-bet-receipt-type">' + res.bet.typeName + '（' + res.bet.methodName + '）</td></tr>' +
        '<tr><th>点数 / 合計</th><td class="uma-bet-receipt-total">' + res.bet.combos.length + '点 / ' + yen(res.bet.total) + '</td></tr>' +
        '<tr><th>購入後残高</th><td><b class="uma-bet-receipt-balance">' + yen(res.balance) + '</b></td></tr>' +
        '</tbody></table>',
        '<button class="btn btn-ghost" data-close="1">続けて投票する</button>' +
        '<button class="btn btn-main" id="to-history">投票履歴を見る</button>');
      $('#to-history').addEventListener('click', function () { closeModal(); location.hash = '#/history'; });
      renderHeader();
      drawEntries(race, S.raceStatus(race));
      drawBetPanel(race, S.raceStatus(race));
      toast('馬券を購入しました（' + yen(res.bet.total) + '）');
    });
  }

  /* -------------------- オッズタブ */

  function oddsHtml(race) {
    var hs = race.horses;
    var html = '<div class="panel-body" style="padding:0">' +
      '<table class="table"><thead><tr><th style="width:44px">馬番</th><th>馬名</th>' +
      '<th class="num" style="width:90px">単勝</th><th class="num" style="width:90px">複勝</th>' +
      '<th class="center" style="width:60px">人気</th></tr></thead><tbody>' +
      hs.map(function (h) {
        return '<tr class="uma-odds-row" data-horse="' + h.num + '">' +
          '<td><span class="horse-num uma-odds-num">' + h.num + '</span></td>' +
          '<td class="uma-odds-name">' + esc(h.name) + '</td>' +
          '<td class="num uma-odds-win ' + (h.odds < 10 ? 'odds-hot' : '') + '">' + h.odds.toFixed(1) + '</td>' +
          '<td class="num uma-odds-place">' + h.fukuOdds.toFixed(1) + '</td>' +
          '<td class="center uma-odds-pop">' + h.popularity + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    // 馬連マトリクス
    html += '<h2 style="border-top:1px solid #d9e2dc">馬連オッズ表</h2><div class="panel-body" style="overflow:auto">' +
      '<table class="table" style="font-size:11.5px"><thead><tr><th></th>' +
      hs.map(function (h) { return '<th class="center">' + h.num + '</th>'; }).join('') + '</tr></thead><tbody>';
    hs.forEach(function (a) {
      html += '<tr><th>' + a.num + '</th>';
      hs.forEach(function (b) {
        if (a.num === b.num) { html += '<td class="center" style="background:#f3f7f4">—</td>'; return; }
        var o = B.oddsFor(race, 'umaren', [a.num, b.num]);
        html += '<td class="num ' + (o < 100 ? 'odds-hot' : '') + '">' + (o >= 1000 ? Math.round(o) : o.toFixed(1)) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody></table></div>';

    // 三連単・三連複 人気上位
    var tri = B.combinations(hs.map(function (h) { return h.num; }), 3)
      .map(function (c) { return { c: c, o: B.oddsFor(race, 'sanrenpuku', c) }; })
      .sort(function (x, y) { return x.o - y.o; }).slice(0, 30);
    html += '<h2 style="border-top:1px solid #d9e2dc">三連複 人気上位30点</h2><div class="panel-body">' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
      tri.map(function (x, i) {
        return '<div style="width:150px;border:1px solid #d9e2dc;border-radius:5px;padding:5px 8px;font-size:12px">' +
          '<span style="color:#6b7a72">' + (i + 1) + '番人気</span><br><b>' + x.c.join(' - ') + '</b>' +
          '<span style="float:right' + (x.o < 100 ? ';color:#b42318;font-weight:700' : '') + '">' + x.o.toFixed(1) + '</span></div>';
      }).join('') + '</div></div>';

    return html;
  }

  /* -------------------- 結果タブ */

  function resultHtml(race, st) {
    if (st !== 'confirmed') {
      return '<div class="empty">このレースはまだ確定していません。<br>' +
        'ヘッダーの「現在時刻（仮想）」を発走時刻（' + race.startTime + '）より後に変更すると結果が表示されます。</div>';
    }
    var res = D.getResult(race.key);
    var html = '<h2>着順</h2><div class="panel-body" style="padding:0">' +
      '<table class="table"><thead><tr><th style="width:60px" class="center">着順</th>' +
      '<th style="width:44px">枠</th><th style="width:44px">馬番</th><th>馬名</th>' +
      '<th style="width:110px">騎手</th><th class="num" style="width:80px">単勝</th></tr></thead><tbody>';
    res.order.forEach(function (n, i) {
      var h = race.horses[n - 1];
      html += '<tr class="uma-result-row" data-rank="' + (i + 1) + '" data-horse="' + h.num + '">' +
        '<td class="center uma-result-rank ' + (i < 3 ? 'pos-' + (i + 1) : '') + '"><b>' + (i + 1) + '</b></td>' +
        '<td><span class="uma-result-waku ' + wakuClass(h.waku) + '">' + h.waku + '</span></td>' +
        '<td><span class="horse-num uma-result-num">' + h.num + '</span></td>' +
        '<td class="uma-result-name">' + esc(h.name) + '</td>' +
        '<td class="uma-result-jockey">' + esc(h.jockey) + '</td>' +
        '<td class="num uma-result-odds">' + h.odds.toFixed(1) + '</td></tr>';
    });
    html += '</tbody></table></div>';

    html += '<h2 style="border-top:1px solid #d9e2dc">払戻金（100円あたり）</h2><div class="panel-body" style="padding:0">' +
      '<table class="table uma-payout-table"><thead><tr><th style="width:110px">式別</th><th style="width:140px">組み合わせ</th>' +
      '<th class="num">払戻金</th></tr></thead><tbody>' +
      B.racePayouts(race.key).map(function (p) {
        return '<tr class="uma-payout-row" data-type="' + p.type + '" data-combo="' + p.combo.join('-') + '">' +
          '<td class="uma-payout-type">' + p.type + '</td>' +
          '<td><b class="uma-payout-combo">' + p.label + '</b></td>' +
          '<td class="num uma-payout-amount" style="font-weight:700">' + yen(p.payout) + '</td></tr>';
      }).join('') + '</tbody></table></div>';

    var mine = S.betsFor(race.key);
    if (mine.length) {
      html += '<h2 style="border-top:1px solid #d9e2dc">あなたの投票結果</h2><div class="panel-body">' +
        mine.map(betCardHtml).join('') + '</div>';
    }
    return html;
  }

  /* ================================================ 投票履歴 */

  function viewHistory() {
    var u = S.currentUser();
    var sm = S.summary();
    var html = '<div class="pc-page-head"><h1>投票履歴</h1><p>' + esc(u.name) + ' 様の購入履歴</p></div>';

    html += '<div class="stat-row uma-summary">' +
      stat('購入点数', sm.count + ' 件', '', 'count') +
      stat('購入金額', yen(sm.total), '', 'total') +
      stat('払戻金額', yen(sm.payout), '', 'payout') +
      stat('収支', (sm.profit >= 0 ? '+' : '−') + yen(Math.abs(sm.profit)), sm.profit >= 0 ? 'plus' : 'minus', 'profit') +
      stat('的中率', sm.hitRate + ' %', '', 'hitrate') +
      '</div>';

    html += '<div class="panel"><h2>購入した馬券' +
      '<span><select id="hist-filter" class="uma-history-filter" style="width:auto;padding:5px 8px">' +
      '<option value="all">すべて</option><option value="pending">未確定</option>' +
      '<option value="hit">的中</option><option value="lose">不的中</option></select></span></h2>' +
      '<div class="panel-body" id="hist-body"></div></div>';

    view.innerHTML = html;

    function draw() {
      var f = $('#hist-filter').value;
      var list = u.bets.filter(function (b) { return f === 'all' || b.status === f; });
      $('#hist-body').innerHTML = list.length
        ? list.map(betCardHtml).join('')
        : '<div class="empty">該当する投票履歴がありません。</div>';
    }
    $('#hist-filter').addEventListener('change', draw);
    draw();
  }

  function stat(k, v, cls, key) {
    return '<div class="stat' + (key ? ' uma-summary-' + key : '') + '">' +
      '<div class="k">' + k + '</div>' +
      '<div class="v ' + (cls || '') + (key ? ' uma-summary-' + key + '-value' : '') + '">' + v + '</div></div>';
  }

  function betCardHtml(b) {
    var badge = b.status === 'hit' ? '<span class="badge badge-hit uma-bet-status">的中</span>'
      : b.status === 'lose' ? '<span class="badge badge-lose uma-bet-status">不的中</span>'
        : '<span class="badge badge-pending uma-bet-status">未確定</span>';
    var hitKeys = {};
    (b.hitCombos || []).forEach(function (c) { hitKeys[c.join('-')] = 1; });

    return '<div class="bet-card uma-bet-item" data-bet-id="' + b.id + '" data-status="' + b.status +
      '" data-race-key="' + b.raceKey + '"><div class="hd">' + badge +
      '<a class="uma-bet-race" href="#/race/' + b.raceKey + '?tab=result">' +
      '<b class="uma-bet-race-label">' + b.raceLabel + '</b> ' +
      '<span class="uma-bet-race-name">' + esc(b.raceName) + '</span></a>' +
      '<span style="color:#6b7a72">発走 ' + b.startTime + '</span>' +
      '<span class="id uma-bet-id">' + b.id + '</span></div>' +
      '<div class="bd"><div class="combos">' +
      '<div style="margin-bottom:6px"><b class="uma-bet-type-name">' + b.typeName + '</b>　' +
      '<span class="uma-bet-method-name">' + b.methodName + '</span>　' +
      '<span class="uma-bet-count">' + b.combos.length + '点</span></div>' +
      b.combos.map(function (c) {
        return '<span class="uma-bet-combo ' + (hitKeys[c.join('-')] ? 'hit' : '') +
          '" data-combo="' + c.join('-') + '">' + B.comboLabel(b.typeId, c) + '</span>';
      }).join('') + '</div>' +
      '<div class="amount">' +
      '<dl><dt>1点あたり</dt><dd class="uma-bet-unit">' + yen(b.amountPerCombo) + '</dd></dl>' +
      '<dl><dt>購入金額</dt><dd class="uma-bet-total">' + yen(b.total) + '</dd></dl>' +
      '<dl><dt>払戻金</dt><dd class="uma-bet-payout ' + (b.payout ? 'pay' : '') + '">' + yen(b.payout) + '</dd></dl>' +
      '<dl style="color:#6b7a72;font-size:11px"><dt>購入日時</dt>' +
      '<dd class="uma-bet-date" style="font-weight:400">' + b.createdAt + '</dd></dl>' +
      '</div></div></div>';
  }

  /* ================================================ 入出金 */

  function viewWallet(mode) {
    var u = S.currentUser();
    var html = '<div class="pc-page-head"><h1>入出金</h1><p>ご購入可能額の入金・出金を行います</p></div>';

    html += '<div class="panel"><div class="panel-body" style="display:flex;align-items:center;gap:40px">' +
      '<div><div style="font-size:12px;color:#6b7a72">ご購入可能額</div>' +
      '<div class="uma-wallet-balance" style="font-size:34px;font-weight:800;color:#0f5132">' + yen(u.balance) + '</div></div>' +
      '<div style="font-size:12.5px;color:#6b7a72;line-height:2">' +
      '登録口座：<span class="uma-wallet-bank">' + esc(u.bank) + '</span><br>' +
      '出金手数料：' + yen(S.WITHDRAW_FEE) + '／回　入金限度額：' + yen(S.MAX_DEPOSIT) + '／回</div>' +
      '</div></div>';

    html += '<div class="tabs uma-wallet-tabs">' +
      '<a class="uma-wallet-tab-deposit ' + (mode === 'deposit' ? 'on' : '') + '" href="#/wallet?mode=deposit">入金する</a>' +
      '<a class="uma-wallet-tab-withdraw ' + (mode === 'withdraw' ? 'on' : '') + '" href="#/wallet?mode=withdraw">出金する</a>' +
      '</div><div class="panel" style="border-radius:0 8px 8px 8px"><div class="panel-body" id="wallet-form"></div></div>';

    html += '<div class="panel"><h2>入出金・購入履歴</h2><div class="panel-body" style="padding:0">' +
      (u.txns.length ? '<table class="table uma-txn-table"><thead><tr>' +
        '<th style="width:170px">日時</th><th style="width:110px">区分</th><th>内容</th>' +
        '<th class="num" style="width:130px">金額</th><th class="num" style="width:130px">残高</th>' +
        '</tr></thead><tbody>' +
        u.txns.map(function (t) {
          var sign = t.amount >= 0 ? '+' : '−';
          var color = t.amount >= 0 ? '#157347' : '#b42318';
          return '<tr class="uma-txn-row" data-txn-type="' + t.type + '">' +
            '<td class="uma-txn-date" style="font-size:12px">' + t.createdAt + '</td>' +
            '<td class="uma-txn-label">' + t.label + '</td>' +
            '<td class="uma-txn-method" style="font-size:12.5px">' + esc(t.method || '') +
            (t.fee ? '<span class="uma-txn-fee" style="color:#6b7a72">（手数料 ' + yen(t.fee) + '）</span>' : '') + '</td>' +
            '<td class="num uma-txn-amount" style="color:' + color + ';font-weight:700">' + sign + yen(Math.abs(t.amount)) + '</td>' +
            '<td class="num uma-txn-balance">' + yen(t.balanceAfter) + '</td></tr>';
        }).join('') + '</tbody></table>'
        : '<div class="empty">入出金履歴はまだありません。</div>') +
      '</div></div>';

    view.innerHTML = html;
    mode === 'withdraw' ? drawWithdrawForm() : drawDepositForm();
  }

  function drawDepositForm() {
    $('#wallet-form').innerHTML =
      '<div class="uma-deposit-form">' +
      '<div id="wallet-msg" class="uma-form-error"></div>' +
      '<div class="form-row"><label>入金方法<span class="req">必須</span></label><div class="field">' +
      '<div class="inline-radio">' +
      S.DEPOSIT_METHODS.map(function (m, i) {
        return '<label class="uma-deposit-method" data-method="' + m.id + '">' +
          '<input type="radio" name="dep-method" value="' + m.id + '"' + (i === 0 ? ' checked' : '') + '>' +
          m.name + '<span style="color:#6b7a72;font-size:11px">（' + m.note + '）</span></label>';
      }).join('') + '</div></div></div>' +
      '<div class="form-row"><label>入金額<span class="req">必須</span></label><div class="field">' +
      '<input type="number" id="dep-amount" class="uma-deposit-amount" value="10000" step="100" min="1000" max="500000">' +
      '<div class="chips" style="margin-top:8px">' +
      [1000, 5000, 10000, 30000, 50000, 100000].map(function (a) {
        return '<button type="button" class="chip uma-deposit-amount-chip" data-dep="' + a + '">' + B.num(a) + '円</button>';
      }).join('') + '</div>' +
      '<div class="hint">100円単位／1回あたり ' + yen(S.MIN_DEPOSIT) + '〜' + yen(S.MAX_DEPOSIT) + '</div>' +
      '</div></div>' +
      '<div style="text-align:center;margin-top:18px">' +
      '<button class="btn btn-main btn-lg uma-deposit-submit" id="dep-go">入金する</button></div></div>';

    $$('[data-dep]').forEach(function (b) {
      b.addEventListener('click', function () { $('#dep-amount').value = b.getAttribute('data-dep'); });
    });
    $('#dep-go').addEventListener('click', function () {
      var m = $('input[name=dep-method]:checked').value;
      var res = S.deposit($('#dep-amount').value, m);
      if (!res.ok) { $('#wallet-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>'; return; }
      modal('入金が完了しました',
        '<div class="msg msg-ok uma-deposit-done">' + yen(res.amount) + ' を入金しました。</div>' +
        '<table class="table uma-deposit-receipt"><tbody>' +
        '<tr><th style="width:130px">入金方法</th><td class="uma-deposit-receipt-method">' + res.method + '</td></tr>' +
        '<tr><th>入金額</th><td class="uma-deposit-receipt-amount">' + yen(res.amount) + '</td></tr>' +
        '<tr><th>ご購入可能額</th><td><b class="uma-deposit-receipt-balance" style="font-size:18px">' + yen(res.balance) + '</b></td></tr>' +
        '</tbody></table>');
      toast('入金が完了しました');
      render();
    });
  }

  function drawWithdrawForm() {
    var u = S.currentUser();
    $('#wallet-form').innerHTML =
      '<div class="uma-withdraw-form">' +
      '<div id="wallet-msg" class="uma-form-error"></div>' +
      '<div class="form-row"><label>出金先口座</label><div class="field">' +
      '<div class="uma-withdraw-bank" style="padding-top:9px">' + esc(u.bank) + '</div>' +
      '<div class="hint">出金先口座の変更はマイページから行えます（デモのため変更は反映されません）。</div></div></div>' +
      '<div class="form-row"><label>出金額<span class="req">必須</span></label><div class="field">' +
      '<input type="number" id="wd-amount" class="uma-withdraw-amount" value="1000" step="100" min="1000">' +
      '<div class="chips" style="margin-top:8px">' +
      [1000, 5000, 10000, 50000].map(function (a) {
        return '<button type="button" class="chip uma-withdraw-amount-chip" data-wd="' + a + '">' + B.num(a) + '円</button>';
      }).join('') +
      '<button type="button" class="chip uma-withdraw-all" data-wd="all">全額出金</button></div>' +
      '<div class="hint">100円単位／出金手数料 ' + yen(S.WITHDRAW_FEE) + ' が別途かかります（残高から差し引き）。</div>' +
      '</div></div>' +
      '<div style="text-align:center;margin-top:18px">' +
      '<button class="btn btn-main btn-lg uma-withdraw-submit" id="wd-go">出金する</button></div></div>';

    $$('[data-wd]').forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-wd');
        if (v === 'all') {
          var max = Math.floor((u.balance - S.WITHDRAW_FEE) / 100) * 100;
          $('#wd-amount').value = Math.max(0, max);
        } else $('#wd-amount').value = v;
      });
    });
    $('#wd-go').addEventListener('click', function () {
      var res = S.withdraw($('#wd-amount').value);
      if (!res.ok) { $('#wallet-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>'; return; }
      modal('出金手続きが完了しました',
        '<div class="msg msg-ok uma-withdraw-done">' + yen(res.amount) + ' の出金手続きを受け付けました。</div>' +
        '<table class="table uma-withdraw-receipt"><tbody>' +
        '<tr><th style="width:130px">出金額</th><td class="uma-withdraw-receipt-amount">' + yen(res.amount) + '</td></tr>' +
        '<tr><th>手数料</th><td class="uma-withdraw-receipt-fee">' + yen(res.fee) + '</td></tr>' +
        '<tr><th>出金先</th><td class="uma-withdraw-receipt-bank">' + esc(u.bank) + '</td></tr>' +
        '<tr><th>ご購入可能額</th><td><b class="uma-withdraw-receipt-balance" style="font-size:18px">' + yen(res.balance) + '</b></td></tr>' +
        '</tbody></table>');
      toast('出金手続きが完了しました');
      render();
    });
  }

  /* ================================================ マイページ */

  function viewMypage() {
    var u = S.currentUser();
    var sm = S.summary();
    var html = '<div class="pc-page-head"><h1>マイページ</h1><p>会員情報・投票状況の確認</p></div>';

    html += '<div class="stat-row uma-summary">' +
      stat('ご購入可能額', '<span class="uma-wallet-balance">' + yen(u.balance) + '</span>', '', 'balance') +
      stat('購入金額（累計）', yen(sm.total), '', 'total') +
      stat('払戻金（累計）', yen(sm.payout), '', 'payout') +
      stat('収支', (sm.profit >= 0 ? '+' : '−') + yen(Math.abs(sm.profit)), sm.profit >= 0 ? 'plus' : 'minus', 'profit') +
      '</div>';

    html += '<div class="panel"><h2>会員情報</h2><div class="panel-body" style="padding:0">' +
      '<table class="table uma-mypage-table"><tbody>' +
      mrow('memberno', '会員番号', u.id.toUpperCase()) +
      mrow('loginid', 'ユーザーID', esc(u.loginId)) +
      mrow('name', 'お名前', esc(u.name)) +
      mrow('kana', 'フリガナ', esc(u.kana)) +
      mrow('birthday', '生年月日', u.birthday) +
      mrow('email', 'メールアドレス', esc(u.email)) +
      mrow('tel', '電話番号', esc(u.tel)) +
      mrow('bank', '登録口座', esc(u.bank)) +
      mrow('type', '区分', u.registered ? '新規登録ユーザー' : 'テストユーザー（' + esc(u.memo) + '）') +
      '</tbody></table></div></div>';

    html += '<div class="panel"><h2>最近の投票<span><a href="#/history">すべて見る</a></span></h2>' +
      '<div class="panel-body">' +
      (u.bets.length ? u.bets.slice(0, 3).map(betCardHtml).join('')
        : '<div class="empty">まだ投票がありません。<a href="#/">レース一覧から投票する</a></div>') +
      '</div></div>';

    html += '<div class="panel"><h2>操作</h2><div class="panel-body">' +
      '<a class="btn btn-main uma-goto-deposit" href="#/wallet?mode=deposit">入金する</a> ' +
      '<a class="btn btn-ghost uma-goto-withdraw" href="#/wallet?mode=withdraw">出金する</a> ' +
      '<button class="btn btn-danger uma-logout" id="mp-logout">ログアウト</button>' +
      '</div></div>';

    view.innerHTML = html;
    $('#mp-logout').addEventListener('click', function () {
      S.logout(); location.hash = '#/'; render(); toast('ログアウトしました');
    });
  }

  function row(k, v) { return '<tr><th style="width:190px">' + k + '</th><td>' + v + '</td></tr>'; }

  // マイページの会員情報行（テストから一意に特定できるようクラスを付ける）
  function mrow(key, k, v) {
    return '<tr class="uma-mypage-row uma-mypage-' + key + '" data-field="' + key + '">' +
      '<th style="width:190px" class="uma-mypage-label">' + k + '</th>' +
      '<td class="uma-mypage-value uma-mypage-' + key + '-value">' + v + '</td></tr>';
  }

  function deviceLabel(d) {
    return { pc: 'PC版', tablet: 'タブレット版', sp: 'スマートフォン版' }[d] || d;
  }

  /* ================================================ ログイン */

  function viewLogin() {
    if (S.isLoggedIn()) { location.hash = '#/mypage'; return; }
    view.innerHTML =
      '<div class="pc-page-head"><h1>ログイン</h1><p>会員の方はこちらからログインしてください</p></div>' +
      '<div style="display:flex;gap:18px;align-items:flex-start">' +
      '<div class="panel uma-login-form" style="flex:1"><h2>ログイン</h2><div class="panel-body">' +
      '<div id="login-msg" class="uma-form-error"></div>' +
      '<div class="form-row"><label>ユーザーID<span class="req">必須</span></label>' +
      '<div class="field"><input type="text" id="lg-id" class="uma-login-id" placeholder="user01" autocomplete="username"></div></div>' +
      '<div class="form-row"><label>パスワード<span class="req">必須</span></label>' +
      '<div class="field"><input type="password" id="lg-pw" class="uma-login-pw" placeholder="パスワード" autocomplete="current-password"></div></div>' +
      '<div style="text-align:center;margin-top:18px">' +
      '<button class="btn btn-main btn-lg uma-login-submit" id="lg-go">ログイン</button></div>' +
      '<div style="text-align:center;margin-top:14px;font-size:12.5px">' +
      'アカウントをお持ちでない方は <a href="#/register" class="uma-register-nav">新規会員登録</a></div>' +
      '</div></div>' +
      '<div class="panel" style="width:430px;flex:0 0 430px"><h2>テストアカウント</h2>' +
      '<div class="panel-body" style="padding:0">' + testUserTable() + '</div></div>' +
      '</div>';

    $('#lg-go').addEventListener('click', doLogin);
    $('#lg-pw').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    $$('[data-fill]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-fill');
        $('#lg-id').value = id;
        $('#lg-pw').value = testUserPassword(id);
      });
    });

    function doLogin() {
      var res = S.login($('#lg-id').value.trim(), $('#lg-pw').value);
      if (!res.ok) { $('#login-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>'; return; }
      toast('ようこそ ' + res.user.name + ' 様');
      location.hash = '#/';
      render();
    }
  }

  function testUserTable() {
    return '<table class="table uma-testuser-table"><thead><tr><th style="width:80px">ID</th><th>お名前</th>' +
      '<th style="width:170px">パスワード</th><th class="num" style="width:90px">残高</th><th style="width:60px"></th>' +
      '</tr></thead><tbody>' +
      D.TEST_USERS.map(function (u) {
        return '<tr class="uma-testuser-row" data-login-id="' + u.loginId + '">' +
          '<td><code class="uma-testuser-id">' + u.loginId + '</code></td>' +
          '<td><span class="uma-testuser-name">' + esc(u.name) + '</span>' +
          '<div class="uma-testuser-memo" style="font-size:11px;color:#6b7a72">' + esc(u.memo) + '</div></td>' +
          '<td><code class="uma-testuser-password" style="font-size:11.5px">' + esc(u.password) + '</code></td>' +
          '<td class="num uma-testuser-balance">' + yen(u.balance) + '</td>' +
          '<td><button class="btn btn-ghost btn-sm uma-testuser-fill" data-fill="' + u.loginId + '">入力</button></td></tr>';
      }).join('') +
      '</tbody></table><div style="padding:10px 14px;font-size:12px;color:#6b7a72">' +
      'パスワードは<b>アカウントごとに異なります</b>（16文字以上・英大小文字＋数字＋記号）。' +
      '「入力」ボタンでログインフォームに自動入力できます。</div>';
  }

  // ログインIDからテストユーザーのパスワードを引く
  function testUserPassword(loginId) {
    var u = D.TEST_USERS.filter(function (x) { return x.loginId === loginId; })[0];
    return u ? u.password : '';
  }

  /* ================================================ 会員登録 */

  function viewRegister() {
    view.innerHTML =
      '<div class="pc-page-head"><h1>新規会員登録</h1><p>デモサイトのため実在の個人情報は入力しないでください</p></div>' +
      '<div class="panel uma-register-form"><h2>お客様情報の入力</h2><div class="panel-body">' +
      '<div id="reg-msg" class="uma-form-error"></div>' +
      field('ユーザーID', '必須', rgInput('loginId', 'text', '半角英数字4〜20文字'), '半角英数字とアンダースコアが使用できます。') +
      field('パスワード', '必須', rgInput('password', 'password', S.MIN_PASSWORD + '文字以上'),
        S.MIN_PASSWORD + '文字以上で、英大文字・英小文字・数字・記号のうち3種類以上を含めてください。' +
        'ユーザーIDや推測されやすい文字列は使用できません。') +
      field('パスワード（確認）', '必須', rgInput('passwordConfirm', 'password')) +
      field('お名前', '必須', rgInput('name', 'text', '競馬 太郎')) +
      field('フリガナ', '必須', rgInput('kana', 'text', 'ケイバ タロウ')) +
      field('生年月日', '必須', rgInput('birthday', 'date', '', '1990-01-01'), '20歳以上の方のみご登録いただけます。') +
      field('メールアドレス', '必須', rgInput('email', 'email', 'taro@example.test')) +
      field('電話番号', '必須', rgInput('tel', 'tel', '090-0000-0000')) +
      field('出金先口座', '', rgInput('bank', 'text', '○○銀行 ○○支店 普通 1234567'), '後から登録することもできます。') +
      '<div class="form-row"><label>利用規約<span class="req">必須</span></label><div class="field">' +
      '<label style="display:flex;gap:8px;align-items:center">' +
      '<input type="checkbox" id="rg-agree" class="uma-register-agree" style="width:auto">' +
      '本サイトが架空のデモサイトであり、日本中央競馬会（JRA）等の実在の団体とは無関係であることを理解し、利用規約に同意します</label>' +
      '</div></div>' +
      '<div style="text-align:center;margin-top:20px">' +
      '<button class="btn btn-main btn-lg uma-register-submit" id="rg-go">この内容で登録する</button></div>' +
      '</div></div>';

    $('#rg-go').addEventListener('click', function () {
      var form = {};
      ['loginId', 'password', 'passwordConfirm', 'name', 'kana', 'birthday', 'email', 'tel', 'bank'].forEach(function (k) {
        form[k] = $('#rg-' + k).value.trim();
      });
      form.agree = $('#rg-agree').checked;
      var res = S.register(form);
      if (!res.ok) {
        $('#reg-msg').innerHTML = '<div class="msg msg-err">' + esc(res.error) + '</div>';
        window.scrollTo(0, 0);
        return;
      }
      modal('会員登録が完了しました',
        '<div class="msg msg-ok uma-register-done">ご登録ありがとうございます。そのままログインしました。</div>' +
        '<table class="table uma-register-receipt"><tbody>' +
        mrow('memberno', '会員番号', res.user.id.toUpperCase()) +
        mrow('loginid', 'ユーザーID', esc(res.user.loginId)) +
        mrow('name', 'お名前', esc(res.user.name)) +
        mrow('balance', 'ご購入可能額', '<b>' + yen(res.user.balance) + '</b>（まずは入金してください）') +
        '</tbody></table>',
        '<button class="btn btn-ghost" data-close="1">閉じる</button>' +
        '<button class="btn btn-main" id="rg-to-wallet">入金画面へ</button>');
      $('#rg-to-wallet').addEventListener('click', function () { closeModal(); location.hash = '#/wallet?mode=deposit'; });
      renderHeader();
      toast('会員登録が完了しました');
    });
  }

  function field(label, req, input, hint) {
    return '<div class="form-row"><label>' + label + (req ? '<span class="req">' + req + '</span>' : '') + '</label>' +
      '<div class="field">' + input + (hint ? '<div class="hint">' + hint + '</div>' : '') + '</div></div>';
  }

  // 会員登録の入力欄（id と同名のクラスを付けてテストから特定できるようにする）
  function rgInput(name, type, ph, val) {
    return '<input type="' + type + '" id="rg-' + name + '" class="uma-register-' + name + '"' +
      (ph ? ' placeholder="' + ph + '"' : '') + (val ? ' value="' + val + '"' : '') + '>';
  }

  /* ================================================ 免責事項 */

  function viewDisclaimer() {
    view.innerHTML =
      '<div class="pc-page-head"><h1>免責事項</h1><p>ご利用の前に必ずお読みください</p></div>' +
      '<div class="panel uma-disclaimer-page"><h2>本サイトについて</h2><div class="panel-body">' +
      '<div class="msg msg-err" style="font-size:14px;font-weight:700">' +
      '本サイトは架空のデモサイトです。日本中央競馬会（JRA）とは一切関係がありません。</div>' +
      '<ol class="uma-disclaimer-list" style="padding-left:1.3em;line-height:2">' +
      D.DISCLAIMER_LINES.map(function (t) { return '<li style="margin-bottom:10px">' + t + '</li>'; }).join('') +
      '</ol></div></div>' +
      '<div class="panel"><h2>架空データについて</h2><div class="panel-body" style="padding:0">' +
      '<table class="table"><tbody>' +
      row('競馬場', D.VENUES.map(function (v) { return v.name + '（' + v.kana + '）'; }).join(' / ') +
        '<div style="color:#6b7a72;font-size:12px">いずれも架空の競馬場です。</div>') +
      row('レース名', '重賞・一般競走を含め、すべて架空のレース名です。') +
      row('競走馬名', '架空の冠名と語を組み合わせて自動生成しています。') +
      row('騎手・調教師名', 'すべて架空の人物名です。') +
      row('オッズ・払戻金', '独自の計算式による架空の数値です。実際の配当とは一切関係ありません。') +
      row('入出金・馬券購入', '画面上の演出のみで、現実の金銭のやり取りは発生しません。') +
      '</tbody></table></div></div>';
  }

  /* ================================================ ヘルプ */

  function viewHelp() {
    view.innerHTML =
      '<div class="pc-page-head"><h1>ヘルプ・テスト情報</h1><p>本デモサイトの仕様一覧</p></div>' +

      '<div class="panel"><h2>このサイトについて</h2><div class="panel-body">' +
      '<p>ウマチケは、テスト自動化・UI検証のために作られた<b>架空の競馬投票サイト</b>です。' +
      '実在の競馬場・競走・団体とは一切関係がなく、実際の金銭のやり取りも発生しません。</p>' +
      '<p>PC・タブレット・スマートフォンで<b>それぞれ専用のHTML / CSS / JavaScript</b>を配信しており、' +
      'ウィンドウ幅を変えても表示は切り替わりません（レスポンシブではありません）。</p>' +
      '</div></div>' +

      '<div class="panel"><h2>表示端末の切り替え</h2><div class="panel-body">' +
      '<p>現在の表示：<b>PC版</b>（<code>/pc/index.html</code>）</p>' +
      '<table class="table" style="margin-bottom:14px"><tbody>' +
      row('自動判定結果', '<b>' + deviceLabel(S.naturalDevice()) + '</b>') +
      row('表示の固定', S.getDeviceOverride() ? '<b>' + deviceLabel(S.getDeviceOverride()) + '</b>に固定中' : 'なし（自動判定）') +
      row('User Agent', '<span style="font-size:11px;word-break:break-all">' + esc(navigator.userAgent) + '</span>') +
      '</tbody></table>' +
      '<p>端末専用ページのURLを直接開いた場合も、判定結果と違えば自動的に正しいページへ移動します。</p>' +
      '<p>' +
      '<a class="btn btn-ghost" href="../tablet/index.html?device=tablet">タブレット版を開く</a> ' +
      '<a class="btn btn-ghost" href="../sp/index.html?device=sp">スマホ版を開く</a> ' +
      '<a class="btn btn-ghost" href="../index.html?select=1">端末選択画面</a> ' +
      '<a class="btn btn-ghost" href="../index.html?reset=1">自動判定に戻す</a>' +
      '</p></div></div>' +

      '<div class="panel"><h2>テストアカウント</h2><div class="panel-body" style="padding:0">' +
      testUserTable() + '</div></div>' +

      '<div class="panel"><h2>仮想時刻とレースの状態</h2><div class="panel-body">' +
      '<p>ヘッダーの「現在時刻（仮想）」を 9:00〜18:00 で切り替えると、レースの状態が変化します。</p>' +
      '<table class="table"><thead><tr><th style="width:120px">状態</th><th>条件</th><th>できること</th></tr></thead><tbody>' +
      '<tr><td>' + statusBadge('onsale') + '</td><td>発走10分前まで</td><td>投票（馬券購入）できます</td></tr>' +
      '<tr><td>' + statusBadge('closed') + '</td><td>発走10分前〜発走5分後</td><td>投票できません（結果も未確定）</td></tr>' +
      '<tr><td>' + statusBadge('confirmed') + '</td><td>発走5分後以降</td><td>着順・払戻が確定し、自動精算されます</td></tr>' +
      '</tbody></table>' +
      '<p style="margin-top:10px">発走時刻は各競馬場とも 1R 10:00 から 30分間隔（12R 15:30）です。</p>' +
      '</div></div>' +

      '<div class="panel"><h2>式別と買い方</h2><div class="panel-body" style="padding:0">' +
      '<table class="table"><thead><tr><th style="width:110px">式別</th><th style="width:70px" class="center">必要頭数</th><th>内容</th></tr></thead><tbody>' +
      D.BET_TYPES.map(function (t) {
        return '<tr><td><b>' + t.name + '</b></td><td class="center">' + t.size + '頭</td><td>' + t.desc + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<table class="table" style="border-top:1px solid #d9e2dc"><thead><tr><th style="width:110px">方式</th><th>内容</th></tr></thead><tbody>' +
      D.BET_METHODS.map(function (m) {
        return '<tr><td><b>' + m.name + '</b></td><td>' + m.desc + '</td></tr>';
      }).join('') + '</tbody></table></div></div>' +

      '<div class="panel"><h2>入出金のルール</h2><div class="panel-body" style="padding:0">' +
      '<table class="table"><tbody>' +
      row('入金額', yen(S.MIN_DEPOSIT) + '〜' + yen(S.MAX_DEPOSIT) + '（100円単位）') +
      row('入金方法', S.DEPOSIT_METHODS.map(function (m) { return m.name; }).join(' / ')) +
      row('出金額', yen(S.MIN_WITHDRAW) + '以上（100円単位）') +
      row('出金手数料', yen(S.WITHDRAW_FEE) + '／回（残高から差し引き）') +
      row('馬券購入', '1点あたり ' + yen(S.MIN_BET_UNIT) + '〜' + yen(S.MAX_BET_UNIT) + '（100円単位）') +
      '</tbody></table></div></div>' +

      '<div class="panel"><h2>データのリセット</h2><div class="panel-body">' +
      '<p>会員情報・残高・投票履歴は <code>localStorage</code>（キー: <code>umatiket_state_v2</code>）に保存されます。' +
      '初期状態に戻す場合は以下のボタンを押してください（新規登録したアカウントも削除されます）。</p>' +
      '<button class="btn btn-danger" id="help-reset">デモデータを初期化する</button>' +
      '</div></div>';

    $('#help-reset').addEventListener('click', function () {
      modal('デモデータの初期化',
        '<p>すべての会員情報・残高・投票履歴を初期状態に戻します。よろしいですか？</p>',
        '<button class="btn btn-ghost" data-close="1">キャンセル</button>' +
        '<button class="btn btn-danger" id="help-reset-go">初期化する</button>');
      $('#help-reset-go').addEventListener('click', function () {
        S.resetAll(); closeModal(); location.hash = '#/'; render(); toast('デモデータを初期化しました');
      });
    });
  }

  /* ------------------------------------------------ 起動 */

  window.addEventListener('hashchange', render);
  render();
})();
