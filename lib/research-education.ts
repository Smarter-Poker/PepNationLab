/**
 * Research education content for the PepNationLab data center: a plain-text
 * peptide glossary, a general peptide FAQ, and foundational learn guides.
 * Research-use-only framing throughout; nothing here is dosing or medical
 * advice. Pure data module (no imports) so it is safe in client or server
 * components.
 *
 * *** ALL CONTENT REWRITTEN IN ELI5 (EXPLAIN LIKE I'M 5) LANGUAGE ***
 * Every definition uses simple words, real-world comparisons, and
 * age-appropriate explanations. No fancy science words.
 */

export interface GlossaryEntry { term: string; def: string }
export interface FaqEntry { category: string; q: string; a: string }
export interface GuideSection { heading: string; body: string }
export interface Guide { slug: string; title: string; intro: string; sections: GuideSection[] }

export const FAQ_CATEGORY_ORDER: string[] = [
  "Basics",
  "Handling & Preparation",
  "Storage & Stability",
  "Safety & Compliance",
  "Evidence & Sourcing",
  "Using This Library"
];

export const PEPTIDE_GLOSSARY: GlossaryEntry[] = [
  {
    "term": "Peptide",
    "def": "A Short Chain Of Tiny Blocks Connected Together. Like LEGO Bricks Stacked In A Line. Scientists Study How These Chains Talk To Your Body."
  },
  {
    "term": "Amino Acid",
    "def": "The Building Block Of A Peptide. Imagine A Single LEGO Brick. Your Body Has About 20 Different Types. When You Connect 2 To 50 Of These Blocks, You Make A Peptide."
  },
  {
    "term": "Peptide Bond",
    "def": "The Super Glue That Holds Two Building Blocks Together. When Two Amino Acids Hold Hands, They Make A Bond. It's Very Strong. Your Body Has To Work Hard To Break It."
  },
  {
    "term": "Sequence",
    "def": "The Order The Blocks Are Stacked. Like: Red Block, Blue Block, Yellow Block. If You Change The Order, You Get A Totally Different Peptide. Order Matters A Lot."
  },
  {
    "term": "Molecular Weight",
    "def": "How Heavy Something Is. Imagine Weighing A Pile Of LEGO Blocks. Scientists Measure It In Tiny Units So They Can Be Very Exact."
  },
  {
    "term": "CAS Number",
    "def": "A Special ID Number For A Substance. Like A Social Security Number For A Chemical. It's So Scientists Can Talk About The Same Thing Without Getting Confused."
  },
  {
    "term": "Lyophilized",
    "def": "Freeze-Dried Into Powder. Imagine Freezing Something And Then Taking Out All The Water While It's Still Frozen. What's Left Is A Dry Powder That Lasts A Really Long Time."
  },
  {
    "term": "Reconstitution",
    "def": "Adding Water To Dry Powder To Make It Liquid Again. Like Adding Water To Powdered Juice To Make It Drinkable. Slow And Gentle Is The Key."
  },
  {
    "term": "Bacteriostatic Water",
    "def": "Super Clean Water That Stops Germs From Growing. It's Like Having A Bodyguard In The Water That Keeps Bad Bacteria Away. Good For Keeping Peptides Safe."
  },
  {
    "term": "Sterile Water",
    "def": "Clean Water With No Germs And No Bodyguard Chemicals. Like Rainwater That Got Cleaned Really Well. Use It When You Don't Want Anything Else In There."
  },
  {
    "term": "Acetic Acid Diluent",
    "def": "Water That's A Tiny Bit Sour. Like Lemon Juice. Some Peptides Like Being In Sour Water Because It Helps Them Dissolve."
  },
  {
    "term": "Diluent",
    "def": "Any Liquid That Dissolves Something. Like Water Dissolves Sugar. It Makes A Peptide Go From Powder To Liquid."
  },
  {
    "term": "Subcutaneous",
    "def": "Under The Skin. Like The Layer Between Your Skin And Your Muscles. Scientists Study What Happens When Things Go There."
  },
  {
    "term": "Intramuscular",
    "def": "Inside A Muscle. Deep Into The Body Where Muscles Are. Scientists Study This Route In Animal Research."
  },
  {
    "term": "Half-Life",
    "def": "How Long Something Stays Around Before Half Of It Is Gone. Like A Cookie Lasting So Long That You Eat Half Of It. Then Half Of What's Left. And So On."
  },
  {
    "term": "Bioavailability",
    "def": "How Much Of Something Actually Gets Absorbed Into The Body. Like Eating 10 Cookies But Your Body Only Uses 8 Of Them. The Other 2 Just Pass Through."
  },
  {
    "term": "Pharmacokinetics",
    "def": "The Story Of What Happens To A Substance In Your Body. Where It Goes. How Long It Stays. How Fast Your Body Gets Rid Of It. Like Following A Truck Route."
  },
  {
    "term": "Agonist",
    "def": "Something That Turns A Lock On. Like A Key That Fits A Lock And Opens The Door. It Activates And Tells The Cell To Do Something."
  },
  {
    "term": "Antagonist",
    "def": "Something That Blocks A Lock. Like Putting A Different Key In The Lock So The Real Key Can't Work. It Stops The Signal."
  },
  {
    "term": "Receptor",
    "def": "A Lock On A Cell. The Peptide Is The Key. When The Right Key Fits The Right Lock, The Door Opens And Something Happens Inside."
  },
  {
    "term": "GHRH",
    "def": "A Signal That Tells Your Body To Make Growth Hormone. Scientists Copy This Signal To Study How Growth Works."
  },
  {
    "term": "GHRP",
    "def": "A Made-Up Signal That Does Something Like GHRH. Scientists Created It To Study Growth And See What Happens."
  },
  {
    "term": "GHS-R1a (Ghrelin Receptor)",
    "def": "A Special Lock That Listens For Growth Signals. When The Right Signal Comes, The Lock Opens And The Body Listens."
  },
  {
    "term": "Secretagogue",
    "def": "Something That Tells Your Glands To Release Stuff. Like Pressing A Button That Makes A Machine Squirt Out Something."
  },
  {
    "term": "IGF-1",
    "def": "A Signal Your Liver Makes When Growth Hormone Shows Up. It's Like The Messenger That Carries The Instruction 'Grow' To Other Cells."
  },
  {
    "term": "GLP-1",
    "def": "A Signal Your Gut Makes After You Eat. It Tells Your Body: Make Insulin And Feel Full. Scientists Study This A Lot."
  },
  {
    "term": "GIP",
    "def": "Another Signal From Your Gut After You Eat. It Also Says: Make Insulin. Works Together With GLP-1."
  },
  {
    "term": "Incretin",
    "def": "Signals That Come From Your Gut And Tell Your Body To Make Insulin After You Eat. Like A Message: Nutrients Coming, Get Ready!"
  },
  {
    "term": "Amylin",
    "def": "A Signal Made Right Next To Insulin. It Says: You're Full, Stop Eating. Scientists Study How This Works."
  },
  {
    "term": "Melanocortin",
    "def": "A Family Of Signals That Do Many Jobs. Make Color. Control Hunger. Scientists Study How They Talk To Cells."
  },
  {
    "term": "MC1R",
    "def": "A Lock That Gets A Signal To Make Skin Color. It's In Your Pigment Cells. Changes This And You Get Different Colored Skin."
  },
  {
    "term": "MC4R",
    "def": "A Lock In Your Brain That Controls Hunger. When This Gets A Signal, You Feel Full Or Hungry. Scientists Study This For Weight Research."
  },
  {
    "term": "Telomerase",
    "def": "An Enzyme That Fixes The Ends Of Chromosomes. Like A Repair Worker That Stops Your DNA From Wearing Out. Studied For Anti-Aging."
  },
  {
    "term": "Telomere",
    "def": "The Cap On The End Of Your DNA. Like The Plastic Tip On A Shoelace. It Gets Shorter Over Time. Short Telomeres Mean Old Cells."
  },
  {
    "term": "Senolytic",
    "def": "Something That Clears Out Old Broken Cells. Like A Trash Truck For Bad Cells. Scientists Study It To Help People Age Better."
  },
  {
    "term": "Senescence",
    "def": "When A Cell Gets Old And Stops Working. It's Still There But Doesn't Do Its Job Anymore. Scientists Study This Because It Happens During Aging."
  },
  {
    "term": "Mitochondria",
    "def": "The Power Plant Of Your Cells. Like Little Batteries That Make Energy So Cells Can Work. Studied For Aging And Energy."
  },
  {
    "term": "Cardiolipin",
    "def": "A Special Fat Found In Mitochondria. Like The Wire That Connects Everything. Important For Mitochondria To Work."
  },
  {
    "term": "Mitophagy",
    "def": "When Your Cell Eats Its Own Broken Batteries. Like Recycling Old Mitochondria. Keeps Cells Clean And Healthy."
  },
  {
    "term": "Angiogenesis",
    "def": "Growing New Blood Vessels. Like Building New Roads In A City So Blood Can Travel Better. Studied For Healing."
  },
  {
    "term": "Pro-Angiogenic",
    "def": "Something That Helps Make New Blood Vessels. Like A Contractor That Builds Roads. Studied For Wound Healing."
  },
  {
    "term": "Cytokine",
    "def": "A Tiny Message Sent Between Cells. Like A Text Message Your Cells Send Each Other. Tells Them What To Do."
  },
  {
    "term": "Peptide Bioregulator",
    "def": "A Short Peptide That Tells A Part Of Your Body To Work Better. Like A Coach That Makes A Team Play Better."
  },
  {
    "term": "Nootropic",
    "def": "Something Studied For Brain Power. Memory. Focus. Thinking Clearer. Scientists Research How These Work."
  },
  {
    "term": "Anxiolytic",
    "def": "Something Studied To See If It Helps With Worry. Scientists Test It To Learn How It Works."
  },
  {
    "term": "Lipolysis",
    "def": "Breaking Down Fat Into Energy. Like Burning A Log To Make Heat. Your Body Does This When It Needs Energy."
  },
  {
    "term": "Lipotropic",
    "def": "Something That Helps Your Body Move Fat Around. Like A Taxi That Drives Fat From Place To Place."
  },
  {
    "term": "Certificate Of Analysis (COA)",
    "def": "A Report Card For A Batch Of Peptide. It Says: Pure? Checked. Right Thing? Checked. Safe? Checked. Like A Quality Guarantee."
  },
  {
    "term": "HPLC",
    "def": "A Machine That Sorts Out What's In A Mixture. Like A Sorter That Separates Different Colors Of LEGO. Checks If It's Pure."
  },
  {
    "term": "Mass Spectrometry",
    "def": "A Machine That Weighs Molecules And Counts Them. Like A Scale That Can Weigh One Grain Of Sand. Very Exact."
  },
  {
    "term": "Endotoxin",
    "def": "Bad Stuff That Bacteria Leave Behind. Like Trash Left In A Room. Scientists Remove This To Keep Things Safe."
  },
  {
    "term": "Sterile Filtration",
    "def": "Pouring A Liquid Through A Super Tiny Net. Like Straining Pasta But Way Tighter. Catches Bad Germs."
  },
  {
    "term": "Research Use Only",
    "def": "A Label That Says: This Is Only For Scientists In Labs. Not For People. Not For Animals. Only For Learning."
  },
  {
    "term": "In Vitro",
    "def": "Experiments In A Dish Or Test Tube. No Living Things. Just Cells And Chemicals. Like A Tiny World In Glass."
  },
  {
    "term": "In Vivo",
    "def": "Experiments Inside A Living Thing. Like An Animal. Scientists Watch What Actually Happens In A Real Body."
  },
  {
    "term": "Preclinical",
    "def": "Testing Before Anyone Gets It. Like Testing A Car In A Lab Before Putting It On Roads. Scientists Check Safety First."
  },
  {
    "term": "Investigational",
    "def": "Still Being Tested. Not Approved Yet. Like A New Recipe You're Still Figuring Out."
  },
  {
    "term": "Freeze-Thaw",
    "def": "Taking Something From Freezer To Room Temperature Then Back To Freezer. Doing This Over And Over Damages It. Like Crumpling Paper."
  },
  {
    "term": "Cold Chain",
    "def": "Keeping Something Cold From Start To Finish. Like A Cooler That Never Gets Warm. Keeps Peptides Happy."
  },
  {
    "term": "N-Terminus",
    "def": "The Start Of A Peptide Chain. Written First. Like The Beginning Of A List."
  },
  {
    "term": "C-Terminus",
    "def": "The End Of A Peptide Chain. Written Last. Like The End Of A List."
  },
  {
    "term": "Purity",
    "def": "How Much Is Real And How Much Is Not. Like: Is This Orange Juice 100 Percent Orange Or Is Some Water Mixed In? Higher Purity Is Better."
  },
  {
    "term": "Aliquot",
    "def": "A Small Portion Of A Big Sample. Like Dividing A Pizza Into Slices. Use One Slice, Keep The Rest Safe."
  }
];

