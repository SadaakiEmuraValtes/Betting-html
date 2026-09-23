# ウマチケ（UMATIKET）— 競馬投票デモサイト

**デモURL: https://sadaakiemuravaltes.github.io/Betting-html/**

> ## ⚠️ 免責事項
>
> 本サイトは、テスト自動化・UI検証・学習を目的として作成された**架空の競馬投票デモサイト**です。
>
> - **日本中央競馬会（JRA）および地方競馬全国協会（NAR）、その他実在のいかなる団体・企業とも一切関係がありません。** 公式サイトでもなければ、提携・監修・許諾を受けたものでもありません。
> - 登場する**競馬場名・レース名・競走馬名・騎手名・調教師名・オッズ・払戻金はすべて架空のもの**です。実在の競馬場、競走、競走馬、騎手、調教師、人物、団体とは一切関係がありません。
> - **実際の馬券の購入はできません。** 入金・出金・投票はすべて画面上の演出であり、現実の金銭のやり取りは一切発生しません。入力された情報はブラウザ内にのみ保存されます。
> - 本サイトは**投票行為を推奨するものではありません**。実際の公営競技は20歳以上の方のみが法令に従って利用できます。
> - 本サイトの利用により生じたいかなる損害についても、作成者は責任を負いません。
>
> この免責はサイト上でも常時表示しています（全ページ上部の免責バー／フッター／`#/disclaimer` の免責事項ページ）。

最大の特徴は **PC / タブレット / スマートフォンでUIが完全に別物**であることです。
CSSメディアクエリによるレスポンシブではなく、**端末ごとに別のHTML・CSS・JavaScriptを配信**しています。
ウィンドウ幅を変えてもレイアウトは切り替わりません。

---

## 起動方法

ビルド不要の静的ファイルのみです。任意の静的サーバで配信してください。

```bash
cd WebAPP/Betting-html
python -m http.server 8080
# → http://localhost:8080/
```

`file://` でも動きますが、ブラウザによっては localStorage が使えず状態が保持されません。
HTTP で配信することを推奨します。

## デプロイ

GitHub Pages（`main` ブランチのルート）で公開しています。ビルド不要なので **main に push すればそのまま反映**されます。

```bash
git add -A
git commit -m "..."
git push origin main
```

Windows の PowerShell / cygwin 環境では、cygwin 版 git が認証エラーになるため
`C:\Program Files\Git\cmd\git.exe` を明示的に使ってください。

---

## ディレクトリ構成

```
Betting-html/
├── index.html          端末を判定して pc / tablet / sp へ振り分けるエントリ
├── common/             3端末で共有するロジック（画面は一切持たない）
│   ├── data.js         マスタデータ・レース/出馬表/着順の決定論的生成
│   ├── bet.js          買い目生成・オッズ算出・的中判定・払戻計算
│   └── store.js        状態管理（会員・残高・入出金・投票・自動精算）
├── pc/                 PC専用UI    （index.html / style.css / app.js）
├── tablet/             タブレット専用UI
└── sp/                 スマートフォン専用UI
```

`common/` はロジックのみ。DOM描画は各端末ディレクトリの `app.js` が独立して持っています。

---

## 端末ごとのUIの違い

| | PC | タブレット | スマートフォン |
|---|---|---|---|
| 想定幅 | 1280px固定（`min-width:1280px`） | 834px固定（`min-width:768px`） | 375px前後 |
| ナビゲーション | 左サイドメニュー（固定） | 上部タブバー（5タブ） | 下部タブバー（5タブ） |
| レース一覧 | 競馬場 × 12R のグリッド表 | 競馬場タブ切替＋2列カード | 競馬場アコーディオン＋1列リスト |
| 出馬表 | 情報量の多いテーブル | カードリスト（大きめタップ領域） | コンパクトリスト |
| 投票操作 | 右サイドに常時表示の投票パネル（2カラム） | 画面下部の固定投票バー＋買い目シート | **全画面4ステップのウィザード** |
| 購入確認 | センターモーダル | センターモーダル | ボトムシート |
| 結果表示 | テーブル | テーブル | リスト |

