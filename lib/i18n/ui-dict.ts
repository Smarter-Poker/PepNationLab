/**
 * Runtime UI dictionary for the trilingual layer (see components/UiTranslator).
 *
 * Keys are the EXACT English strings as rendered (Title Case per the platform
 * rule). A '#' in a key is a number wildcard: at lookup time digit runs
 * (optionally with $ , . %) are collapsed to '#', matched, then substituted
 * back into the translation in order - so '3 Orders' matches '# Orders'.
 *
 * The dictionary is seeded from the manufacturer dictionary (every English
 * value it defines translates identically here) plus the agent / super-agent
 * dashboard vocabulary. Anything not listed simply stays English, so adding
 * coverage is always a pure data change with zero behavioral risk.
 */

import { MDICT, type Locale } from '@/lib/i18n/manufacturer-dict';
import { EXTRACTED_A } from '@/lib/i18n/ui-extracted-a';
import { EXTRACTED_B } from '@/lib/i18n/ui-extracted-b';
import { EXTRACTED_C } from '@/lib/i18n/ui-extracted-c';
import { EXTRACTED_D } from '@/lib/i18n/ui-extracted-d';
import { EXTRACTED_E } from '@/lib/i18n/ui-extracted-e';
import { EXTRACTED_F } from '@/lib/i18n/ui-extracted-f';
import { EXTRACTED_G } from '@/lib/i18n/ui-extracted-g';
import { EXTRACTED_H } from '@/lib/i18n/ui-extracted-h';
import { EXTRACTED_I } from '@/lib/i18n/ui-extracted-i';
import { EXTRACTED_J } from '@/lib/i18n/ui-extracted-j';
import { EXTRACTED_K } from '@/lib/i18n/ui-extracted-k';
import { EXTRACTED_L } from '@/lib/i18n/ui-extracted-l';

type ZhLocale = 'zh-CN' | 'zh-TW';
type Entry = { 'zh-CN': string; 'zh-TW': string };

