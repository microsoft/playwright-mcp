# Playwright MCP プロジェクト概要

## プロジェクトの目的
Playwright MCPは、Model Context Protocol (MCP) サーバーとして動作し、Playwright を使用したブラウザ自動化機能を提供します。LLMがWebページと構造化されたアクセシビリティスナップショットを通じて相互作用できるようにし、スクリーンショットや視覚的に調整されたモデルを必要としません。

## 技術スタック
- **Node.js**: 18以上
- **TypeScript**: ^5.8.2
- **Playwright**: 1.55.0-alpha (コア機能)
- **MCP SDK**: @modelcontextprotocol/sdk ^1.16.0
- **その他の主要依存関係**:
  - commander: CLI管理
  - zod: スキーマ検証
  - ws: WebSocket通信
  - mime: MIMEタイプ処理

## プロジェクト構造
```
src/
├── tools/           # ブラウザ操作ツール群
├── types/           # TypeScript型定義
├── utils/           # ユーティリティ機能（画像処理など）
├── schemas/         # Zodスキーマ定義
├── batch/           # バッチ実行機能
├── mcp/             # MCP サーバー実装
├── extension/       # 拡張機能
└── loop/           # ループ処理機能
```

## 主要機能
1. **高速で軽量**: Playwrightのアクセシビリティツリーを使用（ピクセルベースの入力ではない）
2. **LLMフレンドリー**: ビジョンモデル不要、構造化データのみで動作
3. **決定論的ツール適用**: スクリーンショットベースのアプローチで見られる曖昧さを回避
4. **トークン最適化**: レスポンスフィルタリングとバッチ実行による高度な最適化機能