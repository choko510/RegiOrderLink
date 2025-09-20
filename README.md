# オーダーシステム

このプロジェクトは、FastAPIとJavaScriptを使用したシンプルなオーダーシステムです。レジ、調理、管理、モバイルオーダーの各機能を提供します。

## 機能

-   **モバイルオーダー**: お客様が自身のスマートフォンから注文できます。
-   **レジ**: 対面での注文受付と、モバイルオーダーの支払い処理を行います。
-   **調理場**: リアルタイムで注文リストを確認し、調理ステータスを更新できます。
-   **管理**: 売上レポートの確認や商品価格の管理ができます。
-   **リアルタイム更新**: WebSocketを利用して、注文やステータスの変更が関係する画面に即座に反映されます。

## 技術スタック

-   **バックエンド**:
    -   [FastAPI](https://fastapi.tiangolo.com/ja/): 高速なPythonウェブフレームワーク
    -   [SQLAlchemy](https://www.sqlalchemy.org/): Python SQLツールキットおよびORM
    -   [Alembic](https://alembic.sqlalchemy.org/en/latest/): SQLAlchemyを使用したデータベースマイグレーションツール
    -   [Uvicorn](https://www.uvicorn.org/): ASGIサーバー
-   **フロントエンド**:
    -   HTML5
    -   CSS3
    -   JavaScript (ES6+)

## セットアップ

1.  **リポジトリをクローンします**:
    ```bash
    git clone https://github.com/your-username/order-system.git
    cd order-system
    ```

2.  **Pythonの仮想環境を作成し、有効化します**:
    ```bash
    python -m venv venv
    source venv/bin/activate  # on Windows: venv\Scripts\activate
    ```

3.  **必要なパッケージをインストールします**:
    ```bash
    pip install -r requirements.txt
    ```

## 実行方法

プロジェクトのルートディレクトリで以下のコマンドを実行します。

```bash
python run.py
```

サーバーが起動し、`http://localhost:8000` でアプリケーションにアクセスできるようになります。

-   **メイン画面 (レジ/調理/管理)**: `http://localhost:8000/main.html`
-   **モバイルオーダー画面**: `http://localhost:8000/mobile.html`

初回起動時に、テスト用のテーブルとメニューデータが自動的にデータベースに挿入されます。