### 端末の振り分けと切り替え

判定は UserAgent を優先し、判定できない場合に `screen.width` で補います
（ウィンドウをリサイズしても切り替わらないよう、`innerWidth` ではなく `screen.width` を使います）。

- `index.html` が端末を判定して `pc/` `tablet/` `sp/` へリダイレクトします。
- **端末専用ページのURLを直接開いた場合も判定します。** 例えばスマホで `/pc/index.html` を開くと
  `/sp/index.html` へ差し替わります（`#/wallet` などのハッシュは引き継ぎます）。
- iPadOS 13以降の Safari は UserAgent が `Macintosh` になるため、タッチの有無を併用して判定します。

**手動で固定したいとき**

- URL に `?device=pc` / `?device=tablet` / `?device=sp` を付けると、その表示に固定されます（localStorage に記憶）。
- 固定は「固定した時点の本来の端末」とセットで保存され、**実機が変われば自動的に破棄**されます。
  PCで「スマホ版」に固定しても、実機のスマホからのアクセスには影響しません。
- `index.html?select=1` で手動の端末選択画面、`index.html?reset=1` で固定を解除して自動判定に戻します。
- 各端末のフッター／ヘルプ画面からも相互に行き来できます（リンクには `?device=` が付いています）。

現在の判定結果・固定状態・UserAgent は各端末の **ヘルプ画面**で確認できます。

---

## 主な機能

### 会員
- 新規会員登録（ユーザーID重複・パスワード一致・メール形式・20歳未満はエラー）
- ログイン / ログアウト
- マイページ（会員情報・残高・投票集計）

### 入出金
- 入金：ネット銀行 / クレジットカード / コンビニ入金の3方法、¥1,000〜¥500,000（100円単位）
- 出金：登録口座あて、¥1,000以上（100円単位）、**出金手数料 ¥220／回**
- 入出金・購入・払戻をまとめた取引履歴（残高推移つき）

### 投票（馬券購入）
- 3競馬場（**青嶺 / 桜堤 / 鷹丘** — いずれも架空）× 12レース = 36レース
- 式別7種：単勝 / 複勝 / 馬連 / 馬単 / ワイド / 三連複 / 三連単
- 買い方3種：通常 / ボックス / ながし
  - 馬単・三連単の「通常」は**選択した順が着順**になります
  - 「ながし」は軸馬 × 相手馬の組み合わせ
- 1点あたり ¥100〜¥100,000（100円単位）、点数 × 単価で合計を算出
- 残高不足・締切後は購入不可（エラーメッセージを表示）

### オッズ・結果
- 単勝 / 複勝オッズ、馬連オッズ表（PCはマトリクス）、三連複人気上位
- 着順、払戻金一覧（100円あたり）
- 投票済み馬券は的中／不的中を色分け表示

---

## 仮想時刻とレースの状態

ヘッダーのプルダウンで **9:00〜18:00** を切り替えられます。発走は 1R 10:00 から30分間隔（12R 15:30）。

| 状態 | 条件 | できること |
|---|---|---|
| 発売中 | 発走10分前まで | 投票できる |
| 締切 | 発走10分前 〜 発走5分後 | 投票不可・結果も未確定 |
| 確定 | 発走5分後以降 | 着順・払戻が確定し、保有馬券が**自動精算**される |

時刻を進めると未確定の馬券が精算され、的中していれば払戻金が残高に加算され、取引履歴に記録されます。

---

## テストアカウント

パスワードは**アカウントごとに異なります**（16文字以上／英大文字・英小文字・数字・記号をすべて含む／ユーザーIDと無関係）。

