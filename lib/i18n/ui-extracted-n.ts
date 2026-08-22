/** Account-experience UI strings for the trilingual layer, part N.
 * Final-pass cleanup: the genuine strings the third audit surfaced after L + M —
 * a tier number-wildcard, casing variants, and a few labels/blurbs. The rest of
 * the residual (sentence fragments glued to dynamic values, example/placeholder
 * text, brand names, and SEO marketing copy) is intentionally left in English.
 * Merged by lib/i18n/ui-dict.ts (CURATED wins). '#' is the number wildcard.
 */

export const EXTRACTED_N: Record<string, { 'zh-CN': string; 'zh-TW': string }> = {
  "Tier #": { 'zh-CN': "第 # 级", 'zh-TW': "第 # 級" },
  "Back to Dashboard": { 'zh-CN': "返回控制台", 'zh-TW': "返回控制台" },
  "Contact Info Required": { 'zh-CN': "需要联系信息", 'zh-TW': "需要聯絡資訊" },
  "They Haven't Activated Their Account": { 'zh-CN': "他们尚未激活账户", 'zh-TW': "他們尚未啟用帳戶" },
  "You Are Currently At": { 'zh-CN': "您当前处于", 'zh-TW': "您目前處於" },
  "#-# Days": { 'zh-CN': "#-# 天", 'zh-TW': "#-# 天" },
  "Days Ago.": { 'zh-CN': "天前。", 'zh-TW': "天前。" },
  "Days.": { 'zh-CN': "天。", 'zh-TW': "天。" },
  "Day(s).": { 'zh-CN': "天。", 'zh-TW': "天。" },
  "Last Accepted": { 'zh-CN': "上次接受", 'zh-TW': "上次接受" },
  "Last # Days. Includes Anonymous And Authenticated Visitors.": { 'zh-CN': "最近 # 天。包括匿名和已认证访客。", 'zh-TW': "最近 # 天。包括匿名和已認證訪客。" },
  "Capped At #%. Applied To Gross Peptide Subtotal (Pre-Discount, No Shipping, NOT Profit).": { 'zh-CN': "上限为 #%。适用于肽类总小计（折扣前、不含运费、非利润）。", 'zh-TW': "上限為 #%。適用於肽類總小計（折扣前、不含運費、非利潤）。" },
  "To Order": { 'zh-CN': "待订购", 'zh-TW': "待訂購" },
  "Oldest: Week Of": { 'zh-CN': "最早：所在周", 'zh-TW': "最早：所在週" },
  "Link (Optional, Must Start With /)": { 'zh-CN': "链接（可选，须以 / 开头）", 'zh-TW': "連結（選填，須以 / 開頭）" },
  "URL (e.g. /dashboard)": { 'zh-CN': "URL（例如 /dashboard）", 'zh-TW': "URL（例如 /dashboard）" },
  "Can recruit their own agents": { 'zh-CN': "可招募自己的代理", 'zh-TW': "可招募自己的代理" },
  "Disabled": { 'zh-CN': "已停用", 'zh-TW': "已停用" },
  "Reorder Point:": { 'zh-CN': "补货点：", 'zh-TW': "補貨點：" },
  "Of Acetic Acid #%": { 'zh-CN': "乙酸 #%", 'zh-TW': "乙酸 #%" },
  "ELI5 Summary •": { 'zh-CN': "简明摘要 •", 'zh-TW': "簡明摘要 •" },
  "Download QR": { 'zh-CN': "下载二维码", 'zh-TW': "下載 QR 碼" },
};
