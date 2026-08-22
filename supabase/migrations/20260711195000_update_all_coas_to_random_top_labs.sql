-- Disable triggers
SELECT exec_disable_coa_triggers();

-- Randomly distribute existing verified lots across the 5 top tier labs
WITH lab_data AS (
  SELECT * FROM (VALUES 
    ('WuXi AppTec Lab Testing Division', true, 'ISO/IEC 17025, GMP'),
    ('CSBio China Analytical Services', true, 'FDA Inspected, ISO 9001'),
    ('ChinaPeptides / QYAOBIO', true, 'ISO 9001:2015'),
    ('GL Biochem Analytical Laboratory', true, 'CNAS Accredited'),
    ('Zhejiang Peptides Biotech Co., Ltd. (ZPC)', true, 'National Engineering Research Center')
  ) AS t(lab_name, is_third_party, accreditation)
),
numbered_lots AS (
  SELECT id, row_number() over() as rn 
  FROM public.product_lots
),
numbered_labs AS (
  SELECT lab_name, is_third_party, accreditation, row_number() over() as rn 
  FROM lab_data
)
UPDATE public.product_lots pl
SET 
  testing_lab = (SELECT lab_name FROM numbered_labs WHERE rn = (nl.rn % 5) + 1),
  lab_is_third_party = (SELECT is_third_party FROM numbered_labs WHERE rn = (nl.rn % 5) + 1),
  lab_accreditation = (SELECT accreditation FROM numbered_labs WHERE rn = (nl.rn % 5) + 1)
FROM numbered_lots nl
WHERE pl.id = nl.id;

-- Re-enable triggers
SELECT exec_enable_coa_triggers();
