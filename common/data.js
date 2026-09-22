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

  var RACE_DATE = '2026-09-27';
  var RACE_DATE_LABEL = '2026年9月27日(日)';

  var VENUES = [
    { idx: 0, id: 'nakayama', name: '中山', color: '#1d4ed8' },
    { idx: 1, id: 'hanshin', name: '阪神', color: '#b91c1c' },
    { idx: 2, id: 'niigata', name: '新潟', color: '#047857' }
  ];

  // 重賞（10R / 11R のみ）
  var GRADE_RACES = {
    nakayama: { 10: { name: 'カンナステークス', grade: 'GIII' }, 11: { name: 'オールカマー', grade: 'GII' } },
    hanshin: { 10: { name: 'ローズステークス', grade: 'GII' }, 11: { name: '神戸新聞杯', grade: 'GII' } },
    niigata: { 10: { name: '信濃川特別', grade: 'OP' }, 11: { name: 'スプリンターズ予選', grade: 'GIII' } }
  };

  var RACE_NAMES = [
    'サラ系2歳未勝利', 'サラ系3歳未勝利', '3歳以上1勝クラス', 'サラ系2歳新馬',
    '3歳以上2勝クラス', '古町特別', '3歳以上1勝クラス', '秋風ステークス',
    '3歳以上3勝クラス'
  ];

  var SURFACES = ['芝', 'ダート'];
  var DISTANCES = [1200, 1400, 1600, 1800, 2000, 2200, 2400];

  var NAME_HEAD = ['サクラ', 'メイショウ', 'ダイワ', 'ゴールド', 'キタノ', 'トウカイ', 'ナリタ', 'シンボリ',
    'ヒシ', 'マイネル', 'ロード', 'タニノ', 'エイシン', 'スマート', 'アドマイヤ', 'ヴィクトリー',
    'ミラクル', 'グラン', 'セイウン', 'ハヤブサ', 'コスモ', 'ステラ', 'リュウ', 'カレン'];
  var NAME_TAIL = ['ブレイブ', 'クラウン', 'エクスプレス', 'フラッシュ', 'ソヴリン', 'ドリーム', 'ホープ',
    'マーベル', 'ライジング', 'テイオー', 'ブライアン', 'ロイヤル', 'シャイン', 'トップガン',
    'ウィナー', 'ノヴァ', 'ファースト', 'ブロッサム', 'アロー', 'キング', 'クイーン', 'レジェンド',
    'サンライズ', 'グリット'];

  var JOCKEYS = ['武田 幸彦', '川口 将太', '佐々木 亮', '松永 圭介', '福田 翔', '横井 健司',
    '内村 拓馬', '菅野 涼', '岩本 遼', '三浦 雄大', '田辺 克也', '戸崎 悠',
    '石川 裕紀', '北村 蓮', '坂井 颯', '鮫島 優斗', '藤岡 隼', '西村 和也'];

  var TRAINERS = ['国枝 和彦', '藤沢 健', '堀内 宣之', '友道 達也', '中内田 俊', '矢作 芳彦',
    '池江 泰志', '木村 哲平', '手塚 貴大', '鹿戸 明'];

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

  var TEST_USERS = [
    {
      id: 'u001', loginId: 'user01', password: 'test1234', name: '山田 太郎',
      kana: 'ヤマダ タロウ', email: 'yamada.taro@umatiket.test', birthday: '1985-04-12',
      tel: '090-1111-0001', bank: 'ウマ銀行 本店 普通 1234567',
      balance: 50000, memo: '標準的な残高のユーザー'
    },
    {
      id: 'u002', loginId: 'user02', password: 'test1234', name: '鈴木 花子',
      kana: 'スズキ ハナコ', email: 'suzuki.hanako@umatiket.test', birthday: '1992-11-03',
      tel: '090-1111-0002', bank: 'ケイバ信用金庫 中央支店 普通 2345678',
      balance: 250000, memo: '高額残高ユーザー'
    },
    {
      id: 'u003', loginId: 'user03', password: 'test1234', name: '田中 次郎',
      kana: 'タナカ ジロウ', email: 'tanaka.jiro@umatiket.test', birthday: '1978-06-25',
      tel: '090-1111-0003', bank: 'ターフ銀行 駅前支店 普通 3456789',
      balance: 800, memo: '残高不足の検証用ユーザー'
    },
    {
      id: 'u004', loginId: 'user04', password: 'test1234', name: '佐藤 美咲',
      kana: 'サトウ ミサキ', email: 'sato.misaki@umatiket.test', birthday: '1999-01-18',
      tel: '090-1111-0004', bank: 'ウマ銀行 みどり支店 普通 4567890',
      balance: 12000, memo: '入出金履歴を持つユーザー'
    },
    {
      id: 'u005', loginId: 'user05', password: 'test1234', name: '中村 竜也',
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
