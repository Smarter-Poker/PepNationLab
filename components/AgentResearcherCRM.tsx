/**
 * R30 - Researcher CRM was rebuilt as AgentResearcherCRMv2.
 *
 * This file is now a thin re-export so every existing importer (the agent
 * dashboard, future surfaces) picks up the new build without any wiring
 * changes. The original v1 implementation lived here through R26; the v2
 * rebuild adds:
 *
 *   - 10 KPI tiles with sparklines + WoW deltas + click-to-filter
 *   - Goal & streak header (current-month new-researcher target)
 *   - Insight strip (at-risk, repeat rate, commission, growth nudges)
 *   - Filter chips (All / VIPs / At-Risk / New / Inactive / Pinned)
 *   - Rich table with status badges, churn risk bar, last-contacted column
 *   - Per-row Message / Tag / Pin actions, inline expanded contact panel
 *   - Activity feed
 *   - Empty state with 3-step checklist + Copy Storefront Link
 *   - CSV export
 *   - Mobile card-stack layout under 640px
 *
 * The new payload is served by /api/agent/researchers/v2.
 */
export { default } from './AgentResearcherCRMv2';
