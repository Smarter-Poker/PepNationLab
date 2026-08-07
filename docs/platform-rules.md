# Platform rules: one definition, imported everywhere

This document exists because the same bug has now shipped to production three
times in three different disguises. It is short on purpose. If you change a
rule that users can feel, read it first.

## The bug, three times

**Password length.** The forced first-login page told a newly provisioned agent
their password had to be "At Least 12 Characters". The API that page posts to
rejected anything that was not *exactly* 8. Those two rules have no overlap, so
a new agent could not set a password at all — the page refused the short ones,
the API refused the long ones. The number was written into roughly twenty
files. Underneath them all, `lib/schemas/auth.ts` backed the entire platform
with `z.string().length(8)` — an equality check — so every account-creation
route on the site silently rejected any password that was not exactly 8
characters.

**Referral attribution lifetime.** The signed `pnl_ref_lock` cookie lasted 90
days. The signup page's copy of that window said 30. A guest who scanned an
agent's QR code and came back to sign up on day 45 arrived with a live server
lock and a client that had already forgotten — so the house store took the
credit. No error, no log, nothing for the agent to dispute.

**Storefront slug shape.** The client's slug regex accepted slugs the edge
middleware would refuse to route. A storefront was captured by the server and
dropped by the client, and the agent's printed QR code pointed at a dead page.

Notice what these have in common. Nothing crashed. Types checked. The build was
green, the page rendered, and a real person hit a wall the code says cannot
exist. Every one of them was found by a user, not by us.

## The rule

**If a number, a regex, or a piece of user-facing rule copy has to be true in
more than one file, it gets exactly one definition in `lib/`, and every other
file imports it.** No exceptions for "it's only two places" — password length
started as only two places.

Current owners:

| Rule | Owner | Notes |
|---|---|---|
| Password length + copy | `lib/password-policy.ts` | `MIN_PASSWORD_LENGTH` = 8, `MAX_PASSWORD_LENGTH` = 128, plus the error and placeholder strings and `validatePassword()` |
| Referral attribution lifetime | `lib/ref-lock.ts` | `REF_LOCK_MAX_AGE` — **seconds**, because it feeds a cookie `Max-Age`. Client code comparing against `Date.now()` must multiply by 1000 |
| Storefront slug shape | `lib/store-slug.ts` | `STORE_SLUG_RE` matches an incoming `/<slug>`; `DB_SLUG_RE` is the stricter creation-time guard |
| House storefront | `lib/default-store.ts` | `DEFAULT_STORE_SLUG` |

A shared constant that needs unit conversion is *more* dangerous than one that
doesn't, not less: importing `REF_LOCK_MAX_AGE` and forgetting the `* 1000`
expires attribution after 90 seconds instead of 90 days, and nothing anywhere
will tell you.

## What enforces it

`__tests__/platform-invariants.test.ts` runs on every push and every PR
(`.github/workflows/ci.yml` → `npm test`). It fails the build when:

- any owned constant is re-declared outside its owner module;
- `PasswordSchema` and `validatePassword()` disagree about any length;
- the client attribution window stops equalling `REF_LOCK_MAX_AGE * 1000`;
- a slug the database would accept is not one the router can route;
- a password `<input>` hardcodes its bounds as number literals, or caps
  `maxLength` at the *minimum* — which is how "at least 8" silently became
  "exactly 8" in the UI even where the validator was correct. The field just
  refused the ninth keystroke, with no message at all.

`__tests__/password-policy.test.ts` additionally fails on stale rule copy
("Exactly 8 Characters", "At Least 12 Characters") and on
`password.length !== N` equality checks anywhere in `app/`, `components/`, or
`lib/`.

**When one of these fails, import the constant. Do not add your file to an
allow-list, and do not loosen the regex.** If the guard is wrong, fix the
guard deliberately and say so in the commit — a test people route around
protects nothing.

## Changing a rule

1. Change the value in the owner module. That should be the entire code change.
2. `grep` the repo for the old literal anyway — a value can be duplicated
   without using the constant's name, which is exactly how `MAX_AGE_MS` drifted.
3. Run `npm test`.
4. If the rule is user-visible, check the i18n dictionaries under `lib/i18n/`
   for stale copy — translated strings are keyed by the English text, so old
   phrasing lingers there after the UI has moved on.

## Adding a rule

Export it from a module under `lib/`, then add it to `OWNED_CONSTANTS` in
`__tests__/platform-invariants.test.ts`. That registration is what makes the
guard cover it. A shared constant nobody registered is a future incident.

## The check that actually catches these

Before shipping a change to a rule, ask: **is there a form that states this
rule, and a server route that enforces it, and did I change both?** Every
incident above was a form saying one thing and a route saying another. Grep for
the copy the user reads, not just the code that runs.