const CURATED: Record<string, Entry> = {
  // ── Universal actions ──────────────────────────────────
  'Save': { 'zh-CN': '保存', 'zh-TW': '儲存' },
  'Save Changes': { 'zh-CN': '保存更改', 'zh-TW': '儲存變更' },
  'Cancel': { 'zh-CN': '取消', 'zh-TW': '取消' },
  'Close': { 'zh-CN': '关闭', 'zh-TW': '關閉' },
  'Edit': { 'zh-CN': '编辑', 'zh-TW': '編輯' },
  'Delete': { 'zh-CN': '删除', 'zh-TW': '刪除' },
  'Remove': { 'zh-CN': '移除', 'zh-TW': '移除' },
  'Add': { 'zh-CN': '添加', 'zh-TW': '新增' },
  'Update': { 'zh-CN': '更新', 'zh-TW': '更新' },
  'Submit': { 'zh-CN': '提交', 'zh-TW': '提交' },
  'Confirm': { 'zh-CN': '确认', 'zh-TW': '確認' },
  'Search': { 'zh-CN': '搜索', 'zh-TW': '搜尋' },
  'Search...': { 'zh-CN': '搜索…', 'zh-TW': '搜尋…' },
  'Filter': { 'zh-CN': '筛选', 'zh-TW': '篩選' },
  'View': { 'zh-CN': '查看', 'zh-TW': '查看' },
  'View All': { 'zh-CN': '查看全部', 'zh-TW': '查看全部' },
  'View Details': { 'zh-CN': '查看详情', 'zh-TW': '查看詳情' },
  'Details': { 'zh-CN': '详情', 'zh-TW': '詳情' },
  'Download': { 'zh-CN': '下载', 'zh-TW': '下載' },
  'Upload': { 'zh-CN': '上传', 'zh-TW': '上傳' },
  'Copy': { 'zh-CN': '复制', 'zh-TW': '複製' },
  'Copy Link': { 'zh-CN': '复制链接', 'zh-TW': '複製連結' },
  'Share': { 'zh-CN': '分享', 'zh-TW': '分享' },
  'Refresh': { 'zh-CN': '刷新', 'zh-TW': '重新整理' },
  'Back': { 'zh-CN': '返回', 'zh-TW': '返回' },
  'Next': { 'zh-CN': '下一页', 'zh-TW': '下一頁' },
  'Previous': { 'zh-CN': '上一页', 'zh-TW': '上一頁' },
  'Loading...': { 'zh-CN': '加载中…', 'zh-TW': '載入中…' },
  'Loading Dashboard…': { 'zh-CN': '正在加载控制台…', 'zh-TW': '正在載入控制台…' },
  'Saving...': { 'zh-CN': '保存中…', 'zh-TW': '儲存中…' },
  'Yes': { 'zh-CN': '是', 'zh-TW': '是' },
  'No': { 'zh-CN': '否', 'zh-TW': '否' },
  'All': { 'zh-CN': '全部', 'zh-TW': '全部' },
  'None': { 'zh-CN': '无', 'zh-TW': '無' },
  'Apply': { 'zh-CN': '应用', 'zh-TW': '套用' },
  'Reset': { 'zh-CN': '重置', 'zh-TW': '重設' },
  'Export': { 'zh-CN': '导出', 'zh-TW': '匯出' },
  'Print': { 'zh-CN': '打印', 'zh-TW': '列印' },
  'Approve': { 'zh-CN': '批准', 'zh-TW': '批准' },
  'Reject': { 'zh-CN': '拒绝', 'zh-TW': '拒絕' },
  'Enabled': { 'zh-CN': '已启用', 'zh-TW': '已啟用' },
  'Disabled': { 'zh-CN': '已停用', 'zh-TW': '已停用' },
  'Active': { 'zh-CN': '启用中', 'zh-TW': '啟用中' },
  'Inactive': { 'zh-CN': '未启用', 'zh-TW': '未啟用' },
  'Visible': { 'zh-CN': '可见', 'zh-TW': '可見' },
  'On Sale': { 'zh-CN': '促销中', 'zh-TW': '促銷中' },

  // ── Dashboard shell / tabs (agent + super agent) ─────────────────
  'Overview': { 'zh-CN': '总览', 'zh-TW': '總覽' },
  'Storefront Config': { 'zh-CN': '店铺设置', 'zh-TW': '店鋪設定' },
  'Store Products': { 'zh-CN': '店铺产品', 'zh-TW': '店鋪產品' },
  'My Agent Accounts': { 'zh-CN': '我的代理账户', 'zh-TW': '我的代理帳戶' },
  'My Sub-Agents': { 'zh-CN': '我的子代理', 'zh-TW': '我的子代理' },
  'Researchers': { 'zh-CN': '研究员', 'zh-TW': '研究員' },
  'Inventory': { 'zh-CN': '库存', 'zh-TW': '庫存' },
  'Welcome Back': { 'zh-CN': '欢迎回来', 'zh-TW': '歡迎回來' },
  'Quick Actions': { 'zh-CN': '快捷操作', 'zh-TW': '快捷操作' },
  'Recent Orders': { 'zh-CN': '最近订单', 'zh-TW': '最近訂單' },
  'Recent Activity': { 'zh-CN': '最近动态', 'zh-TW': '最近動態' },
  'Notifications': { 'zh-CN': '通知', 'zh-TW': '通知' },
  'Settings': { 'zh-CN': '设置', 'zh-TW': '設定' },

  // ── Commerce vocabulary ────────────────────────────────
  'Order': { 'zh-CN': '订单', 'zh-TW': '訂單' },
  'Order #': { 'zh-CN': '订单 #', 'zh-TW': '訂單 #' },
  'Total Orders': { 'zh-CN': '订单总数', 'zh-TW': '訂單總數' },
  'Total Sales': { 'zh-CN': '销售总额', 'zh-TW': '銷售總額' },
  'Total Revenue': { 'zh-CN': '总收入', 'zh-TW': '總收入' },
  'Revenue': { 'zh-CN': '收入', 'zh-TW': '收入' },
  'Profit': { 'zh-CN': '利润', 'zh-TW': '利潤' },
  'Margin': { 'zh-CN': '利润率', 'zh-TW': '利潤率' },
  'Price': { 'zh-CN': '价格', 'zh-TW': '價格' },
  'Cost': { 'zh-CN': '成本', 'zh-TW': '成本' },
  'Retail Price': { 'zh-CN': '零售价', 'zh-TW': '零售價' },
  'Base Cost': { 'zh-CN': '基础成本', 'zh-TW': '基礎成本' },
  'Quantity': { 'zh-CN': '数量', 'zh-TW': '數量' },
  'Subtotal': { 'zh-CN': '小计', 'zh-TW': '小計' },
  'Discount': { 'zh-CN': '折扣', 'zh-TW': '折扣' },
  'Payment': { 'zh-CN': '付款', 'zh-TW': '付款' },
  'Payment Method': { 'zh-CN': '付款方式', 'zh-TW': '付款方式' },
  'Fulfillment': { 'zh-CN': '发货', 'zh-TW': '發貨' },
  'Tracking Number': { 'zh-CN': '快递单号', 'zh-TW': '快遞單號' },
  'Add Tracking': { 'zh-CN': '添加快递单号', 'zh-TW': '新增快遞單號' },
  'Shipping Address': { 'zh-CN': '收货地址', 'zh-TW': '收貨地址' },
  'Shipping Cost': { 'zh-CN': '运费', 'zh-TW': '運費' },
  'Pickup': { 'zh-CN': '自取', 'zh-TW': '自取' },
  'Ship': { 'zh-CN': '发货', 'zh-TW': '發貨' },
  'Customer': { 'zh-CN': '客户', 'zh-TW': '客戶' },
  'Customers': { 'zh-CN': '客户', 'zh-TW': '客戶' },
  'Product': { 'zh-CN': '产品', 'zh-TW': '產品' },
  'Products': { 'zh-CN': '产品', 'zh-TW': '產品' },
  'Category': { 'zh-CN': '类别', 'zh-TW': '類別' },
  'In Stock': { 'zh-CN': '有货', 'zh-TW': '有貨' },
  'Out Of Stock': { 'zh-CN': '缺货', 'zh-TW': '缺貨' },
  'Stock': { 'zh-CN': '库存', 'zh-TW': '庫存' },
  'Name': { 'zh-CN': '名称', 'zh-TW': '名稱' },
  'Email': { 'zh-CN': '邮箱', 'zh-TW': '電郵' },
  'Username': { 'zh-CN': '用户名', 'zh-TW': '用戶名' },
  'Phone': { 'zh-CN': '电话', 'zh-TW': '電話' },
  'Address': { 'zh-CN': '地址', 'zh-TW': '地址' },
  'Actions': { 'zh-CN': '操作', 'zh-TW': '操作' },
  'Created': { 'zh-CN': '创建时间', 'zh-TW': '建立時間' },
  'Joined': { 'zh-CN': '加入时间', 'zh-TW': '加入時間' },
  'Last Active': { 'zh-CN': '最近活跃', 'zh-TW': '最近活躍' },
  'This Week': { 'zh-CN': '本周', 'zh-TW': '本週' },
  'This Month': { 'zh-CN': '本月', 'zh-TW': '本月' },
  'Today': { 'zh-CN': '今天', 'zh-TW': '今天' },
  'Balance': { 'zh-CN': '余额', 'zh-TW': '餘額' },
  'Prepaid Balance': { 'zh-CN': '预付余额', 'zh-TW': '預付餘額' },
  'Credit Limit': { 'zh-CN': '信用额度', 'zh-TW': '信用額度' },
  'Available Balance': { 'zh-CN': '可用余额', 'zh-TW': '可用餘額' },
  'Amount': { 'zh-CN': '金额', 'zh-TW': '金額' },
  'Transfer': { 'zh-CN': '转账', 'zh-TW': '轉帳' },
  'Send': { 'zh-CN': '发送', 'zh-TW': '傳送' },
  'Send Message': { 'zh-CN': '发送消息', 'zh-TW': '傳送訊息' },
  'Type A Message': { 'zh-CN': '输入消息', 'zh-TW': '輸入訊息' },
  'New Message': { 'zh-CN': '新消息', 'zh-TW': '新訊息' },
  'Conversations': { 'zh-CN': '会话', 'zh-TW': '對話' },
  'No Results Found': { 'zh-CN': '未找到结果', 'zh-TW': '未找到結果' },
  'No Orders Found': { 'zh-CN': '未找到订单', 'zh-TW': '未找到訂單' },
  'No Products Found': { 'zh-CN': '未找到产品', 'zh-TW': '未找到產品' },
  'Storefront Link': { 'zh-CN': '店铺链接', 'zh-TW': '店鋪連結' },
  'Store Link': { 'zh-CN': '店铺链接', 'zh-TW': '店鋪連結' },
  'QR Code': { 'zh-CN': '二维码', 'zh-TW': '二維碼' },
  'My QR Code': { 'zh-CN': '我的二维码', 'zh-TW': '我的二維碼' },
  'Zelle': { 'zh-CN': 'Zelle', 'zh-TW': 'Zelle' },
  'Venmo': { 'zh-CN': 'Venmo', 'zh-TW': 'Venmo' },
  'Cash App': { 'zh-CN': 'Cash App', 'zh-TW': 'Cash App' },
  'Apple Pay': { 'zh-CN': 'Apple Pay', 'zh-TW': 'Apple Pay' },

  // ── Number-wildcard patterns ─────────────────────────────
  '# Orders': { 'zh-CN': '# 个订单', 'zh-TW': '# 個訂單' },
  '# Order': { 'zh-CN': '# 个订单', 'zh-TW': '# 個訂單' },
  '# Products': { 'zh-CN': '# 个产品', 'zh-TW': '# 個產品' },
  '# Items': { 'zh-CN': '# 件商品', 'zh-TW': '# 件商品' },
  '# Item': { 'zh-CN': '# 件商品', 'zh-TW': '# 件商品' },
  '# Vials': { 'zh-CN': '# 瓶', 'zh-TW': '# 瓶' },
  '# Researchers': { 'zh-CN': '# 位研究员', 'zh-TW': '# 位研究員' },
  '# Agents': { 'zh-CN': '# 位代理', 'zh-TW': '# 位代理' },
  '# Sub-Agents': { 'zh-CN': '# 位子代理', 'zh-TW': '# 位子代理' },
  '# Results': { 'zh-CN': '# 条结果', 'zh-TW': '# 條結果' },
  'Page # Of #': { 'zh-CN': '第 # 页，共 # 页', 'zh-TW': '第 # 頁，共 # 頁' },
  'Showing # Of #': { 'zh-CN': '显示 # / #', 'zh-TW': '顯示 # / #' },
  '# Downloads': { 'zh-CN': '# 次下载', 'zh-TW': '# 次下載' },
  '# Download': { 'zh-CN': '# 次下载', 'zh-TW': '# 次下載' },
};

