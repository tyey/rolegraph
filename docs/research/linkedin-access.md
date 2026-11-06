# Research: LinkedIn message access for onboarding

Ticket: [#7](https://github.com/tyey/rolegraph/issues/7), part of the [wayfinder map](https://github.com/tyey/rolegraph/issues/1).
Researched 2026-11-06 from public documentation only. Nobody logged into or browsed a LinkedIn account for this.

## Question

How can an onboarding agent legitimately read the LinkedIn conversations the user picks? This note covers three routes:

- the official LinkedIn data export,
- the user driving a browser agent such as Claude in Chrome over chosen threads,
- the APIs.

It also covers what LinkedIn's terms allow and the practical limits, and recommends the safest way to get recruiter conversations into rolegraph. This is fact-finding only. Decisions belong to the onboarding-flow ticket.

## Key facts

### 1. Official data export ("Download your data")

Source: [LinkedIn Help: Download your account data](https://www.linkedin.com/help/linkedin/answer/a1339364)

- **Path.** Me > Settings & Privacy > Data Privacy > *How LinkedIn uses your data* > **Download your data**. Pick the data, then **Request archive**. It works on desktop only, not mobile.
- **Two tiers.** You can pick *specific categories*, which arrive "within minutes" (the table heading says "within 10 minutes"). Or you can request the *larger archive*, which arrives within 24 hours (the table heading says "within 48 hours"). The page contradicts itself on both times, so plan for up to 48 hours.
- **Messages are in the slow tier.** The Messages row is in the "Available within 48 hours" table. It is described as messages sent, received and archived, with dates, subject lines, message content and the other member's public profile URL.
- **Delivery.** LinkedIn emails a download link that works for 72 hours.
- **Format.** The help page does not name a format. Third-party guides agree it is a ZIP of CSV files with a `messages.csv` in it ([example](https://www.bitrecover.com/blog/download-linkedin-data)). That is secondary and unverified, so the importer should check the real column headers on a real export and not assume a schema.
- **Scope.** It covers your whole inbox, not the threads you pick. Any filtering to recruiter threads has to happen afterwards, on the user's machine.
- **Other caveats.** Only categories that apply to your account are included. Some connections' email addresses are left out because of their privacy settings. Closing the account ends access. Data outside the export can be asked for through a Data Access Request form, which takes several days.

### 2. APIs

**General LinkedIn APIs: no inbox access.** [Getting Access to LinkedIn APIs](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access) says "Open Permissions are the only permissions that are available to all developers without special approval". The only open permissions are `profile`, `email` and `w_member_social`. Inbox and archive permissions (`r_compliance`, `w_compliance`) are listed under "Compliance (Closed)", where "Access is closed and may not be requested." Marketing, Sales (SNAP) and Talent need partner approval and none of them reads a member's own inbox.

**Member Data Portability (DMA) API: an official API that includes messages, for EEA and Switzerland only.**

- [Member Data Portability (Member)](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-member/) lets a member create their own developer app, using the special *Member Data Portability (Member) Default Company* page, and fetch their own data.
  - Access is granted once you accept the product terms. No business verification is needed.
  - You get a token from the developer portal's OAuth Token Generator with scope `r_dma_portability_self_serve`.
  - This is "available only for LinkedIn members located in the European Economic Area and Switzerland."
- [Member Snapshot Domains](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/snapshot-domain) includes `INBOX`, described as "Messages sent and received in the member's inbox". Domains become available at different times "depending on the effort required" after consent.
- [Member Snapshot API](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/shared/member-snapshot-api):
  - The call is `GET https://api.linkedin.com/rest/memberSnapshotData?q=criteria&domain=INBOX` with the header `Linkedin-Version: 202312`. Only that version works; any other returns 426.
  - Results come back as paginated JSON key-value records. You loop until the API answers "No data found for this memberId", because `total` is unreliable.
  - This page lists the scope as `r_dma_portability_member`, which contradicts the setup page. Check in the portal.
- The [3rd Party variant](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-3rd-party/) needs a verified company page and business verification, and only EEA members can consent to it. It is the wrong fit for a personal localhost tool.
- Like the export, this returns the whole inbox, not chosen threads.
- The [Member Changelog API](https://learn.microsoft.com/en-us/linkedin/dma/member-data-portability/member-data-portability-member/) records interactions only from the moment of consent and keeps 28 days of them. It is useful for incremental updates, not history.

**Unofficial "LinkedIn messaging APIs".** Some vendors resell inbox access without a LinkedIn partner agreement, and some MCP servers wrap session cookies. These are third-party automation of the logged-in site, so they fall under the same User Agreement bans as scrapers (below). They are out of scope for a safe path.

### 3. User driving a browser agent (e.g. Claude in Chrome) over chosen threads

**What LinkedIn's terms say.** [User Agreement](https://www.linkedin.com/legal/user-agreement), effective 3 Nov 2025, §8.2 "Don'ts":

- Item 2 bans developing, supporting or using "software, devices, scripts, robots or any other means or processes" to scrape or copy the Services, including profiles and other data. Crawlers and browser plugins/add-ons are named.
- Item 13 bans "bots or other unauthorized automated methods to access the Services". Automated sending or redirecting of messages is among its examples.
- Item 4 bans copying or distributing information obtained from the Services without the content owner's consent.
- §8 says these apply "unless otherwise explicitly permitted by LinkedIn in a separate writing".
- §3.1: "You own all of your original content". That covers the user's own side of a thread. The recruiter's side is their content.

**LinkedIn Help on enforcement:**

- [Prohibited software and extensions](https://www.linkedin.com/help/linkedin/answer/a1341387) says third-party software or browser extensions that scrape, change the site's appearance or automate activity are prohibited. Accounts using them risk being restricted or shut down.
- [Automated activity on LinkedIn](https://www.linkedin.com/help/linkedin/answer/a1340567) says a restricted account is re-enabled once the software is disabled. It also says such tools "may be a violation of privacy legislation in specific jurisdictions".
- [Restricted Action Message](https://www.linkedin.com/help/linkedin/answer/a1339210) says "an unusually large number of page views" can trigger a restriction, and the advice is to wait 24 hours. It quotes a ban on "automated or manual means of systematically viewing pages". That wording is not in the current §8.2 text, so it is probably from an older version of the agreement.
- None of these pages says how detection works, and none publishes a page-view threshold.

**What Anthropic's docs say:**

- [Use Claude in Chrome safely](https://support.claude.com/en/articles/12902428-use-claude-in-chrome-safely) says the user is responsible for "Respecting third-party website terms of service", including restrictions on automated access.
- The same page says Claude takes screenshots of the tabs it works in, which become part of the conversation, and it cannot filter sensitive content out of what it sees. It recommends a separate browser profile and avoiding sensitive sites.
- [Permissions guide](https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide) describes three modes: manual approval, automatic approval with safety review, and skip all approvals. You can allow a site once or always, and revoke it later in Extension settings. Claude won't follow instructions found in web content, which matters because recruiter messages are untrusted input.

**Reading of the terms.** This is our interpretation, not legal advice. A Chrome extension that reads LinkedIn pages and copies message content out fits the plain wording of §8.2 items 2 and 13, which name browser plugins/add-ons and automated methods. The terms carve out no exception for an agent the user supervises or for the user's own inbox. LinkedIn has given no "separate writing" that permits it. The risk in practice is account restriction, not a lawsuit: the help pages say restrictions are lifted once the tool is disabled. Low-volume, user-supervised reading of a few threads is far less likely to trip page-view limits than bulk crawling. Still, it remains technically outside the terms, and detection thresholds are not published.

**Manual copy-paste stays allowed.** The user can open a thread themselves and copy or "save as" its text into a file for the agent. That is a person using the site normally to keep their own records. It is a different case from software doing the copying.

## Options compared

| | Official export | DMA Member API | Browser agent over chosen threads | User copy-pastes chosen threads |
|---|---|---|---|---|
| **Allowed by terms** | Yes, the official feature | Yes, the official API (DMA) | No: §8.2 items 2 and 13 by their wording | Yes, normal manual use |
| **Eligibility** | Any member | EEA and Switzerland members only | Any | Any |
| **Thread selection** | None: whole inbox, filter afterwards | None: whole `INBOX`, filter afterwards | Yes | Yes |
| **Format** | ZIP of CSVs (`messages.csv`, layout not specified by LinkedIn) | Paginated JSON key-value records | Whatever the agent extracts from screenshots or DOM | Free text |
| **Latency** | Up to 24–48 h, link valid 72 h | Minutes to hours after consent, varies by domain | Immediate | Immediate |
| **Repeatable / incremental** | Request again each time | Yes; Changelog keeps 28 days from consent | Yes | Yes |
| **Account risk** | None | None | Restriction if detected | None |
| **Privacy surface** | File on user's disk | Token plus JSON on user's disk | Screenshots of LinkedIn pages sent to the LLM conversation | Only what the user pastes |
| **Effort** | Low: a few clicks and a wait | Medium: developer app, token, paging script | Low for the user | Medium for many threads |

## Practical limits

- No public LinkedIn API, open or partner, reads a member's inbox outside the DMA products. The compliance permissions are closed.
- The export and the DMA API return all messages. Picking threads has to happen on the user's side: the onboarding agent filters by participant or keyword and shows candidates for the user to confirm. Whatever the user rejects never reaches rolegraph. This fits the map's "review/confirm before writing" note.
- The export arrives late (up to 48 h), so onboarding should be designed as asynchronous: request the export, then import when the file lands.
- The export's CSV columns are not documented. The importer should be tolerant, map columns by header name, and be tested against a fixture made from the user's own export. Per the map, that fixture must stay out of the public repo.
- Data is about third parties (recruiters), so it falls under the map's "never put real companies, people or messages in issues or commits" rule. Keep the export file and any fixtures outside the repo.
- Messages are untrusted text. Whatever reads them, the export importer or an agent, must treat their content as data and never follow it as instructions (prompt-injection risk).

## Recommendation (safest path)

1. **Primary: official data export, filtered on the user's machine.** The user requests the archive. The onboarding agent reads `messages.csv` from the local ZIP, groups rows into conversations, proposes the likely recruiter threads, and the user confirms which to import through rolegraph's API. It is fully within the terms, has no account risk, works for any member, and LinkedIn never sees an agent.
2. **Optional, where eligible: the DMA Member API.** Same terms safety, with structured JSON and repeatable pulls. It only works for EEA and Swiss members, and needs a one-time developer app and token. It is worth offering if the user is eligible and wants periodic refreshes. A small exporter script should write the JSON to disk so the same "filter, then confirm" step can consume it.
3. **Fallback for one-off threads: manual copy-paste or save-as** of a single thread into a file the agent reads. Use it when the user wants something imported now and not after 24–48 h.
4. **Avoid: a browser agent (Claude in Chrome or similar) reading LinkedIn.** It is the only option that gives true thread-level selection with no waiting. But it conflicts with User Agreement §8.2 as written, risks restriction, and sends screenshots of LinkedIn pages, including unrelated threads, into the LLM conversation. If the user still chooses it, that is their call under both LinkedIn's and Anthropic's terms, and it should not be the path rolegraph documents or builds around.

## Open points for the onboarding-flow ticket

- Confirm the real `messages.csv` columns from one real export, kept private and out of the repo.
- Decide whether rolegraph ships an importer for the export, or leaves parsing to the outside agent and exposes only the API.
- Decide whether to support the DMA API at all, given the user's location.
- Provenance: record the source (export file, date, API pull) on each imported fact.
