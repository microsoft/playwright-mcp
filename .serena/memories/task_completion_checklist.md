# Task Completion Checklist

## コード変更後の必須手順

### 1. ビルドとリント
```bash
npm run build      # TypeScript コンパイル
npm run lint       # ESLint + 型チェック
```

### 2. テスト実行
```bash
npm test           # 全ブラウザでPlaywrightテスト実行
```

### 3. ドキュメント更新
```bash
npm run update-readme    # README.mdの自動更新（ツール一覧）
```

### 4. 品質チェック
- **型安全性**: `tsc --noEmit`でエラーなし
- **ESLint**: 警告・エラーなし
- **テスト**: すべてのブラウザで通過

### 5. パッケージング確認（リリース時のみ）
```bash
npm run npm-publish    # clean + build + test + publish
```

## 特記事項
- **トークン最適化**: 新機能でもexpectationパラメータサポート必須
- **バッチ実行**: 複数ステップの操作は batch_execute での対応を検討
- **diff検出**: UI変更を伴う場合は差分検出の動作を確認
- **レスポンス構造**: 既存のレスポンス形式との一貫性を保つ

## デバッグ時の確認ポイント
- **ブラウザ起動**: ヘッドレス/ヘッド付きモードの適切な選択
- **セッション管理**: 永続化プロファイル vs 分離コンテキスト
- **ネットワーク**: プロキシ・CORS設定の確認
- **スクリーンショット**: 出力ディレクトリの書き込み権限