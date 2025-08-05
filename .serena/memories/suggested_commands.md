# 推奨コマンド一覧

## 開発コマンド

### ビルドとコンパイル
```bash
npm run build        # TypeScriptをコンパイル
npm run watch        # 監視モードでコンパイル
npm run clean        # ビルド結果を削除
```

### 品質チェック
```bash
npm run lint         # ESLintとTypeScriptチェック実行
npm run lint-fix     # ESLintの自動修正
npm run update-readme # README.mdの更新
```

### テスト実行
```bash
npm test             # 全てのテスト実行
npm run ctest        # Chrome環境でのテスト
npm run ftest        # Firefox環境でのテスト  
npm run wtest        # WebKit環境でのテスト
```

### サーバー実行
```bash
npm run run-server   # ブラウザサーバーを起動
```

### 本番リリース
```bash
npm run npm-publish  # clean → build → test → publishの一連の流れ
```

## システムコマンド（Darwin/macOS）
```bash
# 基本的なファイル操作
ls -la              # ファイル一覧表示
cd <directory>      # ディレクトリ移動
pwd                 # 現在のディレクトリ表示

# 検索とフィルタリング
find . -name "*.ts" # TypeScriptファイル検索
grep -r "pattern"   # テキスト検索
rg "pattern"        # ripgrepでの高速検索（推奨）

# Git操作
git status          # 変更状況確認
git add .           # 全変更をステージング
git commit -m "msg" # コミット
git push            # プッシュ
```

## MCPサーバー起動
```bash
# 直接起動
npx @playwright/mcp@latest

# 特定設定での起動
npx @playwright/mcp@latest --headless --port 8931

# Dockerでの起動
docker run -i --rm --init --pull=always mcr.microsoft.com/playwright/mcp
```