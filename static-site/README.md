# ABQ Unplugged static calendar

`v2-weekly-refresh.yml` imports public source feeds once a week, Thursdays at 6 PM Denver (so Friday's Instagram roundup has the latest events),
runs bounded cleanup, and generates HTML and a public calendar index. It does
not receive model credentials or schedule social posts, emails, image hosting,
or Netlify builds. Missing organizer images use the site's existing category
photos. No database request or server function is needed to visit or filter the
calendar. Admin and submissions still use the legacy Netlify app.

The build needs Node 24, the locked V2 npm dependencies, and the Supabase
publishable key in `ABQ_PUBLIC_KEY`. From the repository root:

```sh
npm --prefix v2 ci --legacy-peer-deps --ignore-scripts
node --test static-site/calendar.test.mjs
npm exec --yes --package=tsx@4.23.15 -- tsx --tsconfig v2/tsconfig.json static-site/build.mjs
node static-site/verify.mjs
```

A build or import failure leaves the last successful deployment serving. The
scheduled workflow makes no changes to Cloudflare until the build is verified.
Use the workflow's **snapshot only** input to publish without repeating an
already successful import. The build fails closed on catalog read errors or
implausibly low inventory; fix the feed and rerun rather than publishing a
sparse snapshot.

Cloudflare Pages project: `abq-unplugged-static`. Its production branch is
named `main` in Pages; GitHub's default source branch is `v2`. Store a Pages
Edit credential as environment secret `CLOUDFLARE_PAGES_TOKEN` in
`abq-cloudflare-production`, restricted to `v2`. The existing GitHub account
ID secret is used. Set repo variable `ABQ_STATIC_PUBLISH_ENABLED=true` only
after wiring the token. Verify the full build at the Pages hostname before
attaching the apex and www. Use Pages deployment rollback to recover a prior
static release; keep the old DNS targets recorded if a hosting rollback is
needed. Preserve email and payment records.

`ABQ_PREVIEW_DAYS=90` is available only for a smaller dashboard upload; it
sets a no-index header. Scheduled publishing always builds the full catalog.
