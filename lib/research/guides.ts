/**
 * guides.ts
 * Editorial research-guide library. Authored, long-form, RUO-compliant content
 * designed for answer-engine citation (ChatGPT, Claude, Perplexity, Google AI
 * Overviews) and organic search. Each guide renders with Article JSON-LD
 * (headline, author, datePublished, dateModified, image, publisher).
 *
 * COMPLIANCE: every guide is informational and framed strictly around in vitro
 * Research-Use-Only context. No human-use, dosing, or therapeutic guidance.
 */

export interface GuideSection {
  heading: string;        // H2
  paragraphs: string[];   // prose
  bullets?: string[];     // optional list
}

export interface Guide {
  slug: string;
  title: string;          // H1 / headline
  description: string;    // meta description + article summary
  datePublished: string;  // ISO date
  dateModified: string;   // ISO date
  readingTimeMin: number;
  keywords: string[];
  intro: string;
  sections: GuideSection[];
  keyTakeaways: string[]; // dense, quotable summary for AEO
  related: string[];      // slugs of related guides
  compounds?: { name: string; slug: string }[];  // linked compound monographs
  howTo?: {
    name: string;
    description: string;
    steps: { name: string; text: string }[];
  };
}

const AUTHOR = 'Pep Nation Lab Research Desk';

