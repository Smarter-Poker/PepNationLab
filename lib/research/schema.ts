/**
 * Shared JSON-LD builders for the research library.
 *
 * The curated / ranked list pages (most-cited, approved-drugs, intranasal,
 * most-studied, by-class, ...) already server-render their ranked compound
 * cards, but their JSON-LD @graph carried only a CollectionPage node with no
 * item-level structure. Search engines therefore saw "a page about a
 * collection" rather than "a ranked list of these specific compounds", and AI
 * answer engines had to infer the items from prose.
 *
 * An ItemList node is purely additive: it describes content that is already on
 * the page, makes these pages eligible for list/carousel rich results, and
 * hands crawlers an explicit, ordered entity list.
 */

const BASE = 'https://pepnationlab.com';

/** The minimum shape needed to reference a compound monograph. */
export interface CompoundListItem {
  display_name: string;
  slug: string;
}

export type ItemListOrder = 'descending' | 'ascending' | 'unordered';

const ORDER_URI: Record<ItemListOrder, string | undefined> = {
  descending: 'https://schema.org/ItemListOrderDescending',
  ascending: 'https://schema.org/ItemListOrderAscending',
  // Schema.org has ItemListUnordered, but omitting the property entirely is the
  // safer signal for a merely alphabetical index -- it avoids implying a rank.
  unordered: undefined,
};

/**
 * Build an ItemList node for a list of compounds that the page already renders.
 *
 * @param name     Human-readable list name (mirrors the page's H1 intent).
 * @param pageUrl  Absolute canonical URL of the page emitting this node.
 * @param items    The compounds, already in the order the page displays them.
 * @param order    'descending' for ranked lists (default), 'unordered' for
 *                 alphabetical indexes -- never claim a rank the page lacks.
 * @param limit    Cap on emitted items (default 50). Keeps the payload small;
 *                 search engines do not need the full long tail.
 */
export function compoundItemListJsonLd(params: {
  name: string;
  pageUrl: string;
  items: ReadonlyArray<CompoundListItem>;
  order?: ItemListOrder;
  limit?: number;
}): Record<string, unknown> {
  const { name, pageUrl, items, order = 'descending', limit = 50 } = params;

  const capped = items
    .filter((c) => c && c.slug && c.display_name)
    .slice(0, limit);

  const node: Record<string, unknown> = {
    '@type': 'ItemList',
    '@id': `${pageUrl}#itemlist`,
    name,
    numberOfItems: capped.length,
    itemListElement: capped.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.display_name,
      url: `${BASE}/research/${c.slug}`,
    })),
  };

  const orderUri = ORDER_URI[order];
  if (orderUri) node.itemListOrder = orderUri;

  return node;
}
