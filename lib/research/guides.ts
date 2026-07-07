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
