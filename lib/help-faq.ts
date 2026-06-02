/**
 * R27 — Canonical FAQ catalog for /account/help.
 *
 * Single source of truth so the same content can power: the Help & Support
 * page accordion, future search indexing, agent-side help, and any embed
 * widget (e.g., context-aware help on the order detail page).
 *
 * Style rules (platform-wide):
 *   - All `q` and `a` text is Title Case (every word capitalised) per the
 *     PepNationLab UI standard. CSS `text-transform: capitalize` is a
 *     fallback, not a substitute — the source must be Title Case too.
 *   - Zero emojis anywhere.
 *   - `audience` defaults to 'all'. Items with audience 'agent' are only
 *     shown when the viewer's role is 'agent' / 'super_agent' / 'admin'.
 *   - `id` is kebab-case; the client builds anchors as `#faq-<id>` so a
 *     support reply can deep-link to a specific answer.
 *   - `links` is an optional array of in-app destinations rendered as a
 *     small button row beneath the answer.
 */

export type FaqAudience = 'all' | 'agent';

export type FaqCategoryId =
  | 'getting-started'
  | 'payments'
  | 'orders'
  | 'shipping'
  | 'compounds'
  | 'wallet'
  | 'returns'
  | 'account'
  | 'notifications'
  | 'subscriptions'
  | 'referrals'
  | 'pricing'
  | 'privacy'
  | 'mobile'
  | 'agents';

export interface FaqLink {
  label: string;
  href: string;
}

export interface FaqItem {
  id: string;
  category: FaqCategoryId;
  audience?: FaqAudience;
  q: string;
  a: string;
  links?: FaqLink[];
}

export interface FaqCategory {
  id: FaqCategoryId;
  label: string;
  audience: FaqAudience;
}

/**
 * Categories rendered in the order below. Each category gets its own
 * accordion section in the UI. Order is intentional: most-asked first.
 */
export const FAQ_CATEGORIES: FaqCategory[] = [
  { id: 'getting-started', label: 'Getting Started',           audience: 'all' },
  { id: 'payments',        label: 'Payments',                  audience: 'all' },
  { id: 'orders',          label: 'Orders & Fulfillment',      audience: 'all' },
  { id: 'shipping',        label: 'Shipping & Tracking',       audience: 'all' },
  { id: 'compounds',       label: 'Compounds, Lot & COA',      audience: 'all' },
  { id: 'wallet',          label: 'Wallet & Store Credit',     audience: 'all' },
  { id: 'returns',         label: 'Returns & Refunds',         audience: 'all' },
  { id: 'subscriptions',   label: 'Subscriptions',             audience: 'all' },
  { id: 'referrals',       label: 'Referrals',                 audience: 'all' },
  { id: 'pricing',         label: 'Pricing & Storefronts',     audience: 'all' },
  { id: 'account',         label: 'Account & Security',        audience: 'all' },
  { id: 'notifications',   label: 'Notifications & Messaging', audience: 'all' },
  { id: 'privacy',         label: 'Privacy & Data',            audience: 'all' },
  { id: 'mobile',          label: 'Mobile App',                audience: 'all' },
  { id: 'agents',          label: 'For Agents',                audience: 'agent' },
];

/**
 * The full catalog. Add new items here only — keep the file the
 * single source of truth.
 */
