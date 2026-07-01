export type FilterOp = 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in';

export interface FieldFilter {
  field: string;
  op: FilterOp;
  value: string | number;
}

export interface ParsedQuery {
  terms: string[];
  phrases: string[];
  required: string[];
  excluded: string[];
  wildcards: string[];
  filters: FieldFilter[];
  raw: string;
  normalized: string;
}

const KNOWN_FIELDS = new Set([
  'mechanism', 'tier', 'evidence', 'class', 'category', 'area',
  'risk', 'mw', 'half_life', 'route', 'target', 'glp1', 'angiogenic', 'stack', 'hl',
]);

const FIELD_NORMALIZATION: Record<string, string> = {
  evidence: 'tier',
  category: 'class',
  area: 'research_area',
  target: 'molecular_target',
  half_life: 'half_life_hours',
  hl: 'half_life_hours',
};

function normalizeQuery(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s:>"<*+\-./]/g, '');
}

function parseFieldValue(raw: string): FieldFilter | null {
  const m = /^([a-z_]+):(>=|<=|>|<)?([^\s]+)$/i.exec(raw);
  if (!m) return null;
  const fieldRaw = m[1].toLowerCase();
  const opSym = m[2];
  const valueRaw = m[3];
  if (!KNOWN_FIELDS.has(fieldRaw)) return null;
  const field = FIELD_NORMALIZATION[fieldRaw] ?? fieldRaw;
  let op: FilterOp = 'eq';
  if (opSym === '>') op = 'gt';
  else if (opSym === '<') op = 'lt';
  else if (opSym === '>=') op = 'gte';
  else if (opSym === '<=') op = 'lte';
  const asNum = Number(valueRaw);
  const value: string | number =
    !Number.isNaN(asNum) && /^-?\d/.test(valueRaw) ? asNum : valueRaw.toLowerCase();
  return { field, op, value };
}

function tokenize(raw: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|( \S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m[1] !== undefined) tokens.push(`"${m[1]}"`);
    else if (m[2] !== undefined) tokens.push(m[2]);
  }
  return tokens;
}

export function parseQuery(raw: string): ParsedQuery {
  const trimmed = (raw ?? '').trim();
  const parsed: ParsedQuery = {
    terms: [],
    phrases: [],
    required: [],
    excluded: [],
    wildcards: [],
    filters: [],
    raw: trimmed,
    normalized: normalizeQuery(trimmed),
  };
  if (!trimmed) return parsed;

  const tokens = tokenize(trimmed);
  for (const tokRaw of tokens) {
    const upper = tokRaw.toUpperCase();
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') continue;
    if (tokRaw.startsWith('"') && tokRaw.endsWith('"') && tokRaw.length >= 2) {
      const inner = tokRaw.slice(1, -1).trim();
      if (inner) parsed.phrases.push(inner);
      continue;
    }
    if (tokRaw.startsWith('-') && tokRaw.length > 1) {
      parsed.excluded.push(tokRaw.slice(1).toLowerCase());
      continue;
    }
    if (tokRaw.startsWith('+') && tokRaw.length > 1) {
      parsed.required.push(tokRaw.slice(1).toLowerCase());
      continue;
    }
    if (tokRaw.endsWith('*') && tokRaw.length > 1) {
      parsed.wildcards.push(tokRaw.slice(0, -1).toLowerCase());
      continue;
    }
    if (tokRaw.includes(':')) {
      const filter = parseFieldValue(tokRaw);
      if (filter) { parsed.filters.push(filter); continue; }
    }
    parsed.terms.push(tokRaw.toLowerCase());
  }
  return parsed;
}

const STOP_WORDS = new Set(['for', 'the', 'and', 'in', 'to', 'with', 'a', 'an', 'of', 'is', 'it', 'on', 'peptides', 'peptide', 'best']);

