/* =========================================================
 * store.js  —  状態管理（localStorage 永続化）
 *   ・会員登録 / ログイン
 *   ・入出金（入金・出金・履歴）
 *   ・投票（馬券購入）・自動精算
 *   ・仮想時刻（レースの発売中／締切／確定を切り替える）
 * ========================================================= */
(function (global) {
  'use strict';

  var D = global.UmaData;
  var B = global.UmaBet;

  var STATE_KEY = 'umatiket_state_v1';
  var DEVICE_KEY = 'umatiket_device';

  var WITHDRAW_FEE = 220;          // 出金手数料
  var MIN_DEPOSIT = 1000;
  var MAX_DEPOSIT = 500000;
  var MIN_WITHDRAW = 1000;
  var MIN_BET_UNIT = 100;
  var MAX_BET_UNIT = 100000;

  var DEPOSIT_METHODS = [
    { id: 'bank', name: 'ネット銀行', note: '即時反映（デモ）' },
    { id: 'credit', name: 'クレジットカード', note: '手数料無料' },
    { id: 'conveni', name: 'コンビニ入金', note: '即時反映（デモ）' }
  ];

  /* ------------------------------------------------ ユーティリティ */

  function pad(n, l) { return ('000000' + n).slice(-l); }

  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2) +
      ' ' + pad(d.getHours(), 2) + ':' + pad(d.getMinutes(), 2) + ':' + pad(d.getSeconds(), 2);
  }

  function genId(prefix) {
    var d = new Date();
    var rand = pad(Math.floor(Math.random() * 10000), 4);
    return prefix + '-' + d.getFullYear() + pad(d.getMonth() + 1, 2) + pad(d.getDate(), 2) +
      '-' + pad(d.getHours(), 2) + pad(d.getMinutes(), 2) + pad(d.getSeconds(), 2) + '-' + rand;
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ------------------------------------------------ 初期データ */

  function seedState() {
    var accounts = {};
    D.TEST_USERS.forEach(function (u) {
      var a = clone(u);
      a.txns = [];
      a.bets = [];
      a.registered = false;
      accounts[a.id] = a;
    });

    // 初期入出金履歴（履歴画面が空にならないように）
    pushSeedTxn(accounts.u001, 'deposit', 30000, '2026-09-20 11:02:31', 'ネット銀行', 30000);
    pushSeedTxn(accounts.u001, 'deposit', 20000, '2026-09-24 20:15:08', 'クレジットカード', 50000);
    pushSeedTxn(accounts.u002, 'deposit', 300000, '2026-09-13 09:44:12', 'ネット銀行', 300000);
    pushSeedTxn(accounts.u002, 'withdraw', -50220, '2026-09-19 18:30:55', '登録口座', 249780);
    pushSeedTxn(accounts.u002, 'deposit', 220, '2026-09-21 12:00:00', 'コンビニ入金', 250000);
    pushSeedTxn(accounts.u003, 'deposit', 5000, '2026-09-15 08:12:40', 'コンビニ入金', 5000);
    pushSeedTxn(accounts.u003, 'withdraw', -4200, '2026-09-22 22:05:19', '登録口座', 800);
    pushSeedTxn(accounts.u004, 'deposit', 10000, '2026-09-11 19:23:00', 'ネット銀行', 10000);
    pushSeedTxn(accounts.u004, 'deposit', 2000, '2026-09-25 07:41:33', 'クレジットカード', 12000);

    return { accounts: accounts, sessionUserId: null, virtualHour: 9 };
  }

  function pushSeedTxn(acc, type, amount, at, method, after) {
    acc.txns.push({
      id: 'TX-SEED-' + pad(acc.txns.length + 1, 4),
      type: type,
      amount: amount,
      fee: type === 'withdraw' ? WITHDRAW_FEE : 0,
      method: method,
      label: type === 'deposit' ? '入金' : '出金',
      balanceAfter: after,
      createdAt: at
    });
  }

  /* ------------------------------------------------ 読み書き */

  var state = load();

  function load() {
    try {
      var raw = localStorage.getItem(STATE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.accounts) return s;
      }
    } catch (e) { /* 破損時は初期化 */ }
    var fresh = seedState();
    save(fresh);
    return fresh;
  }

  function save(s) {
    try { localStorage.setItem(STATE_KEY, JSON.stringify(s || state)); } catch (e) { }
  }

  var listeners = [];
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { } }); }
  function commit() { save(state); emit(); }

  /* ------------------------------------------------ 仮想時刻 */

  function nowMinutes() { return state.virtualHour * 60; }

  function nowLabel() { return pad(state.virtualHour, 2) + ':00'; }

  function setVirtualHour(h) {
    h = Math.max(9, Math.min(18, Number(h) || 9));
    state.virtualHour = h;
    settle();
    commit();
  }

  /* レースの状態
   *   onsale    : 発売中（投票可能）
   *   closed    : 締切（発走前後）
   *   confirmed : 確定（結果・払戻あり）
   */
  function raceStatus(race) {
    var now = nowMinutes();
    if (now < race.startMinutes - 10) return 'onsale';
    if (now < race.startMinutes + 5) return 'closed';
    return 'confirmed';
  }

  var STATUS_LABEL = { onsale: '発売中', closed: '締切', confirmed: '確定' };

  /* ------------------------------------------------ 認証 */

  function currentUser() {
    return state.sessionUserId ? state.accounts[state.sessionUserId] : null;
  }

  function isLoggedIn() { return !!currentUser(); }

  function login(loginId, password) {
    var found = null;
    Object.keys(state.accounts).forEach(function (k) {
      var a = state.accounts[k];
      if (a.loginId === loginId) found = a;
    });
    if (!found) return { ok: false, error: 'ユーザーIDが登録されていません。' };
    if (found.password !== password) return { ok: false, error: 'パスワードが正しくありません。' };
    state.sessionUserId = found.id;
    settle();
    commit();
    return { ok: true, user: found };
  }

  function logout() {
    state.sessionUserId = null;
    commit();
  }

  function register(form) {
    var required = [
      ['loginId', 'ユーザーID'], ['password', 'パスワード'], ['name', 'お名前'],
      ['kana', 'フリガナ'], ['email', 'メールアドレス'], ['birthday', '生年月日'], ['tel', '電話番号']
    ];
    for (var i = 0; i < required.length; i++) {
      if (!form[required[i][0]]) return { ok: false, error: required[i][1] + 'を入力してください。' };
    }
    if (!/^[A-Za-z0-9_]{4,20}$/.test(form.loginId)) {
      return { ok: false, error: 'ユーザーIDは半角英数字・アンダースコア4〜20文字で入力してください。' };
    }
    if (String(form.password).length < 8) {
      return { ok: false, error: 'パスワードは8文字以上で入力してください。' };
    }
    if (form.password !== form.passwordConfirm) {
      return { ok: false, error: 'パスワードが一致しません。' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return { ok: false, error: 'メールアドレスの形式が正しくありません。' };
    }
    var dup = false;
    Object.keys(state.accounts).forEach(function (k) {
      if (state.accounts[k].loginId === form.loginId) dup = true;
    });
    if (dup) return { ok: false, error: 'このユーザーIDは既に使用されています。' };
    if (!form.agree) return { ok: false, error: '利用規約への同意が必要です。' };
    if (age(form.birthday) < 20) return { ok: false, error: '20歳未満の方はご登録いただけません。' };

    var id = 'u' + pad(Object.keys(state.accounts).length + 1, 3);
    var acc = {
      id: id, loginId: form.loginId, password: form.password, name: form.name,
      kana: form.kana, email: form.email, birthday: form.birthday, tel: form.tel,
      bank: form.bank || '未登録', balance: 0, memo: '新規登録ユーザー',
      txns: [], bets: [], registered: true
    };
    state.accounts[id] = acc;
    state.sessionUserId = id;
    commit();
    return { ok: true, user: acc };
  }

  function age(birthday) {
    var b = new Date(birthday);
    if (isNaN(b.getTime())) return 0;
    var t = new Date('2026-09-27');
    var a = t.getFullYear() - b.getFullYear();
    var m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return a;
  }

  /* ------------------------------------------------ 入出金 */

  function addTxn(acc, txn) {
    txn.id = txn.id || genId('TX');
    txn.createdAt = txn.createdAt || stamp();
    txn.balanceAfter = acc.balance;
    acc.txns.unshift(txn);
  }

  function deposit(amount, methodId) {
    var acc = currentUser();
    if (!acc) return { ok: false, error: 'ログインしてください。' };
    amount = Number(amount);
    if (!amount || amount <= 0) return { ok: false, error: '入金額を入力してください。' };
    if (amount % 100 !== 0) return { ok: false, error: '入金額は100円単位で入力してください。' };
    if (amount < MIN_DEPOSIT) return { ok: false, error: '入金は' + B.yen(MIN_DEPOSIT) + '以上から可能です。' };
    if (amount > MAX_DEPOSIT) return { ok: false, error: '1回の入金上限は' + B.yen(MAX_DEPOSIT) + 'です。' };
    var m = DEPOSIT_METHODS.filter(function (x) { return x.id === methodId; })[0];
    if (!m) return { ok: false, error: '入金方法を選択してください。' };

    acc.balance += amount;
    addTxn(acc, { type: 'deposit', label: '入金', amount: amount, fee: 0, method: m.name });
    commit();
    return { ok: true, amount: amount, balance: acc.balance, method: m.name };
  }

  function withdraw(amount) {
    var acc = currentUser();
    if (!acc) return { ok: false, error: 'ログインしてください。' };
    amount = Number(amount);
    if (!amount || amount <= 0) return { ok: false, error: '出金額を入力してください。' };
    if (amount % 100 !== 0) return { ok: false, error: '出金額は100円単位で入力してください。' };
    if (amount < MIN_WITHDRAW) return { ok: false, error: '出金は' + B.yen(MIN_WITHDRAW) + '以上から可能です。' };
    if (amount + WITHDRAW_FEE > acc.balance) {
      return { ok: false, error: '残高が不足しています（手数料' + B.yen(WITHDRAW_FEE) + 'が別途必要です）。' };
    }
    acc.balance -= (amount + WITHDRAW_FEE);
    addTxn(acc, {
      type: 'withdraw', label: '出金', amount: -amount, fee: WITHDRAW_FEE,
      method: acc.bank || '登録口座'
    });
    commit();
    return { ok: true, amount: amount, fee: WITHDRAW_FEE, balance: acc.balance };
  }

  /* ------------------------------------------------ 投票 */

  function placeBet(raceKey, typeId, methodId, combos, amountPerCombo) {
    var acc = currentUser();
    if (!acc) return { ok: false, error: 'ログインしてください。' };

    var race = D.getRace(raceKey);
    if (!race) return { ok: false, error: 'レースが見つかりません。' };
    if (raceStatus(race) !== 'onsale') return { ok: false, error: 'このレースは締め切られています。' };

    var t = D.betType(typeId);
    if (!t) return { ok: false, error: '式別を選択してください。' };
    if (!combos || !combos.length) return { ok: false, error: '買い目が確定していません。馬を選択してください。' };

    amountPerCombo = Number(amountPerCombo);
    if (!amountPerCombo || amountPerCombo % MIN_BET_UNIT !== 0) {
      return { ok: false, error: '金額は' + MIN_BET_UNIT + '円単位で入力してください。' };
    }
    if (amountPerCombo < MIN_BET_UNIT) return { ok: false, error: '1点あたり' + B.yen(MIN_BET_UNIT) + '以上で入力してください。' };
    if (amountPerCombo > MAX_BET_UNIT) return { ok: false, error: '1点あたりの上限は' + B.yen(MAX_BET_UNIT) + 'です。' };

    var total = amountPerCombo * combos.length;
    if (total > acc.balance) {
      return { ok: false, error: '残高が不足しています（購入額 ' + B.yen(total) + ' / 残高 ' + B.yen(acc.balance) + '）。' };
    }

    var methodName = (D.BET_METHODS.filter(function (m) { return m.id === methodId; })[0] || {}).name || '通常';
    var bet = {
      id: genId('UT'),
      raceKey: race.key,
      raceLabel: race.label,
      raceName: race.name,
      raceDate: D.RACE_DATE_LABEL,
      startTime: race.startTime,
      typeId: typeId,
      typeName: t.name,
      methodId: methodId,
      methodName: methodName,
      combos: combos.map(function (c) { return c.slice(); }),
      amountPerCombo: amountPerCombo,
      total: total,
      createdAt: stamp(),
      status: 'pending',
      payout: 0,
      hitCombos: []
    };

    acc.balance -= total;
    acc.bets.unshift(bet);
    addTxn(acc, {
      type: 'bet', label: '馬券購入', amount: -total, fee: 0,
      method: race.label + ' ' + t.name + '（' + combos.length + '点）', betId: bet.id
    });
    settle();
    commit();
    return { ok: true, bet: bet, balance: acc.balance };
  }

  /* ------------------------------------------------ 自動精算 */

  function settle() {
    var acc = currentUser();
    if (!acc) return;
    var changed = false;

    acc.bets.forEach(function (bet) {
      if (bet.status !== 'pending') return;
      var race = D.getRace(bet.raceKey);
      if (!race || raceStatus(race) !== 'confirmed') return;

      var result = D.getResult(bet.raceKey);
      var payout = 0, hits = [];
      bet.combos.forEach(function (c) {
        var p = B.payoutOf(race, result, bet.typeId, c, bet.amountPerCombo);
        if (p > 0) { payout += p; hits.push(c); }
      });

      bet.status = payout > 0 ? 'hit' : 'lose';
      bet.payout = payout;
      bet.hitCombos = hits;
      bet.settledAt = stamp();

      if (payout > 0) {
        acc.balance += payout;
        addTxn(acc, {
          type: 'payout', label: '払戻金', amount: payout, fee: 0,
          method: race.label + ' ' + bet.typeName, betId: bet.id
        });
      }
      changed = true;
    });

    if (changed) save(state);
  }

  /* ------------------------------------------------ 集計 */

  function summary() {
    var acc = currentUser();
    if (!acc) return { count: 0, total: 0, payout: 0, profit: 0, hit: 0, hitRate: 0 };
    var total = 0, payout = 0, hit = 0, settled = 0;
    acc.bets.forEach(function (b) {
      total += b.total;
      payout += b.payout;
      if (b.status !== 'pending') { settled++; if (b.status === 'hit') hit++; }
    });
    return {
      count: acc.bets.length,
      total: total,
      payout: payout,
      profit: payout - total,
      hit: hit,
      settled: settled,
      hitRate: settled ? Math.round(hit / settled * 1000) / 10 : 0
    };
  }

  function betsFor(raceKey) {
    var acc = currentUser();
    if (!acc) return [];
    return acc.bets.filter(function (b) { return Number(b.raceKey) === Number(raceKey); });
  }

  /* ------------------------------------------------ デバイス切替 */

  function detectDevice() {
    var forced = getDeviceOverride();
    if (forced) return forced;
    var ua = navigator.userAgent;
    if (/iPad|Android(?!.*Mobile)|Tablet|PlayBook|Silk/i.test(ua)) return 'tablet';
    if (/iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Mobile Safari/i.test(ua)) return 'sp';
    var w = window.screen && window.screen.width ? window.screen.width : window.innerWidth;
    if (w <= 767) return 'sp';
    if (w <= 1024) return 'tablet';
    return 'pc';
  }

  function getDeviceOverride() {
    try {
      var q = new RegExp('[?&]device=(pc|tablet|sp)').exec(location.search);
      if (q) { localStorage.setItem(DEVICE_KEY, q[1]); return q[1]; }
      return localStorage.getItem(DEVICE_KEY) || '';
    } catch (e) { return ''; }
  }

  function setDevice(d) {
    try { localStorage.setItem(DEVICE_KEY, d); } catch (e) { }
  }

  function clearDevice() {
    try { localStorage.removeItem(DEVICE_KEY); } catch (e) { }
  }

  /* ------------------------------------------------ リセット */

  function resetAll() {
    state = seedState();
    save(state);
    emit();
  }

  /* ------------------------------------------------ export */

  global.UmaStore = {
    WITHDRAW_FEE: WITHDRAW_FEE,
    MIN_DEPOSIT: MIN_DEPOSIT,
    MAX_DEPOSIT: MAX_DEPOSIT,
    MIN_WITHDRAW: MIN_WITHDRAW,
    MIN_BET_UNIT: MIN_BET_UNIT,
    MAX_BET_UNIT: MAX_BET_UNIT,
    DEPOSIT_METHODS: DEPOSIT_METHODS,
    STATUS_LABEL: STATUS_LABEL,

    get state() { return state; },
    subscribe: function (fn) { listeners.push(fn); },

    currentUser: currentUser,
    isLoggedIn: isLoggedIn,
    login: login,
    logout: logout,
    register: register,

    deposit: deposit,
    withdraw: withdraw,
    placeBet: placeBet,
    settle: settle,
    summary: summary,
    betsFor: betsFor,

    virtualHour: function () { return state.virtualHour; },
    setVirtualHour: setVirtualHour,
    nowMinutes: nowMinutes,
    nowLabel: nowLabel,
    raceStatus: raceStatus,

    detectDevice: detectDevice,
    getDeviceOverride: getDeviceOverride,
    setDevice: setDevice,
    clearDevice: clearDevice,
    resetAll: resetAll
  };
})(window);
