# fast-playwright-mcp プロジェクト概要

## プロジェクトの目的
fast-playwright-mcpは、Model Context Protocol (MCP)サーバーとしてPlaywrightブラウザ自動化機能を提供するプロジェクトです。

### 主な特徴
- **高速で軽量**: Playwrightのアクセシビリティツリーを使用し、画像ベースではなく構造化データで動作
- **LLMフレンドリー**: ビジョンモデル不要、純粋に構造化データで操作
- **決定論的**: スクリーンショットベースのアプローチに比べて曖昧さを回避

### 拡張機能（このフォーク）
- **トークン最適化**: expectationパラメータでレスポンス内容制御
- **画像圧縮**: imageOptionsによる画像最適化
- **バッチ実行**: browser_batch_executeによる複数操作の効率的実行
- **スナップショット制御**: snapshotOptionsによるサイズ制限

## 技術スタック
- **言語**: TypeScript
- **ランタイム**: Node.js 18+
- **主要ライブラリ**:
  - Playwright (1.55.0-alpha)
  - @modelcontextprotocol/sdk
  - zod (スキーマ検証)
  - sharp (画像処理)
  - fast-diff (今回の実装で追加予定)

## プロジェクト構造
```
src/
├── tools/          # ブラウザ操作ツール群
├── types/          # TypeScript型定義
├── utils/          # ユーティリティ関数
├── schemas/        # zodスキーマ定義
├── batch/          # バッチ実行機能
├── mcp/           # MCP関連
└── response.ts    # レスポンス処理（今回の主要変更対象）
```

## 現在の実装タスク
レスポンス差分検出機能の実装（feature/response-diff-detectionブランチ）
- expectationシステムの拡張
- fast-diffライブラリを使用した差分検出
- ResponseDiffDetectorとDiffFormatterクラスの実装
- 既存のResponseクラスへの統合