export const FAQ_ITEMS: FaqItem[] = [
  // ─────────────────────────────────────────────────────────────
  // GETTING STARTED
  // ─────────────────────────────────────────────────────────────
  {
    id: 'how-do-i-sign-up',
    category: 'getting-started',
    q: 'How Do I Sign Up?',
    a: "PepNationLab Is Invite-Only Through An Agent Storefront. Visit Your Agent's Storefront URL And Use Their Signup Form. Public Self-Registration Is Closed Platform-Wide.",
  },
  {
    id: 'how-do-i-find-an-agent',
    category: 'getting-started',
    q: 'How Do I Find An Agent?',
    a: 'If You Were Referred, Use The Storefront URL Your Referrer Shared. If You Have Ordered Before, Your Agent Is Listed In Your Account Settings. Otherwise, Contact Support And We Will Help You Find One.',
  },
  {
    id: 'what-is-research-use-only',
    category: 'getting-started',
    q: 'What Does Research Use Only Mean?',
    a: 'All Products Are Sold Strictly For Laboratory And Analytical Research Use. Not For Human Or Veterinary Consumption. By Using The Platform You Acknowledge The Research-Only Disclaimer Every Time You Enter The Site, Register, Add To Cart, And Check Out.',
    links: [{ label: 'View Disclaimer', href: '/account?tab=compliance' }],
  },
  {
    id: 'why-disclaimer-so-many-times',
    category: 'getting-started',
    q: 'Why Do I Have To Acknowledge The Disclaimer So Many Times?',
    a: 'Research-Only Chemicals Require Layered Acknowledgement For Compliance. Each Of The Four Layers (Site Entry, Registration, Add To Cart, Checkout) Is Logged Separately With A Timestamp So There Is A Clear Audit Trail.',
  },
  {
    id: 'how-do-i-reset-password',
    category: 'getting-started',
    q: 'I Forgot My Password — How Do I Reset It?',
    a: 'On The Login Screen, Tap Forgot Password And Enter The Email On Your Account. We Will Send A Reset Link That Is Valid For One Hour.',
    links: [{ label: 'Forgot Password', href: '/forgot-password' }],
  },
  {
    id: 'username-vs-email-login',
    category: 'getting-started',
    q: 'Can I Log In With My Username Instead Of Email?',
    a: 'Yes. Once You Set A Username Under Account, You Can Use Either The Username Or The Email At Login. Usernames Are Case-Insensitive.',
    links: [{ label: 'Set Username', href: '/account' }],
  },

  // ─────────────────────────────────────────────────────────────
  // PAYMENTS
  // ─────────────────────────────────────────────────────────────
  {
    id: 'how-do-i-pay-for-an-order',
    category: 'payments',
    q: 'How Do I Pay For An Order?',
    a: "Orders Are Paid Peer-To-Peer Via Zelle, Venmo, Cash App, Apple Pay, Apple Cash, PayPal, Google Wallet, Wise, Or Chime. The Available Methods On Each Order Depend On Which Handles Your Agent Has Enabled. Payment Instructions And Your Agent's Handle Are Shown On The Order Detail Page After Checkout.",
  },
  {
    id: 'why-no-credit-cards',
    category: 'payments',
    q: 'Why No Credit Cards?',
    a: 'PepNationLab Is A Research-Only Marketplace. We Keep Settlement Peer-To-Peer Through Payment Apps That Are Appropriate For This Use Case. We Do Not Store Or Process Card Numbers At Any Point.',
  },
  {
    id: 'when-do-i-pay',
    category: 'payments',
    q: 'When Do I Pay — Before Or After Agent Approval?',
    a: 'You Pay Right After Placing The Order. Your Order Sits In Pending Customer Payment Until Your Agent Confirms Funds Landed, At Which Point It Moves Into Approval And Fulfillment.',
  },
  {
    id: 'upload-payment-proof',
    category: 'payments',
    q: 'How Do I Upload Proof Of Payment?',
    a: 'Open The Order Detail Page. Under Payment Proof, Tap Upload And Attach A Screenshot Or Receipt (PNG, JPG, Or PDF). Your Agent Is Notified Automatically And Can Approve The Order As Soon As They See It.',
    links: [{ label: 'My Orders', href: '/orders' }],
  },
  {
    id: 'change-payment-method',
    category: 'payments',
    q: 'Can I Change My Payment Method After Placing An Order?',
    a: 'Yes, As Long As The Order Is Still In Pending Customer Payment. Open The Order, Tap Change Payment Method, And Pick A Different Method Your Agent Accepts. Once Your Agent Approves The Order, The Method Is Locked.',
  },
  {
    id: 'agent-payment-handle',
    category: 'payments',
    q: "What Is My Agent's Payment Handle?",
    a: 'The Specific Phone Number, Email, Or Username To Send Funds To On Each Payment App. It Is Displayed On The Order Detail Page In The Payment Instructions Card, Along With The Exact Amount Due.',
  },
  {
    id: 'default-payment-method',
    category: 'payments',
    q: 'How Do I Set A Default Payment Method?',
    a: 'Account → Payment Method. Pick The Method You Use Most Often. New Orders Pre-Select This Method At Checkout, But You Can Still Change It Per Order Until Approval.',
    links: [{ label: 'Payment Method', href: '/account/payment-method' }],
  },
  {
    id: 'order-marked-paid-but-still-pending',
    category: 'payments',
    q: 'I Sent Payment But My Order Is Still Pending — What Now?',
    a: 'Your Agent Has Not Confirmed Receipt Yet. Upload Your Payment Proof If You Have Not Already, Then Message Your Agent. If There Is No Response Within 24 Hours, Contact Support And We Will Reach Out On Your Behalf.',
  },

  // ─────────────────────────────────────────────────────────────
  // ORDERS & FULFILLMENT
  // ─────────────────────────────────────────────────────────────
  {
    id: 'when-will-my-order-ship',
    category: 'orders',
    q: 'When Will My Order Ship?',
    a: 'Once Your Agent Confirms Payment, Your Order Moves Into Approval And Then Into Fulfillment. Most Orders Ship Within 1 To 3 Business Days Of Approval. You Can Track The Status Any Time From My Orders.',
    links: [{ label: 'My Orders', href: '/orders' }],
  },
  {
    id: 'order-statuses-explained',
    category: 'orders',
    q: 'What Do The Different Order Statuses Mean?',
    a: 'Pending Customer Payment: Order Placed, Waiting On Your Payment. Agent Approval Pending: Payment Received, Awaiting Agent Confirmation. Approved For Shipping Or Approved For Pickup: Confirmed And Queued For Fulfillment. In Fulfillment: Being Packed. Shipped: Label Scanned By Carrier. Delivered: Confirmed Delivered. Cancelled: Voided By You, Your Agent, Or An Auto-Cancel Rule.',
  },
  {
    id: 'ship-vs-pickup',
    category: 'orders',
    q: "What's The Difference Between Approval For Shipping And Approval For Pickup?",
    a: 'Approval For Shipping Means Your Order Will Be Mailed To Your Saved Address Via The Carrier. Approval For Pickup Means You Are Collecting From Your Agent Directly (Local Only). The Fulfillment Method Is Chosen At Checkout.',
  },
  {
    id: 'order-stuck-in-approval',
    category: 'orders',
    q: 'My Order Is Stuck In Agent Approval Pending — What Do I Do?',
    a: 'Most Often This Is The Agent Waiting On Payment Confirmation To Land. Make Sure You Uploaded Your Payment Proof, Then Message Your Agent From Messenger. If There Is No Response In 24 Hours, Open A Support Chat And We Will Step In.',
    links: [{ label: 'Open Messenger', href: '/messenger' }],
  },
  {
    id: 'cancel-an-order',
    category: 'orders',
    q: 'How Do I Cancel An Order?',
    a: 'You Can Cancel Any Order That Is Still In Pending Customer Payment Or Agent Approval Pending Directly From The Order Detail Page. Once Approved For Shipping Or Pickup, Cancellation Has To Go Through Your Agent Or Support.',
  },
  {
    id: 'cancelled-why',
    category: 'orders',
    q: 'My Order Was Marked Cancelled — Why?',
    a: 'Common Reasons: Unpaid For More Than 72 Hours (Auto-Cancelled By The System), Agent Declined The Order, Payment Was Disputed, Or A Product On The Order Became Unavailable. Open The Order To See The Reason Logged.',
  },
  {
    id: 'order-wrong-or-missing',
    category: 'orders',
    q: 'My Order Arrived Wrong Or Missing An Item — What Now?',
    a: 'Open The Order Detail Page And Tap Report Issue, Or Start A Support Chat. Include Photos Of What You Received And The Packing Slip. We Resolve Wrong-Item And Short-Ship Cases With A Replacement Or Store Credit.',
  },
  {
    id: 'where-do-i-find-receipt',
    category: 'orders',
    q: 'Where Do I Find My Receipt?',
    a: 'Every Order Has A Download Receipt Button On The Order Detail Page. The PDF Includes Order Number, Buyer And Seller Info, Line Items, Payment Method, And Shipping Address.',
  },

  // ─────────────────────────────────────────────────────────────
  // SHIPPING & TRACKING
  // ─────────────────────────────────────────────────────────────
  {
    id: 'where-is-my-tracking-number',
    category: 'shipping',
    q: 'Where Do I Find My Tracking Number?',
    a: "On The Order Detail Page Under Tracking, As Soon As Your Agent Generates The Label. The Tracking Number Links To The Carrier's Tracking Page Directly.",
  },
  {
    id: 'what-carriers',
    category: 'shipping',
    q: 'What Carriers Do You Use?',
    a: 'USPS, UPS, And FedEx, Selected By The Best Available Rate For The Weight And Destination Through Shippo. Your Agent Sees The Carrier Options And Picks At Label Generation.',
  },
  {
    id: 'how-shipping-calculated',
    category: 'shipping',
    q: 'How Is Shipping Calculated?',
    a: 'Each Agent Has Weight-Tier Pricing Configured On Their Storefront. The Final Shipping Cost Is Shown At Checkout Before You Confirm The Order.',
  },
  {
    id: 'tracking-says-delivered-no-package',
    category: 'shipping',
    q: "Tracking Says Delivered But I Don't Have It — What Do I Do?",
    a: 'First, Check Anywhere The Carrier May Have Left It (Porch, Mailbox, Side Door) And Ask Neighbors. If 48 Hours Pass With No Package, Open A Support Chat With Your Order Number And We Will Help File A Claim.',
  },
  {
    id: 'po-box',
    category: 'shipping',
    q: 'Can I Ship To A P.O. Box?',
    a: 'USPS Service Levels Can Deliver To P.O. Boxes. UPS And FedEx Require A Street Address. If Your Agent Only Offers UPS Or FedEx, You Will Need A Street Address.',
  },
  {
    id: 'international-shipping',
    category: 'shipping',
    q: 'Do You Ship Internationally?',
    a: "Depends On Your Agent. Many Agents Are Domestic US Only. Check Your Storefront Or Message Your Agent Before Placing An International Order. Customs Fees Are The Buyer's Responsibility When International Shipping Is Available.",
  },
  {
    id: 'shipping-cold-chain',
    category: 'shipping',
    q: 'How Are Temperature-Sensitive Products Shipped?',
    a: 'Lyophilized Vials Ship Stable At Room Temperature For Short Transit Times And Do Not Require Cold-Chain Shipping. If You Need Expedited Delivery To Limit Exposure, Pick The Fastest Service At Checkout.',
  },

  // ─────────────────────────────────────────────────────────────
  // COMPOUNDS, LOT & COA
  // ─────────────────────────────────────────────────────────────
  {
    id: 'what-is-lot-number',
    category: 'compounds',
    q: 'What Is A Lot Number?',
    a: 'A Unique Batch Identifier From The Manufacturer. Every Line Item On Your Order Detail Page Displays Its Lot Number Once The Item Is Picked And Packed.',
  },
  {
    id: 'what-is-coa',
    category: 'compounds',
    q: 'What Is A Certificate Of Analysis (COA)?',
    a: 'A Third-Party Lab Report Documenting Purity And Identity Of The Specific Lot You Received. When A COA Is Available, A View COA Link Appears Next To That Line Item.',
  },
  {
    id: 'lot-coa-pending',
    category: 'compounds',
    q: 'My Order Says "Lot Pending" Or "COA Pending" — When Will It Show?',
    a: 'Lot Numbers And COA Links Are Stamped At Fulfillment Time. If Your Order Is Still In Approval Or In Fulfillment, Both Will Populate Before The Package Ships. You Will Always Have The Final Values By The Time You Receive Your Shipment.',
  },
  {
    id: 'storage-and-handling',
    category: 'compounds',
    q: 'How Should I Store Research Compounds?',
    a: "Most Peptides Are Stable At Room Temperature For Short Durations And Should Be Stored At -20°C For Long-Term Storage Or 2 To 8°C For Short-Term After Reconstitution. Always Reference The Specific Compound's Documentation. We Cannot Provide Compound-Specific Guidance Beyond General Handling Notes.",
  },
  {
    id: 'reconstitution-supplies',
    category: 'compounds',
    q: 'Do You Sell Bacteriostatic Water And Syringes?',
    a: "Yes. Most Storefronts Carry Bacteriostatic Water, Syringes, And Other Reconstitution Supplies As Add-Ons On The Catalog. Check Your Agent's Storefront Or Search Their Catalog.",
  },
  {
    id: 'disposal',
    category: 'compounds',
    q: 'How Do I Dispose Of Unused Research Materials?',
    a: 'Follow Your Local Laboratory Waste Disposal Regulations. Used Syringes And Sharps Must Go Into A Rigid Sharps Container. Do Not Place Unused Compounds Or Sharps In Household Trash Or Recycling.',
  },
  {
    id: 'banned-products',
    category: 'compounds',
    q: 'A Product I Used To Buy Is No Longer Listed — Why?',
    a: 'Either Your Agent Has Removed It From Their Catalog, Or The Product Was Banned Platform-Wide For Compliance. Banned Products Cannot Be Added To Any Cart Or Checkout. Browse Alternatives In The Same Category.',
  },

  // ─────────────────────────────────────────────────────────────
  // WALLET & STORE CREDIT
  // ─────────────────────────────────────────────────────────────
  {
    id: 'what-is-store-credit',
    category: 'wallet',
    q: 'What Is Store Credit?',
    a: 'Balance Held In Your Lab Wallet That Can Be Applied At Checkout. Earned From Referrals, Returns, And Admin Adjustments. Spends The Same As Cash But Cannot Be Withdrawn.',
    links: [{ label: 'Open Wallet', href: '/wallet' }],
  },
  {
    id: 'wallet-balance',
    category: 'wallet',
    q: 'Where Do I See My Wallet Balance?',
    a: 'Lab Wallet From The Main Navigation, Or The Wallet Card On Your Dashboard. Shows Your Current Balance, Recent Transactions, And Any Pending Credits.',
    links: [{ label: 'Open Wallet', href: '/wallet' }],
  },
  {
    id: 'use-store-credit-at-checkout',
    category: 'wallet',
    q: 'How Do I Use Store Credit At Checkout?',
    a: 'If You Have A Balance, A Use Store Credit Toggle Appears In The Checkout Summary. Turn It On To Apply The Full Available Credit Or Pick A Custom Amount.',
  },
  {
    id: 'send-store-credit',
    category: 'wallet',
    q: 'Can I Send Store Credit To Another User?',
    a: "Yes. From The Wallet Page, Tap Send Funds, Enter The Recipient's Username Or Email, And Confirm. Transfers Are Instant And Logged In Both Wallets.",
    links: [{ label: 'Send Funds', href: '/wallet' }],
  },
  {
    id: 'prepaid-vs-store-credit',
    category: 'wallet',
    q: "What's The Difference Between Prepaid Balance And Store Credit?",
    a: 'Both Live In Your Lab Wallet. Prepaid Balance Is Funds You Deposited Up Front. Store Credit Is Earned Through Referrals, Returns, Or Adjustments. Both Spend Identically At Checkout.',
  },
  {
    id: 'wallet-history',
    category: 'wallet',
    q: 'How Do I See My Wallet History?',
    a: 'Open The Wallet Page. The Transactions List Shows Every Credit, Debit, Transfer In, Transfer Out, And Refund With Timestamp And Reference.',
  },

  // ─────────────────────────────────────────────────────────────
  // RETURNS & REFUNDS
  // ─────────────────────────────────────────────────────────────
  {
    id: 'how-do-i-return',
    category: 'returns',
    q: 'How Do I Request A Return?',
    a: 'Open The Order Detail Page Within 7 Days Of Delivery And Tap Request Return. Pick A Reason, Attach Photos, And Submit. You Will Receive An RMA Number And Return Instructions.',
  },
  {
    id: 'damaged-shipment',
    category: 'returns',
    q: 'My Product Arrived Damaged — What Do I Do?',
    a: 'Open A Return Within 7 Days, Reason: Damaged. Attach Photos Of The Damage And The Outer Packaging. We Either Replace The Item Or Refund To Wallet At Your Choice.',
  },
  {
    id: 'refund-vs-credit',
    category: 'returns',
    q: 'Do I Get A Cash Refund Or Store Credit?',
    a: "Damaged Or Wrong-Item Returns Get Your Choice Of A Refund Back To Your Payment Method Or A Credit To Your Wallet. Buyer's-Remorse Returns Are Store Credit Only.",
  },
  {
    id: 'restocking-fee',
    category: 'returns',
    q: 'Is There A Restocking Fee?',
    a: 'Defect Returns Have No Fee. Non-Defect Returns Of Opened Packages May Carry A Restocking Fee, Shown On The RMA Quote Before You Confirm.',
  },
  {
    id: 'return-window',
    category: 'returns',
    q: "What's The Return Window?",
    a: 'Seven Days From The Delivery Date Tracked By The Carrier. After 7 Days Returns Are Not Accepted Except For Documented Defects Discovered Later.',
  },

  // ─────────────────────────────────────────────────────────────
  // SUBSCRIPTIONS
  // ─────────────────────────────────────────────────────────────
  {
    id: 'what-is-auto-replenish',
    category: 'subscriptions',
    q: 'What Is Auto-Replenish?',
    a: 'An Automatic Reorder Of A Past Order On A Schedule You Set (Weekly, Monthly, Or Custom Interval). Each Cycle Creates A New Pending Order You Can Edit Or Pay Like Any Other.',
  },
  {
    id: 'set-up-auto-replenish',
    category: 'subscriptions',
    q: 'How Do I Set Up Auto-Replenish?',
    a: 'Open The Order Detail Page You Want To Repeat And Tap Subscribe & Replenish. Pick The Interval And Save. The Next Cycle Lands Automatically On Schedule.',
  },
  {
    id: 'cancel-subscription',
    category: 'subscriptions',
    q: 'How Do I Cancel A Subscription?',
    a: 'Account → Subscriptions. Pick The Subscription And Tap Cancel. No Further Orders Will Be Created. Already-Created Orders Are Not Affected.',
  },
  {
    id: 'edit-subscription',
    category: 'subscriptions',
    q: 'Can I Edit A Subscription?',
    a: 'Yes. Open Account → Subscriptions And Tap Edit. You Can Adjust The Interval, Skip A Cycle, Change The Quantity, Or Pause Indefinitely.',
  },
  {
    id: 'subscription-charged-when',
    category: 'subscriptions',
    q: 'When Am I Charged For Subscriptions?',
    a: 'A Subscription Cycle Creates A Pending Order Just Like A Manual Order. You Pay Your Agent Via Your Default Payment Method When The Order Is Created. We Never Auto-Charge A Card Because We Do Not Process Cards.',
  },

  // ─────────────────────────────────────────────────────────────
  // REFERRALS
  // ─────────────────────────────────────────────────────────────
  {
    id: 'how-do-referrals-work',
    category: 'referrals',
    q: 'How Do Referrals Work?',
    a: 'Share Your Personal Referral Code Or Link. When Someone Signs Up With Your Code And Their First Order Is Delivered, Store Credit Lands In Your Wallet.',
    links: [{ label: 'My Referrals', href: '/account/referrals' }],
  },
  {
    id: 'how-much-credit-per-referral',
    category: 'referrals',
    q: 'How Much Credit Do I Earn Per Referral?',
    a: 'The Current Bonus Per Qualifying Referral Is Displayed On The Referrals Page. The Platform May Adjust This From Time To Time, So Always Check The Live Value Before Quoting It.',
  },
  {
    id: 'when-does-referral-credit-show',
    category: 'referrals',
    q: 'When Does Referral Credit Show Up In My Wallet?',
    a: "Credit Posts When The Referee's First Order Is Delivered (Tracking Confirms Delivery) Or, For Pickup Orders, When The Agent Marks Delivered. Pending Credits Are Listed Separately Until They Post.",
  },
  {
    id: 'where-is-my-referral-code',
    category: 'referrals',
    q: 'Where Do I Find My Referral Code?',
    a: 'Account → Referrals. Your Code, Your Personal Link, And A Share Button Are All On That Page.',
    links: [{ label: 'My Referrals', href: '/account/referrals' }],
  },

  // ─────────────────────────────────────────────────────────────
  // PRICING & STOREFRONTS
  // ─────────────────────────────────────────────────────────────
  {
    id: 'why-prices-differ-by-agent',
    category: 'pricing',
    q: 'Why Are Prices Different Between Agents?',
    a: 'Each Agent Sets Their Own Retail Markup Over The Platform Base Cost. Different Agents Means Different Markups, Different Sales, And Different Bundles. Compare Storefronts If You Want To.',
  },
  {
    id: 'bulk-discount',
    category: 'pricing',
    q: 'Is There A Bulk Discount?',
    a: 'Most Products Have A Bulk Discount Tier That Activates At A Quantity Threshold (Often 10+ Units). The Discounted Price Is Shown On The Product Card When You Cross The Threshold.',
  },
  {
    id: 'what-is-sale-badge',
    category: 'pricing',
    q: 'What Does The Sale Badge Mean?',
    a: 'Your Agent Has Discounted That Product. The Sale Price Is What You Pay At Checkout; The Original Price Is Shown Crossed Out For Reference.',
  },
  {
    id: 'bundle-pricing',
    category: 'pricing',
    q: "What's A Bundle?",
    a: "A Pre-Configured Combination Of Products Offered At A Discount. Bundles Appear In Your Agent's Storefront With Their Own Card. Add A Bundle To Cart In One Tap.",
  },
  {
    id: 'how-do-i-find-products-fast',
    category: 'pricing',
    q: 'How Do I Find A Specific Product Fast?',
    a: "Use The Search Bar At The Top Of Your Agent's Storefront, Or Browse By Category. Faceted Filters Let You Narrow By Compound Class, Concentration, And Price.",
  },

  // ─────────────────────────────────────────────────────────────
  // ACCOUNT & SECURITY
  // ─────────────────────────────────────────────────────────────
  {
    id: 'update-shipping-or-payment-method',
    category: 'account',
    q: 'How Do I Update My Shipping Address Or Payment Method?',
    a: 'Account → Saved Addresses For Shipping And Account → Payment Method For Payments. Changes Apply To Your Next Checkout; Already-Placed Orders Keep The Address And Method They Were Placed With.',
    links: [
      { label: 'Saved Addresses', href: '/account/addresses' },
      { label: 'Payment Method', href: '/account/payment-method' },
    ],
  },
  {
    id: 'enable-2fa',
    category: 'account',
    q: 'How Do I Enable Two-Factor Authentication?',
    a: 'Account → Security → Enable Two-Factor. Scan The QR Code With Any Authenticator App (Google Authenticator, Authy, 1Password) And Enter The 6-Digit Code To Confirm. Save Your Backup Codes Somewhere Safe.',
    links: [{ label: 'Security Settings', href: '/account?tab=security' }],
  },
  {
    id: 'why-2fa-required-for-agents',
    category: 'account',
    q: 'Why Is Two-Factor Required For Agents?',
    a: 'Agent Accounts Hold Customer Data And Financial Records. Two-Factor Is Mandatory For Agent And Super Agent Roles To Protect That Data. Researcher Accounts Can Use It Optionally.',
  },
  {
    id: 'delete-account',
    category: 'account',
    q: 'Can I Delete My Account?',
    a: 'Account → Danger Zone → Deactivate Account. Your Profile Is Closed And You Are Signed Out. Order History And Compliance Logs Are Retained Because They Are Required For Audit. Contact Support For A Full Erasure Request.',
  },
  {
    id: 'change-username',
    category: 'account',
    q: 'How Do I Change My Username?',
    a: 'Account → Profile → Username. You Can Change Your Username Once Every 30 Days. The Old Username Is Released And Available For Other Users After A Short Cooldown.',
  },
  {
    id: 'compromised-password',
    category: 'account',
    q: 'What Happens If My Password Is Compromised?',
    a: 'We Check Every New Password Against Known Breach Lists. If Your Password Has Been Seen In A Breach, You Are Forced To Change It On Next Login. We Recommend A Password Manager And Two-Factor For Every Account.',
  },

  // ─────────────────────────────────────────────────────────────
  // NOTIFICATIONS & MESSAGING
  // ─────────────────────────────────────────────────────────────
  {
    id: 'how-do-i-get-order-updates',
    category: 'notifications',
    q: 'How Do I Get Order Updates?',
    a: 'Push Notifications And The Bell In The Top Nav. Critical Events (Order Approved, Shipped, Delivered, Issue) Push Automatically If Push Is Enabled On Your Device.',
  },
  {
    id: 'turn-off-notification-type',
    category: 'notifications',
    q: 'How Do I Turn Off A Notification Type?',
    a: 'Account → Notifications. Each Type Has Its Own Toggle: Order Placed, Order Approved, Order Shipped, Order Delivered, New Message, Cart Reminder, Payment Reminder, Referrals, Low Stock, And System. Turning A Type Off Stops Push And The Bell Badge For That Type.',
    links: [{ label: 'Notification Settings', href: '/account?tab=notifications' }],
  },
  {
    id: 'no-email-notifications',
    category: 'notifications',
    q: 'Do You Send Email Notifications?',
    a: 'No. Email Notifications Are Currently Disabled Platform-Wide. All Updates Come Through Push And The Bell. SMS Is Also Not Used. Keep Push Enabled So You Do Not Miss Critical Updates.',
  },
  {
    id: 'message-my-agent',
    category: 'notifications',
    q: 'How Do I Message My Agent?',
    a: 'Open Messenger From The Top Nav Or The Dashboard. Your Agent Appears In Your Conversation List Automatically Once You Have An Order. Tap The Conversation To Start Chatting.',
    links: [{ label: 'Open Messenger', href: '/messenger' }],
  },
  {
    id: 'contact-support',
    category: 'notifications',
    q: 'How Do I Contact Support?',
    a: 'Tap Start A Support Chat At The Top Of This Page Or Use The Customer Support Widget Anywhere On The Site. We Reply In Your Messenger Inbox.',
    links: [{ label: 'Open Messenger', href: '/messenger' }],
  },

  // ─────────────────────────────────────────────────────────────
  // PRIVACY & DATA
  // ─────────────────────────────────────────────────────────────
  {
    id: 'what-data-do-you-collect',
    category: 'privacy',
    q: 'What Data Do You Collect?',
    a: 'Your Profile (Name, Username, Email, Phone), Your Orders, Saved Addresses, Payment Handles You Choose To Store, Disclaimer Acknowledgements, And Messages With Your Agent And Support. We Do Not Store Card Numbers Because We Do Not Process Cards.',
  },
  {
    id: 'export-my-data',
    category: 'privacy',
    q: 'Can I Export My Data?',
    a: 'Yes. Account → Privacy → Export Data. We Email You A ZIP With Your Profile, Orders, Addresses, And Disclaimer History In Machine-Readable Format.',
  },
  {
    id: 'who-sees-my-orders',
    category: 'privacy',
    q: 'Who Can See My Order History?',
    a: 'You, Your Agent (If You Bought From One), And Platform Admin For Support And Compliance. No One Else. Other Researchers Cannot See You Exist Or Discover Your Orders.',
  },
  {
    id: 'how-is-my-data-protected',
    category: 'privacy',
    q: 'How Is My Data Protected?',
    a: "All Traffic Is HTTPS With HSTS. Row-Level Security On The Database Prevents Anyone From Reading Anyone Else's Data. Sensitive Fields Are Encrypted At Rest. Sessions Are Bound To Browser Fingerprints And Expire Automatically.",
  },

  // ─────────────────────────────────────────────────────────────
  // MOBILE APP
  // ─────────────────────────────────────────────────────────────
  {
    id: 'install-as-app',
    category: 'mobile',
    q: 'Can I Install PepNationLab As An App?',
    a: 'Yes. We Are A Progressive Web App. On iOS Safari Tap The Share Button And Add To Home Screen. On Android Chrome Tap The Menu And Install App. The Installed Version Runs Full-Screen Like A Native App.',
  },
  {
    id: 'push-on-mobile',
    category: 'mobile',
    q: 'Do Push Notifications Work On Mobile?',
    a: 'Yes On Android Chrome And iOS 16.4 Or Newer (Requires The App To Be Installed To The Home Screen On iOS). Enable Under Account → Notifications. We Send Critical Order Events And New Messages Automatically.',
  },
  {
    id: 'offline-mode',
    category: 'mobile',
    q: 'Does The App Work Offline?',
    a: 'Cached Pages Load Without A Network But You Cannot Place Orders Or Send Payments Without A Connection. Once You Come Back Online The App Syncs Automatically.',
  },

  // ─────────────────────────────────────────────────────────────
  // FOR AGENTS
  // ─────────────────────────────────────────────────────────────
  {
    id: 'agent-roles',
    category: 'agents',
    audience: 'agent',
    q: "What's The Difference Between Agent, Super Agent, And Sub-Agent?",
    a: 'Agent: Runs Their Own Storefront, Settles With Admin Directly. Super Agent: An Agent Who Also Manages Sub-Agents And Earns Override Commission On Their Sales. Sub-Agent: Sells Under A Super Agent, Cannot Run Their Own Storefront, Earns A Set Commission Per Sale.',
  },
  {
    id: 'agent-tier-pricing',
    category: 'agents',
    audience: 'agent',
    q: "What's My Tier And How Does It Affect Pricing?",
    a: 'Admin Assigns Each Agent A Tier: Tier 1 (5x Multiplier Off Base Cost — Best), Tier 2 (6x), Tier 3 (7x — Entry). Multipliers Are Configurable Per Product And Per Agent. Check Your Tier Under Agent Dashboard → Account.',
  },
  {
    id: 'agent-storefront-setup',
    category: 'agents',
    audience: 'agent',
    q: 'How Do I Set Up My Storefront?',
    a: 'Agent Dashboard → Storefront Setup. Configure Slug, Display Name, Bio, Logo, Warehouse Address, And Payment Handles. Activate The Storefront To Make It Public At Pepnationlab.com/Your-Slug.',
    links: [{ label: 'Agent Help (Full Guide)', href: '/dashboard/agent/help' }],
  },
  {
    id: 'agent-add-subagent',
    category: 'agents',
    audience: 'agent',
    q: 'How Do I Add A Sub-Agent?',
    a: 'Super Agent Dashboard → Sub-Agents → Promote/Create. You Can Promote An Existing User Or Create A New Account. Sub-Agents Inherit Your Storefront And Earn A Set Commission Per Sale.',
  },
  {
    id: 'agent-weekly-statements',
    category: 'agents',
    audience: 'agent',
    q: 'How Do Weekly Statements Work?',
    a: "Every Sunday At 23:59 UTC The Invoice Cron Runs And Bundles The Week's Orders Into Your COGS + Shipping Total. Credit-Billed Agents Settle Weekly. Prepaid Agents Are Debited At Order Approval Instead Of Weekly.",
  },
  {
    id: 'agent-pay-statement',
    category: 'agents',
    audience: 'agent',
    q: 'How Do I Pay My Weekly Statement?',
    a: 'Open Wallet → Pay Statement. Tap Pay, Send The Funds Via Your Chosen Method (Same Methods Buyers Use), And Admin Marks Paid Once Funds Land. Auto-Pay From Prepaid Balance Is Also Available For Credit Accounts.',
  },
  {
    id: 'agent-commissions',
    category: 'agents',
    audience: 'agent',
    q: 'What Is My Commission?',
    a: 'Your Retail Price Minus Your Tier Cost Per Unit Sold. For Super Agents, You Also Get An Override On Sales By Your Sub-Agents. Commissions Are Tracked Per Order And Aggregated On The Sales Dashboard.',
  },
  {
    id: 'agent-restock',
    category: 'agents',
    audience: 'agent',
    q: 'How Do I Restock Inventory?',
    a: 'Agent Dashboard → Inventory → Restock. Pick The Product, Quantity, And Submit. Admin Approves And Stock Posts To Your Storefront. You Can Set Per-Product Low-Stock Thresholds So You Are Notified Before You Run Out.',
  },
  {
    id: 'agent-low-stock-alert',
    category: 'agents',
    audience: 'agent',
    q: "What's The Low-Stock Notification?",
    a: 'A Daily Cron At 09:00 UTC Scans Your Inventory And Drops A Low Stock Notification In Your Bell For Any Product At Or Below Its Threshold (Default 5 Units). Configure The Threshold Per Product On The Inventory Page.',
  },
  {
    id: 'agent-coupons',
    category: 'agents',
    audience: 'agent',
    q: 'How Do Coupons Work?',
    a: "Agent Dashboard → Coupons → New. Pick A Code, A Discount Type (Percent Or Fixed), And Optional Limits (Expiry, Max Uses, Minimum Subtotal). Coupons Are Scoped To Your Storefront Only — Other Agents' Buyers Cannot Use Your Codes.",
  },
  {
    id: 'agent-messenger',
    category: 'agents',
    audience: 'agent',
    q: 'How Do I Reach Researchers And Admin?',
    a: 'Messenger Is Your Direct Channel To Buyers, Sub-Agents, And Platform Admin. Calls, Voice Messages, And File Shares Are All Supported. Your Customer Inbox Surfaces Conversations Across Your Downline.',
    links: [{ label: 'Open Messenger', href: '/messenger' }],
  },
];

