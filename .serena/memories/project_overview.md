# Fast Playwright MCP Server - Project Overview

## プロジェクト概要
Model Context Protocol (MCP) サーバーとして実装されたブラウザ自動化ツール。Playwrightをベースに、LLMがWebページと相互作用できる機能を提供。

## 主要な特徴
- **軽量・高速**: Playwrightのアクセシビリティツリーを使用（ピクセルベース入力不要）
- **LLMフレンドリー**: 構造化データのみで動作、ビジョンモデル不要
- **決定論的ツール適用**: スクリーンショットベースのアプローチによくある曖昧さを回避

## Fast Serverの独自機能
- **トークン最適化**: 50-80%のトークン削減が可能
- **バッチ実行**: 複数操作の一括実行でパフォーマンス向上
- **画像圧縮**: JPEG形式・品質調整・サイズ変更対応
- **diff検出**: 前回の状態との差分のみを表示
- **レスポンス制御**: expectationパラメータによる細かな出力制御

## 技術スタック
- **言語**: TypeScript (Node.js 18+)
- **主要依存関係**:
  - Playwright 1.55.0-alpha
  - @modelcontextprotocol/sdk ^1.16.0
  - Sharp (画像処理)
  - Zod (スキーマ検証)
  - Commander (CLI)

## プロジェクト構造
```
src/
├── tools/          # 各ツールの実装
├── types/          # 型定義
├── schemas/        # Zodスキーマ
├── batch/          # バッチ実行機能
├── utils/          # ユーティリティ
├── mcp/           # MCP関連
└── [その他のコアファイル]
```

## 主要なツール群
- **コア自動化**: click, navigate, type, wait, evaluate等
- **タブ管理**: tab_list, tab_new, tab_select, tab_close
- **ブラウザインストール**: browser_install
- **バッチ実行**: browser_batch_execute（推奨）
- **座標ベース**: mouse_click_xy（--caps=vision時）
- **PDF生成**: pdf_save（--caps=pdf時）