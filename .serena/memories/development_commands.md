# 開発コマンド

## ビルド関連
- `npm run build` - TypeScriptのビルド（メインとベンチマーク）
- `npm run build:benchmark` - ベンチマークのみビルド
- `npm run watch` - TypeScriptの監視ビルド
- `npm run clean` - libディレクトリのクリーンアップ

## テスト関連
- `npm test` - Playwrightテスト実行
- `npm run ctest` - Chrome プロジェクトのテスト
- `npm run ftest` - Firefox プロジェクトのテスト
- `npm run wtest` - WebKit プロジェクトのテスト

## 品質チェック
- `npm run lint` - ESLint + TypeScript型チェック
- `npm run lint-fix` - ESLintの自動修正
- `npm run update-readme` - README.mdの自動更新

## ベンチマーク
- `npm run benchmark` - パフォーマンスベンチマーク実行
- `npm run benchmark:verbose` - 詳細ベンチマーク
- `npm run benchmark:quiet` - 簡潔ベンチマーク

## サーバー実行
- `npm run run-server` - ブラウザサーバーの起動

## パブリッシュ
- `npm run npm-publish` - クリーン→ビルド→テスト→パブリッシュ

## システムコマンド（Darwin/macOS）
- `ls` - ファイル一覧
- `cd` - ディレクトリ移動
- `grep` - テキスト検索（ripgrepのrgが推奨）
- `find` - ファイル検索
- `git` - バージョン管理