const SYNONYMS: Record<string, string[]> = {
  fat: ['weight loss', 'lipolysis', 'obesity', 'adipose', 'slimming', 'lean', 'weight'],
  muscle: ['hypertrophy', 'bodybuilding', 'mass', 'strength', 'growth', 'anabolic', 'gains'],
  sleep: ['insomnia', 'circadian', 'rest', 'recovery', 'rem', 'melatonin', 'dsip'],
  pain: ['analgesic', 'inflammation', 'injury', 'healing', 'joint', 'tendon', 'nociception', 'soreness'],
  brain: ['cognitive', 'nootropic', 'memory', 'focus', 'neuro', 'alzheimers', 'dementia', 'learning'],
  skin: ['anti-aging', 'collagen', 'wrinkle', 'elasticity', 'hair', 'nail', 'glow'],
  energy: ['stamina', 'endurance', 'fatigue', 'metabolism', 'mitochondrial'],
  sugar: ['diabetes', 'insulin', 'glucose', 'glycemic', 'metabolic'],
  heart: ['cardiovascular', 'blood', 'vascular', 'angiogenesis', 'cardiac'],
  bone: ['osteoporosis', 'mineral', 'fracture', 'density', 'healing'],
  sex: ['libido', 'erectile', 'aphrodisiac', 'testosterone', 'hormone', 'arousal'],
  gut: ['digestion', 'ulcer', 'gastric', 'intestinal', 'microbiome', 'bowel', 'leaky', 'stomach'],
  immune: ['immunity', 'infection', 'virus', 'bacteria', 'autoimmune', 'sick'],
  stress: ['anxiety', 'cortisol', 'calm', 'relax', 'mood', 'depression', 'panic'],
  aging: ['longevity', 'senescence', 'lifespan', 'youth', 'telomere', 'anti-aging'],
  weight: ['weight loss', 'weight management', 'obesity', 'lipolysis', 'appetite', 'slimming', 'fat loss'],
  obesity: ['weight management', 'glp-1', 'semaglutide', 'tirzepatide', 'appetite', 'metabolic', 'lipolysis'],
  diet: ['weight management', 'appetite', 'obesity', 'metabolic', 'fat loss'],
  appetite: ['glp-1', 'semaglutide', 'tirzepatide', 'satiety', 'obesity', 'weight management'],
  glp1: ['glp-1', 'semaglutide', 'tirzepatide', 'retatrutide', 'incretin', 'weight management', 'appetite'],
  metabolism: ['metabolic', 'energy', 'fat loss', 'mitochondrial', 'insulin', 'glucose'],
  mitochondria: ['mitochondrial', 'mots-c', 'ss-31', 'energy', 'nad', 'cellular energy'],
  recovery: ['healing', 'tissue repair', 'injury', 'tendon', 'bpc-157', 'tb-500', 'soft tissue'],
  healing: ['tissue repair', 'recovery', 'wound', 'regeneration', 'bpc-157', 'tb-500'],
  wound: ['healing', 'tissue repair', 'regeneration', 'collagen', 'angiogenesis'],
  injury: ['healing', 'tissue repair', 'tendon', 'recovery', 'repair', 'soft tissue'],
  joint: ['cartilage', 'tendon', 'bone joint', 'healing', 'repair', 'arthritis'],
  tendon: ['ligament', 'cartilage', 'healing', 'tissue repair', 'bone joint'],
  inflammation: ['anti-inflammatory', 'pain', 'immune', 'kpv', 'arthritis', 'swelling'],
  focus: ['cognitive', 'nootropic', 'memory', 'attention', 'concentration', 'semax'],
  memory: ['cognitive', 'nootropic', 'recall', 'learning', 'neuroprotective'],
  nootropic: ['cognitive', 'focus', 'memory', 'semax', 'selank', 'neuroprotective'],
  cognition: ['cognitive', 'nootropic', 'memory', 'focus', 'brain'],
  anxiety: ['anxiolytic', 'stress', 'mood', 'calm', 'selank', 'gaba'],
  mood: ['depression', 'anxiety', 'stress', 'wellbeing', 'oxytocin'],
  hair: ['follicle', 'alopecia', 'regrowth', 'ghk-cu', 'ahk-cu', 'dermal', 'scalp', 'cosmetic'],
  libido: ['sexual health', 'arousal', 'erectile', 'desire', 'pt-141', 'testosterone'],
  testosterone: ['hormonal', 'hcg', 'trt', 'luteinizing', 'fertility', 'androgen'],
  trt: ['testosterone', 'hcg', 'hormonal', 'fertility', 'luteinizing'],
  fertility: ['hcg', 'hmg', 'gonadotropin', 'kisspeptin', 'reproductive', 'hormonal'],
  tan: ['melanotan', 'melanocortin', 'tanning', 'pigmentation', 'melanin'],
  growth: ['growth hormone', 'ghrh', 'ghrp', 'secretagogue', 'igf', 'performance'],
  hgh: ['growth hormone', 'igf', 'ghrh', 'ghrp', 'secretagogue', 'fragment'],
  gh: ['growth hormone', 'ghrh', 'ghrp', 'secretagogue', 'igf'],
  antioxidant: ['glutathione', 'oxidative', 'free radical', 'longevity', 'mitochondrial'],
  longevity: ['anti-aging', 'senescence', 'lifespan', 'epithalon', 'nad', 'telomere'],
};

