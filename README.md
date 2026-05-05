# 外出コンパス

Open-Meteoの公開APIを使い、天気、雨、風、PM2.5、UVから外出しやすさを判断するiPhone向けPWAです。

## 特徴

- iPhone単独でAPI取得
- APIキー不要
- 東広島市を初期地点に設定
- 地名検索で地点追加
- 現在地ボタンでGPS地点を使用
- 前回取得データを端末内に保存
- 通信できない場合は前回データを表示
- GitHub Pagesなどの静的ホスティングで公開可能

## 使用API

- Open-Meteo Forecast API
- Open-Meteo Geocoding API
- Open-Meteo Air Quality API

## ローカル確認

```bash
cd /Users/taka/Desktop/codex/iphone_outdoor_compass
python3 -m http.server 4178
```

ブラウザで `http://localhost:4178/` を開きます。

## iPhoneで使う場合

GitHub PagesなどHTTPSの静的ホスティングへ置き、iPhone Safariで開いて共有メニューからホーム画面に追加します。