/**
 * Filter the catalog for a given viewer role. Admins and agents see
 * everything; researchers see only audience='all' items.
 */
export function visibleFaq(role: string | null | undefined): FaqItem[] {
  const isAgentTier =
    role === 'agent' || role === 'super_agent' || role === 'admin';
  return FAQ_ITEMS.filter((item) =>
    item.audience === 'agent' ? isAgentTier : true,
  );
}

/**
 * Filter the categories for a given viewer role. Same rule as items.
 */
export function visibleCategories(role: string | null | undefined): FaqCategory[] {
  const isAgentTier =
    role === 'agent' || role === 'super_agent' || role === 'admin';
  return FAQ_CATEGORIES.filter((cat) =>
    cat.audience === 'agent' ? isAgentTier : true,
  );
}

/**
 * Lightweight search over question + answer text. Case-insensitive,
 * whole-token contains match. Returns matching item IDs.
 */
export function searchFaq(query: string, items: FaqItem[]): Set<string> {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return new Set(items.map((it) => it.id));
  const tokens = q.split(/\s+/).filter(Boolean);
  const hits = new Set<string>();
  for (const it of items) {
    const hay = (it.q + ' ' + it.a).toLowerCase();
    if (tokens.every((t) => hay.includes(t))) {
      hits.add(it.id);
    }
  }
  return hits;
}