export const PEPTIDE_FAQ: FaqEntry[] = [
  {
    "category": "Basics",
    "q": "Are These Products For Human Use?",
    "a": "No Way! Everything We Sell Is Only For Scientists In Labs. Not For People. Not For Animals. Not For Eating, Drinking, Or Putting On Skin. These Are Learning Tools, Nothing More."
  },
  {
    "category": "Basics",
    "q": "What Does Research Use Only Mean?",
    "a": "It Means: Scientists Use These In Labs To Learn. That's It. Not For Medicine. Not For Curing Anything. Not For Making Someone Feel Better. Just For Understanding How Things Work."
  },
  {
    "category": "Basics",
    "q": "What Is A Peptide?",
    "a": "A Peptide Is Like A Short LEGO Tower Made Of Blocks Called Amino Acids. Scientists Study These Towers Because They Send Messages In Bodies. They're Fascinating To Learn About."
  },
  {
    "category": "Basics",
    "q": "What Is The Difference Between A Peptide And A Protein?",
    "a": "Size! Peptides Are Short (2-50 Blocks). Proteins Are Long (51+ Blocks). That's The Main Difference. They're Similar But Different Sizes, Like A Toy And A Real Building."
  },
  {
    "category": "Basics",
    "q": "Why Do Scientists Study Peptides?",
    "a": "Peptides Are Messengers. They Tell Cells What To Do. Understanding Them Helps Scientists Learn How Bodies Work. It's Like Understanding How Text Messages Work."
  },
  {
    "category": "Basics",
    "q": "Where Do Peptides Come From?",
    "a": "Your Body Makes Peptides Naturally. Scientists Can Also Make Them In Labs. Lab-Made Ones Are Copies Or New Versions That Help Us Learn Things."
  },
  {
    "category": "Handling & Preparation",
    "q": "How Do I Use A Peptide Powder?",
    "a": "First, Add Very Clean Water Slowly. Don't Shake Hard. Gently Swirl It. It Becomes A Liquid. That's Reconstitution. Now It's Ready For Experiments."
  },
  {
    "category": "Handling & Preparation",
    "q": "What Water Should I Use?",
    "a": "Use Super Clean Water. Either With A Germ-Stopping Chemical Or Without One. Both Work. Your Experiment Tells You Which Is Better."
  },
  {
    "category": "Handling & Preparation",
    "q": "Should I Shake Or Stir?",
    "a": "Stir Gently. Don't Shake Hard. Shaking Makes Bubbles. Bubbles Hurt The Peptide. Gentle Is Always Better."
  },
  {
    "category": "Storage & Stability",
    "q": "How Should I Store Peptide Powder?",
    "a": "Three Rules: Cold. Dark. Dry. Put It In The Freezer Or Fridge. Keep It Away From Light. Don't Let It Get Wet. Done!"
  },
  {
    "category": "Storage & Stability",
    "q": "How Long Does A Peptide Last?",
    "a": "As Powder: Months Or Years. As Liquid: Days Or Weeks. Cold, Dark, Dry Keeps It Longer. The Colder And Darker, The Longer It Lasts."
  },
  {
    "category": "Storage & Stability",
    "q": "What Happens If I Freeze And Thaw Repeatedly?",
    "a": "It Gets Damaged. Like Crumpling Paper Over And Over. It Falls Apart. Use Small Pieces So You Never Thaw The Whole Thing Twice."
  },
  {
    "category": "Storage & Stability",
    "q": "Can I Store It At Room Temperature?",
    "a": "No. Room Temperature Is Too Warm. Warm Breaks Peptides. Cold Is Your Friend. Keep It Chilled."
  },
  {
    "category": "Safety & Compliance",
    "q": "Is This Safe To Handle?",
    "a": "Yes, If You Follow Rules. Wear Gloves. Don't Eat It. Wash Your Hands. Use Clean Equipment. Basic Lab Safety. Just Common Sense."
  },
  {
    "category": "Safety & Compliance",
    "q": "What If I Spill Some?",
    "a": "Clean It Up With Water. Use Soap. Wash Your Hands. It's Not Dangerous Like Poison. Just Clean It Like Any Spill."
  },
  {
    "category": "Safety & Compliance",
    "q": "Can I Give This To Someone?",
    "a": "No. Never. Not Ever. This Is Research Only. Not For People Or Animals. It's A Lab Tool, Like A Microscope. You Don't Use A Microscope To Look At A Person."
  },
  {
    "category": "Evidence & Sourcing",
    "q": "How Do I Know This Is Real?",
    "a": "We Give You A Report Card Called COA. It Says What Tests We Did. Pure? Yes. Real? Yes. The Right Thing? Yes. Trust The Report."
  },
  {
    "category": "Evidence & Sourcing",
    "q": "What Tests Prove It's Pure?",
    "a": "We Use Machines That Sort And Weigh Molecules. HPLC Separates Everything. Mass Spec Weighs It Exactly. Both Say: Pure!"
  },
  {
    "category": "Using This Library",
    "q": "How Should I Use This Information?",
    "a": "Learn! Read! Understand How Peptides Work! Use This For School Or Science Club. Share With Friends Who Love Science. Just For Learning."
  },
  {
    "category": "Using This Library",
    "q": "What Should I Do If I Have Questions?",
    "a": "Ask A Real Scientist! A Teacher! A Lab Person! Don't Guess. Get Expert Help. They'll Explain Things Right."
  }
];
