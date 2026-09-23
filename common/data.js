/* =========================================================
 * data.js  —  マスタデータ & 決定論的レース生成
 * 競馬投票デモサイト「ウマチケ」
 * ---------------------------------------------------------
 * 全データは raceKey を seed とした LCG で決定論的に生成する。
 * よって何度リロードしても同じ出馬表・同じ結果になる。
 * ========================================================= */
(function (global) {
  'use strict';

  /* ------------------------------------------------ 基本定義 */

  /* 免責文（全端末で共通して表示する）
   * 本サイトは実在の競馬とは無関係の架空サイトであり、
   * 競馬場名・レース名・馬名・騎手名・調教師名はすべて架空のものを使用する。 */
  var DISCLAIMER_SHORT =
    '本サイトはテスト・学習用のデモサイトです。日本中央競馬会（JRA）をはじめ実在の団体とは一切関係ありません。';

  var DISCLAIMER_LINES = [
    '本サイト「ウマチケ（UMATIKET）」は、テスト自動化・UI検証・学習を目的として作成された<b>架空の競馬投票デモサイト</b>です。',
    '<b>日本中央競馬会（JRA）および地方競馬全国協会（NAR）、その他実在のいかなる団体・企業とも一切関係がありません。</b>公式サイトでもなければ、提携・監修・許諾を受けたものでもありません。',
    '登場する<b>競馬場名・レース名・競走馬名・騎手名・調教師名・オッズ・払戻金は、すべて架空のものです。</b>実在の競馬場、競走、競走馬、騎手、調教師、人物、団体とは一切関係がありません。',
    '本サイトでは<b>実際の馬券の購入はできません。</b>入金・出金・投票はすべて画面上の演出であり、現実の金銭のやり取りは一切発生しません。入力された情報はご利用のブラウザ内にのみ保存されます。',
    '本サイトは<b>投票行為を推奨するものではありません。</b>実際の公営競技は20歳以上の方のみが法令に従って利用できます。',
    '本サイトの利用により生じたいかなる損害についても、作成者は責任を負いません。'
  ];

  var RACE_DATE = '2026-09-27';
  var RACE_DATE_LABEL = '2026年9月27日(日)';

  // 競馬場（すべて架空）
  var VENUES = [
    { idx: 0, id: 'aomine', name: '青嶺', kana: 'あおみね', color: '#1d4ed8' },
    { idx: 1, id: 'sakura', name: '桜堤', kana: 'さくらづつみ', color: '#b91c1c' },
    { idx: 2, id: 'takaoka', name: '鷹丘', kana: 'たかおか', color: '#047857' }
  ];

  // 重賞（10R / 11R のみ・すべて架空のレース名）
  var GRADE_RACES = {
    aomine: { 10: { name: '銀嶺ステークス', grade: 'GIII' }, 11: { name: '青嶺記念', grade: 'GII' } },
    sakura: { 10: { name: '花水木ステークス', grade: 'GII' }, 11: { name: '桜堤大賞典', grade: 'GII' } },
    takaoka: { 10: { name: '鷹ノ羽特別', grade: 'OP' }, 11: { name: '鷹丘杯', grade: 'GIII' } }
  };

  // 一般競走名（すべて架空）
  var RACE_NAMES = [
    '2歳新馬', '2歳未勝利', '3歳未勝利', '3歳以上1勝クラス',
    '3歳以上2勝クラス', '木漏れ日特別', '3歳以上1勝クラス', '宵待ステークス',
    '3歳以上3勝クラス'
  ];

  var SURFACES = ['芝', 'ダート'];
  var DISTANCES = [1200, 1400, 1600, 1800, 2000, 2200, 2400];

  /* 馬名は「架空の冠名 + 架空の語」で合成する。
   * 実在の冠名（サクラ / メイショウ / ダイワ 等）は使用しない。 */
  var NAME_HEAD = ['アカツキ', 'ハルカゼ', 'ミドリノ', 'ヤマブキ', 'シラナミ', 'ツクヨミ',
    'オオゾラ', 'カガヤキ', 'ハヤテノ', 'ユキハナ', 'クレナイ', 'アオイロ',
    'ホシフリ', 'ツキカゲ', 'イカヅチ', 'ソラモヨウ', 'ハナビラ', 'キリノミネ',
    'ナギサノ', 'タカラギ', 'コトブキ', 'アサカゼ', 'フウライ', 'ミナモト'];

  var NAME_TAIL = ['ブレイズ', 'グロウス', 'ヴァルト', 'ノクターン', 'セレスト', 'フィオーレ',
    'ミラージュ', 'オラクル', 'ソナタ', 'プリズム', 'ヴェルデ', 'ラピス',
    'クレスト', 'エトワール', 'ルミナス', 'ゼファー', 'オーロラ', 'カルテット',
    'パルス', 'アリア', 'フォルテ', 'リュミエール', 'セイレーン', 'ノヴァ'];

  // 騎手（架空）
  var JOCKEYS = ['一ノ瀬 諒', '天堂 圭吾', '白鳥 隼人', '月岡 慎', '紅林 大地', '風間 律',
    '剣崎 悠真', '氷室 陽介', '鷲尾 拓真', '神崎 蓮司', '遠野 涼太', '桐生 湊',
    '橘 直人', '獅子堂 巧', '鳴海 諒介', '飛鳥井 遥', '久遠 雅人', '柳瀬 千尋'];

  // 調教師（架空）
  var TRAINERS = ['早乙女 和成', '御剣 隆之', '冴島 徹', '灰原 秀明', '宮杜 伸也',
    '卯月 康孝', '皆川 静', '真行寺 勇', '六車 泰三', '東雲 光'];

  var SEXES = ['牡', '牝', 'セ'];

  /* ------------------------------------------------ 式別定義 */

  var BET_TYPES = [
    { id: 'tan', name: '単勝', short: '単', size: 1, ordered: false, desc: '1着になる馬を当てる' },
    { id: 'fuku', name: '複勝', short: '複', size: 1, ordered: false, desc: '3着以内に入る馬を当てる' },
    { id: 'umaren', name: '馬連', short: '馬連', size: 2, ordered: false, desc: '1・2着の組み合わせ（順不同）' },
    { id: 'umatan', name: '馬単', short: '馬単', size: 2, ordered: true, desc: '1・2着を着順どおりに当てる' },
    { id: 'wide', name: 'ワイド', short: 'ワイド', size: 2, ordered: false, desc: '3着以内に入る2頭の組み合わせ' },
    { id: 'sanrenpuku', name: '三連複', short: '3連複', size: 3, ordered: false, desc: '1〜3着の組み合わせ（順不同）' },
    { id: 'sanrentan', name: '三連単', short: '3連単', size: 3, ordered: true, desc: '1〜3着を着順どおりに当てる' }
  ];

  var BET_METHODS = [
    { id: 'normal', name: '通常', desc: '選んだ馬で1点（単複は選んだ頭数だけ）' },
    { id: 'box', name: 'ボックス', desc: '選んだ馬の全組み合わせ' },
    { id: 'nagashi', name: 'ながし', desc: '軸馬 × 相手馬の組み合わせ' }
  ];

  /* ------------------------------------------------ テストユーザー */

  /* テストユーザー
   * パスワードはアカウントごとに異なる16文字以上とし、
   * 英大文字・英小文字・数字・記号をすべて含める（ユーザーIDから推測できないもの）。 */
  var TEST_USERS = [
    {
      id: 'u001', loginId: 'user01', password: 'Zx7#Harukaze-Mine', name: '山田 太郎',
      kana: 'ヤマダ タロウ', email: 'yamada.taro@umatiket.test', birthday: '1985-04-12',
      tel: '090-1111-0001', bank: 'ウマ銀行 本店 普通 1234567',
      balance: 50000, memo: '標準的な残高のユーザー'
    },
    {
      id: 'u002', loginId: 'user02', password: 'Qr4$Tsukikage-Bay', name: '鈴木 花子',
      kana: 'スズキ ハナコ', email: 'suzuki.hanako@umatiket.test', birthday: '1992-11-03',
      tel: '090-1111-0002', bank: 'ケイバ信用金庫 中央支店 普通 2345678',
      balance: 250000, memo: '高額残高ユーザー'
    },
    {
      id: 'u003', loginId: 'user03', password: 'Vm9%Aomine-Ridge', name: '田中 次郎',
      kana: 'タナカ ジロウ', email: 'tanaka.jiro@umatiket.test', birthday: '1978-06-25',
      tel: '090-1111-0003', bank: 'ターフ銀行 駅前支店 普通 3456789',
      balance: 800, memo: '残高不足の検証用ユーザー'
    },
    {
      id: 'u004', loginId: 'user04', password: 'Tp2!Sakura-Levee', name: '佐藤 美咲',
      kana: 'サトウ ミサキ', email: 'sato.misaki@umatiket.test', birthday: '1999-01-18',
      tel: '090-1111-0004', bank: 'ウマ銀行 みどり支店 普通 4567890',
      balance: 12000, memo: '入出金履歴を持つユーザー'
    },
    {
      id: 'u005', loginId: 'user05', password: 'Ls6@Takaoka-Crest', name: '中村 竜也',
      kana: 'ナカムラ タツヤ', email: 'nakamura.tatsuya@umatiket.test', birthday: '1965-09-30',
      tel: '090-1111-0005', bank: 'ケイバ信用金庫 南支店 普通 5678901',
      balance: 0, memo: '残高0・初回入金の検証用ユーザー'
    }
  ];

  /* ------------------------------------------------ 乱数 (LCG) */

  function lcg(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function pick(rnd, arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function range(rnd, min, max) { return min + Math.floor(rnd() * (max - min + 1)); }

  /* ------------------------------------------------ raceKey */

  // raceKey = venueIdx * 100 + round   (例: 阪神11R -> 111)
  function raceKey(venueIdx, round) { return venueIdx * 100 + round; }

  function parseKey(key) {
    key = Number(key);
    return { venueIdx: Math.floor(key / 100), round: key % 100 };
  }

  /* ------------------------------------------------ 発走時刻 */

  // 1R 10:00 → 12R 15:30（30分間隔）
  function startMinutes(round) { return 10 * 60 + (round - 1) * 30; }

  function startTimeLabel(round) {
    var m = startMinutes(round);
    return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2);
  }

  /* ------------------------------------------------ 枠番 */

  function wakuOf(num, total) {
    if (total <= 8) return num;
    var base = Math.floor(total / 8), extra = total % 8, n = 0;
    for (var w = 1; w <= 8; w++) {
      n += base + (w > 8 - extra ? 1 : 0);
      if (num <= n) return w;
    }
    return 8;
  }

  /* ------------------------------------------------ レース生成 */

  var _raceCache = {};

  function getRace(key) {
    key = Number(key);
    if (_raceCache[key]) return _raceCache[key];

    var pk = parseKey(key);
    var venue = VENUES[pk.venueIdx];
    if (!venue || pk.round < 1 || pk.round > 12) return null;

    var rnd = lcg(key * 7919 + 104729);
    var count = range(rnd, 10, 18);

    var gradeInfo = (GRADE_RACES[venue.id] || {})[pk.round];
    var name, grade;
    if (gradeInfo) { name = gradeInfo.name; grade = gradeInfo.grade; }
    else { name = RACE_NAMES[(key + pk.round) % RACE_NAMES.length]; grade = ''; }

    var surface = gradeInfo ? '芝' : pick(rnd, SURFACES);
    // 重賞はマイル以上の距離に限定する
    var distance = pick(rnd, gradeInfo ? DISTANCES.slice(2) : DISTANCES);

    var used = {}, horses = [], strengths = [], i;
    for (i = 1; i <= count; i++) {
      var hname;
      do { hname = pick(rnd, NAME_HEAD) + pick(rnd, NAME_TAIL); } while (used[hname]);
      used[hname] = true;

      strengths.push(Math.pow(rnd(), 2.1) + 0.02);
      horses.push({
        num: i,
        waku: wakuOf(i, count),
        name: hname,
        sex: pick(rnd, SEXES),
        age: range(rnd, 3, 7),
        weight: 52 + Math.floor(rnd() * 8),
        jockey: JOCKEYS[(key * 3 + i * 5) % JOCKEYS.length],
        trainer: TRAINERS[(key + i * 3) % TRAINERS.length],
        bodyWeight: range(rnd, 428, 522),
        bodyDiff: range(rnd, -12, 12)
      });
    }

    // 勝率へ正規化 → 単勝・複勝オッズ
    var sum = strengths.reduce(function (a, b) { return a + b; }, 0);
    for (i = 0; i < horses.length; i++) {
      var p = strengths[i] / sum;
      horses[i].winProb = p;
      horses[i].odds = Math.max(1.1, Math.round((0.8 / p) * 10) / 10);
      horses[i].fukuOdds = Math.max(1.0, Math.round((0.8 / Math.min(0.95, p * 2.6)) * 10) / 10);
    }
    horses.slice().sort(function (a, b) { return a.odds - b.odds; })
      .forEach(function (h, idx) { h.popularity = idx + 1; });

    var race = {
      key: key,
      venueIdx: pk.venueIdx,
      venueId: venue.id,
      venueName: venue.name,
      venueColor: venue.color,
      round: pk.round,
      label: venue.name + pk.round + 'R',
      name: name,
      grade: grade,
      surface: surface,
      distance: distance,
      courseLabel: surface + distance + 'm',
      startMinutes: startMinutes(pk.round),
      startTime: startTimeLabel(pk.round),
      horses: horses,
      count: count
    };
    _raceCache[key] = race;
    return race;
  }

  function allRaces() {
    var list = [];
    for (var v = 0; v < VENUES.length; v++) {
      for (var r = 1; r <= 12; r++) list.push(getRace(raceKey(v, r)));
    }
    return list;
  }

  function venueRaces(venueIdx) {
    var list = [];
    for (var r = 1; r <= 12; r++) list.push(getRace(raceKey(venueIdx, r)));
    return list;
  }

  function featuredRaces() {
    return allRaces().filter(function (r) { return r.grade; });
  }

  /* ------------------------------------------------ 着順生成 */

  var _resultCache = {};

  // 強さで重み付けした非復元抽出で着順を決める
  function getResult(key) {
    key = Number(key);
    if (_resultCache[key]) return _resultCache[key];

    var race = getRace(key);
    if (!race) return null;

    var rnd = lcg(key * 48271 + 12345);
    var pool = race.horses.map(function (h) { return { num: h.num, w: h.winProb }; });
    var order = [];
    while (pool.length) {
      var total = pool.reduce(function (a, b) { return a + b.w; }, 0);
      var t = rnd() * total, acc = 0, idx = pool.length - 1;
      for (var i = 0; i < pool.length; i++) {
        acc += pool[i].w;
        if (t <= acc) { idx = i; break; }
      }
      order.push(pool[idx].num);
      pool.splice(idx, 1);
    }
    var res = { key: key, order: order, top3: order.slice(0, 3) };
    _resultCache[key] = res;
    return res;
  }

  /* ------------------------------------------------ export */

  global.UmaData = {
    DISCLAIMER_SHORT: DISCLAIMER_SHORT,
    DISCLAIMER_LINES: DISCLAIMER_LINES,
    RACE_DATE: RACE_DATE,
    RACE_DATE_LABEL: RACE_DATE_LABEL,
    VENUES: VENUES,
    BET_TYPES: BET_TYPES,
    BET_METHODS: BET_METHODS,
    TEST_USERS: TEST_USERS,
    raceKey: raceKey,
    parseKey: parseKey,
    getRace: getRace,
    allRaces: allRaces,
    venueRaces: venueRaces,
    featuredRaces: featuredRaces,
    getResult: getResult,
    startMinutes: startMinutes,
    startTimeLabel: startTimeLabel,
    betType: function (id) {
      return BET_TYPES.filter(function (t) { return t.id === id; })[0] || null;
    }
  };
})(window);
