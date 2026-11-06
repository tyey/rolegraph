# rolegraph

A personal record of the recruitment processes one candidate takes part in, organised as a graph of roles, so that both open processes and their history can be followed and looked up later.

## Language

### Roles

**Role**:
A kind of job the candidate is pursuing, such as "Software Engineer" or "AI Software Engineer". It is a node in the role graph and is defined by the user.
_Avoid_: Position, job title, category

**Role edge**:
A directed parent → child link saying that the child Role is a specialization of the parent. A Role can have several parents. Role edges never form a cycle, and the graph can have several roots.
_Avoid_: Interconnection, relation

### Processes

**Process**:
One attempt by the candidate to get hired by one Company for one Role, from the first interaction to its end. It hangs off exactly one Role, which may itself have child Roles. Its Company may be unknown for a while only when an Agency has not yet named it. Applying to the same Company again creates a new Process.
_Avoid_: Application, opportunity, leaf, pipeline

**Open** / **Closed**:
Whether a Process is still going on or has ended. A Process is closed by giving it an Outcome, and reopened, losing that Outcome, when the same attempt picks up again.
_Avoid_: Active/archived, done

**Status**:
Where an open Process stands, as set by the candidate: **Active**, **On hold** or **Offer received**. A closed Process has no Status.
_Avoid_: Stage, phase, state

**Outcome**:
How a closed Process ended, as set by the candidate: **Accepted** (took the offer), **Declined** (turned an offer down), **Rejected** (the Company said no), **Withdrawn** (the candidate pulled out before any offer) or **Ghosted** (the Company went silent). Accepted and Declined only close a Process whose Status is Offer received, and Withdrawn only one that is not; an offer the Company takes back is Rejected.
_Avoid_: Result, resolution, verdict

**Company**:
The organisation that would employ the candidate. It is shared by all Processes with that organisation, which links them into one history. It has one current name and may have **aliases**: former or brand names it is also known by.
_Avoid_: Employer, client, organisation

**Talent team**:
A Company's own in-house recruiting team. It belongs to exactly one Company, and each Company has at most one.
_Avoid_: Internal agency, HR, in-house recruiters

**Agency**:
An independent recruiting firm that introduces the candidate to Companies. It can work with any number of Companies, and a Process goes through at most one Agency.
_Avoid_: Headhunter, external recruiter, recruitment firm

### Housekeeping

**Merge**:
Folding a duplicate Role, Company or Agency into another of the same kind. Everything attached to the folded one moves to the survivor, and the folded one is gone. A folded Company's name becomes one of the survivor's aliases.
_Avoid_: Combine, dedupe

**Reclassify**:
Moving a Process from one Role to another.
_Avoid_: Recategorise, re-tag
