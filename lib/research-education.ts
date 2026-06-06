/**
 * Research education content for the PepNationLab data center: a plain-text
 * peptide glossary, a general peptide FAQ, and foundational learn guides.
 * Research-use-only framing throughout; nothing here is dosing or medical
 * advice. Pure data module (no imports) so it is safe in client or server
 * components.
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
    "def": "A short chain of amino acids linked by peptide bonds, generally smaller than a full protein. In research settings peptides are studied for their biological signaling and binding properties."
  },
  {
    "term": "Amino Acid",
    "def": "An organic molecule containing an amine and a carboxyl group that serves as the building block of peptides and proteins. Twenty standard amino acids combine in various sequences to form peptides."
  },
  {
    "term": "Peptide Bond",
    "def": "A covalent amide linkage formed between the carboxyl group of one amino acid and the amine group of the next. It is the bond that joins amino acids into a peptide chain."
  },
  {
    "term": "Sequence",
    "def": "The specific order of amino acids in a peptide, conventionally written from the N-terminus to the C-terminus. The sequence determines a peptide's structure and biological behavior."
  },
  {
    "term": "Molecular Weight",
    "def": "The mass of a single molecule, typically reported in daltons (Da) or grams per mole. It is used to characterize a peptide and to calculate molar concentrations in the laboratory."
  },
  {
    "term": "CAS Number",
    "def": "A unique numerical identifier assigned by the Chemical Abstracts Service to a specific chemical substance. It allows unambiguous reference to a compound across literature and databases."
  },
  {
    "term": "Lyophilized",
    "def": "Freeze-dried into a stable solid powder by removing water under vacuum. Lyophilized peptides are reconstituted with a sterile liquid before laboratory use."
  },
  {
    "term": "Reconstitution",
    "def": "The laboratory process of dissolving a lyophilized powder in a suitable sterile diluent to form a solution. Proper reconstitution yields a known concentration for research handling."
  },
  {
    "term": "Bacteriostatic Water",
    "def": "Sterile water containing a small amount of benzyl alcohol that inhibits bacterial growth. It is commonly used as a diluent for reconstituting research peptides intended for multiple withdrawals."
  },
  {
    "term": "Sterile Water",
    "def": "Purified water that has been processed to remove microorganisms and contains no added preservative. It is used as a diluent in laboratory preparation where a preservative is not desired."
  },
  {
    "term": "Acetic Acid Diluent",
    "def": "A dilute acetic acid solution used to dissolve peptides that are poorly soluble in neutral water. The mild acidity helps solubilize certain hydrophobic or aggregation-prone sequences."
  },
  {
    "term": "Diluent",
    "def": "Any sterile liquid used to dissolve or further dilute a substance to a desired concentration. Common peptide diluents include sterile water, bacteriostatic water, and dilute acetic acid."
  },
  {
    "term": "Subcutaneous",
    "def": "Referring to the tissue layer just beneath the skin. The term describes a route of administration studied in animal models and is used here only in a research-descriptive sense."
  },
  {
    "term": "Intramuscular",
    "def": "Referring to the interior of a muscle. The term describes an administration route used in preclinical and laboratory research contexts."
  },
  {
    "term": "Half-Life",
    "def": "The time required for the concentration of a substance in a system to decrease by one half. It is a key pharmacokinetic parameter describing how quickly a compound is cleared."
  },
  {
    "term": "Bioavailability",
    "def": "The fraction of an administered dose that reaches systemic circulation in an active form. It reflects how efficiently a compound is absorbed and survives initial metabolism."
  },
  {
    "term": "Pharmacokinetics",
    "def": "The study of how a substance is absorbed, distributed, metabolized, and excreted by a biological system over time. It describes what the body does to a compound."
  },
  {
    "term": "Agonist",
    "def": "A molecule that binds to a receptor and activates it to produce a biological response. Agonists mimic the action of the receptor's natural signaling molecule."
  },
  {
    "term": "Antagonist",
    "def": "A molecule that binds to a receptor and blocks or dampens its activation without triggering the usual response. Antagonists can prevent natural ligands from acting at that receptor."
  },
  {
    "term": "Receptor",
    "def": "A protein, typically on a cell surface or inside a cell, that binds a specific molecule and triggers a cellular response. Receptors are the targets through which peptides exert signaling effects."
  },
  {
    "term": "GHRH",
    "def": "Growth Hormone-Releasing Hormone, a hypothalamic peptide that stimulates the pituitary to release growth hormone. Several research peptides are structural analogs of GHRH."
  },
  {
    "term": "GHRP",
    "def": "Growth Hormone-Releasing Peptide, a class of synthetic peptides that stimulate growth hormone release by acting on the ghrelin receptor. GHRPs are studied as growth hormone secretagogues."
  },
  {
    "term": "GHS-R1a (Ghrelin Receptor)",
    "def": "The growth hormone secretagogue receptor subtype 1a, a G-protein-coupled receptor activated by ghrelin and by GHRP-class peptides. It mediates signaling related to growth hormone release and appetite."
  },
  {
    "term": "Secretagogue",
    "def": "A substance that stimulates a cell or gland to secrete a particular substance. Growth hormone secretagogues prompt the release of growth hormone from the pituitary."
  },
  {
    "term": "IGF-1",
    "def": "Insulin-like Growth Factor 1, a peptide hormone produced largely in the liver that mediates many downstream effects of growth hormone. It is widely studied as a marker of growth hormone activity."
  },
  {
    "term": "GLP-1",
    "def": "Glucagon-Like Peptide 1, an incretin hormone released from the gut that influences insulin secretion and appetite signaling. It is a focus of metabolic research and a target of many analog peptides."
  },
  {
    "term": "GIP",
    "def": "Glucose-Dependent Insulinotropic Polypeptide, an incretin hormone secreted by the gut that contributes to insulin release after nutrient intake. It is studied alongside GLP-1 in metabolic research."
  },
  {
    "term": "Incretin",
    "def": "A class of gut-derived hormones, including GLP-1 and GIP, that enhance insulin secretion in response to nutrients. Incretins are central to research on glucose regulation."
  },
  {
    "term": "Amylin",
    "def": "A peptide hormone co-secreted with insulin by pancreatic beta cells that influences satiety and the rate of nutrient entry into circulation. It is studied in metabolic and appetite research."
  },
  {
    "term": "Melanocortin",
    "def": "A family of signaling peptides derived from proopiomelanocortin that act on melanocortin receptors to influence pigmentation, energy balance, and other processes. They are studied across several physiological systems."
  },
  {
    "term": "MC1R",
    "def": "Melanocortin 1 Receptor, a receptor expressed largely in pigment-producing cells that regulates melanin synthesis. It is a target of interest in pigmentation research."
  },
  {
    "term": "MC4R",
    "def": "Melanocortin 4 Receptor, a receptor in the central nervous system involved in the regulation of appetite and energy balance. It is a key target in metabolic and weight-related research."
  },
  {
    "term": "Telomerase",
    "def": "An enzyme that adds repetitive DNA sequences to the ends of chromosomes, counteracting their shortening during cell division. It is studied extensively in research on cellular aging."
  },
  {
    "term": "Telomere",
    "def": "A repetitive DNA cap at the end of a chromosome that protects it from degradation and progressively shortens with cell division. Telomere length is a widely studied marker in aging research."
  },
  {
    "term": "Senolytic",
    "def": "A compound studied for its ability to selectively clear senescent cells from tissue. Senolytics are an active area of aging and longevity research."
  },
  {
    "term": "Senescence",
    "def": "A state in which a cell permanently stops dividing while remaining metabolically active, often accumulating with age. Cellular senescence is a major focus of longevity research."
  },
  {
    "term": "Mitochondria",
    "def": "Membrane-bound organelles that generate most of a cell's chemical energy and regulate metabolism and cell signaling. They are central to research on energy production and aging."
  },
  {
    "term": "Cardiolipin",
    "def": "A distinctive phospholipid found primarily in the inner mitochondrial membrane that is important for mitochondrial structure and function. It is a target of interest in mitochondrial research."
  },
  {
    "term": "Mitophagy",
    "def": "The selective cellular process of identifying and degrading damaged or surplus mitochondria. It is studied as a key mechanism of cellular quality control and aging."
  },
  {
    "term": "Angiogenesis",
    "def": "The biological process of forming new blood vessels from pre-existing ones. It is studied in contexts ranging from tissue repair to disease research."
  },
  {
    "term": "Pro-Angiogenic",
    "def": "Describing a factor or condition that promotes the formation of new blood vessels. Pro-angiogenic signaling is studied in wound and tissue research."
  },
  {
    "term": "Cytokine",
    "def": "A small signaling protein released by cells to coordinate immune responses and intercellular communication. Cytokines regulate inflammation, growth, and many other processes."
  },
  {
    "term": "Peptide Bioregulator",
    "def": "A short peptide proposed in research to influence the activity of specific tissues or gene expression. Bioregulators are studied primarily in the context of cellular function and aging."
  },
  {
    "term": "Nootropic",
    "def": "A substance studied for potential effects on cognitive processes such as memory or attention. The term is descriptive and carries no therapeutic claim in a research setting."
  },
  {
    "term": "Anxiolytic",
    "def": "Describing a substance investigated for effects related to reducing anxiety-like behavior in research models. The term is used descriptively and implies no medical use."
  },
  {
    "term": "Lipolysis",
    "def": "The metabolic breakdown of stored fats into fatty acids and glycerol. It is a process studied in research on energy metabolism and body composition."
  },
  {
    "term": "Lipotropic",
    "def": "Describing a substance studied for its role in the metabolism or transport of fats within the body. Lipotropic agents are examined in metabolic research."
  },
  {
    "term": "Certificate Of Analysis (COA)",
    "def": "A document issued by a laboratory reporting the testing results and specifications for a specific product batch. A COA typically documents identity, purity, and quality data."
  },
  {
    "term": "HPLC",
    "def": "High-Performance Liquid Chromatography, an analytical technique that separates the components of a mixture to assess identity and purity. It is a standard method for evaluating peptide purity."
  },
  {
    "term": "Mass Spectrometry",
    "def": "An analytical technique that measures the mass-to-charge ratio of molecules to confirm identity and molecular weight. It is commonly paired with HPLC to verify peptide structure."
  },
  {
    "term": "Endotoxin",
    "def": "A heat-stable component of the outer membrane of certain bacteria that can provoke strong biological responses. Endotoxin levels are a key purity and safety metric for laboratory materials."
  },
  {
    "term": "Sterile Filtration",
    "def": "A purification step that passes a liquid through a fine membrane, typically 0.22 micron, to remove microorganisms. It is used to render solutions free of viable contaminants."
  },

  {
    "term": "Research Use Only",
    "def": "A designation indicating a product is intended solely for laboratory research and not for human or veterinary use, diagnosis, or treatment. It signals that the material is not approved for clinical application."
  },
  {
    "term": "In Vitro",
    "def": "Describing experiments performed outside a living organism, such as in test tubes, dishes, or cell cultures. In vitro studies isolate biological processes in a controlled environment."
  },
  {
    "term": "In Vivo",
    "def": "Describing experiments conducted within a living organism, such as in animal models. In vivo studies capture effects within the complexity of a whole biological system."
  },
  {
    "term": "Preclinical",
    "def": "Referring to the research stage that precedes human studies, typically involving laboratory and animal experiments. Preclinical work evaluates a compound's properties before any clinical testing."
  },
  {
    "term": "Investigational",
    "def": "Describing a compound that is under research study and has not been approved for general use. The term denotes experimental status rather than an established application."
  },
  {
    "term": "Freeze-Thaw",
    "def": "A cycle of freezing a sample and then warming it back to a usable temperature. Repeated freeze-thaw cycles can degrade peptides, so minimizing them helps preserve sample integrity."
  },
  {
    "term": "Cold Chain",
    "def": "The uninterrupted series of temperature-controlled storage and transport conditions used to keep a sensitive product within its required range. Maintaining the cold chain helps preserve peptide stability."
  },
  {
    "term": "N-Terminus",
    "def": "The end of a peptide chain that carries a free amine group, conventionally written first when listing a sequence. It marks the starting point of the amino acid order."
  },
  {
    "term": "C-Terminus",
    "def": "The end of a peptide chain that carries a free carboxyl group, conventionally written last in a sequence. It marks the terminal point of the amino acid order."
  },
  {
    "term": "Purity",
    "def": "The proportion of a sample that consists of the intended compound, usually expressed as a percentage and assessed by methods such as HPLC. Higher purity indicates fewer contaminating substances."
  },
  {
    "term": "Aliquot",
    "def": "A measured portion of a larger sample divided out for separate handling or storage. Dividing a reconstituted solution into aliquots helps avoid repeated freeze-thaw cycles."
  }
];

export const PEPTIDE_FAQ: FaqEntry[] = [
  {
    "category": "Basics",
    "q": "Are These Products For Human Use?",
    "a": "No. Everything in this catalog is sold for laboratory research use only. These materials are not drugs, supplements, foods, or cosmetics, and they are not intended for human or veterinary use, diagnosis, or treatment. Nothing in this library should be read as authorization or encouragement to administer any compound to a person or animal."
  },
  {
    "category": "Basics",
    "q": "What Does Research Use Only Mean?",
    "a": "Research use only means a material is intended solely for in vitro or laboratory investigation by qualified personnel, not for clinical, therapeutic, or consumer applications. It is a regulatory and labeling status, not a quality grade, and it carries no implied promise of safety or efficacy in humans."
  },
  {
    "category": "Basics",
    "q": "What Is A Peptide?",
    "a": "A peptide is a short chain of amino acids linked by peptide bonds, generally smaller than a full protein. Many are sequences that mimic or modulate naturally occurring signaling molecules, which is why they are studied as biochemical tools. The library describes them as research targets, not as products to be consumed."
  },
  {
    "category": "Basics",
    "q": "What Is The Difference Between A Peptide And A Protein?",
    "a": "The distinction is largely one of size and convention. Peptides are generally defined as chains of roughly fifty amino acids or fewer, while larger folded chains are called proteins. The boundary is not rigid, and some larger research peptides sit near the threshold."
  },
  {
    "category": "Basics",
    "q": "What Is A GLP-1 Receptor Agonist?",
    "a": "A GLP-1 receptor agonist is a compound that binds and activates the glucagon-like peptide-1 receptor, a target studied extensively in metabolic and glucose-regulation research. Several approved drugs in this class exist, and related research compounds are studied preclinically and investigationally. In this library such compounds are presented only as research targets with honest evidence framing."
  },
  {
    "category": "Basics",
    "q": "What Are Copper Peptides?",
    "a": "Copper peptides are short peptide sequences complexed with a copper ion, the best known being GHK-Cu. They have been studied in the context of skin, wound, and tissue biology, and some appear in cosmetic formulations. Within this catalog they are described as research materials, and cosmetic-tier status does not imply suitability for personal use."
  },
  {
    "category": "Basics",
    "q": "What Is A Growth-Hormone Secretagogue?",
    "a": "A growth-hormone secretagogue is a compound studied for its ability to stimulate the release of endogenous growth hormone, often by acting on the ghrelin or GHRH pathways. This group includes peptides investigated in both preclinical and clinical research settings. The library frames them by what studies report, never as agents to administer."
  },
  {
    "category": "Handling & Preparation",
    "q": "What Does Lyophilized Mean?",
    "a": "Lyophilized means freeze-dried: the peptide has been frozen and had its water removed under vacuum, leaving a dry powder or pellet. This form is more stable for storage and shipping than a solution. The visible amount in a vial can look very small because lyophilized mass is often a tiny fraction of the vial volume."
  },
  {
    "category": "Handling & Preparation",
    "q": "How Is A Lyophilized Peptide Reconstituted In The Lab?",
    "a": "In general laboratory practice, a lyophilized peptide is returned to solution by adding a compatible diluent slowly down the side of the vial and allowing it to dissolve without vigorous shaking. The choice of diluent and volume depends on the peptide's solubility and the intended study concentration. This library describes reconstitution only as a general bench concept and provides no human dosing instructions."
  },
  {
    "category": "Handling & Preparation",
    "q": "What Is Bacteriostatic Water?",
    "a": "Bacteriostatic water is sterile water containing a small amount of benzyl alcohol, which inhibits bacterial growth and allows a reconstituted vial to be accessed over time in laboratory settings. It is a common general-purpose diluent for peptides that are soluble in neutral aqueous solution. It is referenced here only as lab-reagent context, not as part of any administration protocol."
  },
  {
    "category": "Handling & Preparation",
    "q": "What Is Acetic Acid Diluent And Why Do Some Peptides Need It?",
    "a": "A dilute acetic acid solution is sometimes used as a diluent because certain peptides are poorly soluble in neutral water and dissolve more readily under mildly acidic conditions. Hydrophobic or aggregation-prone sequences are common examples where a bench protocol may call for acidic solubilization. The appropriate diluent is a chemistry property of the specific peptide and is provided as reference information only."
  },
  {
    "category": "Handling & Preparation",
    "q": "Why Should A Reconstituted Vial Not Be Shaken Vigorously?",
    "a": "Vigorous shaking can introduce mechanical shear and foaming that may denature or aggregate sensitive peptides, reducing the integrity of the sample. General lab practice favors gentle swirling or letting the powder dissolve undisturbed. This is standard reagent-handling guidance, not instruction for any human application."
  },
  {
    "category": "Storage & Stability",
    "q": "How Should Lyophilized Peptides Be Stored?",
    "a": "Lyophilized peptides are generally most stable when kept cold, dry, and protected from light, often refrigerated for shorter periods and frozen for longer-term storage. Keeping the vial sealed and away from moisture helps preserve the dry powder. Always follow the specific storage note on the compound monograph and certificate of analysis."
  },
  {
    "category": "Storage & Stability",
    "q": "How Should Reconstituted Peptides Be Stored?",
    "a": "Once a peptide is in solution it is generally less stable than the dry form and is typically kept refrigerated and protected from light. Solutions are usually intended for use within a limited window rather than indefinite storage. The exact handling depends on the peptide and the diluent used, so consult the monograph."
  },
  {
    "category": "Storage & Stability",
    "q": "How Long Is A Reconstituted Vial Good For?",
    "a": "There is no single universal answer; stability in solution varies widely by sequence, diluent, temperature, and light exposure. As a general concept, reconstituted peptides have a far shorter usable shelf life than their lyophilized form, often measured in days to a few weeks under refrigeration. Any specific stability window should come from the manufacturer data or published stability studies for that compound."
  },
  {
    "category": "Storage & Stability",
    "q": "What Does Freeze-Thaw Do To A Peptide?",
    "a": "Repeated freezing and thawing can degrade peptides through aggregation, hydrolysis, and concentration shifts at the ice boundary, lowering sample quality. To limit this, labs commonly divide a reconstituted solution into single-use aliquots before freezing so each is thawed only once. This is standard sample-preservation practice for research materials."
  },
  {
    "category": "Storage & Stability",
    "q": "Why Are Some Peptides Sensitive To Light And Air?",
    "a": "Certain amino acid residues, such as methionine, cysteine, and tryptophan, are prone to oxidation, and some sequences are sensitive to light, so exposure can degrade them over time. Minimizing headspace, limiting light, and keeping samples cold are common ways labs slow this degradation. The monograph flags when a compound is especially sensitive."
  },
  {
    "category": "Safety & Compliance",
    "q": "Why Do You Surface Side Effects And Warnings If These Are Not For Human Use?",
    "a": "We surface documented adverse effects and warnings from the scientific and regulatory literature so researchers have an honest, complete picture of a compound's known risk profile. Transparent hazard information supports safe laboratory handling and sound research judgment. It is reference material and is not an endorsement of human use in any form."
  },

  {
    "category": "Safety & Compliance",
    "q": "Can These Compounds Be Resold Or Redistributed For Human Use?",
    "a": "No. These materials are supplied strictly as research reagents, and reselling or repackaging them for human consumption, therapy, or supplementation is outside their intended use and may violate applicable law. Buyers are responsible for complying with all regulations that apply to research materials in their jurisdiction. The research-only designation travels with the product."
  },
  {
    "category": "Safety & Compliance",
    "q": "Do You Provide Dosing Or Treatment Protocols?",
    "a": "No. This library does not provide human dosing, cycling, injection, or treatment protocols of any kind. Where a quantity from a published trial is mentioned, it is cited only as a labeled study parameter to describe what researchers reported, never as a recommendation. For any health question, consult a licensed medical professional."
  },
  {
    "category": "Evidence & Sourcing",
    "q": "What Is A Certificate Of Analysis And HPLC Purity?",
    "a": "A certificate of analysis is a document from the manufacturer or testing lab that reports identity and quality data for a specific batch, often including mass spectrometry identity and HPLC purity. HPLC purity, expressed as a percentage, estimates how much of the sample is the intended peptide versus impurities, based on high-performance liquid chromatography. Reviewing the COA is standard practice for verifying what a research material actually contains."
  },
  {
    "category": "Evidence & Sourcing",
    "q": "What Does The Evidence Tier Mean?",
    "a": "The evidence tier is an honest label for how much human and scientific data backs a compound, ranging from approved drug (authorized by a regulator for a defined indication) to investigational (in clinical trials), preclinical (animal or cell data only), research compound (limited or early data), and cosmetic (topical or formulation context). Higher tiers reflect more rigorous evidence, not an invitation to use the material. The tier is about data maturity, not about safety in any individual."
  },
  {
    "category": "Evidence & Sourcing",
    "q": "Does A Higher Evidence Tier Mean A Compound Is Safe?",
    "a": "No. An evidence tier describes the depth and quality of available research, not a guarantee of safety for any person or use. Even approved-drug compounds carry documented risks and are only safe within a supervised medical context that this library does not provide. We present the tier so researchers can weigh claims against the actual strength of the data."
  },
  {
    "category": "Using This Library",
    "q": "How Do I Read A Compound Monograph And Use The Search?",
    "a": "Each compound monograph summarizes what a peptide is, what it has been studied for, its evidence tier, handling and storage notes, and documented warnings, with research-use framing throughout. You can use the search to find a compound by name, sequence family, research area, or even a goal, then open its monograph for the full reference. The goal is to give researchers organized, honestly framed information, not usage instructions."
  },
  {
    "category": "Using This Library",
    "q": "Can I Get Information On A Peptide You Do Not Sell?",
    "a": "The library focuses on compounds in our catalog, but general reference entries and the glossary may cover well-studied peptides and terms even when they are not available for purchase. If a compound is not listed, you can still rely on primary literature and manufacturer data from reputable sources for background. We do not provide custom acquisition or usage guidance for materials outside our research catalog."
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
