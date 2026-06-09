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
export const LEARN_GUIDES: Guide[] = [
  {
    "slug": "what-are-research-peptides",
    "title": "What Are Research Peptides?",
    "intro": "Peptides are short chains of amino acids, and the compounds in this catalog are supplied strictly for laboratory research use. This guide explains what a peptide is and what research use only means in practice.",
    "sections": [
      {
        "heading": "What A Peptide Is",
        "body": "A peptide is a short chain of amino acids linked by peptide bonds, sitting in size between a single amino acid and a full protein. Many are signaling molecules: they bind a receptor or interact with another protein to nudge a biological process. The compounds profiled in the PepNationLab library range from tiny tripeptides such as GHK-Cu (three amino acids) to larger sequences such as Thymosin Alpha-1 (twenty-eight residues), and a few entries are related small molecules or cofactors rather than peptides in the strict sense.\n\nMost are supplied as a lyophilized (freeze-dried) powder. Identity is described by a sequence, a molecular weight, and where one exists a CAS registry number, which together let a researcher confirm what is actually in the vial against a certificate of analysis."
      },
      {
        "heading": "Why These Are Sold For Research Use Only",
        "body": "The large majority of these compounds are not approved drugs. Some are investigational and still in human trials, some have only animal or cell-culture data, and several are sold purely as research chemicals with no approved human use at all. A compound that has not cleared regulatory review for a given use cannot be lawfully marketed as a treatment for that use.\n\nResearch-use-only framing reflects that reality honestly. Products are intended for in-vitro and laboratory study by qualified researchers, not for human consumption. The platform describes what a compound is studied for and what researchers have reported, never what it will do for a person."
      },
      {
        "heading": "What That Means Legally And Practically",
        "body": "Practically, research use only means no dosing protocols, no medical claims, and no therapeutic promises accompany any product. Where a number appears, it is cited only as a published study or label parameter, such as a dose used in a named clinical trial, and never as a recommendation.\n\nThe site enforces this with a four-layer disclaimer that a researcher acknowledges at site entry, registration, add-to-cart, and checkout. These gates are a compliance backbone, not a formality. Anyone evaluating a compound should treat the evidence tier on its page as the most important piece of information on it."
      }
    ]
  },
  {
    "slug": "understanding-evidence-tiers",
    "title": "Understanding Evidence Tiers",
    "intro": "Not all compounds carry the same weight of evidence behind them. This guide explains the five evidence tiers used across the library so you can calibrate any claim you read.",
    "sections": [
      {
        "heading": "The Five Tiers",
        "body": "Every profile carries an evidence tier so a reader can judge how much trust a claim deserves. Approved drug means the compound is FDA and/or EMA approved with robust human trial data. Investigational means it is in active human clinical trials but not yet approved. Preliminary or preclinical means the evidence is mainly from animal or in-vitro work, or from limited single-group human data. Research-chemical only means there is no approved human use and the compound is sold for laboratory research. Cosmetic ingredient means it is a recognized topical cosmetic active rather than a drug.\n\nThese tiers are deliberately blunt. A compound can be genuinely interesting and still sit at the bottom of the ladder."
      },
      {
        "heading": "How To Calibrate A Claim",
        "body": "Tier tells you the type of evidence; you still have to read the context. Reported in animal models to is a far weaker statement than in the STEP-1 trial. In-vitro evidence in cultured cells does not predict what happens in a living organism, and a single-group human cohort with no control arm is not the same as a randomized trial.\n\nBe especially cautious with compounds whose human data is old, non-independent, or comes from a single research lineage. Several entries in this catalog fit that description and say so plainly."
      },
      {
        "heading": "Weak Evidence Is Stated, Not Hidden",
        "body": "Some catalog compounds are entirely preclinical, and at least one failed its pivotal human trial. The library names these cases rather than burying them. Surfacing weak evidence is treated as a feature: it is what separates a credible research reference from marketing copy.\n\nWhen a page says evidence is thin, that is the finding, not an oversight. Plan any research design around the honest tier, not around the most optimistic single study."
      }
    ]
  },
  {
    "slug": "reconstitution-basics",
    "title": "Reconstitution Basics",
    "intro": "Most catalog compounds arrive as a lyophilized powder that must be brought into solution before laboratory use. This guide explains the general concept of reconstitution and how diluent choice is decided, with no dosing guidance.",
    "sections": [
      {
        "heading": "From Lyophilized Powder To Solution",
        "body": "Lyophilization (freeze-drying) removes water so a peptide stays stable as a dry powder during shipping and storage. Reconstitution is simply adding a sterile liquid (a diluent) back to that powder to form a solution for laboratory work.\n\nThe powder is fragile. Diluent is generally added slowly down the side of the vial and the vial is swirled gently rather than shaken, because vigorous agitation and foaming can damage the peptide. This is a general lab-preparation concept, not an instruction for any human use."
      },
      {
        "heading": "Choosing A Diluent",
        "body": "Bacteriostatic water (sterile water with a small amount of benzyl alcohol) is the most common diluent and is suitable for the majority of catalog peptides; sterile water is also used. Some poorly soluble or aggregation-prone peptides dissolve better with a dilute acetic acid solution, which lowers pH to help the peptide go into solution. Many entries note that acetic acid is generally not needed.\n\nDiluent choice is compound-specific. Copper peptides such as GHK-Cu are pH and redox sensitive and are degraded by strong acids and reducing agents, so the per-compound handling note on each monograph is the authority. Always follow the compound's own profile rather than a one-size-fits-all rule."
      },
      {
        "heading": "Use The Reconstitution Calculator",
        "body": "Working out the relationship between powder mass, diluent volume, and resulting concentration is arithmetic, and the platform provides a reconstitution calculator for it. Use that tool to plan concentration for a research preparation.\n\nThe calculator handles concentration math only. It is not a dosing tool and does not imply any human administration. Pair it with the compound's handling note for diluent type and storage."
      }
    ]
  },
  {
    "slug": "storage-cold-chain-shelf-life",
    "title": "Storage, Cold Chain & Shelf Life",
    "intro": "Peptides are sensitive molecules, and how they are stored before and after reconstitution determines whether they remain intact. This guide covers temperature, light, freeze-thaw, and general shelf-life concepts.",
    "sections": [
      {
        "heading": "Lyophilized Versus Reconstituted Storage",
        "body": "As a dry lyophilized powder, most catalog peptides are stable for extended periods when kept cold, dark, and dry. Common guidance across profiles is refrigeration at 2 to 8 degrees Celsius for nearer-term storage and freezing around minus 20 degrees Celsius for long-term storage. A few hygroscopic powders, such as injectable NAD+, readily absorb moisture and need especially careful dry, cold storage.\n\nOnce reconstituted, the same peptide is far less stable. A solution is generally refrigerated and treated as having a much shorter usable window than the dry powder."
      },
      {
        "heading": "Temperature, Light And Moisture",
        "body": "Heat, light, oxygen, and moisture all degrade peptides. Many compounds are explicitly light-sensitive: methylcobalamin (vitamin B12) and melatonin are notable examples, and copper peptides are sensitive to pH and redox conditions. The default for nearly every entry is cold, dark, and dry.\n\nThiol-containing compounds add another wrinkle. Reduced glutathione oxidizes readily on contact with air, light, or metals and can develop a sulfurous odor as it degrades, so it is stored cold and reconstituted fresh."
      },
      {
        "heading": "Freeze-Thaw And Reconstituted Shelf Life",
        "body": "Repeated freeze-thaw cycles are a common cause of peptide damage. Several profiles, including SS-31 (elamipretide) and CJC-1295 with DAC, specifically warn to avoid freeze-thaw because each cycle can denature or aggregate the molecule. Note also that some formulated products, such as Zadaxin (Thymosin Alpha-1), should not be frozen at all once formulated.\n\nReconstituted shelf life is best thought of as a short window measured in days to a few weeks, refrigerated, and shorter still for chemically labile peptides that the profile flags as unstable in solution. Always defer to the specific compound's handling note, which captures these quirks per molecule."
      }
    ]
  },
  {
    "slug": "how-to-read-a-compound-monograph",
    "title": "How To Read A Compound Monograph",
    "intro": "Every compound in the library follows the same fixed schema so you can compare entries quickly. This guide walks through each section of a monograph and what it tells you.",
    "sections": [
      {
        "heading": "Identity And Mechanism",
        "body": "A monograph opens with the compound's class or type and an identity block: sequence, molecular weight, and a CAS number where one exists, plus common aliases. These identifiers let you verify what is in a vial against a certificate of analysis, and to catch labeling ambiguities the references flag for compounds such as Thymalin.\n\nThe mechanism section then describes the molecular target and how the compound is thought to operate, in plain prose. For example, SS-31 is described as binding cardiolipin in the inner mitochondrial membrane to stabilize cristae rather than acting as a free-radical scavenger."
      },
      {
        "heading": "What It Is Studied For And Reported Findings",
        "body": "What it is studied for lists research use cases, each carrying its own evidence tier so you can tell investigational human work from preclinical animal work. Reported findings then gives the benefits with study context, naming named trials such as STEP or SURMOUNT where they exist, and stating in-vitro versus animal versus human honestly.\n\nThese two sections are deliberately framed as studied for and researchers report, never as promises. A finding in cultured cells or mice is labeled as such."
      },
      {
        "heading": "Side Effects, Warnings And Handling",
        "body": "The reported side effects section is candid and unsoftened. Warnings and limitations carry the hard safety flags and the regulatory status, including not approved, failed trial, or preclinical where it applies. These are the lines to read first for any safety-sensitive compound, such as the opioid risk on dermorphin or the melanoma signal on Melanotan II.\n\nHandling, storage and reconstitution covers lyophilized versus solution state, diluent, temperature, light sensitivity, freeze-thaw, and shelf life."
      },
      {
        "heading": "Regulatory Status And Sources",
        "body": "The regulatory block states FDA or EMA status. The sources block lists the key references behind the profile, from peer-reviewed literature and regulatory labels to DrugBank and PubChem entries.\n\nRead a monograph top to bottom and the page is verifiable: you can check the identity against a CoA, the claims against the cited studies, and the status against current regulatory lists."
      }
    ]
  },
  {
    "slug": "quality-verification",
    "title": "Quality & Verification",
    "intro": "A research compound is only as good as the evidence that it is what the label says. This guide covers the documents and tests used to verify identity, purity, and safety of a peptide vial.",
    "sections": [
      {
        "heading": "The Certificate Of Analysis",
        "body": "A certificate of analysis (CoA) is the document that reports the testing performed on a specific lot of product. A useful CoA ties to a lot or batch number, states the methods used, and reports results you can check against the compound's known identity.\n\nBecause labeling ambiguities are real, the references flag cases such as Thymalin where a vendor may equate a complex with a single dipeptide. The CoA, read against the monograph's identity block, is how you catch that kind of mismatch."
      },
      {
        "heading": "Purity And Identity Testing",
        "body": "High-performance liquid chromatography (HPLC) is the standard method for assessing purity: it separates the components in a sample so that the main peptide can be quantified against impurities, usually reported as a percentage purity. Mass spectrometry confirms identity by measuring molecular mass, which should match the compound's stated molecular weight.\n\nTogether, HPLC and mass spec answer two different questions: how pure the sample is, and whether it is actually the molecule it claims to be. A high purity figure for the wrong molecule is still the wrong molecule."
      },
      {
        "heading": "Endotoxin, Sterility And Third-Party Testing",
        "body": "For preparations intended for sterile laboratory work, endotoxin (bacterial pyrogen) testing and sterility testing address contamination that HPLC and mass spec do not. These are particularly relevant for any aqueous or parenteral research preparation.\n\nThird-party testing, where an independent lab rather than the seller runs the assays, adds credibility because the tester has no incentive in the result. Independent verification carries more weight than an in-house claim alone."
      },
      {
        "heading": "Vial Verification",
        "body": "At the point of receipt, basic checks matter: confirm the lot number on the vial matches the CoA, that the labeled identity and quantity match what was ordered, and that the physical product matches expectations, such as the characteristic blue color of a copper-peptide complex like GHK-Cu.\n\nAppearance is a weak signal on its own, but a mismatch between vial, label, and CoA is a clear reason to stop and question the product before any research use."
      }
    ]
  },
  {
    "slug": "peptide-classes-overview",
    "title": "Peptide Classes Overview",
    "intro": "The library groups compounds into families that share a mechanism or origin. This guide gives a short orientation to each major class so you know where a compound sits.",
    "sections": [
      {
        "heading": "GHRH Analogs",
        "body": "Growth-hormone-releasing hormone (GHRH) analogs are synthetic agonists of the GHRH receptor on the pituitary, prompting it to release growth hormone. Examples in the catalog include CJC-1295, where a DAC modification binds albumin to extend the half-life to several days and produce sustained rather than pulsatile growth-hormone release. Most members of the growth-hormone-axis class are research chemicals, not approved drugs."
      },
      {
        "heading": "Growth-Hormone-Releasing Peptides And Secretagogues",
        "body": "Secretagogues such as the GHRP family and ipamorelin act mainly through the ghrelin and GH-secretagogue receptor rather than the GHRH receptor, providing a second, complementary pathway to stimulate growth-hormone release. They are often discussed alongside GHRH analogs because the two mechanisms are studied in combination. Like the GHRH analogs, these carry the general GH-axis caveats around glucose tolerance."
      },
      {
        "heading": "GLP-1 And Incretin Agonists",
        "body": "Incretin agonists mimic gut hormones such as GLP-1 (and in dual or triple agonists, GIP and glucagon) that regulate insulin secretion, appetite, and gastric emptying. This class includes the most rigorously trialed compounds in the catalog, with named human programs such as STEP and SURMOUNT behind several entries. Class-wide warnings include gastrointestinal side effects and a thyroid C-cell tumor signal observed in rodents, which belongs on every incretin page."
      },
      {
        "heading": "Copper Peptides",
        "body": "Copper peptides such as GHK-Cu (Copper Tripeptide-1) and AHK-Cu are small tripeptides that chelate and deliver copper into cells, where they are studied for collagen synthesis, wound repair, and hair-follicle signaling. GHK-Cu is a recognized cosmetic ingredient rather than an approved drug. They are pH and redox sensitive, degrade in contact with strong acids and reducing agents, and carry a pro-angiogenic caveat for any systemic use."
      },
      {
        "heading": "Peptide Bioregulators",
        "body": "Bioregulators are very short peptides, often two to four amino acids, associated with the Khavinson research tradition. Examples include Epithalon, Pinealon, and Thymalin, proposed to bind DNA and modulate gene expression in a tissue-specific way. The evidence is largely preliminary, frequently from a single research lineage and not independently replicated, and these are research chemicals not approved in the United States or European Union."
      },
      {
        "heading": "Melanocortins",
        "body": "Melanocortin peptides act on the melanocortin receptor family and are studied for pigmentation and sexual-function endpoints, with Melanotan II as the prototypical catalog example. This class carries notable safety flags that the library surfaces plainly, including a melanoma signal for Melanotan II. They are research chemicals without approval for the uses for which they are commonly studied."
      },
      {
        "heading": "Mitochondrial Peptides",
        "body": "Mitochondrial peptides target mitochondrial function and integrity. SS-31 (elamipretide) binds cardiolipin to stabilize the inner mitochondrial membrane and recently gained a narrow FDA approval for Barth syndrome, making it the strongest human evidence in its anti-aging-adjacent category, while remaining investigational for everything else. MOTS-c is a mitochondrial-derived peptide studied as a metabolic regulator."
      }
    ]
  }
];
