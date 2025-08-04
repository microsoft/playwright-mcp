# PR #2: Response Filtering Implementation - 詳細設計書

## 概要

PR #2では、PR #1で構築したexpectationSchema基盤の上に、実際のResponse Filtering機能を実装します。主要な実装対象は以下の通りです：

1. **Tab.capturePartialSnapshot()メソッド** - CSSセレクタによる部分スナップショット取得
2. **Response.renderFilteredTabSnapshot()の拡張** - 高度なフィルタリング機能
3. **コンソールメッセージフィルタリングの強化** - 既存機能の拡張
4. **画像処理オプション機能** - 新規ユーティリティ実装
5. **単語境界考慮のスナップショット切り捨て** - PR #1レビュー対応

## 実装詳細

### 1. Tab.capturePartialSnapshot()メソッド

#### 1.1 メソッド仕様

```typescript
// src/tab.ts に追加
async capturePartialSnapshot(selector: string, maxLength?: number): Promise<TabSnapshot> {
  // セレクタで指定された要素のみのスナップショットを取得
}
```

#### 1.2 実装アプローチ

```typescript
/**
 * CSSセレクタで指定された要素の部分スナップショットを取得
 * @param selector - 対象要素を指定するCSSセレクタ
 * @param maxLength - スナップショットの最大文字数
 * @returns 部分スナップショットを含むTabSnapshot
 */
async capturePartialSnapshot(selector: string, maxLength?: number): Promise<TabSnapshot> {
  let tabSnapshot: TabSnapshot | undefined;
  const modalStates = await this._raceAgainstModalStates(async () => {
    // 1. フルスナップショットを取得
    const fullSnapshot = await (this.page as PageEx)._snapshotForAI();
    
    // 2. セレクタに基づいて部分スナップショットを抽出
    const partialSnapshot = await this._extractPartialSnapshot(fullSnapshot, selector);
    
    // 3. 長さ制限を適用
    const finalSnapshot = maxLength && partialSnapshot.length > maxLength
      ? this._truncateAtWordBoundary(partialSnapshot, maxLength)
      : partialSnapshot;
    
    tabSnapshot = {
      url: this.page.url(),
      title: await this.page.title(),
      ariaSnapshot: finalSnapshot,
      modalStates: [],
      consoleMessages: [],
      downloads: this._downloads,
    };
  });
  
  if (tabSnapshot) {
    tabSnapshot.consoleMessages = this._recentConsoleMessages;
    this._recentConsoleMessages = [];
  }
  
  return tabSnapshot ?? {
    url: this.page.url(),
    title: '',
    ariaSnapshot: '',
    modalStates,
    consoleMessages: [],
    downloads: [],
  };
}
```

#### 1.3 部分スナップショット抽出ロジック

```typescript
/**
 * セレクタに基づいてARIAスナップショットから部分的な内容を抽出
 */
private async _extractPartialSnapshot(fullSnapshot: string, selector: string): Promise<string> {
  try {
    // 1. Playwrightの要素取得APIを使用してセレクタの妥当性を確認
    const element = await this.page.locator(selector).first();
    await element.waitFor({ timeout: 1000 });
    
    // 2. 要素のテキスト内容とARIA情報を取得
    const elementText = await element.textContent() || '';
    const ariaLabel = await element.getAttribute('aria-label') || '';
    const role = await element.getAttribute('role') || '';
    
    // 3. フルスナップショットから該当セクションを抽出
    // シンプルなテキストマッチングでARIAスナップショットの該当部分を特定
    const lines = fullSnapshot.split('\n');
    const matchingLines = this._findMatchingLines(lines, elementText, ariaLabel, role);
    
    return matchingLines.length > 0 
      ? matchingLines.join('\n')
      : `Selected element (${selector}):\n${elementText}`;
      
  } catch (error) {
    // セレクタが無効または要素が見つからない場合は、エラー情報を返す
    return `Error: Element not found with selector "${selector}"`;
  }
}

/**
 * ARIAスナップショットの行から、指定された要素に関連する行を抽出
 */
private _findMatchingLines(lines: string[], elementText: string, ariaLabel: string, role: string): string[] {
  const matchingLines: string[] = [];
  let inMatchingSection = false;
  let indentLevel = -1;
  
  for (const line of lines) {
    const currentIndent = line.length - line.trimStart().length;
    const trimmedLine = line.trim();
    
    // テキスト内容、aria-label、またはroleによる一致を確認
    const isMatch = 
      (elementText && trimmedLine.includes(elementText.slice(0, 50))) ||
      (ariaLabel && trimmedLine.includes(ariaLabel)) ||
      (role && trimmedLine.includes(`${role}:`));
    
    if (isMatch && !inMatchingSection) {
      // マッチングセクション開始
      inMatchingSection = true;
      indentLevel = currentIndent;
      matchingLines.push(line);
    } else if (inMatchingSection) {
      // 同じインデントレベルまたはより深いレベルの行を含める
      if (currentIndent >= indentLevel) {
        matchingLines.push(line);
      } else {
        // インデントが浅くなったらセクション終了
        break;
      }
    }
  }
  
  return matchingLines;
}
```