export const GUIDES: Guide[] = [
  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'what-research-use-only-means',
    title: 'What "Research Use Only" Means For Peptides',
    description:
      'A plain-language explanation of the Research Use Only (RUO) designation for peptides: what it covers, why it exists, and how it differs from FDA-approved pharmaceuticals.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 5,
    keywords: ['research use only', 'RUO peptides', 'in vitro research', 'FDA', 'research peptides'],
    intro:
      'Research Use Only, usually abbreviated RUO, is a regulatory and labeling designation that appears on many laboratory reagents, including research peptides. It signals that a product is intended exclusively for in vitro scientific investigation and has not been evaluated or approved for use in humans or animals. Understanding the RUO designation is essential for any researcher sourcing compounds, because it defines both the legal boundaries and the appropriate handling of the material.',
    sections: [
      {
        heading: 'What The RUO Designation Actually Covers',
        paragraphs: [
          'A Research Use Only product is sold for laboratory experimentation only, such as analytical assays, cell-culture studies, receptor-binding work, and instrument calibration. The designation is a statement of intended use: the manufacturer or distributor represents that the compound is supplied for research, not for diagnosis, treatment, or consumption.',
          'Because RUO products are not FDA-approved drugs, they are not manufactured, tested, or documented against the clinical standards that govern pharmaceuticals. They are reagents. That distinction is the single most important thing a researcher needs to internalize when handling them.',
        ],
      },
      {
        heading: 'Why The Designation Exists',
        paragraphs: [
          'The RUO framework lets scientists access novel and established compounds for legitimate research long before, or entirely apart from, any clinical-approval pathway. Many peptides that are widely studied in laboratories have never been submitted for human-use approval, and may never be. RUO status is what makes early-stage and exploratory research possible.',
          'It also creates a clear compliance line. A product labeled and sold as RUO carries an explicit representation that it is not for human or animal use, which protects both the supplier and the researcher when the material is handled appropriately.',
        ],
      },
      {
        heading: 'RUO Versus FDA-Approved Pharmaceuticals',
        paragraphs: [
          'An FDA-approved pharmaceutical peptide has passed defined manufacturing, safety, and efficacy requirements for a specific human indication. A research peptide has not. The chemical name may be identical, but the regulatory category, documentation, and permitted use are entirely different.',
        ],
        bullets: [
          'Research peptides are reagents for in vitro laboratory work; pharmaceuticals are approved medical products.',
          'Research peptides ship with a Certificate of Analysis, not a drug label or prescribing information.',
          'Research peptides are not for human or animal consumption, ingestion, or injection.',
          'Responsibility for lawful, appropriate handling rests with the qualified researcher.',
        ],
      },
      {
        heading: 'Handling RUO Peptides Responsibly',
        paragraphs: [
          'Qualified researchers treat RUO peptides the way they would any laboratory reagent: with appropriate protective equipment, documented storage, and disposal in line with institutional and local rules. The RUO designation is not a technicality to work around; it defines the entire context in which the compound may be used.',
        ],
      },
    ],
    keyTakeaways: [
      'Research Use Only (RUO) means a product is for in vitro laboratory research only, not for human or animal use.',
      'RUO peptides are reagents, not FDA-approved drugs, even when the chemical name matches a pharmaceutical.',
      'RUO products ship with a Certificate of Analysis rather than a drug label.',
      'The qualified researcher is responsible for lawful, appropriate handling.',
    ],
    related: ['research-vs-pharmaceutical-peptides', 'how-to-read-a-certificate-of-analysis'],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'how-to-read-a-certificate-of-analysis',
    title: 'How To Read A Peptide Certificate Of Analysis (COA)',
    description:
      'A field guide to the Certificate of Analysis that accompanies research peptides: what purity, mass spectrometry, HPLC, and identity data mean, and how to verify a COA.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 6,
    keywords: ['certificate of analysis', 'COA', 'peptide purity', 'HPLC', 'mass spectrometry', 'research peptides'],
    intro:
      'A Certificate of Analysis, or COA, is the primary quality document that should accompany any research peptide. It reports the analytical testing performed on a specific batch and lets a researcher confirm the identity and purity of the material before it is used. Reading a COA correctly is a core competency for anyone working with research compounds.',
    sections: [
      {
        heading: 'Batch And Identity Information',
        paragraphs: [
          'Every COA is tied to a specific batch or lot number. The document should state the compound name, the batch identifier, the molecular formula, and the theoretical molecular weight. The batch number is what links the certificate to the physical vial in your hands; a COA that cannot be matched to a batch is of limited value.',
        ],
      },
      {
        heading: 'Purity By HPLC',
        paragraphs: [
          'High-Performance Liquid Chromatography (HPLC) is the standard method for reporting peptide purity. The COA typically lists a purity percentage, often expressed as area-under-the-curve at a specified wavelength. A chromatogram may be included, showing a dominant peak for the target compound and any minor peaks representing impurities.',
          'Higher purity is generally preferable for research reproducibility, though the acceptable threshold depends on the intended experiment. What matters is that the number is reported, the method is stated, and a chromatogram supports the claim.',
        ],
      },
      {
        heading: 'Identity By Mass Spectrometry',
        paragraphs: [
          'Mass spectrometry (MS) confirms the identity of the peptide by measuring its molecular mass. The COA compares the observed mass against the theoretical mass calculated from the sequence. A close match confirms that the synthesized compound is the intended molecule, not a different or incorrectly assembled sequence.',
        ],
      },
      {
        heading: 'What To Check Before Trusting A COA',
        paragraphs: [
          'A credible COA is specific, method-referenced, and batch-linked. Treat a certificate with caution if it lacks any of the following.',
        ],
        bullets: [
          'A batch or lot number that matches the vial.',
          'A stated purity figure with the analytical method named (for example, HPLC at a given wavelength).',
          'A mass spectrometry result comparing observed versus theoretical mass.',
          'Supporting chromatograms or spectra rather than a bare summary number.',
          'The testing party identified, ideally an independent or third-party laboratory.',
        ],
      },
    ],
    keyTakeaways: [
      'A Certificate of Analysis (COA) reports the analytical testing on a specific peptide batch.',
      'HPLC reports purity; mass spectrometry confirms identity against the theoretical molecular weight.',
      'A trustworthy COA is batch-linked, method-referenced, and supported by chromatograms or spectra.',
      'Always match the COA batch number to the physical vial before relying on the data.',
    ],
    related: ['what-research-use-only-means', 'peptide-storage-and-reconstitution'],
    howTo: {
      name: 'How to verify a Certificate of Analysis (COA) for a research peptide',
      description: 'A step-by-step process for reviewing and verifying the purity and identity data on a peptide COA before use in vitro.',
      steps: [
        { name: 'Match the Batch Number', text: 'Ensure the batch or lot number stated on the COA perfectly matches the identifier printed on the physical vial.' },
        { name: 'Check HPLC Purity', text: 'Look for a stated purity percentage determined by High-Performance Liquid Chromatography (HPLC) and verify it is supported by a chromatogram.' },
        { name: 'Verify Mass Identity', text: 'Review the mass spectrometry (MS) result to confirm the observed mass matches the theoretical mass calculated from the peptide sequence.' },
        { name: 'Confirm Third-Party Testing', text: 'Check if the testing was performed and validated by an independent or accredited third-party analytical laboratory.' }
      ]
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'peptide-storage-and-reconstitution',
    title: 'Research Peptide Storage, Reconstitution, And Handling',
    description:
      'General laboratory principles for storing, reconstituting, and handling lyophilized research peptides to preserve stability and integrity for in vitro work.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 6,
    keywords: ['peptide storage', 'reconstitution', 'lyophilized peptide', 'peptide stability', 'research handling'],
    intro:
      'Research peptides are typically supplied as a lyophilized (freeze-dried) powder because the dry state is far more stable than a solution. Preserving that stability through storage, reconstitution, and handling is what keeps a compound suitable for reproducible in vitro research. This guide covers the general laboratory principles, framed strictly for research handling.',
    sections: [
      {
        heading: 'Storing Lyophilized Peptides',
        paragraphs: [
          'In their dry, lyophilized form, most research peptides are relatively stable and are commonly stored cold. Short holding periods are often managed at refrigerator temperatures, while longer-term storage typically uses a freezer. Protecting the powder from moisture and repeated temperature swings is the central goal, because water and thermal cycling are the main drivers of degradation.',
        ],
      },
      {
        heading: 'Reconstitution Principles',
        paragraphs: [
          'Reconstitution is the process of dissolving the lyophilized powder into a suitable solvent for laboratory use. The choice of solvent depends on the chemistry of the specific peptide; some dissolve readily in water-based solvents, while more hydrophobic sequences may require different approaches documented in the research literature.',
          'Gentle handling matters. Directing solvent slowly down the side of the vial and allowing the peptide to dissolve without vigorous agitation helps protect the molecule. Once in solution, peptides are generally less stable than in the dry state and are handled accordingly.',
        ],
      },
      {
        heading: 'Minimizing Degradation In Solution',
        paragraphs: [
          'A reconstituted peptide is more vulnerable to hydrolysis, oxidation, and microbial contamination than the dry powder. Researchers commonly limit the time a compound spends in solution, keep it cold while in use, and consider aliquoting to avoid repeated freeze-thaw cycles that can degrade the material.',
        ],
        bullets: [
          'Keep the lyophilized powder dry and cold; avoid repeated temperature cycling.',
          'Reconstitute gently with a solvent appropriate to the specific peptide.',
          'Minimize time in solution and keep solutions cold during use.',
          'Aliquot where practical to avoid repeated freeze-thaw cycles.',
        ],
      },
      {
        heading: 'A Note On Scope',
        paragraphs: [
          'These are general laboratory principles for handling research reagents. Specific solvent choices, concentrations, and storage windows vary by compound and should be drawn from the peer-reviewed literature and the material documentation. All handling is for in vitro research only.',
        ],
      },
    ],
    keyTakeaways: [
      'Lyophilized (freeze-dried) research peptides are stored cold and kept dry for stability.',
      'Reconstitution dissolves the powder in a solvent appropriate to the specific peptide, handled gently.',
      'Peptides in solution degrade faster than the dry powder, so time in solution and freeze-thaw cycles are minimized.',
      'Storage and reconstitution details are compound-specific and for in vitro research only.',
    ],
    related: ['how-to-read-a-certificate-of-analysis', 'what-research-use-only-means'],
    howTo: {
      name: 'How to store and reconstitute lyophilized research peptides',
      description: 'General laboratory principles for preserving stability during storage and properly reconstituting peptide powders for in vitro research.',
      steps: [
        { name: 'Store the Lyophilized Powder', text: 'Keep the dry, lyophilized peptide powder in a cold, dry environment (refrigerator for short-term, freezer for long-term) and avoid repeated temperature cycling.' },
        { name: 'Select the Solvent', text: 'Choose a reconstitution solvent appropriate for the specific peptide\'s chemistry, as documented in peer-reviewed literature.' },
        { name: 'Reconstitute Gently', text: 'Direct the solvent slowly down the side of the vial and allow the peptide to dissolve without vigorous agitation.' },
        { name: 'Minimize Time in Solution', text: 'Once dissolved, keep the solution cold during use, limit its time in solution, and aliquot if necessary to prevent freeze-thaw degradation.' }
      ]
    },
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'research-vs-pharmaceutical-peptides',
    title: 'Research Peptides vs. Pharmaceutical Peptides: The Regulatory Distinction',
    description:
      'How research-grade peptides differ from pharmaceutical peptides in regulation, manufacturing, documentation, and permitted use, even when the chemical name is identical.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 5,
    keywords: ['research peptides', 'pharmaceutical peptides', 'FDA approval', 'GMP', 'research grade', 'regulatory'],
    intro:
      'A recurring point of confusion is that a research peptide and a pharmaceutical peptide can share the same chemical name yet occupy completely different regulatory categories. The name describes the molecule; the category describes how it is made, documented, and permitted to be used. This guide draws that line clearly.',
    sections: [
      {
        heading: 'Same Molecule, Different Category',
        paragraphs: [
          'Chemically, a peptide is defined by its amino-acid sequence. Two products with the same sequence are the same molecule. But a pharmaceutical is far more than a molecule: it is a molecule plus an approved manufacturing process, a defined indication, safety and efficacy data, and regulated labeling. A research peptide is the molecule supplied as a laboratory reagent, without that clinical apparatus.',
        ],
      },
      {
        heading: 'Manufacturing And Documentation',
        paragraphs: [
          'Pharmaceutical peptides are produced under clinical manufacturing standards and accompanied by prescribing information. Research peptides are produced for laboratory use and accompanied by a Certificate of Analysis that reports batch identity and purity. Both can be high quality within their category, but they are documented against different standards for different purposes.',
        ],
      },
      {
        heading: 'Permitted Use',
        paragraphs: [
          'This is the decisive difference. A pharmaceutical is approved for a specific human use. A research peptide is for in vitro laboratory research only and is not for human or animal consumption, ingestion, or injection. Using a research reagent as though it were an approved medicine ignores the category it belongs to and the documentation it lacks.',
        ],
        bullets: [
          'Same sequence does not mean same regulatory status.',
          'Pharmaceuticals carry approval, indications, and prescribing information; research peptides carry a COA.',
          'Research peptides are strictly for in vitro laboratory research.',
          'Category, not chemical name, determines how a product may lawfully be used.',
        ],
      },
    ],
    keyTakeaways: [
      'A research peptide and a pharmaceutical peptide can share a chemical name but occupy different regulatory categories.',
      'Pharmaceuticals carry approval, indications, and prescribing information; research peptides carry a Certificate of Analysis.',
      'Research peptides are for in vitro laboratory research only, never for human or animal use.',
      'Permitted use is determined by regulatory category, not by the chemical name.',
    ],
    related: ['what-research-use-only-means', 'how-to-read-a-certificate-of-analysis'],
    compounds: [{ name: 'Semaglutide', slug: 'semaglutide' }, { name: 'Tirzepatide', slug: 'tirzepatide' }],
  },
  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'understanding-peptide-purity',
    title: 'Understanding Peptide Purity In Research',
    description:
      'What peptide purity means, how HPLC and mass spectrometry quantify it, why net peptide content differs from chromatographic purity, and why it matters for reproducible research.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 6,
    keywords: ['peptide purity', 'HPLC purity', 'net peptide content', 'mass spectrometry', 'research reproducibility'],
    intro:
      'Purity is one of the most important quality attributes of a research peptide, yet it is frequently misunderstood. A single percentage on a label can describe different things depending on the method behind it. This guide explains what purity means in a research context, how it is measured, and why the distinction between chromatographic purity and net peptide content matters for reproducible work.',
    sections: [
      {
        heading: 'Chromatographic Purity Versus Net Peptide Content',
        paragraphs: [
          'Chromatographic purity, usually reported by HPLC, describes the proportion of the target peptide relative to other peptide-related impurities in the sample. Net peptide content is a different measurement: it describes how much of the total dry mass is actually peptide, versus water, counter-ions, and residual salts left over from synthesis.',
          'A vial can be high in chromatographic purity yet contain a meaningful fraction of non-peptide mass. Both numbers describe real, useful things - they simply answer different questions, and a rigorous researcher reads them together rather than treating a single figure as the whole story.',
        ],
      },
      {
        heading: 'How Purity Is Measured',
        paragraphs: [
          'HPLC separates the components of a sample so the target peak can be quantified against impurity peaks. Mass spectrometry confirms that the main peak is the intended molecule by matching its measured mass to the theoretical mass. Together, HPLC and MS answer the two core questions: how pure is it, and is it the right compound.',
        ],
        bullets: [
          'HPLC: proportion of target peptide versus peptide-related impurities.',
          'Mass spectrometry: confirmation of molecular identity by mass.',
          'Net peptide content: fraction of dry mass that is peptide, not salt or water.',
        ],
      },
      {
        heading: 'Why It Matters For Reproducibility',
        paragraphs: [
          'Inconsistent purity introduces uncontrolled variables into research. Two batches with different impurity profiles or different net peptide content can produce different results even when nominally identical. This is why documented, batch-specific purity data - not a generic claim - is what supports reproducible experimental design.',
        ],
      },
    ],
    keyTakeaways: [
      'Chromatographic purity (HPLC) and net peptide content measure different things and should be read together.',
      'Mass spectrometry confirms identity; HPLC quantifies purity.',
      'A high purity percentage can still accompany significant non-peptide mass (salt, water).',
      'Batch-specific purity documentation is what supports reproducible research.',
    ],
    related: ['how-to-read-a-certificate-of-analysis', 'how-research-peptides-are-synthesized'],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'peptide-research-areas-explained',
    title: 'Peptide Research Areas Explained',
    description:
      'An overview of the major research areas peptides are studied in - metabolic, tissue repair and recovery, growth and longevity, cognitive, and skin and cosmetic science.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 5,
    keywords: ['peptide research areas', 'metabolic research', 'tissue repair', 'longevity peptides', 'cognitive peptides'],
    intro:
      'Research peptides are studied across a wide range of scientific areas. Grouping compounds by research area helps researchers navigate a large catalog and understand where a given peptide sits in the broader literature. This guide summarizes the major areas, framed strictly around in vitro and preclinical research context.',
    sections: [
      {
        heading: 'Metabolic Research',
        paragraphs: [
          'This area includes the widely studied incretin-related compounds such as Semaglutide and Tirzepatide, investigated in the context of metabolic regulation and energy balance. It is one of the most active areas in current peptide research literature.',
        ],
      },
      {
        heading: 'Tissue Repair And Recovery',
        paragraphs: [
          'Compounds like BPC-157 and TB-500 are studied for their roles in cellular repair, angiogenesis, and tissue-regeneration research models. This area draws significant interest from researchers focused on recovery mechanisms.',
        ],
      },
      {
        heading: 'Growth, Longevity, And Other Areas',
        paragraphs: [
          'Growth hormone secretagogues such as Ipamorelin and CJC-1295 are studied for growth-axis signaling. Longevity-focused compounds like Epithalon are studied in aging models. Additional areas include cognitive research and skin and cosmetic science, where copper peptides such as GHK-Cu are studied for collagen and wound-healing pathways.',
        ],
        bullets: [
          'Metabolic: Semaglutide, Tirzepatide, Retatrutide.',
          'Tissue repair and recovery: BPC-157, TB-500.',
          'Growth and longevity: Ipamorelin, CJC-1295, Sermorelin, Epithalon.',
          'Skin and cosmetic: GHK-Cu.',
        ],
      },
    ],
    keyTakeaways: [
      'Research peptides are grouped by research area to navigate a large catalog.',
      'Major areas include metabolic, tissue repair and recovery, growth and longevity, cognitive, and skin and cosmetic science.',
      'Each area maps to well-studied compounds documented in the research literature.',
      'All study is framed around in vitro and preclinical research context only.',
    ],
    related: ['glp-1-receptor-agonists-in-research', 'growth-hormone-secretagogues-explained'],
    compounds: [{ name: 'BPC-157', slug: 'bpc-157' }, { name: 'TB-500', slug: 'tb-500' }, { name: 'Semaglutide', slug: 'semaglutide' }, { name: 'Tirzepatide', slug: 'tirzepatide' }, { name: 'Ipamorelin', slug: 'ipamorelin' }, { name: 'Sermorelin', slug: 'sermorelin' }, { name: 'GHK-Cu', slug: 'ghk-cu' }, { name: 'Epithalon', slug: 'epithalon' }],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'glp-1-receptor-agonists-in-research',
    title: 'GLP-1 Receptor Agonists In Research: Semaglutide, Tirzepatide, And Retatrutide',
    description:
      'A research overview of the incretin-mimetic peptide class - GLP-1 and dual GIP/GLP-1 receptor agonists such as Semaglutide, Tirzepatide, and Retatrutide - and how they are studied.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 6,
    keywords: ['GLP-1', 'semaglutide research', 'tirzepatide research', 'retatrutide', 'incretin', 'metabolic research'],
    intro:
      'The incretin-mimetic peptides are among the most studied research compounds in metabolic science. This guide gives a research-context overview of the class - what a GLP-1 receptor agonist is, how single- versus multi-receptor compounds differ, and the compounds most commonly referenced in the literature. It contains no dosing or human-use guidance.',
    sections: [
      {
        heading: 'What A GLP-1 Receptor Agonist Is',
        paragraphs: [
          'GLP-1 (glucagon-like peptide-1) is an incretin hormone involved in glucose-dependent signaling. A GLP-1 receptor agonist is a compound that binds and activates the GLP-1 receptor. In research, these compounds are studied as tools for investigating metabolic and energy-balance pathways.',
        ],
      },
      {
        heading: 'Single Versus Multi-Receptor Compounds',
        paragraphs: [
          'Semaglutide is a GLP-1 receptor agonist. Tirzepatide is a dual agonist that acts at both the GIP and GLP-1 receptors. Retatrutide is studied as a triple agonist adding glucagon-receptor activity. Moving from single to multi-receptor activity is a central theme in the current research literature on this class.',
        ],
        bullets: [
          'Semaglutide: GLP-1 receptor agonist.',
          'Tirzepatide: dual GIP / GLP-1 receptor agonist.',
          'Retatrutide: triple GIP / GLP-1 / glucagon receptor agonist (research stage).',
        ],
      },
      {
        heading: 'How The Class Is Studied',
        paragraphs: [
          'In a research setting these compounds are handled as reference agonists for receptor-signaling and metabolic-pathway studies. As with all research peptides, they are for in vitro laboratory research only and are not for human or animal use.',
        ],
      },
    ],
    keyTakeaways: [
      'GLP-1 receptor agonists are incretin-mimetic peptides studied in metabolic research.',
      'Semaglutide targets GLP-1; Tirzepatide is a dual GIP/GLP-1 agonist; Retatrutide is a triple agonist.',
      'Multi-receptor activity is a central theme in this research class.',
      'These compounds are for in vitro research only, not human or animal use.',
    ],
    related: ['peptide-research-areas-explained', 'research-vs-pharmaceutical-peptides'],
    compounds: [{ name: 'Semaglutide', slug: 'semaglutide' }, { name: 'Tirzepatide', slug: 'tirzepatide' }, { name: 'Retatrutide', slug: 'retatrutide' }],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'bpc-157-research-overview',
    title: 'BPC-157 Research Overview',
    description:
      'A research-context overview of BPC-157, one of the most studied peptides in tissue-repair research: what it is, the pathways it is studied in, and its Research Use Only status.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 5,
    keywords: ['BPC-157', 'body protection compound', 'tissue repair research', 'angiogenesis', 'research peptide'],
    intro:
      'BPC-157, sometimes referred to as Body Protection Compound 157, is among the most frequently studied peptides in tissue-repair research. This guide provides a neutral, research-context overview: what the compound is, the pathways researchers study it in, and the strict Research Use Only framework it belongs to. It contains no dosing or human-use guidance.',
    sections: [
      {
        heading: 'What BPC-157 Is',
        paragraphs: [
          'BPC-157 is a synthetic peptide derived from a sequence originally identified in a gastric protein. In the research literature it is studied as a tool compound in models of cellular repair and tissue regeneration.',
        ],
      },
      {
        heading: 'Research Pathways',
        paragraphs: [
          'BPC-157 is most often referenced in research on angiogenesis (the formation of new blood vessels), tendon and ligament repair models, and gut-tissue studies. It is one of the anchor compounds in the tissue repair and recovery research area.',
        ],
        bullets: [
          'Angiogenesis and vascular-repair research models.',
          'Tendon, ligament, and connective-tissue repair studies.',
          'Gastrointestinal-tissue research.',
        ],
      },
      {
        heading: 'Research Use Only Status',
        paragraphs: [
          'BPC-157 supplied as a research peptide is for in vitro laboratory research only. It is not an FDA-approved drug and is not for human or animal consumption, ingestion, or injection. Researchers should consult the primary literature and batch documentation for their protocols.',
        ],
      },
    ],
    keyTakeaways: [
      'BPC-157 is a synthetic peptide widely studied in tissue-repair research.',
      'It is referenced in angiogenesis, connective-tissue repair, and gut-tissue research models.',
      'It is a Research Use Only compound, not FDA-approved and not for human or animal use.',
      'Protocols should draw on the primary literature and batch documentation.',
    ],
    related: ['peptide-research-areas-explained', 'what-research-use-only-means'],
    compounds: [{ name: 'BPC-157', slug: 'bpc-157' }, { name: 'TB-500', slug: 'tb-500' }],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'growth-hormone-secretagogues-explained',
    title: 'Growth Hormone Secretagogues Explained',
    description:
      'A research overview of the growth hormone secretagogue class - GHRH analogues and ghrelin-receptor agonists such as Sermorelin, CJC-1295, and Ipamorelin - and how they are studied.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 5,
    keywords: ['growth hormone secretagogue', 'GHRH', 'ipamorelin', 'CJC-1295', 'sermorelin', 'GHRP'],
    intro:
      'Growth hormone secretagogues are a widely studied peptide class in growth-axis research. This guide explains the two main mechanisms in the class, the compounds most often referenced, and how they are handled in a research context. It contains no dosing or human-use guidance.',
    sections: [
      {
        heading: 'Two Mechanisms In One Class',
        paragraphs: [
          'The class divides into two mechanisms. GHRH analogues, such as Sermorelin and CJC-1295, mimic growth-hormone-releasing hormone. Ghrelin-receptor agonists (also called GHRPs), such as Ipamorelin, act through a separate receptor. Researchers frequently study the two mechanisms together because they engage the growth axis through complementary pathways.',
        ],
        bullets: [
          'GHRH analogues: Sermorelin, CJC-1295.',
          'Ghrelin-receptor agonists (GHRPs): Ipamorelin, GHRP-2, GHRP-6.',
        ],
      },
      {
        heading: 'Why The Combination Is Studied',
        paragraphs: [
          'A common research pairing is a GHRH analogue with a ghrelin-receptor agonist, studied because the two mechanisms address different points in growth-axis signaling. This pairing is one of the most referenced combinations in the growth and longevity research area.',
        ],
      },
      {
        heading: 'Research Context',
        paragraphs: [
          'These compounds are studied as reference agonists for receptor and signaling research. As research peptides they are for in vitro laboratory research only and are not for human or animal use.',
        ],
      },
    ],
    keyTakeaways: [
      'Growth hormone secretagogues split into GHRH analogues and ghrelin-receptor agonists (GHRPs).',
      'Sermorelin and CJC-1295 are GHRH analogues; Ipamorelin is a ghrelin-receptor agonist.',
      'A GHRH analogue paired with a GHRP is a commonly studied combination.',
      'All are Research Use Only, not for human or animal use.',
    ],
    related: ['peptide-research-areas-explained', 'glp-1-receptor-agonists-in-research'],
    compounds: [{ name: 'Sermorelin', slug: 'sermorelin' }, { name: 'CJC-1295', slug: 'cjc-1295-dac' }, { name: 'Ipamorelin', slug: 'ipamorelin' }, { name: 'GHRP-2', slug: 'ghrp-2' }, { name: 'GHRP-6', slug: 'ghrp-6' }],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'how-research-peptides-are-synthesized',
    title: 'How Research Peptides Are Synthesized',
    description:
      'A plain-language overview of solid-phase peptide synthesis (SPPS), why sequence fidelity and purification matter, and how synthesis quality shows up in a Certificate of Analysis.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 6,
    keywords: ['peptide synthesis', 'solid-phase peptide synthesis', 'SPPS', 'purification', 'sequence fidelity'],
    intro:
      'Understanding how research peptides are made clarifies why documentation like a Certificate of Analysis exists and what it is verifying. This guide gives a plain-language overview of solid-phase peptide synthesis, the dominant method, and explains how synthesis quality translates into the purity and identity data researchers rely on.',
    sections: [
      {
        heading: 'Solid-Phase Peptide Synthesis',
        paragraphs: [
          'Most research peptides are made by solid-phase peptide synthesis (SPPS). The peptide is assembled one amino acid at a time on a solid resin support, with each residue added in a controlled coupling step and protecting groups removed between steps. Building the chain on a solid support allows excess reagents to be washed away at each stage, which drives the reaction toward completion.',
        ],
      },
      {
        heading: 'Why Sequence Fidelity And Purification Matter',
        paragraphs: [
          'Every coupling step is an opportunity for a small fraction of chains to deviate - a missing residue, an incomplete coupling, or a side reaction. These produce closely related impurities that must be separated from the target during purification, typically by preparative HPLC. The quality of both synthesis and purification determines the final purity profile.',
        ],
        bullets: [
          'Chains are assembled residue by residue on a solid support.',
          'Imperfect couplings create closely related peptide impurities.',
          'Preparative HPLC purifies the target from those impurities.',
        ],
      },
      {
        heading: 'How This Shows Up In A COA',
        paragraphs: [
          'The Certificate of Analysis is where synthesis quality becomes visible to the researcher. HPLC purity reflects how cleanly the target was synthesized and purified; mass spectrometry confirms the assembled sequence matches the intended molecule. Reading a COA is, in effect, reading the outcome of the synthesis process.',
        ],
      },
    ],
    keyTakeaways: [
      'Most research peptides are made by solid-phase peptide synthesis (SPPS), assembled residue by residue on a resin.',
      'Imperfect coupling steps create related impurities that purification (preparative HPLC) must remove.',
      'Synthesis and purification quality determine the final purity profile.',
      'A Certificate of Analysis reports the outcome: HPLC purity and mass-spectrometry identity.',
    ],
    related: ['understanding-peptide-purity', 'how-to-read-a-certificate-of-analysis'],
  },
  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'tirzepatide-vs-semaglutide-research',
    title: 'Tirzepatide vs. Semaglutide: A Research Comparison',
    description:
      'A neutral, research-context comparison of Tirzepatide and Semaglutide - how the dual GIP/GLP-1 agonist and the GLP-1 agonist differ in receptor targets, mechanism, and how each is studied. Research use only.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 6,
    keywords: ['tirzepatide vs semaglutide', 'GLP-1 vs GIP', 'incretin research', 'dual agonist', 'metabolic research peptides'],
    intro:
      'Tirzepatide and Semaglutide are two of the most studied compounds in metabolic peptide research, and researchers frequently ask how they compare. This guide gives a neutral, research-context comparison - what each compound is, how their receptor targets differ, and how they are studied. It contains no dosing, efficacy claims, or human-use guidance; both are supplied strictly for in vitro laboratory research.',
    sections: [
      {
        heading: 'The Core Difference: Single Versus Dual Receptor Activity',
        paragraphs: [
          'Semaglutide is a GLP-1 receptor agonist - it binds and activates a single incretin receptor, GLP-1. Tirzepatide is a dual agonist that acts at both the GIP receptor and the GLP-1 receptor. This single-versus-dual distinction is the central theme researchers examine when comparing the two compounds.',
          'Because the two engage different receptor combinations, they are studied as distinct tools for investigating incretin signaling, even though both sit in the same metabolic research area.',
        ],
      },
      {
        heading: 'Molecular And Structural Notes',
        paragraphs: [
          'Both are peptide analogs designed for extended stability. In the research literature they are handled as reference agonists, and each is characterized by its own sequence, molecular weight, and receptor-binding profile documented on its monograph.',
        ],
        bullets: [
          'Semaglutide: GLP-1 receptor agonist.',
          'Tirzepatide: dual GIP / GLP-1 receptor agonist.',
          'Both are studied in metabolic and energy-balance pathway research.',
          'Retatrutide extends the theme further as a triple GIP/GLP-1/glucagon agonist.',
        ],
      },
      {
        heading: 'How Researchers Choose Between Them',
        paragraphs: [
          'The choice of reference compound depends on the research question. A study focused on GLP-1 signaling alone may use Semaglutide, while research examining combined incretin activity may use Tirzepatide. Reviewing each compound monograph - receptor targets, mechanism, and referenced findings - is the appropriate way to inform that selection.',
        ],
      },
      {
        heading: 'Research Use Only',
        paragraphs: [
          'Both compounds, supplied as research peptides, are for in vitro laboratory research only. They are not for human or animal consumption, ingestion, or injection, and are not FDA-approved for such use. This guide compares them only as research reference compounds.',
        ],
      },
    ],
    keyTakeaways: [
      'Semaglutide is a GLP-1 receptor agonist; Tirzepatide is a dual GIP/GLP-1 receptor agonist.',
      'The single-versus-dual receptor distinction is the core difference researchers study.',
      'Both belong to the metabolic research area and are handled as reference agonists.',
      'Both are Research Use Only - not for human or animal use.',
    ],
    related: ['glp-1-receptor-agonists-in-research', 'research-vs-pharmaceutical-peptides'],
    compounds: [{ name: 'Semaglutide', slug: 'semaglutide' }, { name: 'Tirzepatide', slug: 'tirzepatide' }],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'bpc-157-vs-tb-500-research',
    title: 'BPC-157 vs. TB-500: A Research Comparison',
    description:
      'A research-context comparison of BPC-157 and TB-500 (Thymosin Beta-4) - the two anchor compounds of tissue-repair research: what each is, how their mechanisms differ, and why they are often studied together. Research use only.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 6,
    keywords: ['BPC-157 vs TB-500', 'tissue repair peptides', 'thymosin beta-4', 'angiogenesis research', 'recovery peptides'],
    intro:
      'BPC-157 and TB-500 are the two most referenced compounds in tissue-repair research, and they are frequently compared and studied side by side. This guide explains what each is, how their mechanisms differ, and why researchers often examine them together - framed strictly around in vitro laboratory research context, with no dosing or human-use guidance.',
    sections: [
      {
        heading: 'Two Different Origins',
        paragraphs: [
          'BPC-157 is a synthetic pentadecapeptide derived from a sequence identified in a gastric protein. TB-500 is a synthetic fragment related to Thymosin Beta-4, a naturally occurring regenerative peptide. They come from different biological origins and are structurally distinct.',
        ],
      },
      {
        heading: 'Different Mechanisms, Overlapping Research Areas',
        paragraphs: [
          'In the research literature, BPC-157 is studied heavily in angiogenesis and connective-tissue repair models, while TB-500 is studied for actin regulation, cell migration, and tissue regeneration. Their mechanisms differ, but both sit within the tissue repair and recovery research area, which is why they are often examined together in comparative studies.',
        ],
        bullets: [
          'BPC-157: angiogenesis, tendon/ligament and gut-tissue repair models.',
          'TB-500: actin binding, cell migration, and regeneration research.',
          'Both are anchor compounds of the tissue repair and recovery area.',
        ],
      },
      {
        heading: 'Why They Are Studied Together',
        paragraphs: [
          'Because the two engage repair pathways through different mechanisms, researchers sometimes study them in combination to examine complementary effects in tissue-repair models. This pairing is one of the more referenced combinations in recovery research.',
        ],
      },
      {
        heading: 'Research Use Only',
        paragraphs: [
          'Both compounds are supplied strictly for in vitro laboratory research. They are not FDA-approved and are not for human or animal consumption, ingestion, or injection. This comparison is informational and research-focused only.',
        ],
      },
    ],
    keyTakeaways: [
      'BPC-157 is a synthetic gastric-derived pentadecapeptide; TB-500 is a synthetic Thymosin Beta-4 fragment.',
      'BPC-157 is studied in angiogenesis and connective-tissue repair; TB-500 in actin regulation and cell migration.',
      'Both are anchor compounds of the tissue repair and recovery research area and are sometimes studied together.',
      'Both are Research Use Only - not for human or animal use.',
    ],
    related: ['bpc-157-research-overview', 'peptide-research-areas-explained'],
    compounds: [{ name: 'BPC-157', slug: 'bpc-157' }, { name: 'TB-500', slug: 'tb-500' }],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'understanding-peptide-half-life',
    title: 'Understanding Peptide Half-Life In Research',
    description:
      'What peptide half-life means, how it is measured and reported, why it varies so widely between compounds, and how modifications extend it - a plain-language pharmacokinetics primer for research context.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 6,
    keywords: ['peptide half-life', 'pharmacokinetics', 'peptide stability', 'DAC', 'half-life extension', 'research peptides'],
    intro:
      'Half-life is one of the most frequently cited pharmacokinetic properties on a peptide monograph, and it strongly shapes how a compound behaves in research models. This guide explains what half-life means, how it is measured and reported, why it varies so widely, and how structural modifications extend it - framed for in vitro and preclinical research context.',
    sections: [
      {
        heading: 'What Half-Life Actually Describes',
        paragraphs: [
          'Half-life is the time it takes for the concentration of a compound to fall to half its starting value. A short half-life means the compound clears quickly; a long half-life means it persists. For research, half-life is a key variable in experimental design because it influences how a compound is modeled over time.',
        ],
      },
      {
        heading: 'Why Half-Life Varies So Widely',
        paragraphs: [
          'Native peptides are often broken down rapidly by enzymes, giving very short half-lives measured in minutes. Structural strategies - such as amino-acid substitutions, fatty-acid conjugation, or a drug-affinity complex (DAC) that binds albumin - slow degradation and extend half-life dramatically, sometimes from minutes to days. This is why two compounds in the same class can have completely different half-life profiles.',
        ],
        bullets: [
          'Unmodified peptides: often minutes to a few hours.',
          'Substituted / stabilized analogs: hours.',
          'Albumin-binding or DAC-modified analogs: up to days.',
        ],
      },
      {
        heading: 'How It Is Reported On A Monograph',
        paragraphs: [
          'Half-life on a compound monograph may be measured (from pharmacokinetic studies) or predicted (estimated from structure). A well-documented monograph distinguishes the two. Reading half-life alongside the mechanism and route notes gives the clearest picture of a compound behavior in a research setting.',
        ],
      },
    ],
    keyTakeaways: [
      'Half-life is the time for a compound concentration to fall by half - a core pharmacokinetic variable.',
      'It varies from minutes (native peptides) to days (albumin-binding or DAC-modified analogs).',
      'Structural modifications like fatty-acid conjugation or a DAC extend half-life by slowing degradation.',
      'Monographs may report measured or predicted half-life; the distinction matters for research design.',
    ],
    related: ['how-research-peptides-are-synthesized', 'understanding-peptide-purity'],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'peptide-receptor-targets-explained',
    title: 'Peptide Receptor Targets Explained',
    description:
      'What a receptor target is, what it means for a peptide to be an agonist, and why receptor targets are the most useful way to organize and compare research peptides. A plain-language primer for research context.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 5,
    keywords: ['receptor target', 'peptide agonist', 'GPCR', 'receptor binding', 'mechanism of action', 'research peptides'],
    intro:
      'Many research peptides are described by the receptor they act on - GLP-1 receptor, ghrelin receptor, melanocortin receptor, and so on. Understanding what a receptor target is, and what agonism means, is the key to reading a monograph mechanism section and comparing compounds. This guide is a plain-language primer for research context.',
    sections: [
      {
        heading: 'What A Receptor Target Is',
        paragraphs: [
          'A receptor is a protein, often on the cell surface, that a signaling molecule binds to in order to trigger a response inside the cell. Many peptides are studied specifically because they bind a particular receptor. That receptor is the peptide target, and it defines much of how the compound behaves in a research model.',
        ],
      },
      {
        heading: 'Agonists, Antagonists, And Selectivity',
        paragraphs: [
          'A compound that binds a receptor and activates it is an agonist; one that binds and blocks it is an antagonist. Many of the most studied research peptides are agonists. Selectivity describes how specifically a compound targets one receptor versus several - a single-receptor agonist versus a dual or triple agonist, for example.',
        ],
        bullets: [
          'Agonist: binds and activates the receptor.',
          'Antagonist: binds and blocks the receptor.',
          'Selectivity: how specifically a compound targets one receptor versus multiple.',
        ],
      },
      {
        heading: 'Why Receptor Targets Organize The Catalog',
        paragraphs: [
          'Grouping compounds by receptor target is one of the most useful ways to navigate a research library, because compounds that share a target are often studied for related questions. The Pep Nation Lab research library lets researchers browse by receptor target to see every compound annotated against a given receptor.',
        ],
      },
    ],
    keyTakeaways: [
      'A receptor target is the protein a peptide binds to trigger a cellular response.',
      'An agonist activates its receptor; an antagonist blocks it - most studied peptides are agonists.',
      'Selectivity describes single- versus multi-receptor targeting (e.g., dual and triple agonists).',
      'Browsing by receptor target is an efficient way to compare related research compounds.',
    ],
    related: ['glp-1-receptor-agonists-in-research', 'growth-hormone-secretagogues-explained'],
  },

  // ───────────────────────────────────────────────────────────────────────
  {
    slug: 'evaluating-peptide-research-evidence',
    title: 'How To Evaluate Peptide Research Evidence',
    description:
      'A practical primer on evaluating peptide research: the difference between in vitro, in vivo, and clinical evidence, what evidence tiers mean, and how to read the strength of the literature behind a compound.',
    datePublished: '2026-07-07',
    dateModified: '2026-07-07',
    readingTimeMin: 6,
    keywords: ['peptide research evidence', 'in vitro vs in vivo', 'preclinical', 'evidence tier', 'evaluating studies', 'research peptides'],
    intro:
      'Not all research findings carry the same weight, and evaluating the strength of the evidence behind a compound is a core research skill. This guide explains the difference between in vitro, in vivo, and clinical evidence, what evidence tiers communicate, and how to read the literature behind a research peptide critically.',
    sections: [
      {
        heading: 'In Vitro, In Vivo, And Clinical: A Hierarchy Of Evidence',
        paragraphs: [
          'In vitro research is conducted outside a living organism - in cell cultures or isolated systems. In vivo research uses living organisms, typically animal models. Clinical evidence comes from controlled human studies. These represent increasing levels of complexity and, generally, increasing strength of evidence for a given claim.',
          'A compound with strong in vitro or animal data but little or no human evidence is common in peptide research. Recognizing where a compound sits on this hierarchy is essential to interpreting what is actually known about it.',
        ],
      },
      {
        heading: 'What Evidence Tiers Communicate',
        paragraphs: [
          'Some research libraries assign an evidence tier to each compound to summarize how much and how strong the supporting research is. A tier is a shorthand: it tells a researcher, at a glance, whether a compound is backed by extensive study or by early, limited data. It is a starting point for judgment, not a substitute for reading the primary literature.',
        ],
        bullets: [
          'In vitro: cell-culture and isolated-system studies.',
          'In vivo: animal-model studies.',
          'Clinical: controlled human studies (rare for many research peptides).',
          'Evidence tier: a summary of how much and how strong the research is.',
        ],
      },
      {
        heading: 'Reading The Literature Critically',
        paragraphs: [
          'Strong evaluation means checking the source of a claim: is it a peer-reviewed study, a review, or anecdote; is it in vitro, animal, or human; and is it a single finding or a replicated result. A compound monograph that cites its sources and states its evidence context is far more useful than one that simply asserts effects.',
        ],
      },
      {
        heading: 'Research Use Only',
        paragraphs: [
          'This guide is about evaluating research evidence, not about human use. All compounds referenced across the Pep Nation Lab research library are for in vitro laboratory research only and are not for human or animal use.',
        ],
      },
    ],
    keyTakeaways: [
      'Evidence strength generally increases from in vitro, to in vivo (animal), to clinical (human) research.',
      'Many research peptides have strong in vitro or animal data but little human evidence - know where a compound sits.',
      'An evidence tier summarizes how much and how strong the research is; it is a starting point, not a verdict.',
      'Evaluate claims by source, study type, and whether findings are replicated.',
    ],
    related: ['research-vs-pharmaceutical-peptides', 'what-research-use-only-means'],
  },

];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function getRelatedGuides(guide: Guide): Guide[] {
  return guide.related
    .map((slug) => GUIDES.find((g) => g.slug === slug))
    .filter((g): g is Guide => Boolean(g));
}

