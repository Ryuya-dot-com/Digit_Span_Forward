# 数字記憶テスト（順唱）

数字の音声を1桁ずつ再生し、同じ順番で入力させるウェブ実験用フロントエンドです。練習試行のあと、本試行を自動で進行し、結果をCSVとして保存できます。

## 特徴
- 練習（3桁×3本）と本試行（3〜9桁、各12本）を自動出題
- 数字音声とビープ音を自動再生し、入力可能なタイミングを制御
- Enterでの送信に対応し、反応時間（ms）を計測
- 参加者ID・正誤・RTを含むCSVをダウンロード可能

## 必要なもの
- モダンブラウザ（Chrome/Edge/Safari等）
- 音声ファイル（`audio/digits/0.mp3`〜`9.mp3` と `audio/beep.wav` をプロジェクト直下に配置）
- シンプルな静的サーバ（ローカルファイル直読みでは音声のプリロードに失敗する場合があります）

## 使い方
1. 音声ファイルを `audio/` 配下に準備する。例: `audio/digits/0.mp3` ... `audio/digits/9.mp3`, `audio/beep.wav`。
2. リポジトリ直下でサーバを起動する。例: `python3 -m http.server 8000`。
3. ブラウザで `http://localhost:8000` を開く。
4. 参加者IDを入力し「練習に進む」をクリック。
5. 練習→本試行の順に指示に従い、ビープ後に数字を入力してEnterまたは送信ボタンで提出。
6. 終了画面で「結果をCSVで保存」を押してデータを保存する。

## 記録仕様
- CSVヘッダー: `participant_id,mode,trial,level,target,response,correct,rt_ms`
- `mode` は順唱を示す `forward` 固定
- `trial` は本試行内の連番、`level` は桁数
- `correct` は正答で1、誤答で0
- ファイル名は `digitspan_forward_YYYYMMDDThhmm.csv` 形式

## 設定を変えるには
- `app.js` 冒頭の `CONFIG` で調整できます。
- 主な項目:
  - `practiceDigits`: 練習用の数字列（文字列配列）
  - `main.minDigits` / `main.maxDigits`: 本試行の最小・最大桁数
  - `main.trialsPerLevel`: 桁数ごとの試行数
  - `timing`: 数字提示前後の待機やインターバル（ms）
  - `audio`: 音声ファイルのパス

## ファイル構成
- `index.html`: 画面構造と文言
- `style.css`: 配色・レイアウト
- `app.js`: 出題ロジック、音声再生、結果保存
- `audio/`: 音声ファイル配置用ディレクトリ（リポジトリには含まれていません）
