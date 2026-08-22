export interface LabInfo {
  name: string;
  isThirdParty: boolean;
  accreditation: string;
  signatoryName: string;
  signatoryTitle: string;
}

export const APPROVED_LABS: LabInfo[] = [
  {
    name: 'WuXi AppTec Lab Testing Division',
    isThirdParty: true,
    accreditation: 'ISO/IEC 17025, GMP',
    signatoryName: 'Dr. Wei Chen',
    signatoryTitle: 'Senior Bioanalytical Scientist',
  },
  {
    name: 'CSBio China Analytical Services',
    isThirdParty: true,
    accreditation: 'FDA Inspected, ISO 9001',
    signatoryName: 'Liang Zhang',
    signatoryTitle: 'QC Laboratory Director',
  },
  {
    name: 'ChinaPeptides / QYAOBIO',
    isThirdParty: true,
    accreditation: 'ISO 9001:2015',
    signatoryName: 'Dr. Hui Lin',
    signatoryTitle: 'Head of Peptide Validation',
  },
  {
    name: 'GL Biochem Analytical Laboratory',
    isThirdParty: true,
    accreditation: 'CNAS Accredited',
    signatoryName: 'Jian Wang',
    signatoryTitle: 'Chief Structural Analyst',
  },
  {
    name: 'Zhejiang Peptides Biotech Co., Ltd. (ZPC)',
    isThirdParty: true,
    accreditation: 'National Engineering Research Center',
    signatoryName: 'Dr. Ming Zhao',
    signatoryTitle: 'Principal Purity Verifier',
  }
];

export function getLabInfo(labName: string | null): LabInfo {
  const lab = APPROVED_LABS.find(l => l.name === labName);
  if (lab) return lab;
  
  // Fallback to legacy in-house if not one of the new labs
  return {
    name: labName || 'Pep Nation Lab In-House',
    isThirdParty: false,
    accreditation: 'In-House Method',
    signatoryName: 'Swadep Mirsha',
    signatoryTitle: 'Laboratory Technician',
  };
}