function getTermExpansions(term: string): string[] {
  const cleanTerm = term.replace(/[^a-z0-9_\-]/gi, '');
  if (!cleanTerm || STOP_WORDS.has(cleanTerm)) return [];
  const expansions = [cleanTerm];
  if (cleanTerm.endsWith('ies')) expansions.push(cleanTerm.slice(0, -3) + 'y');
  else if (cleanTerm.endsWith('es')) expansions.push(cleanTerm.slice(0, -2));
  else if (cleanTerm.endsWith('s')) expansions.push(cleanTerm.slice(0, -1));
  if (!cleanTerm.endsWith('s')) expansions.push(cleanTerm + 's');
  const finalExpansions = new Set<string>();
  for (const exp of expansions) {
    finalExpansions.add(exp);
    if (SYNONYMS[exp]) { for (const syn of SYNONYMS[exp]) finalExpansions.add(syn); }
  }
  return Array.from(finalExpansions);
}

function formatExpansionForPg(exp: string): string {
  const parts = exp.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `(${parts.join(' <-> ')})`;
  return parts[0];
}

export function buildTsquery(parsed: ParsedQuery): string {
  function clean(t: string): string { return t.replace(/[^a-z0-9_\-]/gi, ''); }
  const atoms: string[] = [];
  for (const phrase of parsed.phrases) {
    const words = phrase.split(/\s+/).map(clean).filter(Boolean);
    if (words.length === 0) continue;
    atoms.push('(' + words.join(' <-> ') + ')');
  }
  for (const term of parsed.required) {
    const exps = getTermExpansions(term);
    if (exps.length > 0) atoms.push('(' + exps.map(formatExpansionForPg).join(' | ') + ')');
  }
  for (const term of parsed.terms) {
    const exps = getTermExpansions(term);
    if (exps.length > 0) atoms.push('(' + exps.map(formatExpansionForPg).join(' | ') + ')');
  }
  for (const w of parsed.wildcards) {
    const c = clean(w);
    if (c && !STOP_WORDS.has(c)) atoms.push(`${c}:*`);
  }
  let q = atoms.join(' & ');
  for (const excl of parsed.excluded) {
    const c = clean(excl);
    if (c) q = q ? `${q} & !${c}` : `!${c}`;
  }
  return q;
}

export function buildAutoWildcardTsquery(parsed: ParsedQuery): string {
  const base = buildTsquery(parsed);
  if (parsed.phrases.length === 0 && parsed.wildcards.length === 0 && parsed.terms.length + parsed.required.length === 1) {
    const lone = [...parsed.required, ...parsed.terms][0];
    const cleanLone = lone.replace(/[^a-z0-9_\-]/gi, '');
    if (cleanLone && !STOP_WORDS.has(cleanLone)) return base ? `${base} | ${cleanLone}:*` : `${cleanLone}:*`;
  }
  return base;
}
