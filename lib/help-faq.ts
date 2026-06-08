/**
 * R27 - Canonical FAQ catalog for /account/help.
 *
 * Single source of truth so the same content can power: the Help & Support
 * page accordion, future search indexing, agent-side help, and any embed
 * widget (e.g., context-aware help on the order detail page).
 *
 * Style rules (platform-wide):
 *   - All `q` and `a` text is Title Case (every word capitalised) per the
 *     PepNationLab UI standard. CSS `text-transform: capitalize` is a
 *     fallback, not a substitute - the source must be Title Case too.
 *   - Zero emojis anywhere.
 *   - R29: zero em-dashes (U+2014) anywhere. A vitest guardrail enforces this.
 *   - `audience` defaults to 'all'. Items with audience 'agent' are only
 *     shown when the viewer's role is 'agent' / 'super_agent' / 'admin'.
 *   - `id` is kebab-case; the client builds anchors as `#faq-<id>` so a
 *     support reply can deep-link to a specific answer.
 *   - `links` is an optional array of in-app destinations rendered as a
 *     small button row beneath the answer.
 */

export type FaqAudience = 'all' | 'agent' | 'admin';

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
  | 'messenger'
  | 'subscriptions'
  | 'referrals'
  | 'pricing'
  | 'privacy'
  | 'mobile'
  | 'agents'
  | 'support'
  | 'admin';

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
  { id: 'messenger',       label: 'Messenger Features',        audience: 'all' },
  { id: 'privacy',         label: 'Privacy & Data',            audience: 'all' },
  { id: 'mobile',          label: 'Mobile App',                audience: 'all' },
  { id: 'agents',          label: 'For Agents',                audience: 'agent' },
  { id: 'support',         label: 'Customer Support',          audience: 'all'   },
  { id: 'admin',           label: 'Admin Tools',               audience: 'admin' },
];

/**
 * The full catalog. Add new items here only - keep the file the
 * single source of truth.
 */
