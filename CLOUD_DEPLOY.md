# 雲端架站建議

## 推薦做法：GitHub Pages + GitHub Actions

這個官網目前是靜態網站，適合放在 GitHub Pages、Cloudflare Pages、Netlify 或 Vercel。若希望商品價格每天自動更新，最簡單的雲端流程是：

1. 把整個資料夾推到 GitHub repository。
2. 開啟 GitHub Pages，發布根目錄。
3. 使用 GitHub Actions 每天執行 `tools/update-site-data.mjs`。
4. 若有更新，Action 自動 commit 回 repository，GitHub Pages 重新發布。
5. 在 repository Secrets 加上 `IG_ACCESS_TOKEN`，網站就能同步最新 1 篇 IG 貼文。

## 為什麼不能只靠打開 index.html

直接用 `file://` 打開時，圖片與資料都依賴你的電腦和瀏覽器環境；客人不會連到你的電腦，所以必須把 `index.html`、`styles.css`、`script.js`、`assets/` 放到雲端主機。

## 商品圖片

賣貨便商品圖片目前使用賣貨便圖片網址，客人只要有網路就能看到。品牌 LOGO 與首頁主視覺是本機素材，放到雲端後會由雲端主機提供，不會受你電腦關機影響。

## IG 自動更新

Instagram 最新貼文需要官方 API token。沒有 token 時，網站只能連到 IG 主頁，不能穩定抓最新貼文。
