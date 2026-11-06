# Research: the cv-latex repo and referencing CV versions

Ticket: [#3](https://github.com/tyey/rolegraph/issues/3) · Map: [#1](https://github.com/tyey/rolegraph/issues/1) · Researched 2026-11-06

> **Privacy note.** `cv-latex` is a **private** repo that holds personal data. This file is in a
> public repo, so it describes only the repo's *structure and mechanisms*. Company, employer and
> people names have been replaced with general descriptions, and no CV content is quoted.

## Question

1. What does the user's `cv-latex` repository contain: its structure, branches and tags, build
   outputs and per-company variants?
2. What is the most robust way for a timeline **Step** to reference *the exact CV or cover letter
   that was sent*? The candidates are a commit-SHA permalink, a tag, a release asset, or a copy of
   the PDF stored in rolegraph.
3. What could an onboarding agent extract from that repo's history: which variant went to which
   company, and when?

## Key facts

### The cv-latex repo

Everything below was gathered read-only through `gh` / the GitHub REST API on 2026-11-06.

| Fact | Source |
|---|---|
| The repo is private. Its default branch is `main`. It was created 2026-08 and last pushed 2026-11-05. | `gh repo view tyey/cv-latex` |
| It has **no tags and no GitHub Releases**. | `GET /repos/tyey/cv-latex/tags` returns `[]`; `gh release list` is empty |
| It is a LaTeX (`moderncv`, `pdflatex`/`latexmk`) workspace. The repo's own `CLAUDE.md` documents the layout and workflow. | `CLAUDE.md` on `main` |
| Layout: `src/ModernCV_Master.tex` is a long master record that every variant branches from. `src/roles/*.tex` holds one cut-down CV per application. `releases/` holds the dated PDFs that were actually sent. Also present: `archive/legacy-sources/` (superseded `.tex`), `archive/historical-cvs/` (pre-LaTeX CVs, an old cover letter and reference scans, with an `INDEX.md`), `docs/specs/` (design specs for targeted CVs), `docs/linkedin/` (a profile draft) and `assets/` (photos). `build/` is git-ignored. | `GET /repos/tyey/cv-latex/git/trees/main?recursive=1`; `CLAUDE.md` |
| Workflow: per application, the author branches from the master, cuts it to the target role, compiles it, and copies the PDF to `releases/YYYYMMDD_<Name>_CV.pdf`. `releases/` is described as **append-only**, a "snapshot of a CV actually sent". `.gitignore` allows PDFs only in `releases/`. | `CLAUDE.md` ("Release convention") |
| Release filenames normally carry **no company name**, because the author keeps role codenames out of the filename that recruiters see. Two files are exceptions with a variant suffix (`_<Variant>.pdf`). Three legacy files use other date formats (`YYYYMM_`, `YYYY-MM-DD_`) or have no date at all. | `releases/` listing; `CLAUDE.md` |
| `main` holds 14 release PDFs from 2018 to 2026. Sizes run from about 175 KB to 1.04 MB, so at least one is over the Contents API's 1 MB limit for the default media type. | `GET /repos/tyey/cv-latex/contents/releases?ref=main` |
| The link from a release PDF to its target lives **only in free text**. Sources: a table in `CLAUDE.md` (role `.tex` → date → target role/company → "Produced `releases/…pdf`"), commit messages ("Release the … CV as …pdf"), branch names and PR titles, and each role `.tex` header comment, which also lists what was deliberately not claimed. | `CLAUDE.md`; `GET /repos/tyey/cv-latex/commits`; `gh pr list` |
| Branching: there is one branch per application or batch. These are generalised here because branch names contain company names. There are 9 branches, and 11 PRs, 9 of them merged. **Two PRs were stacked**: they merged into another feature branch whose PR to `main` is still open. As a result, 4 release PDFs and the only LaTeX **cover letter** (`src/letters/*.tex`, `releases/YYYYMMDD_<Name>_Cover_Letter.pdf`) exist **only on non-default branches**. | `gh pr list --json headRefName,baseRefName,mergedAt`; `GET /compare/main...<branch>` |
| **The append-only rule has been broken once.** A "re-release" commit *modified* an existing `releases/*.pdf` in place, so the same path holds two different PDFs at two commits. | `GET /repos/tyey/cv-latex/commits/35f6a704` (`status: modified`) |
| Release commits change the PDF, `CLAUDE.md`, and often the master and role `.tex` together. The commit that adds a PDF therefore also pins the source that produced it. | `GET /commits/fa31fc68`, `/commits/b2ea44e7` |
| Older cover letters and CVs exist only as `.docx`/`.pdf` in `archive/historical-cvs/`. They have no dated naming and no record of where they were sent. | tree listing; `CLAUDE.md` |

### GitHub mechanisms for pinning an exact file version

| Fact | Source |
|---|---|
| Replacing the branch name in a file URL with a commit ID gives a link that "will permanently link to the exact version of the file in that commit". Pressing `y` on a file page rewrites the URL to that permalink. | [GitHub Docs: Getting permanent links to files](https://docs.github.com/en/repositories/working-with-files/using-files/getting-permanent-links-to-files) |
| Git stores file contents as content-addressed **blob** objects. The blob SHA is a hash of the bytes, so identical bytes give the same SHA and any change gives a different one. | [Pro Git: Git Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects) |
| The Contents API takes `ref` (a commit, branch or tag) and returns the file's `sha`, which is the blob SHA. Files of 1–100 MB are served only with the `raw`/`object` media types, and nothing over 100 MB is served. `download_url`s "expire and are meant to be used just once". | [GitHub REST: Repository contents](https://docs.github.com/en/rest/repos/contents) |
| **Immutable releases** lock the tag to a commit and make the assets impossible to modify or delete. A deleted release's tag name cannot be reused. Title and notes can still be edited. | [GitHub Docs: Immutable releases](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/immutable-releases) |
| Every one of these links points into a **private** repo, so following it needs the user's GitHub auth. None of them can be followed from an exported rolegraph folder on a machine without that auth. | The repo is private (above); Contents API `download_url` expiry (above) |

The next point is an inference, not a documented guarantee. A commit that is reachable only from a
branch can become unreachable once that branch is deleted. For example, stacked branches are often
deleted after merge. An unreachable commit is no longer protected from git garbage collection, so a
SHA permalink is only as durable as the refs that keep its commit alive.

## Options compared

| Option | Pins exact bytes? | Survives cv-latex history changes? | Works offline / in rolegraph export? | Cost |
|---|---|---|---|---|
| **A. Path on a branch** (`blob/main/releases/x.pdf`) | No. The path has been overwritten once and branches move. | No | No | None |
| **B. Commit-SHA permalink** (`blob/<sha>/releases/x.pdf`) | Yes | Only while some ref keeps the commit reachable. 4 PDFs are on unmerged branches today. | No (private, needs auth) | None. The SHA is already in history. |
| **C. Tag per sent document** (e.g. `sent/YYYYMMDD-<slug>`) | Yes, if tags are never moved | Yes. A tag keeps the commit reachable. | No | One `git tag` per send, plus a new habit in cv-latex. There are no tags today. |
| **D. GitHub Release asset** (immutable release) | Yes. Tamper-proof. | Yes | No (private, needs auth) | Heaviest: a release per send, assets uploaded separately, duplicated next to `releases/`. |
| **E. Copy of the PDF stored in rolegraph** | Yes (checksum the bytes) | Yes. Independent of cv-latex. | **Yes.** Travels with export/import to the synced folder. | Storage of about 0.2–1 MB per document. Personal data sits in rolegraph's local data dir, which is local and never committed. |

## Recommendation

A Step should reference a sent CV or cover letter with **both** a stored copy and a provenance
pointer. The copy (E) makes the record self-contained. The pointer (B) records where the copy came
from. Tags (C) are an optional extra, adopted in cv-latex, that make the pointer durable.

A suggested value object (names are proposals for `CONTEXT.md`, not settled terms):

```
DocumentRef            # attached to a Step; kind = cv | cover_letter | other
  kind
  sha256               # hash of the stored bytes: identity + integrity check
  stored_file          # rolegraph-managed copy, content-addressed by sha256, included in export
  original_filename    # e.g. YYYYMMDD_<Name>_CV.pdf
  source:              # optional provenance; absent for documents not from cv-latex
    repo               # "tyey/cv-latex"
    commit_sha         # full 40-char SHA of the commit that introduced these bytes
    path               # releases/...pdf
    blob_sha           # git blob SHA; cross-checks that commit+path still hold these bytes
    source_tex         # optional: src/roles/....tex at the same commit
```

Why this design:

- **Exactness.** `sha256` and `blob_sha` both identify the bytes. Storing only the path would break,
  because the repo has already overwritten a release path once.
- **Durability.** rolegraph's own copy survives branch deletion, history rewrites, repo renames and
  loss of GitHub access. It also fits the map's requirement that data survives across machines
  through export/import.
- **Navigability.** `repo + commit_sha + path` produces the permalink
  `https://github.com/<repo>/blob/<commit_sha>/<path>` for the user, and it also pins the `.tex`
  source that produced the PDF.
- **Privacy.** PDFs live only in the local data dir and the synced export folder, never in the
  public rolegraph repo. That dir should be git-ignored.
- **Optional hardening in cv-latex.** A lightweight `sent/…` tag per sent document keeps the
  commit reachable. Immutable releases are not worth the ceremony for a single-author private repo.

The same `DocumentRef` covers cover letters, documents attached by hand (no `source`), and any
document produced outside cv-latex.

## What an onboarding agent could extract

All of this is available through the authenticated `gh`/REST API, read-only:

1. **Every distinct sent document.** List `releases/` (and `src/letters/`) on **every branch**,
   not only `main`, through the Trees API. Deduplicate by blob SHA. Each unique blob becomes one
   candidate `DocumentRef`.
2. **When each one was produced.** For each blob, find the commit that introduced it
   (`GET /commits?path=<path>&sha=<branch>`, oldest commit where the blob first appears). That
   gives the commit SHA and date. The `YYYYMMDD` filename prefix is a second date signal.
   Re-released paths produce several blobs and therefore several documents.
3. **Which company and role it targeted.** Three sources, in order of reliability:
   - the `CLAUDE.md` table row ("Produced `releases/…`")
   - the release commit's message, its PR title and branch name
   - the role `.tex` changed in the same commit, whose header comment names the target and lists
     deliberate omissions (useful later as prep context)

   Variant suffixes in filenames help in two cases only.
4. **Supporting context.** `docs/specs/*` design specs and `.tex` header comments can seed a Step's
   prep context. The master `.tex` can seed career facts.

Caveats the onboarding flow (map: "Onboarding flow (v2)") must handle:

- The link from a PDF to a company is **free text**, so the agent proposes and the user confirms.
- The filename date is a **build date**, not a confirmed send date.
- Documents from before 2026 and the pre-LaTeX documents have **no target recorded**.
- Some documents exist **only on unmerged branches**, so a `main`-only scan misses them.
- One path holds **two different PDFs** over time.
- The repo also holds third-party personal data (reference letters) that onboarding must **not**
  import.
- Nothing extracted may be written to the public repo or to issues.
