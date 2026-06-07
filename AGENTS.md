<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:deployment-rules -->
# Hard Deployment Law

After EVERY code change or fix — no exceptions:
1. Write any required SQL migration files to `supabase/migrations/` and apply them via `npx supabase db push` (or note if Supabase CLI is unavailable and provide the raw SQL).
2. Commit ALL changed files with `git add -A && git commit -m "..."`.
3. Push to production with `git push` (Vercel auto-deploys on push).
4. Only AFTER push is confirmed, give the user a report.

Never give a report without first deploying. This is a hard law.
<!-- END:deployment-rules -->

<!-- BEGIN:iframe-omega-protocol -->
# MANDATORY: The Omega Protocol for External Links

**This is a hard platform rule with zero exceptions.**
PepNationLab strictly forbids navigating users away from the `pepnationlab.com` domain. Any external link MUST be rendered inside the app using the `IframeModal` component.
- Always use `<IframeModal url={externalUrl} title={optionalTitle} onClose={handler} />`.
- `IframeModal` natively routes the URL through `/api/proxy?url=...` to bypass `X-Frame-Options`. Never attempt to put an external URL directly into an `<iframe>` src.
- The `IframeModal` must be true full-screen, utilizing `height: 100dvh` and `z-index: 999999`. Do not alter these properties.
<!-- END:iframe-omega-protocol -->