export const FAQ_ITEMS: FaqItem[] = [
  // GETTING STARTED
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
    q: 'I Forgot My Password. How Do I Reset It?',
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
  {
    id: 'signup-availability-check',
    category: 'getting-started',
    q: 'How Does The Username Availability Check Work When I Sign Up?',
    a: 'As You Type, We Live-Check The Username (And Slug For Agents) Against The Database. A Green Checkmark Means Available, A Red Cross Means Taken. The Check Is Debounced So It Does Not Fire On Every Keystroke.',
  },

  // PAYMENTS
  {
    id: 'how-do-i-pay-for-an-order',
    category: 'payments',
    q: 'How Do I Pay For An Order?',
    a: "Orders Are Paid Peer-To-Peer Via Zelle, Venmo, Cash App, Apple Pay, Apple Cash, PayPal, Google Wallet, Wise, Or Chime. The Available Methods On Each Order Depend On Which Handles Your Agent Has Enabled. Payment Instructions And Your Agent's Handle Are Shown On The Order Detail Page After Checkout.",
  },
  { id: 'why-no-credit-cards', category: 'payments', q: 'Why No Credit Cards?', a: 'PepNationLab Is A Research-Only Marketplace. We Keep Settlement Peer-To-Peer Through Payment Apps That Are Appropriate For This Use Case. We Do Not Store Or Process Card Numbers At Any Point.' },
  { id: 'when-do-i-pay', category: 'payments', q: 'When Do I Pay, Before Or After Agent Approval?', a: 'You Pay Right After Placing The Order. Your Order Sits In Pending Customer Payment Until Your Agent Confirms Funds Landed, At Which Point It Moves Into Approval And Fulfillment.' },
  { id: 'upload-payment-proof', category: 'payments', q: 'How Do I Upload Proof Of Payment?', a: 'Open The Order Detail Page. Under Payment Proof, Tap Upload And Attach A Screenshot Or Receipt (PNG, JPG, Or PDF). Your Agent Is Notified Automatically And Can Approve The Order As Soon As They See It.', links: [{ label: 'My Orders', href: '/orders' }] },
  { id: 'change-payment-method', category: 'payments', q: 'Can I Change My Payment Method After Placing An Order?', a: 'Yes, As Long As The Order Is Still In Pending Customer Payment. Open The Order, Tap Change Payment Method, And Pick A Different Method Your Agent Accepts. Once Your Agent Approves The Order, The Method Is Locked.' },
  { id: 'agent-payment-handle', category: 'payments', q: "What Is My Agent's Payment Handle?", a: 'The Specific Phone Number, Email, Or Username To Send Funds To On Each Payment App. It Is Displayed On The Order Detail Page In The Payment Instructions Card, Along With The Exact Amount Due.' },
  { id: 'default-payment-method', category: 'payments', q: 'How Do I Set A Default Payment Method?', a: 'Account, Then Payment Method. Pick The Method You Use Most Often. New Orders Pre-Select This Method At Checkout, But You Can Still Change It Per Order Until Approval.', links: [{ label: 'Payment Method', href: '/account/payment-method' }] },
  { id: 'order-marked-paid-but-still-pending', category: 'payments', q: 'I Sent Payment But My Order Is Still Pending. What Now?', a: 'Your Agent Has Not Confirmed Receipt Yet. Upload Your Payment Proof If You Have Not Already, Then Message Your Agent. If There Is No Response Within 24 Hours, Contact Support And We Will Reach Out On Your Behalf.' },

  // ORDERS & FULFILLMENT
  { id: 'when-will-my-order-ship', category: 'orders', q: 'When Will My Order Ship?', a: 'Once Your Agent Confirms Payment, Your Order Moves Into Approval And Then Into Fulfillment. Most Orders Ship Within 1 To 3 Business Days Of Approval. You Can Track The Status Any Time From My Orders.', links: [{ label: 'My Orders', href: '/orders' }] },
  { id: 'order-statuses-explained', category: 'orders', q: 'What Do The Different Order Statuses Mean?', a: 'Pending Customer Payment: Order Placed, Waiting On Your Payment. Agent Approval Pending: Payment Received, Awaiting Agent Confirmation. Approved For Shipping Or Approved For Pickup: Confirmed And Queued For Fulfillment. In Fulfillment: Being Packed. Shipped: Label Scanned By Carrier. Delivered: Confirmed Delivered. Cancelled: Voided By You, Your Agent, Or An Auto-Cancel Rule.' },
  { id: 'ship-vs-pickup', category: 'orders', q: "What's The Difference Between Approval For Shipping And Approval For Pickup?", a: 'Approval For Shipping Means Your Order Will Be Mailed To Your Saved Address Via The Carrier. Approval For Pickup Means You Are Collecting From Your Agent Directly (Local Only). The Fulfillment Method Is Chosen At Checkout.' },
  { id: 'order-stuck-in-approval', category: 'orders', q: 'My Order Is Stuck In Agent Approval Pending. What Do I Do?', a: 'Most Often This Is The Agent Waiting On Payment Confirmation To Land. Make Sure You Uploaded Your Payment Proof, Then Message Your Agent From Messenger. If There Is No Response In 24 Hours, Open A Support Chat And We Will Step In.', links: [{ label: 'Open Messenger', href: '/messenger' }] },
  { id: 'cancel-an-order', category: 'orders', q: 'How Do I Cancel An Order?', a: 'You Can Cancel Any Order That Is Still In Pending Customer Payment Or Agent Approval Pending Directly From The Order Detail Page. Once Approved For Shipping Or Pickup, Cancellation Has To Go Through Your Agent Or Support.' },
  { id: 'cancelled-why', category: 'orders', q: 'My Order Was Marked Cancelled. Why?', a: 'Common Reasons: Unpaid For More Than 72 Hours (Auto-Cancelled By The System), Agent Declined The Order, Payment Was Disputed, Or A Product On The Order Became Unavailable. Open The Order To See The Reason Logged.' },
  { id: 'order-wrong-or-missing', category: 'orders', q: 'My Order Arrived Wrong Or Missing An Item. What Now?', a: 'Open The Order Detail Page And Tap Report Issue, Or Start A Support Chat. Include Photos Of What You Received And The Packing Slip. We Resolve Wrong-Item And Short-Ship Cases With A Replacement Or Store Credit.' },
  { id: 'where-do-i-find-receipt', category: 'orders', q: 'Where Do I Find My Receipt?', a: 'Every Order Has A Download Receipt Button On The Order Detail Page. The PDF Includes Order Number, Buyer And Seller Info, Line Items, Payment Method, And Shipping Address.' },

  // SHIPPING & TRACKING
  { id: 'where-is-my-tracking-number', category: 'shipping', q: 'Where Do I Find My Tracking Number?', a: "On The Order Detail Page Under Tracking, As Soon As Your Agent Generates The Label. The Tracking Number Links To The Carrier's Tracking Page Directly." },
  { id: 'what-carriers', category: 'shipping', q: 'What Carriers Do You Use?', a: 'USPS, UPS, And FedEx, Selected By The Best Available Rate For The Weight And Destination Through Shippo. Your Agent Sees The Carrier Options And Picks At Label Generation.' },
  { id: 'how-shipping-calculated', category: 'shipping', q: 'How Is Shipping Calculated?', a: 'Each Agent Has Weight-Tier Pricing Configured On Their Storefront. The Final Shipping Cost Is Shown At Checkout Before You Confirm The Order.' },
  { id: 'tracking-says-delivered-no-package', category: 'shipping', q: "Tracking Says Delivered But I Don't Have It. What Do I Do?", a: 'First, Check Anywhere The Carrier May Have Left It (Porch, Mailbox, Side Door) And Ask Neighbors. If 48 Hours Pass With No Package, Open A Support Chat With Your Order Number And We Will Help File A Claim.' },
  { id: 'po-box', category: 'shipping', q: 'Can I Ship To A P.O. Box?', a: 'USPS Service Levels Can Deliver To P.O. Boxes. UPS And FedEx Require A Street Address. If Your Agent Only Offers UPS Or FedEx, You Will Need A Street Address.' },
  { id: 'international-shipping', category: 'shipping', q: 'Do You Ship Internationally?', a: "Depends On Your Agent. Many Agents Are Domestic US Only. Check Your Storefront Or Message Your Agent Before Placing An International Order. Customs Fees Are The Buyer's Responsibility When International Shipping Is Available." },
  { id: 'shipping-cold-chain', category: 'shipping', q: 'How Are Temperature-Sensitive Products Shipped?', a: 'Lyophilized Vials Ship Stable At Room Temperature For Short Transit Times And Do Not Require Cold-Chain Shipping. If You Need Expedited Delivery To Limit Exposure, Pick The Fastest Service At Checkout.' },

  // COMPOUNDS, LOT & COA
  { id: 'what-is-lot-number', category: 'compounds', q: 'What Is A Lot Number?', a: 'A Unique Batch Identifier From The Manufacturer. Every Line Item On Your Order Detail Page Displays Its Lot Number Once The Item Is Picked And Packed.' },
  { id: 'what-is-coa', category: 'compounds', q: 'What Is A Certificate Of Analysis (COA)?', a: 'A Third-Party Lab Report Documenting Purity And Identity Of The Specific Lot You Received. When A COA Is Available, A View COA Link Appears Next To That Line Item.' },
  { id: 'lot-coa-pending', category: 'compounds', q: 'My Order Says "Lot Pending" Or "COA Pending". When Will It Show?', a: 'Lot Numbers And COA Links Are Stamped At Fulfillment Time. If Your Order Is Still In Approval Or In Fulfillment, Both Will Populate Before The Package Ships. You Will Always Have The Final Values By The Time You Receive Your Shipment.' },
  { id: 'storage-and-handling', category: 'compounds', q: 'How Should I Store Research Compounds?', a: "Most Peptides Are Stable At Room Temperature For Short Durations And Should Be Stored At -20 C For Long-Term Storage Or 2 To 8 C For Short-Term After Reconstitution. Always Reference The Specific Compound's Documentation. We Cannot Provide Compound-Specific Guidance Beyond General Handling Notes." },
  { id: 'reconstitution-supplies', category: 'compounds', q: 'Do You Sell Bacteriostatic Water And Syringes?', a: "Yes. Most Storefronts Carry Bacteriostatic Water, Syringes, And Other Reconstitution Supplies As Add-Ons On The Catalog. Check Your Agent's Storefront Or Search Their Catalog." },
  { id: 'disposal', category: 'compounds', q: 'How Do I Dispose Of Unused Research Materials?', a: 'Follow Your Local Laboratory Waste Disposal Regulations. Used Syringes And Sharps Must Go Into A Rigid Sharps Container. Do Not Place Unused Compounds Or Sharps In Household Trash Or Recycling.' },
  { id: 'banned-products', category: 'compounds', q: 'A Product I Used To Buy Is No Longer Listed. Why?', a: 'Either Your Agent Has Removed It From Their Catalog, Or The Product Was Banned Platform-Wide For Compliance. Banned Products Cannot Be Added To Any Cart Or Checkout. Browse Alternatives In The Same Category.' },
  { id: 'compound-detail-page', category: 'compounds', q: 'Can I Read More About A Specific Compound?', a: 'Yes. Every Product Links To A Compound Detail Page (Peptide Expert) With Identity, Mechanism, Studied-For Use Cases, Evidence Tier, Side Effects, Warnings, And Storage Guidance. The Profile Is Research-Only And Sourced From The Compounds Knowledge Base.' },

  // WALLET & STORE CREDIT
  { id: 'what-is-store-credit', category: 'wallet', q: 'What Is Store Credit?', a: 'Balance Held In Your Lab Wallet That Can Be Applied At Checkout. Earned From Referrals, Returns, And Admin Adjustments. Spends The Same As Cash But Cannot Be Withdrawn.', links: [{ label: 'Open Wallet', href: '/wallet' }] },
  { id: 'wallet-balance', category: 'wallet', q: 'Where Do I See My Wallet Balance?', a: 'Lab Wallet From The Main Navigation, Or The Wallet Card On Your Dashboard. Shows Your Current Balance, Recent Transactions, And Any Pending Credits.', links: [{ label: 'Open Wallet', href: '/wallet' }] },
  { id: 'use-store-credit-at-checkout', category: 'wallet', q: 'How Do I Use Store Credit At Checkout?', a: 'If You Have A Balance, A Use Store Credit Toggle Appears In The Checkout Summary. Turn It On To Apply The Full Available Credit Or Pick A Custom Amount.' },
  { id: 'send-store-credit', category: 'wallet', q: 'Can I Send Store Credit To Another User?', a: "Yes. From The Wallet Page, Tap Send Funds, Enter The Recipient's Username Or Email, And Confirm. Transfers Are Instant And Logged In Both Wallets.", links: [{ label: 'Send Funds', href: '/wallet' }] },
  { id: 'prepaid-vs-store-credit', category: 'wallet', q: "What's The Difference Between Prepaid Balance And Store Credit?", a: 'Both Live In Your Lab Wallet. Prepaid Balance Is Funds You Deposited Up Front. Store Credit Is Earned Through Referrals, Returns, Or Adjustments. Both Spend Identically At Checkout.' },
  { id: 'wallet-history', category: 'wallet', q: 'How Do I See My Wallet History?', a: 'Open The Wallet Page. The Transactions List Shows Every Credit, Debit, Transfer In, Transfer Out, And Refund With Timestamp And Reference.' },

  // RETURNS & REFUNDS
  { id: 'how-do-i-return', category: 'returns', q: 'How Do I Request A Return?', a: 'Open The Order Detail Page Within 7 Days Of Delivery And Tap Request Return. Pick A Reason, Attach Photos, And Submit. You Will Receive An RMA Number And Return Instructions.' },
  { id: 'damaged-shipment', category: 'returns', q: 'My Product Arrived Damaged. What Do I Do?', a: 'Open A Return Within 7 Days, Reason: Damaged. Attach Photos Of The Damage And The Outer Packaging. We Either Replace The Item Or Refund To Wallet At Your Choice.' },
  { id: 'refund-vs-credit', category: 'returns', q: 'Do I Get A Cash Refund Or Store Credit?', a: "Damaged Or Wrong-Item Returns Get Your Choice Of A Refund Back To Your Payment Method Or A Credit To Your Wallet. Buyer's-Remorse Returns Are Store Credit Only." },
  { id: 'restocking-fee', category: 'returns', q: 'Is There A Restocking Fee?', a: 'Defect Returns Have No Fee. Non-Defect Returns Of Opened Packages May Carry A Restocking Fee, Shown On The RMA Quote Before You Confirm.' },
  { id: 'return-window', category: 'returns', q: "What's The Return Window?", a: 'Seven Days From The Delivery Date Tracked By The Carrier. After 7 Days Returns Are Not Accepted Except For Documented Defects Discovered Later.' },

  // SUBSCRIPTIONS
  { id: 'what-is-auto-replenish', category: 'subscriptions', q: 'What Is Auto-Replenish?', a: 'An Automatic Reorder Of A Past Order On A Schedule You Set (Weekly, Monthly, Or Custom Interval). Each Cycle Creates A New Pending Order You Can Edit Or Pay Like Any Other.' },
  { id: 'set-up-auto-replenish', category: 'subscriptions', q: 'How Do I Set Up Auto-Replenish?', a: 'Open The Order Detail Page You Want To Repeat And Tap Subscribe & Replenish. Pick The Interval And Save. The Next Cycle Lands Automatically On Schedule.' },
  { id: 'cancel-subscription', category: 'subscriptions', q: 'How Do I Cancel A Subscription?', a: 'Account, Then Subscriptions. Pick The Subscription And Tap Cancel. No Further Orders Will Be Created. Already-Created Orders Are Not Affected.' },
  { id: 'edit-subscription', category: 'subscriptions', q: 'Can I Edit A Subscription?', a: 'Yes. Open Account, Then Subscriptions And Tap Edit. You Can Adjust The Interval, Skip A Cycle, Change The Quantity, Or Pause Indefinitely.' },
  { id: 'subscription-charged-when', category: 'subscriptions', q: 'When Am I Charged For Subscriptions?', a: 'A Subscription Cycle Creates A Pending Order Just Like A Manual Order. You Pay Your Agent Via Your Default Payment Method When The Order Is Created. We Never Auto-Charge A Card Because We Do Not Process Cards.' },

  // REFERRALS
  { id: 'how-do-referrals-work', category: 'referrals', q: 'How Do Referrals Work?', a: 'Share Your Personal Referral Code Or Link. When Someone Signs Up With Your Code And Their First Order Is Delivered, Store Credit Lands In Your Wallet.', links: [{ label: 'My Referrals', href: '/account/referrals' }] },
  { id: 'how-much-credit-per-referral', category: 'referrals', q: 'How Much Credit Do I Earn Per Referral?', a: 'The Current Bonus Per Qualifying Referral Is Displayed On The Referrals Page. The Platform May Adjust This From Time To Time, So Always Check The Live Value Before Quoting It.' },
  { id: 'when-does-referral-credit-show', category: 'referrals', q: 'When Does Referral Credit Show Up In My Wallet?', a: "Credit Posts When The Referee's First Order Is Delivered (Tracking Confirms Delivery) Or, For Pickup Orders, When The Agent Marks Delivered. Pending Credits Are Listed Separately Until They Post." },
  { id: 'where-is-my-referral-code', category: 'referrals', q: 'Where Do I Find My Referral Code?', a: 'Account, Then Referrals. Your Code, Your Personal Link, And A Share Button Are All On That Page.', links: [{ label: 'My Referrals', href: '/account/referrals' }] },

  // PRICING & STOREFRONTS
  { id: 'why-prices-differ-by-agent', category: 'pricing', q: 'Why Are Prices Different Between Agents?', a: 'Each Agent Sets Their Own Retail Markup Over The Platform Base Cost. Different Agents Means Different Markups, Different Sales, And Different Bundles. Compare Storefronts If You Want To.' },
  { id: 'bulk-discount', category: 'pricing', q: 'Is There A Bulk Discount?', a: 'Most Products Have A Bulk Discount Tier That Activates At A Quantity Threshold (Often 10+ Units). The Discounted Price Is Shown On The Product Card When You Cross The Threshold.' },
  { id: 'what-is-sale-badge', category: 'pricing', q: 'What Does The Sale Badge Mean?', a: 'Your Agent Has Discounted That Product. The Sale Price Is What You Pay At Checkout; The Original Price Is Shown Crossed Out For Reference.' },
  { id: 'bundle-pricing', category: 'pricing', q: "What's A Bundle?", a: "A Pre-Configured Combination Of Products Offered At A Discount. Bundles Appear In Your Agent's Storefront With Their Own Card. Add A Bundle To Cart In One Tap." },
  { id: 'how-do-i-find-products-fast', category: 'pricing', q: 'How Do I Find A Specific Product Fast?', a: "Use The Search Bar At The Top Of Your Agent's Storefront, Or Browse By Category. Faceted Filters Let You Narrow By Compound Class, Concentration, And Price." },

  // ACCOUNT & SECURITY
  { id: 'update-shipping-or-payment-method', category: 'account', q: 'How Do I Update My Shipping Address Or Payment Method?', a: 'Account, Then Saved Addresses For Shipping And Account, Then Payment Method For Payments. Changes Apply To Your Next Checkout; Already-Placed Orders Keep The Address And Method They Were Placed With.', links: [{ label: 'Saved Addresses', href: '/account/addresses' }, { label: 'Payment Method', href: '/account/payment-method' }] },
  { id: 'enable-2fa', category: 'account', q: 'How Do I Enable Two-Factor Authentication?', a: 'Account, Then Security, Then Enable Two-Factor. Scan The QR Code With Any Authenticator App (Google Authenticator, Authy, 1Password) And Enter The 6-Digit Code To Confirm. Save Your Backup Codes Somewhere Safe.', links: [{ label: 'Security Settings', href: '/account?tab=security' }] },
  { id: 'why-2fa-required-for-agents', category: 'account', q: 'Why Is Two-Factor Required For Agents?', a: 'Agent Accounts Hold Customer Data And Financial Records. Two-Factor Is Mandatory For Agent And Super Agent Roles To Protect That Data. Researcher Accounts Can Use It Optionally.' },
  { id: 'delete-account', category: 'account', q: 'Can I Delete My Account?', a: 'Account, Then Danger Zone, Then Deactivate Account. Your Profile Is Closed And You Are Signed Out. Order History And Compliance Logs Are Retained Because They Are Required For Audit. Contact Support For A Full Erasure Request.' },
  { id: 'change-username', category: 'account', q: 'How Do I Change My Username?', a: 'Account, Then Profile, Then Username. You Can Change Your Username Once Every 30 Days. The Old Username Is Released And Available For Other Users After A Short Cooldown.' },
  { id: 'compromised-password', category: 'account', q: 'What Happens If My Password Is Compromised?', a: 'We Check Every New Password Against Known Breach Lists. If Your Password Has Been Seen In A Breach, You Are Forced To Change It On Next Login. We Recommend A Password Manager And Two-Factor For Every Account.' },
  { id: 'lab-journal-saved', category: 'account', q: 'How Do I Use The Lab Journal?', a: 'Tap The Heart On Any Product Card To Save It. The Lab Journal Lists Everything You Saved, Previously Ordered, Or Recently Viewed. Use It To Plan Future Orders Without Cluttering Your Cart.', links: [{ label: 'Lab Journal', href: '/lab-journal' }] },
  { id: 'recently-viewed', category: 'account', q: 'Where Do I See Products I Have Viewed Recently?', a: 'Your Lab Journal. We Keep The Last 50 Products You Looked At So You Can Pick Up Where You Left Off Without Re-Searching. The List Is Private To You.', links: [{ label: 'Lab Journal', href: '/lab-journal' }] },

  // NOTIFICATIONS & MESSAGING
  { id: 'how-do-i-get-order-updates', category: 'notifications', q: 'How Do I Get Order Updates?', a: 'Push Notifications And The Bell In The Top Nav. Critical Events (Order Approved, Shipped, Delivered, Issue) Push Automatically If Push Is Enabled On Your Device.' },
  { id: 'turn-off-notification-type', category: 'notifications', q: 'How Do I Turn Off A Notification Type?', a: 'Account, Then Notifications. Each Type Has Its Own Toggle: Order Placed, Order Approved, Order Shipped, Order Delivered, New Message, Cart Reminder, Payment Reminder, Referrals, Low Stock, And System. Turning A Type Off Stops Push And The Bell Badge For That Type.', links: [{ label: 'Notification Settings', href: '/account?tab=notifications' }] },
  { id: 'enable-push-on-this-device', category: 'notifications', q: 'How Do I Enable Push Notifications On This Device?', a: 'Open Account, Then Notifications And Tap Enable Push. Approve The Browser Permission Prompt. We Send A Test Notification Right Away So You Can Confirm It Worked. Repeat For Every Device You Want Pushes On (Phone, Tablet, Desktop).', links: [{ label: 'Notification Settings', href: '/account?tab=notifications' }] },
  { id: 'no-email-notifications', category: 'notifications', q: 'Do You Send Email Notifications?', a: 'No. Email Notifications Are Currently Disabled Platform-Wide. All Updates Come Through Push And The Bell. SMS Is Also Not Used. Keep Push Enabled So You Do Not Miss Critical Updates.' },
  { id: 'message-my-agent', category: 'notifications', q: 'How Do I Message My Agent?', a: 'Open Messenger From The Top Nav Or The Dashboard. Your Agent Appears In Your Conversation List Automatically Once You Have An Order. Tap The Conversation To Start Chatting.', links: [{ label: 'Open Messenger', href: '/messenger' }] },
  { id: 'contact-support', category: 'notifications', q: 'How Do I Contact Support?', a: 'Tap Start A Support Chat At The Top Of This Page Or Use The Customer Support Widget Anywhere On The Site. We Reply In Your Messenger Inbox.', links: [{ label: 'Open Messenger', href: '/messenger' }] },

  // MESSENGER FEATURES
  { id: 'messenger-calls', category: 'messenger', q: 'Can I Make Voice Or Video Calls In The Messenger?', a: 'Yes. Open Any Conversation And Tap The Phone Or Video Icon In The Header. Calls Use LiveKit And Work In Any Modern Browser, Including iOS Safari. The Other Side Sees A Full-Screen FaceTime-Style Incoming Call Screen With Accept And Decline.', links: [{ label: 'Open Messenger', href: '/messenger' }] },
  { id: 'messenger-voice-message', category: 'messenger', q: 'How Do I Send A Voice Message?', a: 'In The Composer, Press And Hold The Microphone Icon To Record. Release To Send, Or Slide Away To Cancel. Voice Messages Play Inline With A Waveform And The Recipient Can Adjust Playback Speed.' },
  { id: 'messenger-attachments', category: 'messenger', q: 'Can I Send Photos, Videos, And Files?', a: 'Yes. Tap The Plus Or Paperclip In The Composer To Attach A File. Photos, Videos, PDFs, And Most Document Types Are Supported. Videos Show A First-Frame Poster In The Bubble Before Playback.' },
  { id: 'messenger-reactions', category: 'messenger', q: 'How Do I React To A Message?', a: 'Long-Press (Mobile) Or Hover (Desktop) Over Any Message And Tap A Reaction Emoji. Reactions Stack Below The Message And Update In Real Time For Everyone In The Conversation.' },
  { id: 'messenger-bookmarks', category: 'messenger', q: 'How Do I Bookmark An Important Message?', a: 'Long-Press The Message And Pick Bookmark From The Action Menu. Your Bookmarks Are Private To You And Listed Under Messenger, Then Bookmarks For Quick Recall.' },
  { id: 'messenger-pins', category: 'messenger', q: 'How Do I Pin A Message To The Top Of A Conversation?', a: 'Open The Message Actions And Pick Pin. Pinned Messages Stay At The Top Of The Conversation For Everyone Until Unpinned. Useful For Sharing An Address, A Lot Number, Or A Recurring Schedule.' },
  { id: 'messenger-mute', category: 'messenger', q: 'How Do I Mute A Conversation?', a: 'Open The Conversation Header Menu And Tap Mute. Pick A Duration (1 Hour, 24 Hours, Until I Re-Enable). Muted Conversations Stop Pushing Notifications But Still Show In The Inbox.' },
  { id: 'messenger-leave', category: 'messenger', q: 'How Do I Leave A Group Conversation?', a: 'Open The Conversation Menu And Pick Leave Conversation. You Are Removed From The Group And No Longer Receive Messages From It. Direct Conversations Cannot Be Left, So Mute Them Instead.' },
  { id: 'messenger-schedule', category: 'messenger', q: 'Can I Schedule A Message To Send Later?', a: 'Yes. Compose Your Message, Long-Press The Send Button, And Pick A Time. Scheduled Messages Appear Under Messenger, Then Scheduled And Can Be Edited Or Cancelled Before They Fire.' },
  { id: 'messenger-reminders', category: 'messenger', q: 'How Do I Set A Reminder For A Message?', a: 'Long-Press The Message And Tap Remind Me. Pick A Time. The Bell Pings You At That Time With A Link Back To The Original Message, So Nothing Slips Through The Cracks.' },
  { id: 'messenger-themes', category: 'messenger', q: 'Can I Customize My Messenger Theme?', a: 'Yes. Messenger, Then Settings, Then Theme. Pick A Background Color, A Bubble Style, And A Font Size. Themes Are Per-Account And Apply Across Devices.' },
  { id: 'messenger-templates', category: 'messenger', q: 'What Are Message Templates?', a: 'Saved Replies You Can Insert With One Tap (Common Replies, Shipping Updates, Payment Reminders). Manage Under Messenger, Then Templates. Agents And Admin Find This Especially Useful For Repetitive Replies.' },
  { id: 'messenger-search', category: 'messenger', q: 'How Do I Search Across All My Messages?', a: 'Tap The Search Icon At The Top Of The Inbox. Type Any Term. We Search Across Every Conversation, Every Message, Every File Name, And Every Bookmark You Own. Results Link Straight To The Original Message.' },
  { id: 'messenger-read-receipts', category: 'messenger', q: 'Do You Show Read Receipts?', a: "Yes. A Filled Checkmark Means The Recipient Has Opened The Message. You Can Disable Sending Read Receipts Under Messenger, Then Settings, Then Privacy, In Which Case You Won't See The Other Side's Either." },
  { id: 'messenger-auto-responder', category: 'messenger', q: "What's The Support Auto-Responder?", a: 'When You Open A Support Chat, A Smart Auto-Responder Acknowledges Your Message Immediately And Tries To Match Your Question To A Relevant FAQ. A Human Support Agent Picks Up Shortly After. The Auto-Responder Never Resolves Tickets On Its Own. A Human Always Gets The Final Word.' },

  // PRIVACY & DATA
  { id: 'what-data-do-you-collect', category: 'privacy', q: 'What Data Do You Collect?', a: 'Your Profile (Name, Username, Email, Phone), Your Orders, Saved Addresses, Payment Handles You Choose To Store, Disclaimer Acknowledgements, And Messages With Your Agent And Support. We Do Not Store Card Numbers Because We Do Not Process Cards.' },
  { id: 'export-my-data', category: 'privacy', q: 'Can I Export My Data?', a: 'Yes. Account, Then Privacy, Then Export Data. We Email You A ZIP With Your Profile, Orders, Addresses, And Disclaimer History In Machine-Readable Format.' },
  { id: 'messages-export', category: 'privacy', q: 'Can I Export My Messages?', a: 'Yes. Account, Then Privacy, Then Export Messages. We Email You A ZIP With Each Conversation As A Readable Transcript Plus All Attachments. Useful For Record-Keeping Or Switching Devices.' },
  { id: 'who-sees-my-orders', category: 'privacy', q: 'Who Can See My Order History?', a: 'You, Your Agent (If You Bought From One), And Platform Admin For Support And Compliance. No One Else. Other Researchers Cannot See You Exist Or Discover Your Orders.' },
  { id: 'how-is-my-data-protected', category: 'privacy', q: 'How Is My Data Protected?', a: "All Traffic Is HTTPS With HSTS. Row-Level Security On The Database Prevents Anyone From Reading Anyone Else's Data. Sensitive Fields Are Encrypted At Rest. Sessions Are Bound To Browser Fingerprints And Expire Automatically." },

  // MOBILE APP
  { id: 'install-as-app', category: 'mobile', q: 'Can I Install PepNationLab As An App?', a: 'Yes. We Are A Progressive Web App. On iOS Safari Tap The Share Button And Add To Home Screen. On Android Chrome Tap The Menu And Install App. The Installed Version Runs Full-Screen Like A Native App.' },
  { id: 'push-on-mobile', category: 'mobile', q: 'Do Push Notifications Work On Mobile?', a: 'Yes On Android Chrome And iOS 16.4 Or Newer (Requires The App To Be Installed To The Home Screen On iOS). Enable Under Account, Then Notifications. We Send Critical Order Events And New Messages Automatically.' },
  { id: 'offline-mode', category: 'mobile', q: 'Does The App Work Offline?', a: 'Cached Pages Load Without A Network But You Cannot Place Orders Or Send Payments Without A Connection. Once You Come Back Online The App Syncs Automatically.' },
  { id: 'cart-sync-across-devices', category: 'mobile', q: 'Does My Cart Sync Across Devices?', a: 'Yes. Items You Add On Your Phone Show Up On Your Desktop The Next Time You Sign In, And Vice Versa. Each Storefront Cart Is Separate, So Switching Agents Does Not Mix Items.' },

  // FOR AGENTS
  { id: 'agent-roles', category: 'agents', audience: 'agent', q: "What's The Difference Between Agent, Super Agent, And Sub-Agent?", a: 'Agent: Runs Their Own Storefront, Settles With Admin Directly. Super Agent: An Agent Who Also Manages Sub-Agents And Earns Override Commission On Their Sales. Sub-Agent: Sells Under A Super Agent, Cannot Run Their Own Storefront, Earns A Set Commission Per Sale.' },
  { id: 'agent-tier-pricing', category: 'agents', audience: 'agent', q: "What's My Tier And How Does It Affect Pricing?", a: 'Admin Assigns Each Agent A Tier: Tier 1 (5x Multiplier Off Base Cost, Best Pricing), Tier 2 (6x), Tier 3 (7x, Entry Pricing). Multipliers Are Configurable Per Product And Per Agent. Check Your Tier Under Agent Dashboard, Then Account.' },
  { id: 'agent-storefront-setup', category: 'agents', audience: 'agent', q: 'How Do I Set Up My Storefront?', a: 'Agent Dashboard, Then Storefront Setup. Configure Slug, User Name, Logo, Warehouse Address, And Payment Handles. The Storefront Is Automatically Public At Pepnationlab.com/Your-Slug.', links: [{ label: 'Agent Help (Full Guide)', href: '/dashboard/agent/help' }] },
  { id: 'agent-add-subagent', category: 'agents', audience: 'agent', q: 'How Do I Add A Sub-Agent?', a: 'Super Agent Dashboard, Then Sub-Agents, Then Promote/Create. You Can Promote An Existing User Or Create A New Account. Sub-Agents Inherit Your Storefront And Earn A Set Commission Per Sale.' },
  { id: 'agent-weekly-statements', category: 'agents', audience: 'agent', q: 'How Do Weekly Statements Work?', a: "Every Sunday At 23:59 UTC The Invoice Cron Runs And Bundles The Week's Orders Into Your COGS + Shipping Total. Credit-Billed Agents Settle Weekly. Prepaid Agents Are Debited At Order Approval Instead Of Weekly." },
  { id: 'agent-pay-statement', category: 'agents', audience: 'agent', q: 'How Do I Pay My Weekly Statement?', a: 'Open Wallet, Then Pay Statement. Tap Pay, Send The Funds Via Your Chosen Method (Same Methods Buyers Use), And Admin Marks Paid Once Funds Land. Auto-Pay From Prepaid Balance Is Also Available For Credit Accounts.' },
  { id: 'agent-commissions', category: 'agents', audience: 'agent', q: 'What Is My Commission?', a: 'Your Retail Price Minus Your Tier Cost Per Unit Sold. For Super Agents, You Also Get An Override On Sales By Your Sub-Agents. Commissions Are Tracked Per Order And Aggregated On The Sales Dashboard.' },
  { id: 'agent-restock', category: 'agents', audience: 'agent', q: 'How Do I Restock Inventory?', a: 'Agent Dashboard, Then Inventory, Then Restock. Pick The Product, Quantity, And Submit. Admin Approves And Stock Posts To Your Storefront. You Can Set Per-Product Low-Stock Thresholds So You Are Notified Before You Run Out.' },
  { id: 'agent-low-stock-alert', category: 'agents', audience: 'agent', q: "What's The Low-Stock Notification?", a: 'A Daily Cron At 09:00 UTC Scans Your Inventory And Drops A Low Stock Notification In Your Bell For Any Product At Or Below Its Threshold (Default 5 Units). Configure The Threshold Per Product On The Inventory Page.' },
  { id: 'agent-coupons', category: 'agents', audience: 'agent', q: 'How Do Coupons Work?', a: "Agent Dashboard, Then Coupons, Then New. Pick A Code, A Discount Type (Percent Or Fixed), And Optional Limits (Expiry, Max Uses, Minimum Subtotal). Coupons Are Scoped To Your Storefront Only. Other Agents' Buyers Cannot Use Your Codes." },
  { id: 'agent-messenger', category: 'agents', audience: 'agent', q: 'How Do I Reach Researchers And Admin?', a: 'Messenger Is Your Direct Channel To Buyers, Sub-Agents, And Platform Admin. Calls, Voice Messages, And File Shares Are All Supported. Your Customer Inbox Surfaces Conversations Across Your Downline.', links: [{ label: 'Open Messenger', href: '/messenger' }] },
  { id: 'agent-mfa-enroll', category: 'agents', audience: 'agent', q: 'How Do I Enroll In Two-Factor As An Agent?', a: 'Agent Dashboard, Then Security, Then Enable Two-Factor. Scan The QR Code With An Authenticator App (Authy, Google Authenticator, 1Password) And Confirm The 6-Digit Code. Save Your Backup Codes Because They Are Your Recovery Path If You Lose The Device.', links: [{ label: 'Security Settings', href: '/account?tab=security' }] },
  { id: 'agent-auto-pay', category: 'agents', audience: 'agent', q: 'What Is Auto-Pay And How Do I Enable It?', a: 'Wallet, Then Auto-Pay. When Enabled, Your Weekly Statement Is Settled Automatically From Your Prepaid Balance Each Sunday. If The Balance Is Short, We Notify You And Skip Auto-Pay For That Week.', links: [{ label: 'Wallet', href: '/wallet' }] },
  { id: 'agent-1099', category: 'agents', audience: 'agent', q: 'How Do I Download My 1099 At Tax Time?', a: 'Wallet, Then 1099. Pick The Tax Year. If You Meet The IRS Threshold For The Year, We Generate A 1099 PDF With Your Total Reportable Earnings. Available After January 31 Of Each Year.', links: [{ label: 'Wallet', href: '/wallet' }] },
  { id: 'agent-credit-increase', category: 'agents', audience: 'agent', q: 'How Do I Request A Credit Limit Increase?', a: 'Wallet, Then Credit Limit, Then Request Increase. Pick The Amount And Provide A Brief Reason. Admin Reviews Manually Based On Your Payment History And Sales Volume. Increases Are Typically Decided Within 1 To 2 Business Days.' },
  { id: 'agent-statement-dispute', category: 'agents', audience: 'agent', q: 'How Do I Dispute A Weekly Statement?', a: 'Open The Statement Detail Modal And Tap Dispute Statement. Add A Brief Reason. Admin Pauses The Bill Pending Investigation And Replies In Messenger Once Reviewed. Disputes Must Be Filed Within 14 Days Of The Statement Date.' },
  { id: 'agent-coupon-performance', category: 'agents', audience: 'agent', q: 'How Do I See Coupon Performance?', a: 'Agent Dashboard, Then Coupons, Then Performance. Shows Each Coupon Code With Total Redemptions, Total Discount Given, Average Order Value, And Net Revenue Influence. Sort By Any Metric.' },
  { id: 'agent-tax-export', category: 'agents', audience: 'agent', q: 'Can I Export Sales Data For My Tax Filing?', a: 'Yes. Agent Dashboard, Then Sales, Then Export Tax. Pick A Year And A Format (CSV Or PDF). The Export Includes Gross Sales, Refunds, Net Sales, And Sales By Jurisdiction Where Applicable.' },
  { id: 'agent-address-validation', category: 'agents', audience: 'agent', q: 'Why Did A Customer Address Get Flagged At Label Generation?', a: 'Before Generating A Label, We Run The Buyer Address Through Shippo Address Validation. If The Carrier Cannot Confirm The Address (Missing Apartment Number, Misspelled Street, P.O. Box For UPS), We Flag It For Your Review. Correct It With The Buyer Via Messenger, Then Regenerate The Label.' },
  { id: 'agent-sub-agent-referrals', category: 'agents', audience: 'agent', q: 'How Are Sub-Agent Referrals Tracked?', a: 'Each Sub-Agent Has A Personal Storefront Link With Their ID Encoded. Any Researcher Who Signs Up Through That Link Is Permanently Tagged With Referring_Sub_Agent_Id And Triggers Commission On Every Future Order They Place.' },

  // R28 - DEPTH ADDITIONS
  { id: 'agent-invoice-pdf', category: 'agents', audience: 'agent', q: 'Where Do I Download My Weekly Invoice As A PDF?', a: 'Wallet, Then Statements, Then Download PDF. The PDF Bundles Every Order On The Statement With COGS, Shipping, Discounts, And Net Owed. Useful For Bookkeeping And End-Of-Year Accounting.', links: [{ label: 'Wallet', href: '/wallet' }] },
  { id: 'agent-invoice-vs-receipt-vs-1099', category: 'agents', audience: 'agent', q: 'What Is The Difference Between An Invoice, A Receipt, And A 1099?', a: 'Receipt: Buyer-Side Document Showing What A Researcher Paid You Per Order. Invoice: Your Weekly Statement Of Orders You Owe Admin For (COGS + Shipping). 1099: IRS Tax Form Summarizing Your Annual Reportable Earnings, Generated After Year End.' },
  { id: 'become-an-agent', category: 'getting-started', q: 'How Do I Become An Agent?', a: 'Apply Via The Become An Agent Page From The Footer. Pick A Tier (Tier 3 Is Entry), Submit Your Storefront Slug Preference, And Acknowledge The Compliance Disclosures. Admin Reviews Manually And Reaches Out To Approve.', links: [{ label: 'Become An Agent', href: '/become-agent' }] },
  { id: 'zelle-tips', category: 'payments', q: 'Zelle Payment Tips', a: 'Send Friends-And-Family Equivalent (Zelle Has No Goods-And-Services Toggle). Add Your Order Number In The Memo. Most Banks Process Zelle Instantly During Business Hours; Some Hold Until The Next Business Day For New Recipients.' },
  { id: 'venmo-tips', category: 'payments', q: 'Venmo Payment Tips', a: 'Always Send As Friends And Family (Toggle Off Goods & Services). Goods & Services Triggers Buyer Protection That Conflicts With Research-Only Sales And May Cause Reversal. Put Your Order Number In The Note.' },
  { id: 'cashapp-tips', category: 'payments', q: 'Cash App Payment Tips', a: 'Send As Pay Not Request (You Are Initiating The Payment). For Larger Amounts You May Need To Verify Your Cash App Identity First. Add The Order Number In The Note.' },
  { id: 'applepay-tips', category: 'payments', q: 'Apple Pay Payment Tips', a: 'Apple Pay Is Used Via Apple Cash On iMessage. Send To Your Agent\'s Phone Number (Their Stored Handle). Include The Order Number In The iMessage Thread So They Can Match It Quickly.' },
  { id: 'applecash-tips', category: 'payments', q: 'Apple Cash Payment Tips', a: 'Apple Cash Lives Inside iMessage And Wallet. Send From Your Apple Cash Card To The Phone Number On File. Both Sides Need An Apple Cash Account. Send The Order Number In The Same iMessage Thread.' },
  { id: 'paypal-tips', category: 'payments', q: 'PayPal Payment Tips', a: 'Always Use Friends And Family. Goods And Services Triggers Buyer Protection That Conflicts With Research-Only Sales And Can Result In Reversal. Put The Order Number In The Note. Send From A Verified PayPal Balance Or A Linked Bank.' },
  { id: 'googlewallet-tips', category: 'payments', q: 'Google Wallet (Google Pay) Payment Tips', a: 'Send To The Email Or Phone Number Your Agent Has Configured. Google Wallet Peer-To-Peer Is U.S. Only. Note The Order Number In The Memo.' },
  { id: 'wise-tips', category: 'payments', q: 'Wise Payment Tips', a: 'Wise Is The Go-To For International Or Larger USD Transfers. Use Your Agent\'s Wise Email Or Wisetag. Wise Charges A Small Fee. Check It Before Sending So Your Agent Receives The Expected Net.' },
  { id: 'chime-tips', category: 'payments', q: 'Chime Payment Tips', a: 'Use Chime Pay Friends. Send To Your Agent\'s Chime Tag Or Phone. Chime Is U.S. Only. Note The Order Number In The Memo.' },
  { id: 'refund-timing-per-app', category: 'returns', q: 'How Long Does A Refund Take By Payment App?', a: 'Zelle, Apple Cash: Same Day If Sent Before 5 PM Local. Venmo, Cash App, PayPal Friends-And-Family: 1 To 3 Business Days. Wise: 1 To 5 Business Days. Chime, Google Wallet: 1 To 3 Business Days. Refunds To Wallet Are Instant Regardless Of Original Method.' },
  { id: 'account-locked-recovery', category: 'account', q: 'My Account Is Locked Or Deactivated. How Do I Recover It?', a: 'Open A Support Chat From The Login Screen Or Email Support@Pepnationlab.com. Include Your Username Or Email And A Brief Description Of The Issue. Admin Reviews The Audit Log And Reactivates If Appropriate, Or Explains What Happened.' },
  { id: 'cart-reminder-why', category: 'notifications', q: 'Why Did I Get A Cart Reminder?', a: 'You Added Items To A Cart But Did Not Check Out. We Send One Friendly Reminder Push To Help You Finish. You Can Turn Cart Reminders Off Under Account, Then Notifications, Then Cart Reminder. We Never Send More Than One Per Cart Session.', links: [{ label: 'Notification Settings', href: '/account?tab=notifications' }] },
  { id: 'support-hours', category: 'support', q: 'What Are Your Support Hours?', a: 'Live Support Coverage Runs 9am To 5pm CST, Seven Days A Week. Outside Those Hours, A Message To Support Still Queues Up And A Human Replies The Next Morning. Critical Order Issues Get Bumped First.' },
  { id: 'support-sla', category: 'support', q: 'How Fast Will Support Reply?', a: 'Inside Live Hours, Median Response Is Under 15 Minutes. Outside Live Hours, We Reply The Next Morning. Order Issues With A Real Block (Stuck Payment, Missing Package) Are Triaged Ahead Of General Questions.' },
  { id: 'support-escalation', category: 'support', q: 'How Do I Escalate If My Issue Is Not Resolved?', a: 'Reply In The Same Support Thread And Tap Escalate. The Conversation Is Flagged For Admin And A Senior Support Specialist Picks It Up. Do Not Open A New Thread Because It Resets Your Place In The Queue. If Your Issue Still Is Not Resolved, Tap Email Support For Escalation On The Help Page To Send Direct To Support@Pepnationlab.com.' },
  { id: 'support-widget-everywhere', category: 'support', q: 'How Do I Reach Support Without Leaving The Page I Am On?', a: 'The Support Widget Lives In The Bottom-Right Corner Of Every Authenticated Page. Tap It To Open A Mini Chat With Support. Your Conversation Continues In Messenger If You Switch Pages.' },
  { id: 'lot-lookup-for-verification', category: 'compounds', q: 'How Do Resellers Verify A Lot Number?', a: 'Each Lot On Your Order Detail Page Carries A Verification Code You Can Read Out Or Paste Into Lab Records. The COA PDF Includes The Manufacturer\'s Lot ID So Downstream Verification Can Be Independently Confirmed.' },
  { id: 'agent-storefront-offline', category: 'orders', q: 'My Agent\'s Storefront Is Offline. What Happens To My Orders?', a: 'Pending Orders Stay Open And Can Still Be Fulfilled By Your Agent (Or Admin On Their Behalf). New Orders Cannot Be Placed Until The Storefront Is Reactivated. If The Storefront Is Permanently Closed, Admin Reassigns You To Another Agent And Pending Orders Are Refunded Or Reissued.' },
  { id: 'multi-currency', category: 'pricing', q: 'Can I See Prices In My Local Currency?', a: 'All Prices Display In USD Because Settlement Is USD-Denominated And Payment Apps Convert At Their Own Rates. If You Are International, Your Bank Or Payment App Shows The Equivalent Charge When You Send The Funds.' },
  { id: 'pwa-install-failed', category: 'mobile', q: 'The Install App Prompt Did Not Work. What Do I Do?', a: 'Make Sure You Are On Chrome (Android) Or Safari (iOS) And Visiting The Site At pepnationlab.com Directly. If The Prompt Still Fails, Manually Add To Home Screen From The Browser Share Menu. iOS Requires The Home-Screen Install To Receive Push.' },
  { id: 'pwa-install-button-missing', category: 'mobile', q: 'Where Is The Install App Button?', a: 'On Android Chrome The Button Lives In The Account Header After You Sign In. On iOS Safari There Is No Programmatic Install Prompt. Use Share, Then Add To Home Screen. On Desktop Chrome, Look For The Install Icon On The Right Side Of The Address Bar.' },
  { id: 'platform-times-in-utc', category: 'orders', q: 'Why Do Some Times Show In UTC?', a: 'Internal System Events (Cron Runs, Statement Cutoffs, Audit Logs) Are Recorded And Surfaced In UTC For Consistency Across Time Zones. Buyer-Facing Times On Order Cards Are Converted To Your Browser Local Time Automatically.' },
  { id: 'admin-impersonation', category: 'admin', audience: 'admin', q: 'How Does Admin Impersonation Work?', a: 'Admin Dashboard, Then Researchers Or Agents, Then Pick A User, Then Impersonate. The Session Is Recorded In Admin Audit Log With Full Tool Tracing And A Visible Banner Reminds You That You Are Impersonating. End The Session Immediately When Done.' },
  { id: 'admin-mark-paid', category: 'admin', audience: 'admin', q: 'How Do I Mark An Order Paid From The Admin Side?', a: 'Admin, Then Orders, Then Pick The Order, Then Mark Paid. This Posts An Agent Approval Pending Transition. Use Sparingly And Only When The Agent Confirms Receipt. The Action Is Logged In The Admin Audit Log.' },
  { id: 'admin-catalog-risk-audit', category: 'admin', audience: 'admin', q: 'How Do I Audit The Catalog For Compliance Risk?', a: 'Admin, Then Products, Then Filter By Risk. Surfaces Banned Products, Recently Added Products Without COA, And Products With Anomalous Pricing. Use Quarterly To Catch Compliance Drift.' },
  { id: 'admin-product-ban', category: 'admin', audience: 'admin', q: 'How Do I Ban A Product Platform-Wide?', a: 'Admin, Then Products, Then Pick The Product, Then Toggle Banned. Banned Products Cannot Be Added To Any Cart, Cannot Be Checked Out (Checkout Re-Verifies At Submit Time), And Are Hidden From Storefronts. The Ban Is Logged To Admin Audit Log.' },
  { id: 'admin-impersonation-audit', category: 'admin', audience: 'admin', q: 'How Do I Review Past Admin Impersonation Sessions?', a: 'Admin, Then Audit Log, Then Filter By Action: impersonate.start. Each Entry Includes The Acting Admin, The Impersonated User, Start Time, Duration, And A Click-Through To The Full Session Trace. Review Quarterly As Part Of SOC2 Posture.' },
  { id: 'admin-mfa-required', category: 'admin', audience: 'admin', q: 'Is Two-Factor Required For Admin?', a: 'Yes. Admin Role Cannot Bypass The Two-Factor Enrollment Gate. If You Lose Your Authenticator Device, Use A Backup Code Or Contact Another Admin To Reset Enrollment Via Direct DB Tooling. There Is No Self-Service Reset For Admin.' },
];

