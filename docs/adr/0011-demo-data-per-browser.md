# Demo data is a separate database chosen per browser

rolegraph can be shown to others, or tried after installation, without exposing anyone's real data. **Demo mode** is switched on per browser from the Help menu. It sets a `rolegraph_demo=1` cookie. The composition root builds two engine + DocumentStore pairs: the real one on `<data dir>`, and a demo one on `<data dir>/demo/`. A request dependency picks the pair from the cookie. Clients without the cookie, such as other devices or agents (#16), never see Demo data, and real data is never written while demo is on. A "Demo" badge in the header shows which side a browser is on.

**Seed.** Demo data comes from a deterministic seed that creates made-up Roles, Companies, an Agency, People, Processes in every Status and Outcome, and a few generated PDFs. It goes **through the application use cases**, so it can't drift from the schema or the domain rules. Dates are relative to today, so Timelines always look current. The seed runs the first time a browser turns demo on and again on "Reset demo data" (Help menu). The Playwright journeys reuse it. It lives in the `exchange` module, which may call every module.

**Rules in demo mode.**

- Everything is editable.
- Graph export works on the demo data.
- Backup and Restore are greyed out.
- Demo changes never count as a change for the automatic Backup, and `<data dir>/demo/` is excluded from Backups.

When the real data is empty, the Roles outline offers both "Add your first Role" and "Explore with demo data". The README documents demo mode.

## Considered Options

- **A server-wide switch** (swapping the one engine). Rejected: while presenting, every device would show demo data, and forgetting to switch back would send real edits into the demo set.
- **A second `rolegraph-demo` container.** Rejected: the Help-menu toggle would become a link to another URL, and the server would run two instances.
- **A committed demo Backup zip, or a JSON fixture POSTed through the API.** Rejected: the zip's dates go stale and it is a binary in git. The fixture breaks with every API change.
- **Read-only demo, or demo on by default for new installs.** Rejected: visitors couldn't try adding a Step or a Merge, and a new user might type real data into the demo set.

## Consequences

- Startup migrates both databases. Only the real one gets a pre-migration Backup.
- Every new use case and module is automatically reachable in demo mode. The seed should grow when a feature needs demo content to be worth showing.