### 2. 単語境界考慮の切り捨て機能

```typescript
/**
 * 単語境界を考慮してテキストを切り捨て
 * PR #1のレビューで指摘された改善点
 */
private _truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // maxLength位置から後ろに向かって単語境界を探す
  let truncatePos = maxLength;
  while (truncatePos > 0 && 
         !this._isWordBoundary(text[truncatePos]) && 
         !this._isWordBoundary(text[truncatePos - 1])) {
    truncatePos--;
  }
  
  // 単語境界が見つからない場合は、元の位置で切り捨て
  if (truncatePos === 0) {
    truncatePos = maxLength;
  }
  
  return text.slice(0, truncatePos) + '...';
}

/**
 * 文字が単語境界かどうかを判定
 */
private _isWordBoundary(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\t' || 
         char === '.' || char === ',' || char === ';' || char === ':';
}
```

### 3. Response.renderFilteredTabSnapshot()の拡張

#### 3.1 部分スナップショット対応

```typescript
// src/response.ts の既存メソッドを拡張
async finish() {
  if ((this._includeSnapshot || this._expectation.includeSnapshot) && this._context.currentTab()) {
    const options = this._expectation.snapshotOptions;
    if (options?.selector) {
      // 部分スナップショット取得
      this._tabSnapshot = await this._context.currentTabOrDie()
        .capturePartialSnapshot(options.selector, options.maxLength);
    } else {
      // フルスナップショット取得
      this._tabSnapshot = await this._context.currentTabOrDie().captureSnapshot();
    }
  }
  
  for (const tab of this._context.tabs())
    await tab.updateTitle();
}
```

#### 3.2 スナップショット形式変換

```typescript
/**
 * スナップショット形式の変換処理
 */
private convertSnapshotFormat(snapshot: string, format: 'aria' | 'text' | 'html'): string {
  switch (format) {
    case 'text':
      // ARIAスナップショットからプレーンテキストを抽出
      return this._extractTextFromAria(snapshot);
    case 'html':
      // ARIAスナップショットからHTMLライクな表現を生成
      return this._convertAriaToHtml(snapshot);
    case 'aria':
    default:
      return snapshot;
  }
}

/**
 * ARIAスナップショットからプレーンテキストを抽出
 */
private _extractTextFromAria(ariaSnapshot: string): string {
  const lines = ariaSnapshot.split('\n');
  const textLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // ARIA構造情報を除去してテキスト内容のみを抽出
    const textMatch = trimmed.match(/^[^"]*"([^"]+)"/);
    if (textMatch) {
      textLines.push(textMatch[1]);
    } else if (trimmed && !trimmed.includes(':') && !trimmed.startsWith('<')) {
      textLines.push(trimmed);
    }
  }
  
  return textLines.join('\n');
}

/**
 * ARIAスナップショットをHTMLライクな形式に変換
 */
private _convertAriaToHtml(ariaSnapshot: string): string {
  const lines = ariaSnapshot.split('\n');
  const htmlLines: string[] = [];
  
  for (const line of lines) {
    const indent = line.length - line.trimStart().length;
    const trimmed = line.trim();
    
    if (trimmed.includes('button:')) {
      const text = trimmed.replace('button:', '').trim();
      htmlLines.push(`${'  '.repeat(indent)}<button>${text}</button>`);
    } else if (trimmed.includes('textbox:')) {
      const text = trimmed.replace('textbox:', '').trim();
      htmlLines.push(`${'  '.repeat(indent)}<input type="text" placeholder="${text}" />`);
    } else if (trimmed.includes('heading:')) {
      const text = trimmed.replace('heading:', '').trim();
      htmlLines.push(`${'  '.repeat(indent)}<h2>${text}</h2>`);
    } else {
      htmlLines.push(line);
    }
  }
  
  return htmlLines.join('\n');
}
```