export const GUIDES_UPDATED = '2026-07-07';
export const GUIDE_AUTHOR = AUTHOR;

// Per-guide FAQs, keyed by guide slug. Appended to lib/research/guides.ts.
// Each answer is 1-2 sentences, factual, and RUO-compliant (no dosing, no
// human-use guidance). Rendered as a "Frequently Asked Questions" section and
// emitted as FAQPage JSON-LD on each guide page.
export const GUIDE_FAQS: Record<string, { q: string; a: string }[]> = {
  'what-research-use-only-means': [
    {
      q: 'What does Research Use Only mean?',
      a: 'Research Use Only (RUO) means a product is supplied exclusively for in vitro laboratory research and has not been evaluated or approved for use in humans or animals. It is a statement of intended use, not a quality grade.',
    },
    {
      q: 'Are Research Use Only peptides the same as FDA-approved drugs?',
      a: 'No. RUO peptides are laboratory reagents, not FDA-approved drugs. Even when the chemical name matches a pharmaceutical, the regulatory category, documentation, and permitted use are entirely different.',
    },
    {
      q: 'Who is responsible for handling RUO peptides correctly?',
      a: 'The qualified researcher is responsible for lawful, appropriate handling, storage, and disposal in line with institutional and local rules. The RUO designation defines the entire context in which the compound may be used.',
    },
  ],
  'how-to-read-a-certificate-of-analysis': [
    {
      q: 'What is a Certificate of Analysis (COA)?',
      a: 'A COA is the primary quality document for a research peptide. It reports the analytical testing performed on a specific batch, letting a researcher confirm the identity and purity of the material before use.',
    },
    {
      q: 'How is peptide purity shown on a COA?',
      a: 'Purity is typically reported by HPLC as a percentage, often with a supporting chromatogram. Mass spectrometry is used separately to confirm the compound identity against its theoretical molecular weight.',
    },
    {
      q: 'How do I know a COA is trustworthy?',
      a: 'A credible COA is batch-linked, names the analytical method, includes a mass-spectrometry identity result, and is supported by chromatograms or spectra. Always match the COA batch number to the physical vial.',
    },
  ],
  'peptide-storage-and-reconstitution': [
    {
      q: 'How are lyophilized research peptides stored?',
      a: 'In their dry, lyophilized form most research peptides are kept cold and protected from moisture, with longer-term storage typically in a freezer. Water and repeated temperature cycling are the main drivers of degradation.',
    },
    {
      q: 'What is reconstitution?',
      a: 'Reconstitution is dissolving the lyophilized powder into a suitable solvent for laboratory use. The appropriate solvent depends on the specific peptide, and the material is handled gently to protect the molecule.',
    },
    {
      q: 'Why do peptides degrade faster once in solution?',
      a: 'A reconstituted peptide is more vulnerable to hydrolysis, oxidation, and contamination than the dry powder. Researchers commonly limit time in solution, keep it cold, and aliquot to avoid repeated freeze-thaw cycles.',
    },
  ],
  'research-vs-pharmaceutical-peptides': [
    {
      q: 'Can a research peptide and a pharmaceutical have the same name?',
      a: 'Yes. Chemically, a peptide is defined by its amino-acid sequence, so two products with the same sequence are the same molecule. But they can occupy completely different regulatory categories.',
    },
    {
      q: 'What is the difference between a research peptide and a pharmaceutical?',
      a: 'A pharmaceutical is a molecule plus an approved manufacturing process, a defined indication, safety and efficacy data, and regulated labeling. A research peptide is the molecule supplied as a laboratory reagent with a Certificate of Analysis.',
    },
    {
      q: 'What determines how a peptide product may be used?',
      a: 'Permitted use is determined by regulatory category, not by the chemical name. Research peptides are for in vitro laboratory research only, never for human or animal use.',
    },
  ],
  'understanding-peptide-purity': [
    {
      q: 'What is the difference between chromatographic purity and net peptide content?',
      a: 'Chromatographic purity (HPLC) is the proportion of target peptide versus peptide-related impurities. Net peptide content is how much of the total dry mass is actually peptide, versus water, counter-ions, and residual salts.',
    },
    {
      q: 'How is peptide purity measured?',
      a: 'HPLC quantifies the target peptide against impurity peaks, and mass spectrometry confirms the main peak is the intended molecule by matching its mass. The two methods answer different questions and are read together.',
    },
    {
      q: 'Why does purity matter for reproducible research?',
      a: 'Inconsistent purity introduces uncontrolled variables. Two batches with different impurity profiles or net peptide content can produce different results, so documented batch-specific purity data supports reproducibility.',
    },
  ],
  'peptide-research-areas-explained': [
    {
      q: 'What are the main peptide research areas?',
      a: 'The major areas are metabolic research, tissue repair and recovery, growth and longevity, cognitive research, and skin and cosmetic science. Each maps to well-studied compounds documented in the literature.',
    },
    {
      q: 'Which peptides are studied in metabolic research?',
      a: 'Incretin-related compounds such as Semaglutide and Tirzepatide are the most active in metabolic research, studied in the context of metabolic regulation and energy balance.',
    },
    {
      q: 'Which peptides are studied for tissue repair?',
      a: 'BPC-157 and TB-500 are the anchor compounds in tissue repair and recovery research, studied in models of cellular repair, angiogenesis, and tissue regeneration.',
    },
  ],
  'glp-1-receptor-agonists-in-research': [
    {
      q: 'What is a GLP-1 receptor agonist?',
      a: 'GLP-1 (glucagon-like peptide-1) is an incretin hormone involved in glucose-dependent signaling. A GLP-1 receptor agonist is a compound that binds and activates the GLP-1 receptor, studied as a tool in metabolic research.',
    },
    {
      q: 'How do Semaglutide, Tirzepatide, and Retatrutide differ?',
      a: 'Semaglutide is a GLP-1 receptor agonist, Tirzepatide is a dual GIP/GLP-1 agonist, and Retatrutide is studied as a triple GIP/GLP-1/glucagon agonist. Moving from single to multi-receptor activity is a central theme in the class.',
    },
    {
      q: 'Are GLP-1 research compounds for human use?',
      a: 'No. Supplied as research peptides, they are for in vitro laboratory research only and are not for human or animal use.',
    },
  ],
  'bpc-157-research-overview': [
    {
      q: 'What is BPC-157?',
      a: 'BPC-157, sometimes called Body Protection Compound 157, is a synthetic peptide derived from a sequence originally identified in a gastric protein. It is studied as a tool compound in tissue-repair research.',
    },
    {
      q: 'What is BPC-157 studied for?',
      a: 'In the research literature it is most often referenced in angiogenesis models, tendon and ligament repair studies, and gut-tissue research. It is one of the anchor compounds in the tissue repair and recovery area.',
    },
    {
      q: 'Is BPC-157 FDA-approved?',
      a: 'No. BPC-157 supplied as a research peptide is for in vitro laboratory research only. It is not an FDA-approved drug and is not for human or animal use.',
    },
  ],
  'growth-hormone-secretagogues-explained': [
    {
      q: 'What is a growth hormone secretagogue?',
      a: 'A growth hormone secretagogue is a compound studied for its role in growth-axis signaling. The class splits into GHRH analogues and ghrelin-receptor agonists (GHRPs), which engage the axis through different receptors.',
    },
    {
      q: 'How do Sermorelin, CJC-1295, and Ipamorelin differ?',
      a: 'Sermorelin and CJC-1295 are GHRH analogues that mimic growth-hormone-releasing hormone, while Ipamorelin is a ghrelin-receptor agonist acting through a separate receptor.',
    },
    {
      q: 'Why are a GHRH analogue and a GHRP studied together?',
      a: 'The two mechanisms address different points in growth-axis signaling, so pairing them is one of the most referenced combinations in growth and longevity research.',
    },
  ],
  'how-research-peptides-are-synthesized': [
    {
      q: 'How are research peptides made?',
      a: 'Most are made by solid-phase peptide synthesis (SPPS), where the peptide is assembled one amino acid at a time on a solid resin support, allowing excess reagents to be washed away at each coupling step.',
    },
    {
      q: 'Why does synthesis quality affect purity?',
      a: 'Each coupling step can leave a small fraction of chains with a missing residue or incomplete coupling, creating closely related impurities that must be removed during purification, typically by preparative HPLC.',
    },
    {
      q: 'How does synthesis quality show up in documentation?',
      a: 'It appears in the Certificate of Analysis: HPLC purity reflects how cleanly the peptide was synthesized and purified, and mass spectrometry confirms the assembled sequence matches the intended molecule.',
    },
  ],
  'tirzepatide-vs-semaglutide-research': [
    {
      q: 'What is the main difference between Tirzepatide and Semaglutide?',
      a: 'Semaglutide is a single GLP-1 receptor agonist, while Tirzepatide is a dual agonist that acts at both the GIP and GLP-1 receptors. That single-versus-dual receptor activity is the core difference researchers study.',
    },
    {
      q: 'Are Tirzepatide and Semaglutide studied in the same research area?',
      a: 'Yes. Both sit in the metabolic research area and are handled as reference incretin agonists, but they engage different receptor combinations, so they are studied as distinct tools.',
    },
    {
      q: 'Are these compounds for human use?',
      a: 'No. Supplied as research peptides, both are strictly for in vitro laboratory research and are not for human or animal use.',
    },
  ],
  'bpc-157-vs-tb-500-research': [
    {
      q: 'How do BPC-157 and TB-500 differ?',
      a: 'They have different origins and mechanisms: BPC-157 is a synthetic gastric-derived pentadecapeptide studied in angiogenesis and connective-tissue repair, while TB-500 is a Thymosin Beta-4 fragment studied for actin regulation and cell migration.',
    },
    {
      q: 'Why are BPC-157 and TB-500 studied together?',
      a: 'Because they engage tissue-repair pathways through different mechanisms, researchers sometimes study them in combination to examine complementary effects in repair models.',
    },
    {
      q: 'Are BPC-157 and TB-500 FDA-approved?',
      a: 'No. Both are Research Use Only compounds, not FDA-approved, and are not for human or animal use.',
    },
  ],
  'understanding-peptide-half-life': [
    {
      q: 'What does peptide half-life mean?',
      a: 'Half-life is the time it takes for a compound concentration to fall to half its starting value. A short half-life means fast clearance; a long half-life means the compound persists.',
    },
    {
      q: 'Why do peptide half-lives vary so much?',
      a: 'Native peptides are broken down quickly (minutes), but structural modifications such as amino-acid substitutions, fatty-acid conjugation, or a drug-affinity complex (DAC) that binds albumin slow degradation and can extend half-life to days.',
    },
    {
      q: 'What is the difference between measured and predicted half-life?',
      a: 'Measured half-life comes from pharmacokinetic studies; predicted half-life is estimated from a compound structure. A well-documented monograph distinguishes the two.',
    },
  ],
  'peptide-receptor-targets-explained': [
    {
      q: 'What is a receptor target?',
      a: 'A receptor is a protein, often on the cell surface, that a signaling molecule binds to trigger a cellular response. A peptide receptor target is the receptor it is studied for binding.',
    },
    {
      q: 'What is the difference between an agonist and an antagonist?',
      a: 'An agonist binds a receptor and activates it; an antagonist binds and blocks it. Most widely studied research peptides are agonists.',
    },
    {
      q: 'What does receptor selectivity mean?',
      a: 'Selectivity describes how specifically a compound targets one receptor versus several - for example, a single-receptor agonist versus a dual or triple agonist.',
    },
  ],
  'evaluating-peptide-research-evidence': [
    {
      q: 'What is the difference between in vitro and in vivo research?',
      a: 'In vitro research is done outside a living organism, in cell cultures or isolated systems; in vivo research uses living organisms, typically animal models. Clinical research uses controlled human studies.',
    },
    {
      q: 'What does an evidence tier tell me?',
      a: 'An evidence tier summarizes how much and how strong the research behind a compound is. It is a quick starting point for judgment, not a substitute for reading the primary literature.',
    },
    {
      q: 'How should I evaluate a research claim about a peptide?',
      a: 'Check the source (peer-reviewed study, review, or anecdote), the study type (in vitro, animal, or human), and whether the finding has been replicated rather than reported once.',
    },
  ],
};

