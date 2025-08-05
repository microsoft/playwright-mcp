# コーディングスタイルと規約

## TypeScript規約

### 型定義
- インターfaces使用を推奨
- strict mode有効
- 明示的な戻り値型指定（関数）
- Genericsの適切な使用

### ファイル構造
```typescript
// 1. Import文（外部依存 → 内部依存の順）
import type { ExpectationOptions } from '../schemas/expectation.js';

// 2. 型定義
export interface SomeInterface {
  property: string;
}

// 3. 実装
export function someFunction(): SomeType {
  // implementation
}
```

## 命名規約

### ファイル命名
- camelCase: `imageProcessor.ts`
- kebab-case: 設定ファイル等
- PascalCase: クラス名と同一のファイル

### 変数・関数命名
- **camelCase**: 変数、関数、メソッド
- **PascalCase**: クラス、インターフェース、型
- **SCREAMING_SNAKE_CASE**: 定数
- **descriptive names**: 略語避ける

### 関数設計
```typescript
// Good: 明確な目的と戻り値型
export async function processImage(
  imageData: Buffer, 
  originalContentType: string,
  options?: ImageOptions
): Promise<ImageProcessingResult> {
  // implementation
}
```

## エラーハンドリング
- 明示的なエラー型定義
- 適切なvalidation実装
- エラーメッセージの配列返却パターン

```typescript
export function validateImageOptions(options: ImageOptions): string[] {
  const errors: string[] = [];
  
  if (options?.quality !== undefined && (options.quality < 1 || options.quality > 100)) {
    errors.push('Image quality must be between 1 and 100');
  }
  
  return errors;
}
```

## コメント規約
- JSDoc形式でのAPI文書化
- 複雑なロジックのみ説明コメント
- TODO、FIXME、NOTEの適切な使用
- コピーライトヘッダーの必須記載

## Import/Export
- ES Modules使用（.jsファイル拡張子必須）
- type importの明示的使用
- default exportよりnamed exportを推奨