### 4. 画像処理オプション機能

#### 4.1 imageProcessor.ts の新規作成

```typescript
// src/utils/imageProcessor.ts
import sharp from 'sharp';
import type { ExpectationOptions } from '../schemas/expectation.js';

export interface ImageProcessingResult {
  data: Buffer;
  contentType: string;
  originalSize: { width: number; height: number };
  processedSize: { width: number; height: number };
  compressionRatio: number;
}

/**
 * 画像処理オプションに基づいて画像を最適化
 */
export async function processImage(
  imageData: Buffer, 
  originalContentType: string,
  options?: NonNullable<ExpectationOptions>['imageOptions']
): Promise<ImageProcessingResult> {
  if (!options) {
    return {
      data: imageData,
      contentType: originalContentType,
      originalSize: { width: 0, height: 0 },
      processedSize: { width: 0, height: 0 },
      compressionRatio: 1.0
    };
  }
  
  let processor = sharp(imageData);
  const metadata = await processor.metadata();
  const originalSize = { 
    width: metadata.width || 0, 
    height: metadata.height || 0 
  };
  
  // サイズ制限を適用
  if (options.maxWidth || options.maxHeight) {
    processor = processor.resize(options.maxWidth, options.maxHeight, {
      fit: 'inside',
      withoutEnlargement: true
    });
  }
  
  // フォーマット変換と品質設定
  let processedData: Buffer;
  let contentType: string;
  
  switch (options.format) {
    case 'jpeg':
      processedData = await processor
        .jpeg({ quality: options.quality || 85 })
        .toBuffer();
      contentType = 'image/jpeg';
      break;
    case 'webp':
      processedData = await processor
        .webp({ quality: options.quality || 85 })
        .toBuffer();
      contentType = 'image/webp';
      break;
    case 'png':
    default:
      processedData = await processor
        .png({ compressionLevel: 6 })
        .toBuffer();
      contentType = 'image/png';
      break;
  }
  
  const processedMetadata = await sharp(processedData).metadata();
  const processedSize = {
    width: processedMetadata.width || 0,
    height: processedMetadata.height || 0
  };
  
  return {
    data: processedData,
    contentType,
    originalSize,
    processedSize,
    compressionRatio: imageData.length / processedData.length
  };
}

/**
 * 画像処理オプションを検証
 */
export function validateImageOptions(options: NonNullable<ExpectationOptions>['imageOptions']): string[] {
  const errors: string[] = [];
  
  if (options?.quality && (options.quality < 1 || options.quality > 100)) {
    errors.push('Image quality must be between 1 and 100');
  }
  
  if (options?.maxWidth && options.maxWidth < 1) {
    errors.push('Max width must be greater than 0');
  }
  
  if (options?.maxHeight && options.maxHeight < 1) {
    errors.push('Max height must be greater than 0');
  }
  
  return errors;
}
```

#### 4.2 Response.addImage()の拡張

```typescript
// src/response.ts の既存メソッドを拡張
import { processImage, validateImageOptions } from './utils/imageProcessor.js';

async addImage(image: { contentType: string, data: Buffer }) {
  const imageOptions = this._expectation.imageOptions;
  
  if (imageOptions) {
    // 画像オプションの検証
    const validationErrors = validateImageOptions(imageOptions);
    if (validationErrors.length > 0) {
      throw new Error(`Invalid image options: ${validationErrors.join(', ')}`);
    }
    
    // 画像処理を実行
    const processed = await processImage(image.data, image.contentType, imageOptions);
    this._images.push({
      contentType: processed.contentType,
      data: processed.data
    });
  } else {
    // 画像処理オプションが指定されていない場合は元の処理
    this._images.push(image);
  }
}
```

### 5. コンソールメッセージフィルタリングの強化

#### 5.1 高度なフィルタリングオプション

