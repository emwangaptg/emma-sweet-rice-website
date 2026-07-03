import { readFile, writeFile } from "node:fs/promises";

const STORE_URL = "https://myship.7-11.com.tw/general/detail/GM2305188665189";
const STORE_ID = "GM2305188665189";
const SCRIPT_PATH = new URL("../script.js", import.meta.url);

function decodeEntities(value = "") {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToText(value = "") {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<p[^>]*>/gi, "\n")
    .replace(/<span[^>]*>/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compactText(text, max = 260) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}...` : cleaned;
}

function ingredientsFrom(text) {
  const index1 = text.indexOf("成份：");
  const index2 = text.indexOf("成分：");
  const index = index1 >= 0 ? index1 : index2;
  if (index < 0) return "依賣貨便商品頁與包裝標示為準。";
  return text.slice(index).replace(/^成份：\s*|^成分：\s*/, "").trim();
}

function priceRange(specs) {
  const activeSpecs = specs.filter((spec) => spec.inventory > 0);
  const prices = (activeSpecs.length ? activeSpecs : specs)
    .map((spec) => spec.salePrice || spec.price)
    .filter(Boolean);

  if (!prices.length) return "售價依賣場為準";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `NT$${min}` : `NT$${min} - NT$${max}`;
}

async function fetchMyshipProducts() {
  const response = await fetch(STORE_URL, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "zh-TW,zh;q=0.9,en;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`賣貨便讀取失敗：HTTP ${response.status}`);
  }

  const html = await response.text();
  const matches = [...html.matchAll(/data-product="([^"]+)"/g)];
  const seen = new Set();

  return matches.map((match) => {
    const raw = decodeEntities(match[1]);
    const product = JSON.parse(raw);
    if (seen.has(product.Cgdd_Id)) return null;
    seen.add(product.Cgdd_Id);

    const description = htmlToText(product.Cgdd_Product_Description);
    const specs = (product.Spec || []).map((spec) => ({
      name: spec.Cgds_Spec,
      price: spec.Cgds_Price,
      salePrice: spec.Cgds_SPrice,
      inventory: spec.Inventory
    }));
    const inStock = product.productStatus === 1 && specs.some((spec) => spec.inventory > 0);

    if (!inStock) return null;

    return {
      id: product.Cgdd_Id,
      name: product.Cgdd_Product_Name,
      priceText: priceRange(specs),
      image: `https://myship.7-11.com.tw/i/cgdm/${STORE_ID}/${product.GoodsFirstImg}`,
      summary: compactText(description, 210),
      detail: compactText(description, 520),
      ingredients: compactText(ingredientsFrom(description), 420),
      specs: specs.map((spec) => {
        const current = spec.salePrice || spec.price;
        const original = spec.price && spec.salePrice && spec.price !== spec.salePrice ? `（原價 NT$${spec.price}）` : "";
        const stock = spec.inventory <= 0 ? " / 無庫存" : "";
        return `${spec.name} / NT$${current}${original}${stock}`;
      }),
      minOrder: product.Cgdd_Product_MinOrder || 0,
      maxOrder: product.Cgdd_Product_MaxOrder || 0
    };
  }).filter(Boolean);
}

async function fetchInstagramPosts() {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) return null;

  let igUserId = process.env.IG_USER_ID;

  if (!igUserId) {
    const userUrl = new URL("https://graph.instagram.com/v21.0/me");
    userUrl.searchParams.set("fields", "user_id,username");
    userUrl.searchParams.set("access_token", token);

    const userResponse = await fetch(userUrl);
    if (!userResponse.ok) {
      throw new Error(`Instagram 使用者讀取失敗：HTTP ${userResponse.status}`);
    }

    const userPayload = await userResponse.json();
    const firstUser = Array.isArray(userPayload.data) ? userPayload.data[0] : userPayload;
    igUserId = firstUser?.user_id || firstUser?.id;

    if (!igUserId) {
      throw new Error("Instagram token 可用，但回應中找不到 user_id；請手動設定 IG_USER_ID。");
    }
  }

  const url = new URL(`https://graph.instagram.com/v21.0/${igUserId}/media`);
  url.searchParams.set("fields", "id,caption,media_url,permalink,timestamp,media_type,thumbnail_url");
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", token);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Instagram 讀取失敗：HTTP ${response.status}`);
  }

  const payload = await response.json();
  return (payload.data || []).slice(0, 1).map((post) => ({
    title: "最新 IG 貼文",
    caption: compactText(post.caption || "到 IG 查看最新貼文", 120),
    url: post.permalink,
    image: post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url
  }));
}

function replaceConstant(source, name, value) {
  const serialized = JSON.stringify(value, null, 2);
  const pattern = new RegExp(`const ${name} = [\\s\\S]*?;\\n`);
  if (!pattern.test(source)) {
    throw new Error(`找不到 const ${name}`);
  }
  return source.replace(pattern, `const ${name} = ${serialized};\n`);
}

const products = await fetchMyshipProducts();
const instagramPosts = await fetchInstagramPosts();
let script = await readFile(SCRIPT_PATH, "utf8");

script = replaceConstant(script, "SITE_DATA_UPDATED_AT", new Date().toISOString());
script = replaceConstant(script, "PRODUCTS", products);

if (instagramPosts) {
  script = replaceConstant(script, "INSTAGRAM_POSTS", instagramPosts);
}

await writeFile(SCRIPT_PATH, script, "utf8");
console.log(`已更新 ${products.length} 個賣貨便商品${instagramPosts ? "，以及最新 1 篇 IG 貼文" : "。IG 未更新：未設定 IG_ACCESS_TOKEN"}`);
