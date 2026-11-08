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

### People

**Person**:
A human the candidate deals with during recruitment, such as a recruiter, an interviewer or a hiring manager. There is one Person per human, shared by every Process they take part in, so looking at a Person shows their history across Companies and Agencies and leads back to each of those Processes. A Person may start as a placeholder known only by a description, such as "senior engineer from the platform team", and be named or Merged into the real Person later.
_Avoid_: Contact, recruiter (for the general case)

**Profile link**:
A way to reach or recognise a Person, such as a LinkedIn profile URL or an email address. A Person has any number of them. A new Person whose Profile link already belongs to another Person is offered as a match for that Person, while a similar name is only suggested; the candidate decides, and two Persons found to be one human are Merged. Several Persons can share a Profile link, such as a shared hiring inbox, so a match is only offered, never forced.
_Avoid_: Contact details, handle, identifier

**Participant**:
A Person's place in one Process, saying whom they spoke for there: the Company, its Talent team, the Agency, or no one, as with a friend elsewhere who referred the candidate. A Person has at most one Participant per Process, and a Step lists which of its Process's Participants took part in it; someone who never appears in a Step, such as a hiring manager behind the scenes, can still be a Participant.
_Avoid_: Involvement, attendee, contact

**Part**:
What a Participant does in their Process, such as Recruiter, Sourcer, Coordinator, Interviewer, Hiring manager, Team member, Referrer or Executive. A Participant has one or more Parts. rolegraph starts with a set of Parts; the candidate can add, rename and Merge them.
_Avoid_: Role (that is a kind of job), function, capacity, title

**Decision maker**:
A Participant the candidate has marked as having a say in whether they are hired in that Process. A Process can have none, one or several, and the mark goes with any Part.
_Avoid_: Hiring authority, approver, boss

### Timelines

**Timeline**:
The Steps of one Process in date order. Steps may overlap or share a day, and there are no branches between them; undated Planned Steps come after the dated ones, in an order the candidate chooses.
_Avoid_: History, pipeline, loop

**Step**:
One interaction within exactly one Process, such as an application, a screening call, an interview, or a decision the Company sends, like an offer or a rejection. It has a Step kind, a day (required once Done, optional while Planned), an optional time of day and an optional end, such as the due day of a take-home.
_Avoid_: Stage, round, event, interview (for the general case)

**Origin**:
The Step that started a Process, such as the candidate's application or a recruiter reaching out. Every Process has exactly one, created with it and always first on its Timeline.
_Avoid_: Source, lead, first contact

**Channel**:
The route an Origin came through, such as LinkedIn, a job board, a company careers site, email or a referral. Only an Origin has a Channel; rolegraph starts with a set of Channels and the candidate can add, rename and Merge them.
_Avoid_: Source, medium, platform

**Step kind**:
What sort of Step it is, such as Application, Screening, Live coding, Take-home, Culture fit or Offer. rolegraph starts with a set of Step kinds; the candidate can add, rename and Merge them, and every Step kind can be reused by any Process.
_Avoid_: Step type, category

**Planned** / **Done** / **Cancelled**:
Whether a Step is still to come, has happened, or will not happen. Rescheduling a Planned Step only changes its day or time; a Cancelled Step stays on the Timeline. Closing a Process cancels its remaining Planned Steps, and a Closed Process can gain Done Steps but no Planned ones.
_Avoid_: Scheduled, completed, deleted

**Prep notes**:
What the candidate knows and plans in order to prepare, written on a Step or on the Process as a whole. Practice for a Step draws on both, together with the Step's Documents.
_Avoid_: Prep context, preparation, briefing

**Reflection**:
The candidate's own account of how a Step went, at most one per Step.
_Avoid_: Notes, self-feedback, retro

**Feedback**:
What someone else said about the candidate after a Step, such as an interviewer's comments or the reasons for a rejection. A Step can have several, each with the day it arrived and who gave it: a Participant of that Process when known, otherwise the Company, its Talent team or the Agency.
_Avoid_: Review, evaluation, reflection

### Documents

**Document**:
A file kept in rolegraph as an exact copy, such as a CV that was sent or a job description that was received. It is identified by its bytes, so the same file is one Document however many Steps it is attached to, and a changed file is a new Document. Each Step keeps the file name the Document was added under there, so one Document can carry different names on different Steps. Each is marked **Sent** or **Received**.
_Avoid_: DocumentRef, attachment, file, link

**Document kind**:
What sort of Document it is, such as CV, Cover letter, Job description, Take-home brief, Take-home submission, Offer letter, Notes or Other. rolegraph starts with a set of Document kinds; the candidate can add, rename and Merge them.
_Avoid_: Document type, category

**Provenance**:
The optional record of where a Document was produced, such as the cv-latex commit and path a CV was built at. A Document added by hand has none.
_Avoid_: Source, origin, link

### Housekeeping

**Merge**:
Folding a duplicate Role, Company, Agency, Person, Part, Step kind, Channel or Document kind into another of the same kind. Everything attached to the folded one moves to the survivor, and the folded one is gone. A folded Company's name becomes one of the survivor's aliases.
_Avoid_: Combine, dedupe

**Reclassify**:
Moving a Process from one Role to another.
_Avoid_: Recategorise, re-tag
