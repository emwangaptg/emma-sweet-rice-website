# 官網資料更新方式

## 賣貨便商品

執行以下指令會抓取 7-11 賣貨便目前上架且有庫存的商品，並更新 `script.js` 內的商品資料與更新時間。

```powershell
& "C:\Users\emmawang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\update-site-data.mjs
```

可把這個指令放到 Windows 工作排程器，每天執行一次。

## Instagram 最新 1 篇

Instagram 不提供穩定的公開免登入抓取方式。若要自動同步最新 1 篇貼文，請設定官方 API token：

```powershell
$env:IG_ACCESS_TOKEN="你的 Instagram API token"
& "C:\Users\emmawang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" tools\update-site-data.mjs
```

如果 token 無法自動解析 IG User ID，可另外設定：

```powershell
$env:IG_USER_ID="你的 Instagram professional account user_id"
```

未設定 `IG_ACCESS_TOKEN` 時，官網會顯示 IG 入口卡片，避免放入猜測或過期貼文。
