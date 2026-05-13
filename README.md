# 外出コンパス

Open-Meteoの公開APIを使い、天気、雨、風、PM2.5、UVから外出しやすさを判断するiPhone/Android向けPWAです。

## 特徴

- iPhone/Android単独でAPI取得
- APIキー不要
- 東広島市を初期地点に設定
- 地名検索で地点追加
- 現在地ボタンでGPS地点を使用
- 前回取得データを端末内に保存
- 通信できない場合は前回データを表示
- GitHub Pagesなどの静的ホスティングで公開可能
- 情報タブで地域ニュース、地域イベント、公式リンクを確認
- GitHub Actionsで静的サイトの公開とヒガシルのイベント情報JSON更新を実行
- Google Calendar APIのClient IDを内蔵し、iPhone/Android単独で予定の読み取り接続を開始可能
- Googleカレンダー予定を今日、明日、今後7日間で切り替え表示
- カレンダー予定を日付、時刻、場所の有無が分かるカードで表示
- 次の予定の時間帯と天気を組み合わせた外出判断を表示
- 外出判断を徒歩、自転車、車の移動手段別に切り替え
- 選択中の移動手段を大きめの色付きボタンで表示
- ダッシュボード上部に今日の次の予定を大きく表示
- 前日からの最高/最低気温の変化を表示
- 現在の体感気温と昨日同時刻の体感差を表示
- 体感気温差が大きい時だけ警告色で表示
- 設定タブからPWA更新を確認し、ホーム画面版へ最新版を反映可能
- Android Chromeでは設定タブからインストール確認を起動可能

## 使用API

- Open-Meteo Forecast API
- Open-Meteo Geocoding API
- Open-Meteo Air Quality API
- GDELT Doc API
- 東広島おでかけ観光サイト「ヒガシル」
- Google Calendar API（任意接続、読み取り専用）

## Google Calendar連携の権限

通常の方角、天気、外出メモ機能はGoogleログインなしで使えます。

Googleカレンダー予定を表示する場合だけ、Googleログインとカレンダー読み取り権限が必要です。アクセストークンはこのアプリのlocalStorageには保存せず、画面を開いている間のメモリ上だけで使います。

予定を見ない場合は、Google連携を使わずに運用できます。

## イベント情報の更新

`scripts/update-events.mjs` がヒガシルのイベントページから表示用JSONを生成します。

```bash
node scripts/update-events.mjs
```

GitHub Actionsでは毎日5:15頃（日本時間）に `data/events.json` を更新します。GitHub Pagesの公開もActionsワークフローから実行します。

## ローカル確認

```bash
cd /Users/taka/Desktop/codex/iphone_outdoor_compass
python3 -m http.server 4178
```

ブラウザで `http://localhost:4178/` を開きます。

## iPhoneで使う場合

GitHub PagesなどHTTPSの静的ホスティングへ置き、iPhone Safariで開いて共有メニューからホーム画面に追加します。

## Androidで使う場合

GitHub PagesなどHTTPSの静的ホスティングへ置き、Android Chromeで開きます。設定タブの「Android / iPhoneへ追加」でインストールボタンが有効になったら、そのままホーム画面へ追加できます。

Android Chrome側の条件が揃っているのにボタンが出ない場合は、Chromeのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。

## Google Play向けTWA化

Google Play配布用のTrusted Web Activity準備は [`twa/README.md`](./twa/README.md) にまとめています。

現時点では `twa/twa-manifest.json` と `twa/assetlinks.template.json` を用意済みです。実際のAPK/AAB生成には、Node.js、JDK 17、Android SDK、Bubblewrap、署名鍵のSHA-256 fingerprintが必要です。
