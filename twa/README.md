# Android TWA配布準備

このディレクトリは、公開済みPWAをGoogle Play配布用のTrusted Web Activityに変換するための作業台です。

## 現在の設定

| 項目 | 値 |
|---|---|
| 公開URL | `https://hokutoki.github.io/iphone-outdoor-compass/` |
| Web Manifest | `https://hokutoki.github.io/iphone-outdoor-compass/manifest.webmanifest` |
| Android package | `com.hokutoki.outdoorcompass` |
| アプリ名 | `外出コンパス` |
| 起動URL | `/iphone-outdoor-compass/index.html` |
| 生成先 | `twa/android/` |

## 事前に必要なもの

- Node.js 20以上
- JDK 17
- Android SDK Command-line Tools、またはAndroid Studio
- Android実機、またはエミュレータ
- Google Play Consoleアカウント

このMacでは、2026-05-06時点で `java`、`gradle`、`npm` が未導入だったため、APK/AABの生成までは未実行です。

## 1. Bubblewrapを使える状態にする

```bash
npm i -g @bubblewrap/cli
bubblewrap doctor
```

初回実行時にJDK 17とAndroid SDKの場所を聞かれます。未導入の場合はBubblewrapに依存関係の取得を任せるか、Android Studioを入れてから設定します。

## 2. TWA Androidプロジェクトを生成する

リポジトリ直下で実行します。

```bash
cd /Users/taka/Desktop/codex/iphone_outdoor_compass
bubblewrap init \
  --manifest=https://hokutoki.github.io/iphone-outdoor-compass/manifest.webmanifest \
  --directory=twa/android
```

対話入力では、以下を基準にします。

| 入力項目 | 推奨値 |
|---|---|
| Package ID | `com.hokutoki.outdoorcompass` |
| App name | `外出コンパス` |
| Launcher name | `外出コンパス` |
| Start URL | `/iphone-outdoor-compass/index.html` |
| Display mode | `standalone` |
| Orientation | `portrait` |
| Notifications | `false` |
| Signing key alias | `outdoor-compass` |

生成後に `twa/twa-manifest.json` の内容を、生成された `twa/android/twa-manifest.json` へ反映します。

## 3. APK/AABをビルドする

```bash
cd /Users/taka/Desktop/codex/iphone_outdoor_compass/twa/android
bubblewrap build
```

成功すると、通常は以下が生成されます。

- `app-release-signed.apk`
- `app-release-bundle.aab`

Google Playへ出す本命は `.aab` です。

## 4. Digital Asset Linksを設定する

TWAがURLバーなしで信頼済み表示になるには、Web側に `.well-known/assetlinks.json` が必要です。

署名後、SHA-256 fingerprintを取得します。

```bash
keytool -list -v -keystore twa/android/release.jks -alias outdoor-compass
```

Google Play App Signingを使う場合は、Play Consoleの「アプリ署名鍵の証明書」のSHA-256も必要です。

`twa/assetlinks.template.json` の `REPLACE_WITH_RELEASE_OR_PLAY_APP_SIGNING_SHA256` を実際のSHA-256に置き換え、公開サイトの以下へ配置します。

```text
https://hokutoki.github.io/.well-known/assetlinks.json
```

注意: 今のGitHub Pages URLは `hokutoki.github.io/iphone-outdoor-compass/` ですが、Digital Asset Linksはオリジン直下の `.well-known/assetlinks.json` を見ます。`hokutoki.github.io` のユーザーサイト側に配置できない場合は、独自ドメインを設定する方が確実です。

## 5. 実機確認

```bash
bubblewrap install
```

確認項目:

- アプリ一覧に `外出コンパス` が出る
- 起動時にURLバーが出ない
- 天気取得が動く
- 地点保存が残る
- Googleカレンダー接続が期待通り動く
- オフライン時に前回データが表示される

URLバーが出る場合は、Digital Asset LinksのSHA-256、package name、配置URLのどれかがずれている可能性が高いです。

## 6. Google Play提出前チェック

- Play Consoleでアプリ作成
- AABを内部テストへアップロード
- データセーフティに、Web閲覧URLがブラウザへ渡ることを前提に回答
- ストア掲載文、アイコン、スクリーンショットを準備
- 内部テストでTWA検証と基本操作を確認