// Maps a compound category to the most relevant research guides. Two universal
// guides (RUO explainer + COA) always lead, followed by category-specific
// guides. Used to surface editorial guides on compound monographs
// (internal-link mesh + topical association).
const CATEGORY_GUIDE_SLUGS: Record<string, string[]> = {
  'Weight Loss & Metabolism': ['glp-1-receptor-agonists-in-research', 'peptide-research-areas-explained'],
  'Healing & Recovery': ['bpc-157-research-overview', 'peptide-research-areas-explained'],
  'Muscle Growth & Performance': ['growth-hormone-secretagogues-explained', 'peptide-research-areas-explained'],
  'Anti-Aging & Longevity': ['peptide-research-areas-explained', 'understanding-peptide-purity'],
  'Skin, Hair & Cosmetics': ['peptide-research-areas-explained', 'understanding-peptide-purity'],
  'Immunity & Wellness': ['peptide-research-areas-explained', 'research-vs-pharmaceutical-peptides'],
  'Sexual Health & Hormones': ['peptide-research-areas-explained', 'research-vs-pharmaceutical-peptides'],
  'Peptide Stacks': ['peptide-research-areas-explained', 'peptide-storage-and-reconstitution'],
};

export function getGuidesForCategory(category: string | null | undefined): { slug: string; title: string }[] {
  const universal = ['what-research-use-only-means', 'how-to-read-a-certificate-of-analysis'];
  const specific = (category && CATEGORY_GUIDE_SLUGS[category]) || ['peptide-research-areas-explained'];
  const slugs: string[] = [];
  for (const s of [...universal, ...specific]) if (!slugs.includes(s)) slugs.push(s);
  return slugs
    .map((slug) => GUIDES.find((g) => g.slug === slug))
    .filter((g): g is Guide => Boolean(g))
    .slice(0, 4)
    .map((g) => ({ slug: g.slug, title: g.title }));
}
