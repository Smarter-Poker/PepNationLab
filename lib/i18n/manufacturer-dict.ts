/**
 * Trilingual dictionary for every surface a manufacturer account sees:
 * the login page core labels and the entire manufacturer dashboard.
 *
 * Locales: 'en' (English), 'zh-CN' (Simplified Chinese), 'zh-TW'
 * (Traditional Chinese). English strings follow the platform Title Case
 * rule; Chinese has no letter case so the rule does not apply there.
 */

export type Locale = 'en' | 'zh-CN' | 'zh-TW';

export const SUPPORTED_LOCALES: Locale[] = ['en', 'zh-CN', 'zh-TW'];

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'EN',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
};

type Entry = Record<Locale, string>;

export const MDICT: Record<string, Entry> = {
  // ── Shared chrome ────────────────────────────────────────────────
  manufacturer_dashboard: { en: 'Manufacturer Dashboard', 'zh-CN': '制造商控制台', 'zh-TW': '製造商控制台' },
  welcome: { en: 'Welcome', 'zh-CN': '欢迎', 'zh-TW': '歡迎' },
  sign_out: { en: 'Sign Out', 'zh-CN': '退出登录', 'zh-TW': '登出' },
  your_store_link: { en: 'Your Store Link', 'zh-CN': '您的店铺链接', 'zh-TW': '您的店鋪連結' },
  copy: { en: 'Copy', 'zh-CN': '复制', 'zh-TW': '複製' },
  copied: { en: 'Copied', 'zh-CN': '已复制', 'zh-TW': '已複製' },
  loading: { en: 'Loading', 'zh-CN': '加载中', 'zh-TW': '載入中' },
  load_failed: { en: 'Could Not Load. Please Retry.', 'zh-CN': '加载失败，请重试。', 'zh-TW': '載入失敗，請重試。' },
  retry: { en: 'Retry', 'zh-CN': '重试', 'zh-TW': '重試' },
  language: { en: 'Language', 'zh-CN': '语言', 'zh-TW': '語言' },

  // ── Tabs ─────────────────────────────────────────────────────────
  tab_products: { en: 'Products And Pricing', 'zh-CN': '产品与定价', 'zh-TW': '產品與定價' },
  tab_orders: { en: 'Orders', 'zh-CN': '订单', 'zh-TW': '訂單' },
  tab_earnings: { en: 'Earnings', 'zh-CN': '收益', 'zh-TW': '收益' },
  tab_settings: { en: 'Settings', 'zh-CN': '设置', 'zh-TW': '設定' },

  // ── Products tab ─────────────────────────────────────────────────
  pricing_intro: {
    en: 'Set Any Price Per 10-Vial Pack. No Floors, No Ceilings, No Restrictions.',
    'zh-CN': '每10瓶装的售价完全由您决定，没有最低价、最高价或任何限制。',
    'zh-TW': '每10瓶裝的售價完全由您決定，沒有最低價、最高價或任何限制。',
  },
  pricing_note_multiples: {
    en: 'Everything On Your Store Is Bought And Sold In Multiples Of 10 Vials.',
    'zh-CN': '您店铺中的所有产品均以10瓶为单位买卖。',
    'zh-TW': '您店鋪中的所有產品均以10瓶為單位買賣。',
  },
  search_products: { en: 'Search Products', 'zh-CN': '搜索产品', 'zh-TW': '搜尋產品' },
  col_product: { en: 'Product', 'zh-CN': '产品', 'zh-TW': '產品' },
  col_size: { en: 'Size', 'zh-CN': '规格', 'zh-TW': '規格' },
  price_per_10: { en: 'Price Per 10 Vials', 'zh-CN': '每10瓶售价', 'zh-TW': '每10瓶售價' },
  your_cost_per_10: { en: 'Your Cost Per 10 Vials', 'zh-CN': '您的成本（每10瓶）', 'zh-TW': '您的成本（每10瓶）' },
  cost_private_note: {
    en: 'Private. Only You And The Site Owner Can See This.',
    'zh-CN': '保密信息，仅您和站长可见。',
    'zh-TW': '保密資訊，僅您和站長可見。',
  },
  you_receive: { en: 'You Receive', 'zh-CN': '您的所得', 'zh-TW': '您的所得' },
  your_profit: { en: 'Your Profit', 'zh-CN': '您的利润', 'zh-TW': '您的利潤' },
  per_pack_of_10: { en: 'Per Pack Of 10', 'zh-CN': '每10瓶装', 'zh-TW': '每10瓶裝' },
  visible_in_store: { en: 'Visible In Store', 'zh-CN': '店铺显示', 'zh-TW': '店鋪顯示' },
  hidden: { en: 'Hidden', 'zh-CN': '已隐藏', 'zh-TW': '已隱藏' },
  save: { en: 'Save', 'zh-CN': '保存', 'zh-TW': '儲存' },
  saving: { en: 'Saving', 'zh-CN': '保存中', 'zh-TW': '儲存中' },
  saved: { en: 'Saved', 'zh-CN': '已保存', 'zh-TW': '已儲存' },
  save_failed: { en: 'Save Failed. Please Retry.', 'zh-CN': '保存失败，请重试。', 'zh-TW': '儲存失敗，請重試。' },
  not_set: { en: 'Not Set', 'zh-CN': '未设置', 'zh-TW': '未設定' },
  no_products_found: { en: 'No Products Found.', 'zh-CN': '未找到产品。', 'zh-TW': '未找到產品。' },
  set_cost_hint: {
    en: 'Enter Your Own Production Cost To See Your Profit Per Pack.',
    'zh-CN': '输入您的生产成本，即可查看每包利润。',
    'zh-TW': '輸入您的生產成本，即可查看每包利潤。',
  },

  // ── Orders tab ───────────────────────────────────────────────────
  orders_intro: {
    en: 'Orders Placed On Your Store. You Ship Every Order Directly.',
    'zh-CN': '您店铺的订单，所有订单均由您直接发货。',
    'zh-TW': '您店鋪的訂單，所有訂單均由您直接發貨。',
  },
  col_order: { en: 'Order', 'zh-CN': '订单号', 'zh-TW': '訂單號' },
  col_date: { en: 'Date', 'zh-CN': '日期', 'zh-TW': '日期' },
  col_buyer: { en: 'Buyer', 'zh-CN': '买家', 'zh-TW': '買家' },
  col_items: { en: 'Items', 'zh-CN': '商品', 'zh-TW': '商品' },
  col_status: { en: 'Status', 'zh-CN': '状态', 'zh-TW': '狀態' },
  col_total: { en: 'Total', 'zh-CN': '总计', 'zh-TW': '總計' },
  product_subtotal: { en: 'Product Subtotal', 'zh-CN': '产品小计', 'zh-TW': '產品小計' },
  shipping: { en: 'Shipping', 'zh-CN': '运费', 'zh-TW': '運費' },
  vials: { en: 'Vials', 'zh-CN': '瓶', 'zh-TW': '瓶' },
  no_orders_yet: { en: 'No Orders Yet.', 'zh-CN': '暂无订单。', 'zh-TW': '暫無訂單。' },
  approve_ship: { en: 'Approve And Ship', 'zh-CN': '批准并发货', 'zh-TW': '批准並發貨' },
  mark_paid: { en: 'Mark Paid', 'zh-CN': '标记已付款', 'zh-TW': '標記已付款' },
  cancel_order: { en: 'Cancel Order', 'zh-CN': '取消订单', 'zh-TW': '取消訂單' },
  action_done: { en: 'Done', 'zh-CN': '已完成', 'zh-TW': '已完成' },
  action_failed: { en: 'Action Failed. Please Retry.', 'zh-CN': '操作失败，请重试。', 'zh-TW': '操作失敗，請重試。' },
  confirm_cancel: {
    en: 'Cancel This Order? This Cannot Be Undone.',
    'zh-CN': '确定取消该订单？此操作无法撤销。',
    'zh-TW': '確定取消該訂單？此操作無法撤銷。',
  },

  // Order statuses
  status_pending_customer_payment: { en: 'Awaiting Customer Payment', 'zh-CN': '等待客户付款', 'zh-TW': '等待客戶付款' },
  status_agent_approval_pending: { en: 'Awaiting Your Approval', 'zh-CN': '等待您审批', 'zh-TW': '等待您審批' },
  status_approved_ship: { en: 'Approved - Ship It', 'zh-CN': '已批准，请发货', 'zh-TW': '已批准，請發貨' },
  status_approved_pickup: { en: 'Approved - Pickup', 'zh-CN': '已批准，自取', 'zh-TW': '已批准，自取' },
  status_in_fulfillment: { en: 'In Fulfillment', 'zh-CN': '配货中', 'zh-TW': '配貨中' },
  status_shipped: { en: 'Shipped', 'zh-CN': '已发货', 'zh-TW': '已發貨' },
  status_delivered: { en: 'Delivered', 'zh-CN': '已送达', 'zh-TW': '已送達' },
  status_cancelled: { en: 'Cancelled', 'zh-CN': '已取消', 'zh-TW': '已取消' },

  // ── Earnings tab ─────────────────────────────────────────────────
  earnings_intro: {
    en: 'Every Sale Splits Automatically: Your Share, The Platform Commission, And Shipping Passed To You In Full.',
    'zh-CN': '每笔销售自动分账：您的份额、平台佣金，运费全额归您。',
    'zh-TW': '每筆銷售自動分帳：您的份額、平台佣金，運費全額歸您。',
  },
  product_sales: { en: 'Product Sales', 'zh-CN': '产品销售额', 'zh-TW': '產品銷售額' },
  platform_commission: { en: 'Platform Commission', 'zh-CN': '平台佣金', 'zh-TW': '平台佣金' },
  your_net_earnings: { en: 'Your Net Earnings', 'zh-CN': '您的净收益', 'zh-TW': '您的淨收益' },
  shipping_collected: { en: 'Shipping Collected', 'zh-CN': '已收运费', 'zh-TW': '已收運費' },
  all_time: { en: 'All Time', 'zh-CN': '累计', 'zh-TW': '累計' },
  last_30_days: { en: 'Last 30 Days', 'zh-CN': '近30天', 'zh-TW': '近30天' },
  col_commission: { en: 'Commission', 'zh-CN': '佣金', 'zh-TW': '佣金' },
  col_your_net: { en: 'Your Net', 'zh-CN': '您的净额', 'zh-TW': '您的淨額' },
  voided: { en: 'Voided', 'zh-CN': '已作废', 'zh-TW': '已作廢' },
  no_earnings_yet: { en: 'No Sales Recorded Yet.', 'zh-CN': '暂无销售记录。', 'zh-TW': '暫無銷售記錄。' },
  commission_explainer: {
    en: 'Pep Nation Lab Keeps {pct}% Of Product Sales As Commission. Shipping Charges Pass To You In Full. Settlement Is Arranged Directly With The Site Owner.',
    'zh-CN': 'Pep Nation Lab 收取产品销售额的{pct}%作为佣金，运费全额归您。结算事宜与站长直接安排。',
    'zh-TW': 'Pep Nation Lab 收取產品銷售額的{pct}%作為佣金，運費全額歸您。結算事宜與站長直接安排。',
  },

  // ── Settings tab ─────────────────────────────────────────────────
  settings_language_title: { en: 'Choose Your Language', 'zh-CN': '选择语言', 'zh-TW': '選擇語言' },
  settings_language_note: {
    en: 'Your Choice Is Remembered On This Device And On Your Account.',
    'zh-CN': '您的选择将保存在本设备和您的账户中。',
    'zh-TW': '您的選擇將保存在本裝置和您的帳戶中。',
  },
  change_password: { en: 'Change Password', 'zh-CN': '修改密码', 'zh-TW': '修改密碼' },
  new_password: { en: 'New Password', 'zh-CN': '新密码', 'zh-TW': '新密碼' },
  confirm_new_password: { en: 'Confirm New Password', 'zh-CN': '确认新密码', 'zh-TW': '確認新密碼' },
  update_password: { en: 'Update Password', 'zh-CN': '更新密码', 'zh-TW': '更新密碼' },
  password_updated: { en: 'Password Updated.', 'zh-CN': '密码已更新。', 'zh-TW': '密碼已更新。' },
  password_mismatch: { en: 'Passwords Do Not Match.', 'zh-CN': '两次输入的密码不一致。', 'zh-TW': '兩次輸入的密碼不一致。' },
  password_too_short: { en: 'Password Must Be At Least 8 Characters.', 'zh-CN': '密码至少需要8个字符。', 'zh-TW': '密碼至少需要8個字元。' },
  password_update_failed: { en: 'Password Update Failed. Please Retry.', 'zh-CN': '密码更新失败，请重试。', 'zh-TW': '密碼更新失敗，請重試。' },
  your_commission_rate: { en: 'Your Commission Arrangement', 'zh-CN': '您的佣金安排', 'zh-TW': '您的佣金安排' },

  // ── Login page ───────────────────────────────────────────────────
  login_title: { en: 'Sign In To Your Account', 'zh-CN': '登录您的账户', 'zh-TW': '登入您的帳戶' },
  login_username: { en: 'Username Or Email', 'zh-CN': '用户名或邮箱', 'zh-TW': '用戶名或電郵' },
  login_password: { en: 'Password', 'zh-CN': '密码', 'zh-TW': '密碼' },
  login_button: { en: 'Sign In', 'zh-CN': '登录', 'zh-TW': '登入' },
  login_loading: { en: 'Signing In', 'zh-CN': '登录中', 'zh-TW': '登入中' },
  login_forgot: { en: 'Forgot Password?', 'zh-CN': '忘记密码？', 'zh-TW': '忘記密碼？' },
  login_invalid: { en: 'Invalid Username Or Password', 'zh-CN': '用户名或密码错误', 'zh-TW': '用戶名或密碼錯誤' },
  login_subtitle: { en: 'Access Your Account', 'zh-CN': '访问您的账户', 'zh-TW': '訪問您的帳戶' },
  login_or_username: { en: 'Or Sign In With A Username', 'zh-CN': '或使用用户名登录', 'zh-TW': '或使用用戶名登入' },
  login_username_label: { en: 'Username', 'zh-CN': '用户名', 'zh-TW': '用戶名' },
  login_username_placeholder: { en: 'Enter Your Username', 'zh-CN': '输入您的用户名', 'zh-TW': '輸入您的用戶名' },
  login_button_lab: { en: 'Sign In To Laboratory', 'zh-CN': '登录实验室', 'zh-TW': '登入實驗室' },
  login_authenticating: { en: 'Authenticating', 'zh-CN': '验证中', 'zh-TW': '驗證中' },
  login_no_account: { en: 'Do Not Have An Account?', 'zh-CN': '还没有账户？', 'zh-TW': '還沒有帳戶？' },
  login_create_account: { en: 'Create Account', 'zh-CN': '创建账户', 'zh-TW': '創建帳戶' },
  login_ruo_footer: { en: 'For Qualified Researchers Only. Research Use Only.', 'zh-CN': '仅限合格研究人员，仅供研究使用。', 'zh-TW': '僅限合格研究人員，僅供研究使用。' },
  login_reset_title: { en: 'Password Reset', 'zh-CN': '重置密码', 'zh-TW': '重置密碼' },
  login_reset_body: { en: 'Contact Your Research Agent If You Forgot Your Password Or Need It Reset', 'zh-CN': '如忘记密码或需要重置，请联系您的研究代理。', 'zh-TW': '如忘記密碼或需要重置，請聯繫您的研究代理。' },
  got_it: { en: 'Got It', 'zh-CN': '知道了', 'zh-TW': '知道了' },
};

/** Resolve a dictionary key for a locale, with English then key fallback. */
export function translate(key: string, locale: Locale, vars?: Record<string, string | number>): string {
  const entry = MDICT[key];
  let out = entry ? (entry[locale] ?? entry.en) : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.split(`{${k}}`).join(String(v));
    }
  }
  return out;
}