| ユーザーID | パスワード | 氏名 | 初期残高 | 用途 |
|---|---|---|---:|---|
| `user01` | `Zx7#Harukaze-Mine` | 山田 太郎 | ¥50,000 | 標準的な残高のユーザー |
| `user02` | `Qr4$Tsukikage-Bay` | 鈴木 花子 | ¥250,000 | 高額残高ユーザー |
| `user03` | `Vm9%Aomine-Ridge` | 田中 次郎 | ¥800 | 残高不足の検証用 |
| `user04` | `Tp2!Sakura-Levee` | 佐藤 美咲 | ¥12,000 | 入出金履歴を持つユーザー |
| `user05` | `Ls6@Takaoka-Crest` | 中村 竜也 | ¥0 | 残高0・初回入金の検証用 |

ログイン画面・ヘルプ画面の一覧に**パスワードを表示**しており、「入力」ボタンで
そのアカウントのIDとパスワードをフォームに流し込めます。

### 新規登録時のパスワード要件

| 条件 |
|---|
| 12文字以上 |
| 英大文字・英小文字・数字・記号のうち**3種類以上**を含む |
| ユーザーIDを含まない |
| 同一文字の繰り返しでない |
| `password` / `qwerty` / `test1234` などの推測されやすい文字列を含まない |

判定ロジックは `UmaStore.checkPassword(password, loginId)` に切り出してあります
（問題があればエラーメッセージ、なければ空文字を返します）。

---

## データの保存とリセット

- 会員情報・残高・入出金履歴・投票履歴は `localStorage` に保存されます
  - 状態： `umatiket_state_v2`
  - 端末固定： `umatiket_device`
- 各端末の **ヘルプ画面 →「デモデータを初期化する」** で初期状態に戻せます
  （新規登録したアカウントも削除されます）

---

## データ生成の仕組み

出馬表・オッズ・着順はすべて `raceKey` を seed とした LCG（線形合同法）で生成しています。
サーバもDBも持ちませんが、**何度リロードしても、どの端末で開いても同じ内容**になります。

```
raceKey = 競馬場インデックス * 100 + ラウンド    例）桜堤11R → 111
```

- 各馬の強さから勝率を正規化し、単勝・複勝オッズを算出
- 連勝式のオッズは Harville モデルによる逐次確率から概算
- 着順は勝率で重み付けした非復元抽出

---

## テスト時の目印（セレクタ）

各画面の要素には `uma-` で始まる**テスト用クラス**を付けています。
**3端末で同じクラス名**を使っているため、UIが違っても同じセレクタでテストを書けます。
（端末の判別は `<body data-device="pc|tablet|sp">` で行えます）

### ヘッダー・共通

| 要素 | セレクタ |
|---|---|
| 残高 | `.uma-balance` |
| 仮想時刻セレクト | `.uma-clock` |
| ログイン中のユーザー名 | `.uma-user-name` |
| ログアウト | `.uma-logout` |
| フォームのエラー表示 | `.uma-form-error` |
| 免責バー / 免責ページ | `.uma-disclaimer-bar` / `.uma-disclaimer-page` |

### ログイン・会員登録

| 要素 | セレクタ |
|---|---|
| ユーザーID / パスワード / 実行 | `.uma-login-id` / `.uma-login-pw` / `.uma-login-submit` |
| テストアカウント行 | `.uma-testuser-row[data-login-id="user01"]` |
| ID自動入力ボタン | `.uma-testuser-fill` |
| 登録フォーム各項目 | `.uma-register-loginId` / `-password` / `-passwordConfirm` / `-name` / `-kana` / `-birthday` / `-email` / `-tel` / `-bank` |
| 規約同意 / 登録実行 | `.uma-register-agree` / `.uma-register-submit` |
| 登録完了 | `.uma-register-done` / `.uma-register-receipt` |

### マイページ（ユーザー項目）

