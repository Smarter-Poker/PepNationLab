/**
 * Trilingual labels for the global hamburger drawer (Phase 1 of translating
 * the full agent/super-agent surface for manufacturer accounts).
 *
 * Keyed by the ENGLISH label exactly as written in roleNavLinks.tsx and
 * Navbar.tsx, so those files keep a single source of truth for menu
 * structure and this map stays a pure display-time lookup. Unknown labels
 * fall back to the English string, so a new menu item can never break
 * rendering - it simply shows in English until a translation is added.
 *
 * Locale type and conventions come from lib/i18n/manufacturer-dict.ts
 * (en / zh-CN / zh-TW; Chinese vocabulary kept consistent with that file,
 * e.g. dashboards are rendered as controls consoles).
 */

import type { Locale } from '@/lib/i18n/manufacturer-dict';

type NavEntry = { 'zh-CN': string; 'zh-TW': string };

const NAV_DICT: Record<string, NavEntry> = {
  // Shared chrome
  'Language': { 'zh-CN': '语言', 'zh-TW': '語言' },
  'Logged In As': { 'zh-CN': '当前登录', 'zh-TW': '當前登入' },
  'Home': { 'zh-CN': '首页', 'zh-TW': '首頁' },
  'About': { 'zh-CN': '关于', 'zh-TW': '關於' },
  'Sign In': { 'zh-CN': '登录', 'zh-TW': '登入' },
  'Sign Out': { 'zh-CN': '退出登录', 'zh-TW': '登出' },
  'Dashboard': { 'zh-CN': '控制台', 'zh-TW': '控制台' },
  'Agent Dashboard': { 'zh-CN': '代理控制台', 'zh-TW': '代理控制台' },
  'Admin Dashboard': { 'zh-CN': '管理控制台', 'zh-TW': '管理控制台' },

  // Role chip under the display name
  'Super Agent': { 'zh-CN': '超级代理', 'zh-TW': '超級代理' },
  'Agent': { 'zh-CN': '代理', 'zh-TW': '代理' },
  'Researcher': { 'zh-CN': '研究员', 'zh-TW': '研究員' },
  'Admin': { 'zh-CN': '管理员', 'zh-TW': '管理員' },
  'Shipping': { 'zh-CN': '发货', 'zh-TW': '發貨' },

  // Agent / super-agent menu
  'Overview': { 'zh-CN': '总览', 'zh-TW': '總覽' },
  'Visit My Storefront': { 'zh-CN': '访问我的店铺', 'zh-TW': '訪問我的店鋪' },
  'Wallet': { 'zh-CN': '钱包', 'zh-TW': '錢包' },
  'Messenger': { 'zh-CN': '消息中心', 'zh-TW': '訊息中心' },
  'Lab Journal': { 'zh-CN': '实验日志', 'zh-TW': '實驗日誌' },
  'Orders & Fulfillment': { 'zh-CN': '订单与发货', 'zh-TW': '訂單與發貨' },
  'Storefront Configure': { 'zh-CN': '店铺设置', 'zh-TW': '店鋪設定' },
  'Product Manager': { 'zh-CN': '产品管理', 'zh-TW': '產品管理' },
  'My Agents': { 'zh-CN': '我的代理', 'zh-TW': '我的代理' },
  'My Sub Agents': { 'zh-CN': '我的子代理', 'zh-TW': '我的子代理' },
  'My Researchers': { 'zh-CN': '我的研究员', 'zh-TW': '我的研究員' },
  'Local Instock Inventory': { 'zh-CN': '本地现货库存', 'zh-TW': '本地現貨庫存' },
  'Sales & Accounting': { 'zh-CN': '销售与账务', 'zh-TW': '銷售與帳務' },
  'Research Library': { 'zh-CN': '研究文库', 'zh-TW': '研究文庫' },
  'Find A Peptide': { 'zh-CN': '查找肽', 'zh-TW': '尋找肽' },
  'Coupons': { 'zh-CN': '优惠券', 'zh-TW': '優惠券' },
  'Signup Promos': { 'zh-CN': '注册优惠', 'zh-TW': '註冊優惠' },
  'Lab Tools Calculator': { 'zh-CN': '实验工具计算器', 'zh-TW': '實驗工具計算器' },
  'Referral Codes': { 'zh-CN': '推荐码', 'zh-TW': '推薦碼' },
  'Account Settings': { 'zh-CN': '账户设置', 'zh-TW': '帳戶設定' },
  'Orders': { 'zh-CN': '订单', 'zh-TW': '訂單' },
  'Orders & Tracking': { 'zh-CN': '订单与物流', 'zh-TW': '訂單與物流' },
  'Products': { 'zh-CN': '产品', 'zh-TW': '產品' },

  // Admin menu extras
  'Pricing': { 'zh-CN': '定价', 'zh-TW': '定價' },
  'Visit Storefront': { 'zh-CN': '访问店铺', 'zh-TW': '訪問店鋪' },
  'Agent Payments': { 'zh-CN': '代理付款', 'zh-TW': '代理付款' },
  'Statements': { 'zh-CN': '结算单', 'zh-TW': '結算單' },
  'Credit Requests': { 'zh-CN': '额度申请', 'zh-TW': '額度申請' },
  'Disputes': { 'zh-CN': '争议', 'zh-TW': '爭議' },
  'Global Search': { 'zh-CN': '全局搜索', 'zh-TW': '全域搜尋' },
  'Find User': { 'zh-CN': '查找用户', 'zh-TW': '查找用戶' },
  'Transactions': { 'zh-CN': '交易记录', 'zh-TW': '交易記錄' },
  'Shadow Notes': { 'zh-CN': '内部备注', 'zh-TW': '內部備註' },
  'Network': { 'zh-CN': '代理网络', 'zh-TW': '代理網絡' },
  'Sales & Revenue': { 'zh-CN': '销售与收入', 'zh-TW': '銷售與收入' },
  'Catalog Risk': { 'zh-CN': '目录风险', 'zh-TW': '目錄風險' },
  'Global Shipping Settings': { 'zh-CN': '全局运费设置', 'zh-TW': '全域運費設定' },
  'Flash Sale': { 'zh-CN': '限时特卖', 'zh-TW': '限時特賣' },
  'Cart Recovery': { 'zh-CN': '购物车挽回', 'zh-TW': '購物車挽回' },
  'Moderation': { 'zh-CN': '内容审核', 'zh-TW': '內容審核' },
  'Audit Log': { 'zh-CN': '审计日志', 'zh-TW': '審計日誌' },
  'Referrals': { 'zh-CN': '推荐', 'zh-TW': '推薦' },

  // Drawer bottom bar
  'Advertising Hub': { 'zh-CN': '广告中心', 'zh-TW': '廣告中心' },
  'Help & Support': { 'zh-CN': '帮助与支持', 'zh-TW': '幫助與支援' },
  'Peptide 101': { 'zh-CN': '肽知识入门', 'zh-TW': '肽知識入門' },
  'Download Pep Nation App': { 'zh-CN': '下载 Pep Nation 应用', 'zh-TW': '下載 Pep Nation 應用' },
};

/**
 * Translate a drawer label for the active locale. English (or any label
 * without a dictionary entry) is returned unchanged.
 */
export function navLabel(label: string, locale: Locale): string {
  if (locale === 'en') return label;
  return NAV_DICT[label]?.[locale] ?? label;
}