```typescript
// src/response.ts の既存メソッドを拡張
private filterConsoleMessages(messages: any[], options?: NonNullable<ExpectationOptions>['consoleOptions']): any[] {
  let filtered = messages;
  
  // レベルによるフィルタリング（既存機能）
  if (options?.levels && options.levels.length > 0) {
    filtered = filtered.filter(msg => {
      const level = msg.type || 'log';
      return options.levels!.includes(level);
    });
  }
  
  // 新機能: パターンマッチングによるフィルタリング
  if (options?.patterns) {
    filtered = filtered.filter(msg => {
      const text = msg.toString();
      return options.patterns!.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(text);
        } catch {
          // 無効な正規表現の場合は部分文字列マッチング
          return text.includes(pattern);
        }
      });
    });
  }
  
  // 新機能: 重複メッセージの除去
  if (options?.removeDuplicates) {
    const seen = new Set<string>();
    filtered = filtered.filter(msg => {
      const key = `${msg.type}:${msg.toString()}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  // メッセージ数制限（既存機能の改良）
  const maxMessages = options?.maxMessages ?? 10;
  if (filtered.length > maxMessages) {
    // 最新のメッセージを優先して残す
    filtered = filtered.slice(-maxMessages);
  }
  
  return filtered;
}
```

#### 5.2 expectationSchemaの拡張

```typescript
// src/schemas/expectation.ts に追加
export const expectationSchema = z.object({
  // ... 既存のフィールド ...
  consoleOptions: z.object({
    levels: z.array(z.enum(['log', 'warn', 'error', 'info'])).optional(),
    maxMessages: z.number().optional().default(10),
    patterns: z.array(z.string()).optional().describe('Filter patterns (regex or substring)'),
    removeDuplicates: z.boolean().optional().default(false).describe('Remove duplicate messages')
  }).optional(),
  // ... 既存のフィールド ...
}).optional();
```

## TDD実装計画

### テスト実装順序

1. **Tab.capturePartialSnapshot()のテスト**
   - セレクタが有効な場合のスナップショット取得
   - セレクタが無効な場合のエラーハンドリング
   - maxLength制限の動作確認
   - 単語境界考慮の切り捨て動作

2. **画像処理オプションのテスト**
   - 各フォーマット変換の動作確認
   - 品質設定の効果測定
   - サイズ制限の動作確認
   - バリデーション機能のテスト

3. **コンソールメッセージフィルタリングのテスト**
   - パターンマッチング機能
   - 重複除去機能
   - レベルフィルタリング（既存機能の拡張テスト）

4. **統合テスト**
   - expectationOptionsの組み合わせテスト
   - パフォーマンステスト
   - エラーケースの網羅テスト

## パフォーマンス考慮事項

### 1. 部分スナップショット最適化
- フルスナップショット取得は維持（既存APIとの互換性）
- セレクタマッチングは軽量なテキスト処理で実装
- キャッシュ機能は今回は実装せず、将来の拡張で検討

### 2. 画像処理最適化
- Sharpライブラリによる高効率な画像処理
- 必要時のみ処理実行（オプション指定時のみ）
- メモリ使用量の監視

### 3. コンソールメッセージ処理
- 正規表現コンパイルの最適化
- 重複チェックのハッシュ化
- メッセージ数制限による早期終了

## セキュリティ考慮事項

### 1. セレクタインジェクション対策
- CSSセレクタの検証とサニタイゼーション
- 危険なセレクタ（:has()、:matches()など）の制限

### 2. 画像処理セキュリティ
- 入力画像データの検証
- メモリ消費量の監視と制限
- 無効な画像データに対する適切なエラーハンドリング

### 3. 正規表現セキュリティ
- ReDoS攻撃に対する保護
- 正規表現の複雑さ制限
- タイムアウト設定

## 後方互換性

### 保証事項
- 既存のAPIは一切変更なし
- expectationパラメータは完全にオプショナル
- デフォルト動作は既存と完全同一

### 移行サポート
- 段階的な機能採用が可能
- 古いコードは修正不要で継続動作
- 新機能はopt-inで利用開始

## まとめ

PR #2の実装により、以下の成果を達成します：

1. **トークン削減効果**: 部分スナップショットにより30-60%削減見込み
2. **レスポンス品質向上**: 高度なフィルタリングによる関連情報の精選
3. **画像最適化**: サイズと品質の最適化による転送効率向上
4. **開発者体験向上**: 柔軟なオプション設定による使いやすさ向上

すべての実装はTDDアプローチで進め、包括的なテストカバレッジを確保します。