| 要素 | セレクタ |
|---|---|
| 会員情報の行 | `.uma-mypage-row[data-field="email"]` |
| 各項目の値 | `.uma-mypage-memberno-value` / `-loginid-` / `-name-` / `-kana-` / `-birthday-` / `-email-` / `-tel-` / `-bank-` / `-type-value` |
| 残高 | `.uma-wallet-balance` |
| 集計値 | `.uma-summary-total-value` / `-payout-` / `-profit-` / `-count-` / `-hitrate-value` |

### 入出金

| 要素 | セレクタ |
|---|---|
| 入金フォーム | `.uma-deposit-form` |
| 入金方法 / 金額 / 実行 | `.uma-deposit-method` / `.uma-deposit-amount` / `.uma-deposit-submit` |
| 入金完了・明細 | `.uma-deposit-done` / `.uma-deposit-receipt-balance` |
| 出金フォーム | `.uma-withdraw-form` |
| 出金先 / 金額 / 実行 | `.uma-withdraw-bank` / `.uma-withdraw-amount` / `.uma-withdraw-submit` |
| 出金完了・明細 | `.uma-withdraw-done` / `.uma-withdraw-receipt-fee` |
| 取引履歴の行 | `.uma-txn-row[data-txn-type="deposit"]` |
| 行の各項目 | `.uma-txn-date` / `.uma-txn-label` / `.uma-txn-amount` / `.uma-txn-balance` |

### レース・出馬表

| 要素 | セレクタ |
|---|---|
| レースへのリンク | `.uma-race-link[data-race-key="111"]` |
| レース名 / 状態 / 発走 | `.uma-race-name` / `.uma-race-status` / `.uma-race-start` |
| タブ | `.uma-tab-entries` / `.uma-tab-odds` / `.uma-tab-result` |
| 出馬表の行 | `.uma-entry-row[data-horse="5"]` |
| 行の各項目 | `.uma-entry-waku` / `-num` / `-name` / `-sexage` / `-jockey` / `-odds` / `-pop` |
| 馬の選択 / 軸 | `.uma-entry-pick` / `.uma-entry-axis` |

### 投票

| 要素 | セレクタ |
|---|---|
| 投票パネル | `.uma-bet-panel` |
| 式別 / 方式 | `.uma-bet-type[data-type="umaren"]` / `.uma-bet-method[data-method="box"]` |
| 1点あたり金額 | `.uma-bet-amount`（入力）/ `.uma-bet-amount-chip`（ボタン） |
| 点数 / 合計 / 購入後残高 | `.uma-bet-count` / `.uma-bet-total` / `.uma-bet-after` |
| 買い目 | `.uma-bet-combo[data-combo="1-3"]` |
| 購入ボタン | PC・タブレット：`.uma-bet-submit` → `.uma-bet-confirm`<br>スマホ：`.uma-bet-start` → `.uma-bet-next` ×3 → `.uma-bet-confirm` |
| 購入完了 | `.uma-bet-done` / `.uma-bet-receipt-id` / `.uma-bet-receipt-balance` |

### 投票履歴・結果

| 要素 | セレクタ |
|---|---|
| 履歴の1件 | `.uma-bet-item[data-status="hit"]` |
| 件の各項目 | `.uma-bet-status` / `.uma-bet-race-label` / `.uma-bet-type-name` / `.uma-bet-total` / `.uma-bet-payout` / `.uma-bet-id` |
| 絞り込み | `.uma-history-filter` |
| 着順の行 | `.uma-result-row[data-rank="1"]` |
| 払戻の行 | `.uma-payout-row[data-type="三連単"]` / `.uma-payout-amount` |
| オッズの行 | `.uma-odds-row[data-horse="3"]` / `.uma-odds-win` / `.uma-odds-place` |

### ルーティング

```
#/                     レース一覧
#/race/111             レース詳細（?tab=entries / odds / result）
#/history              投票履歴
#/wallet               入出金（?mode=deposit / withdraw）
#/mypage               マイページ
#/login  #/register    ログイン・会員登録
#/help                 ヘルプ・テスト情報
#/disclaimer           免責事項
```

画面遷移はハッシュルーティングです（3端末とも同じパス）。