/**
 * Filter the catalog for a given viewer role. Admins and agents see
 * everything; researchers see only audience='all' items.
 */
export function visibleFaq(role: string | null | undefined): FaqItem[] {
  const isAdmin = role === 'admin';
  const isAgentTier =
    role === 'agent' || role === 'super_agent' || role === 'admin';
  return FAQ_ITEMS.filter((item) => {
    if (item.audience === 'admin') return isAdmin;
    if (item.audience === 'agent') return isAgentTier;
    return true;
  });
}

/**
 * Filter the categories for a given viewer role. Same rule as items.
 */
export function visibleCategories(role: string | null | undefined): FaqCategory[] {
  const isAdmin = role === 'admin';
  const isAgentTier =
    role === 'agent' || role === 'super_agent' || role === 'admin';
  return FAQ_CATEGORIES.filter((cat) => {
    if (cat.audience === 'admin') return isAdmin;
    if (cat.audience === 'agent') return isAgentTier;
    return true;
  });
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

/**
 * R28 - Build a canonical deep-link URL to a specific FAQ answer. Used by
 * <HelpHint />, the sitemap, and any surface that wants to send a buyer
 * straight to a specific answer (the help page opens it on mount via hash).
 */
export function faqDeepLink(itemId: string): string {
  return `/account/help#faq-${itemId}`;
}

export interface FaqSuggestion {
  item: FaqItem;
  /** Higher = stronger match. Bounded 0 to 100 in practice. */
  score: number;
}

/**
 * R28 - Lightweight natural-language match used by the support widget and
 * the messenger composer to surface 1 to 3 likely answers before a user
 * hits send. Scores by token overlap with the question (weighted higher)
 * and the answer body. Returns `limit` strongest matches, descending.
 *
 * Behaviour:
 *   - Empty or single-character prompts return `[]` so we never suggest a
 *     random answer in response to nothing.
 *   - Tokens shorter than 3 chars are dropped to keep noise out.
 *   - Score is rounded to a percentage of the theoretical maximum so the
 *     UI can render a confidence bar consistently across queries.
 */
export function suggestFaq(
  prompt: string,
  items: FaqItem[],
  limit = 3,
): FaqSuggestion[] {
  const cleaned = (prompt || '').trim().toLowerCase();
  if (cleaned.length < 2) return [];
  const tokens = cleaned
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return [];

  const unique = Array.from(new Set(tokens));
  const ranked: FaqSuggestion[] = [];

  for (const it of items) {
    const qLower = it.q.toLowerCase();
    const aLower = it.a.toLowerCase();
    let raw = 0;
    for (const tok of unique) {
      if (qLower.includes(tok)) raw += 3;
      else if (aLower.includes(tok)) raw += 1;
    }
    if (raw === 0) continue;
    const max = unique.length * 3;
    const score = Math.min(100, Math.round((raw / max) * 100));
    ranked.push({ item: it, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, Math.max(0, limit));
}
