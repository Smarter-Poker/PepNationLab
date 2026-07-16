/**
 * Runtime UI dictionary for the trilingual layer (see components/UiTranslator).
 *
 * Keys are the EXACT English strings as rendered (Title Case per the platform
 * rule). A '#' in a key is a number wildcard: at lookup time digit runs
 * (optionally with $ , . %) are collapsed to '#', matched, then substituted
 * back into the translation in order - so '3 Orders' matches '# Orders'.
 *
 * The dictionary is seeded from the manufacturer dictionary (every English
 * value it defines translates identically here) plus the agent / super-agent
 * dashboard vocabulary. Anything not listed simply stays English, so adding
 * coverage is always a pure data change with zero behavioral risk.
 */

import { MDICT, type Locale } from '@/lib/i18n/manufacturer-dict';

type ZhLocale = 'zh-CN' | 'zh-TW';
type Entry = { 'zh-CN': string; 'zh-TW': string };

const CURATED: Record<string, Entry> = {
  // ── Universal actions ──────────────────────────────────
  'Save': { 'zh-CN': '保存', 'zh-TW': '儲存' },
  'Cancel': { 'zh-CN': '取消', 'zh-TW': '取消' },
};

export type { Locale };
