# Suggested Commands

## 開発用コマンド
```bash
# ビルド
npm run build

# 型チェック・リント
npm run lint

# リント修正
npm run lint-fix

# ウォッチモード
npm run watch

# クリーンアップ
npm run clean
```

## テストコマンド
```bash
# 全ブラウザでテスト
npm test

# Chrome のみ
npm run ctest

# Firefox のみ
npm run ftest

# WebKit のみ
npm run wtest
```

## ベンチマーク
```bash
# ベンチマーク実行
npm run benchmark

# 詳細出力
npm run benchmark:verbose

# 最小出力
npm run benchmark:quiet
```

## サーバー起動
```bash
# MCPサーバーとして起動
node lib/browserServer.js

# または CLI経由
./cli.js

# ポート指定でHTTPサーバーとして起動
npx @playwright/mcp@latest --port 8931
```

## システムコマンド（macOS）
```bash
# ファイル操作
ls -la          # ファイル一覧（詳細）
find . -name    # ファイル検索
grep -r         # 文字列検索（再帰）

# Git操作
git status
git log --oneline
git diff

# プロセス管理
ps aux | grep
lsof -i :PORT   # ポート使用状況
```