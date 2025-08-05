# Playwright MCP Performance Comparison Guide

## バッチ処理の効果測定

### なぜバッチ処理が効果的か

1. **API呼び出し回数の削減**
   - Original: 5回のMCP API呼び出し
   - Fast (Batch): 2回のMCP API呼び出し

2. **レスポンストークンの削減**
   - 各コマンドごとの冗長な情報（ヘッダー、フッター、状態情報）を削減
   - globalExpectationで不要な情報を一括除外

3. **実行時間の短縮**
   - コマンド間のラウンドトリップ時間を削減
   - 内部的に最適化された実行

### 具体的な比較例

#### Sequential (Original Playwright MCP)
```
Command 1: navigate
Response: [Full browser state + snapshot + tabs + console]

Command 2: click  
Response: [Full browser state + snapshot + tabs + console]

Command 3: wait
Response: [Full browser state + snapshot + tabs + console]

Command 4: navigate_back
Response: [Full browser state + snapshot + tabs + console]

Command 5: snapshot
Response: [Full browser state + snapshot + tabs + console]

Total: 5 responses × ~2000 tokens = ~10,000 tokens
```

#### Batch (Fast Playwright MCP)
```
Command 1: batch_execute (with globalExpectation: no snapshots)
Response: [Summary + minimal step results]

Command 2: snapshot
Response: [Full browser state + snapshot]

Total: 1 summary + 1 full response = ~3,000 tokens
```

### 期待される改善効果

1. **トークン削減**: 60-70% 削減
2. **実行時間**: 40-50% 短縮  
3. **API呼び出し**: 60% 削減（5→2）

## 測定方法

### 手動測定
1. 各コマンドを実行
2. レスポンスをテキストファイルに保存
3. 文字数をカウント（トークン数 ≈ 文字数 ÷ 4）
4. 実行時間を記録

### 半自動測定
```bash
# レスポンスサイズの比較
wc -c original-response.txt fast-response.txt

# トークン数の概算
echo "Original tokens: $(($(wc -c < original-response.txt) / 4))"
echo "Fast tokens: $(($(wc -c < fast-response.txt) / 4))"
```

## バッチ処理のベストプラクティス

1. **類似操作をグループ化**
   - ナビゲーション系の操作
   - フォーム入力系の操作
   - 検証系の操作

2. **globalExpectationの活用**
   ```javascript
   globalExpectation: {
     includeSnapshot: false,    // 中間スナップショット不要
     includeConsole: false,     // コンソール出力不要
     includeCode: true,         // 実行コードは必要
     includeTabs: false         // タブ情報不要
   }
   ```

3. **最後にスナップショット**
   - バッチ実行後に最終状態のみ取得
   - 必要に応じて部分スナップショット使用