# コーディング規約と慣習

## TypeScript スタイル
- **厳密な型定義**: すべての変数、関数、クラスに明示的な型を定義
- **zodスキーマ**: バリデーションにはzodを使用し、型をinferで導出
- **Null安全性**: optional chainingとnullish coalescingを積極活用

## ファイル構造
- **拡張子**: .ts（TypeScriptモジュール）
- **importスタイル**: ES Modules（.js拡張子でimport）
- **exportスタイル**: named exportを推奨

## クラス設計
- **private/publicの明示**: プロパティとメソッドの可視性を明確に
- **読み取り専用**: readonly修飾子を適切に使用
- **コンストラクタ**: 必要な依存関係の注入を行う

## エラーハンドリング
- **try-catchブロック**: 失敗する可能性のある処理を適切にキャッチ
- **エラーログ**: console.errorでエラーメッセージを出力
- **graceful degradation**: 処理失敗時も可能な限り継続

## コメント規約
- **重要な要点のみ**: 自明でない技術的判断理由を記録
- **著作権表示**: ファイル先頭にMicrosoft Corporation著作権表示
- **JSDocスタイル**: 関数やクラスの説明にはJSDoc形式を使用

## パフォーマンス考慮事項
- **非同期処理**: Promise/async-awaitを適切に使用
- **メモリ効率**: 不要なオブジェクト参照を避ける
- **レスポンス最適化**: expectationシステムによる出力制御

## テスト規約
- **ファイル命名**: *.test.ts
- **descriptive tests**: テスト名は動作を明確に説明
- **モックとスパイ**: 外部依存関係の適切なモック化