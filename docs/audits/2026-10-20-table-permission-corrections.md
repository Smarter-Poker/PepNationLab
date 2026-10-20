# Table permission corrections, October 20

Supabase will require explicit access declarations for new public tables. This change qualifies specific existing defects and adds a forward declaration check; it does not certify every historical table or every full reset.

- Browser roles lose TRUNCATE, TRIGGER, REFERENCES and MAINTAIN across the current public relations. Their ordinary DML and all service privileges remain unchanged. Native fixtures use actual ACL metadata for 190 relations (180 base tables), not production data.
- Reactions require message participation in the service API and parent participation plus ownership in child RLS. Authentication alone previously allowed reactions to unrelated message identifiers. Unknown policy drift aborts installation.
- Order cost column revokes were overridden by table SELECT. Browser SELECT becomes ten explicit safe fields; the order detail server authorizes seller/direct-parent/admin cost reads independently of buyer visibility. Writes and service rights remain unchanged.
- Migration source qualification replaces the dormant unsafe history-rewind/unbounded push workflow. Install exact qualified migrations and verify durable history/readback separately.
- Database fixture helpers and commands refuse production targets and missing isolation evidence before client creation. A real isolated Supabase integration target is still required for the separate DB suite.

Regression enforcement: existing migration qualification executes declaration/isolation/parser tests, native PostgreSQL 17 permission tests, actual reaction API handlers and fixture entry tests. The column drift guard now bounds tagged function bodies correctly; intentional service-only RLS boundaries have exact evidence-backed guard entries. Two preexisting generated update-payload typing failures were corrected without runtime changes to permit the required build.

Thirteen Lab Journal/saved-research tables also have caller-specific explicit grants qualified without defaults (eight journal and five saved-research tables). Native tests apply their original source schemas, verify actual own-user policies, deny unrelated/unneeded operations and preserve existing live grants. Service grants are limited to observed server reads.

Local evidence: 348 unit/API tests pass, 27 Node declaration/isolation/authorization/parser tests pass, full TypeScript compilation passes, native structural (8), reaction (12) and cost (11) boundaries pass. No production test rows or auth fixtures were created. Full historical per-table least-privilege qualification continues; current broad ACLs are never treated as a safe manifest to copy.
