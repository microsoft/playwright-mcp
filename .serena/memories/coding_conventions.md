# Coding Conventions

## TypeScript スタイル
- **型定義**: 厳密な型チェックを使用
- **インポート**: ES Modules（.js拡張子で参照）
- **エクスポート**: 名前付きエクスポートを優先
- **非同期処理**: async/awaitパターン

## ファイル命名規則
- **ツール**: `src/tools/[tool-name].ts`
- **型定義**: `src/types/[type-name].ts`
- **スキーマ**: `src/schemas/[schema-name].ts`
- **ユーティリティ**: `src/utils/[util-name].ts`

## コード構成パターン
```typescript
// ツールの基本構造
import { Tool } from './tool.js';
import { z } from 'zod';

const toolSchema = z.object({
  // スキーマ定義
});

export const tool: Tool<typeof toolSchema> = {
  name: 'browser_[action]',
  capability: 'core',
  description: '...',
  schema: toolSchema,
  handler: async (args, context) => {
    // 実装
  }
};
```

## エラーハンドリング
- **MCPエラー**: `McpError`クラスを使用
- **Playwright例外**: 適切にキャッチして変換
- **検証エラー**: Zodスキーマで自動検証

## レスポンス設計
- **最適化**: expectationパラメータによる制御
- **構造化**: 一貫したレスポンス形式
- **diff検出**: 変更のみを効率的に報告

## ドキュメント
- **JSDoc**: 関数・クラスには必須
- **README更新**: `npm run update-readme`で自動生成
- **型安全性**: すべての公開APIで型を明示