/**
 * MDICT already carries careful translations for every string the
 * manufacturer dashboard and login page render. Reuse them here keyed by the
 * exact English value, so those same words translate identically anywhere
 * they appear on the agent surface.
 */
function buildDict(): Record<string, Entry> {
  const dict: Record<string, Entry> = {};
  for (const entry of Object.values(MDICT)) {
    const en = entry.en.trim();
    if (en && !dict[en]) {
      dict[en] = { 'zh-CN': entry['zh-CN'], 'zh-TW': entry['zh-TW'] };
    }
  }
  // Extracted agent-surface strings fill coverage (Orders, Store Products,
  // Sales, Sub-Agents, Coupons, Inventory, Bundles, CRM, Storefront Config,
  // wallet, messaging, QR, dashboard shell). Curated entries still win below.
  for (const part of [EXTRACTED_A, EXTRACTED_B, EXTRACTED_C, EXTRACTED_D, EXTRACTED_E, EXTRACTED_F, EXTRACTED_G, EXTRACTED_H, EXTRACTED_I, EXTRACTED_J, EXTRACTED_K, EXTRACTED_L]) {
    for (const [en, entry] of Object.entries(part)) {
      dict[en] = entry;
    }
  }
  // Curated entries win over derived ones on conflict.
  for (const [en, entry] of Object.entries(CURATED)) {
    dict[en] = entry;
  }
  return dict;
}

const UI_DICT: Record<string, Entry> = buildDict();

const NUMBER_RE = /[$]?\d[\d,.]*%?/g;

/**
 * Translate one trimmed UI string. Returns null when the dictionary has no
 * entry (caller leaves the text unchanged). Exact match first, then a
 * number-wildcard match where digit runs collapse to '#'.
 */
export function uiTranslate(text: string, locale: ZhLocale): string | null {
  const exact = UI_DICT[text];
  if (exact) return exact[locale];

  if (NUMBER_RE.test(text)) {
    NUMBER_RE.lastIndex = 0;
    const norm = text.replace(NUMBER_RE, '#');
    const entry = UI_DICT[norm];
    if (entry) {
      NUMBER_RE.lastIndex = 0;
      const nums = text.match(NUMBER_RE) ?? [];
      let i = 0;
      return entry[locale].replace(/#/g, () => nums[i++] ?? '#');
    }
  }
  return null;
}

export type { Locale };
