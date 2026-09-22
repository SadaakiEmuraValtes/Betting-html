/* =========================================================
 * bet.js  —  買い目生成 / オッズ算出 / 的中判定 / 払戻計算
 * ========================================================= */
(function (global) {
  'use strict';

  var D = global.UmaData;

  /* ------------------------------------------------ 汎用 */

  function yen(n) {
    return '¥' + Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function num(n) {
    return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function combinations(arr, k) {
    var out = [];
    (function rec(start, cur) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (var i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
    })(0, []);
    return out;
  }

  function permutations(arr, k) {
    var out = [];
    (function rec(cur, rest) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (var i = 0; i < rest.length; i++) {
        cur.push(rest[i]);
        rec(cur, rest.slice(0, i).concat(rest.slice(i + 1)));
        cur.pop();
      }
    })([], arr);
    return out;
  }

  function uniqCombos(list, ordered) {
    var seen = {}, out = [];
    list.forEach(function (c) {
      var k = (ordered ? c : c.slice().sort(function (a, b) { return a - b; })).join('-');
      if (!seen[k]) { seen[k] = 1; out.push(ordered ? c.slice() : k.split('-').map(Number)); }
    });
    return out;
  }

  /* ------------------------------------------------ 買い目生成
   * sel = { picks: [馬番...], axis: [軸馬番...] }
   * picks は選択順を保持する（馬単・三連単の「通常」で着順として使う）
   */
  function buildCombos(typeId, methodId, sel) {
    var t = D.betType(typeId);
    if (!t) return [];
    var picks = (sel.picks || []).slice();
    var axis = (sel.axis || []).slice();

    if (t.size === 1) {
      return picks.map(function (n) { return [n]; });
    }

    if (methodId === 'box') {
      if (picks.length < t.size) return [];
      return t.ordered ? permutations(picks, t.size) : combinations(picks, t.size);
    }

    if (methodId === 'nagashi') {
      if (!axis.length) return [];
      var others = picks.filter(function (n) { return axis.indexOf(n) < 0; });
      var need = t.size - axis.length;
      if (need < 1 || others.length < need) return [];
      var rests = combinations(others, need);
      var list = [];
      rests.forEach(function (r) {
        if (t.ordered) {
          // 軸は先着（1着 → 2着 …）固定、相手側のみ並べ替え
          permutations(r, r.length).forEach(function (p) { list.push(axis.concat(p)); });
        } else {
          list.push(axis.concat(r));
        }
      });
      return uniqCombos(list, t.ordered);
    }

    // normal（順不同の式別は昇順にそろえる）
    if (picks.length !== t.size) return [];
    return [t.ordered ? picks.slice() : picks.slice().sort(function (a, b) { return a - b; })];
  }

  /* ------------------------------------------------ オッズ算出 */

  function probOf(race, n) {
    var h = race.horses[n - 1];
    return h ? h.winProb : 0.001;
  }

  function roundOdds(o) {
    if (!isFinite(o) || o <= 0) return 9999.9;
    if (o >= 1000) return Math.round(o);
    return Math.round(o * 10) / 10;
  }

  // 1着→2着→3着 の逐次確率（Harville モデル）
  function seqProb(race, order) {
    var p = 1, used = 0;
    for (var i = 0; i < order.length; i++) {
      var pi = probOf(race, order[i]);
      var denom = 1 - used;
      if (denom <= 0.0001) return 0.0000001;
      p *= pi / denom;
      used += pi;
    }
    return p;
  }

  function oddsFor(race, typeId, combo) {
    var p;
    switch (typeId) {
      case 'tan':
        return race.horses[combo[0] - 1].odds;
      case 'fuku':
        return race.horses[combo[0] - 1].fukuOdds;
      case 'umaren':
        p = seqProb(race, [combo[0], combo[1]]) + seqProb(race, [combo[1], combo[0]]);
        return roundOdds(0.775 / p);
      case 'umatan':
        p = seqProb(race, [combo[0], combo[1]]);
        return roundOdds(0.75 / p);
      case 'wide':
        p = (seqProb(race, [combo[0], combo[1]]) + seqProb(race, [combo[1], combo[0]])) * 2.9;
        return roundOdds(0.775 / Math.min(p, 0.9));
      case 'sanrenpuku':
        p = 0;
        permutations(combo, 3).forEach(function (o) { p += seqProb(race, o); });
        return roundOdds(0.75 / p);
      case 'sanrentan':
        p = seqProb(race, combo);
        return roundOdds(0.725 / p);
      default:
        return 0;
    }
  }

  /* ------------------------------------------------ 的中判定 */

  // 出走8頭未満は複勝・ワイドが2着までの払戻
  function placeCount(race) { return race.count >= 8 ? 3 : 2; }

  function isHit(race, result, typeId, combo) {
    var order = result.order;
    var pc = placeCount(race);
    var top = order.slice(0, pc);
    switch (typeId) {
      case 'tan': return combo[0] === order[0];
      case 'fuku': return top.indexOf(combo[0]) >= 0;
      case 'umaren': return sameSet(combo, order.slice(0, 2));
      case 'umatan': return combo[0] === order[0] && combo[1] === order[1];
      case 'wide': return top.indexOf(combo[0]) >= 0 && top.indexOf(combo[1]) >= 0;
      case 'sanrenpuku': return sameSet(combo, order.slice(0, 3));
      case 'sanrentan': return combo[0] === order[0] && combo[1] === order[1] && combo[2] === order[2];
      default: return false;
    }
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var sa = a.slice().sort(), sb = b.slice().sort();
    return sa.every(function (v, i) { return v === sb[i]; });
  }

  // 払戻金（10円未満切り捨て）
  function payoutOf(race, result, typeId, combo, amount) {
    if (!isHit(race, result, typeId, combo)) return 0;
    var o = oddsFor(race, typeId, combo);
    return Math.floor(amount * o / 10) * 10;
  }

  /* ------------------------------------------------ 結果の払戻一覧 */

  var _payoutCache = {};

  // 結果ページに出す「100円あたりの払戻金」一覧
  function racePayouts(raceKey) {
    if (_payoutCache[raceKey]) return _payoutCache[raceKey];
    var race = D.getRace(raceKey);
    var result = D.getResult(raceKey);
    var o = result.order, pc = placeCount(race);
    var rows = [];

    function add(typeName, combo, typeId) {
      var t = D.betType(typeId);
      var shown = t.ordered ? combo : combo.slice().sort(function (a, b) { return a - b; });
      rows.push({
        type: typeName,
        combo: shown,
        label: shown.join(t.ordered ? ' → ' : ' - '),
        payout: Math.floor(oddsFor(race, typeId, combo) * 100 / 10) * 10
      });
    }

    add('単勝', [o[0]], 'tan');
    for (var i = 0; i < pc; i++) add('複勝', [o[i]], 'fuku');
    add('馬連', [o[0], o[1]], 'umaren');
    add('馬単', [o[0], o[1]], 'umatan');
    add('ワイド', [o[0], o[1]], 'wide');
    if (pc >= 3) {
      add('ワイド', [o[0], o[2]], 'wide');
      add('ワイド', [o[1], o[2]], 'wide');
      add('三連複', [o[0], o[1], o[2]], 'sanrenpuku');
      add('三連単', [o[0], o[1], o[2]], 'sanrentan');
    }
    _payoutCache[raceKey] = rows;
    return rows;
  }

  /* ------------------------------------------------ 表示用 */

  function comboLabel(typeId, combo) {
    var t = D.betType(typeId);
    if (t && t.ordered) return combo.join(' → ');
    return combo.slice().sort(function (a, b) { return a - b; }).join(' - ');
  }

  global.UmaBet = {
    yen: yen,
    num: num,
    combinations: combinations,
    permutations: permutations,
    buildCombos: buildCombos,
    oddsFor: oddsFor,
    isHit: isHit,
    payoutOf: payoutOf,
    racePayouts: racePayouts,
    placeCount: placeCount,
    comboLabel: comboLabel
  };
})(window);
