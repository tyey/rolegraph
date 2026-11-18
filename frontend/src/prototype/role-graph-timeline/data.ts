// PROTOTYPE (tyey/rolegraph#13): throwaway in-memory data. Every name here is made up.

export type Side = 'Company' | 'Talent team' | 'Agency' | 'none'
export type StepState = 'Planned' | 'Done' | 'Cancelled'
export type Status = 'Active' | 'On hold' | 'Offer received'
export type Outcome = 'Accepted' | 'Declined' | 'Rejected' | 'Withdrawn' | 'Ghosted'

export type Role = { id: string; name: string }
export type RoleEdge = { parent: string; child: string }
export type Company = { id: string; name: string; aliases: string[] }
export type Agency = { id: string; name: string }
export type Person = { id: string; name?: string; description?: string; links: string[] }
export type Participant = { personId: string; side: Side; parts: string[]; decisionMaker: boolean }
export type Doc = { id: string; sha: string; kind: string; direction: 'Sent' | 'Received' }
export type StepDoc = { docId: string; fileName: string }
export type Feedback = { day: string; text: string; participantPersonId?: string; fromSide?: Side }
export type Step = {
  id: string
  kind: string
  state: StepState
  day?: string // PlainDate in the real app
  time?: string
  endDay?: string
  channel?: string // Origin only
  origin?: boolean
  participants: string[] // personIds
  docs: StepDoc[]
  prep: string
  reflection: string
  feedback: Feedback[]
}
export type Process = {
  id: string
  roleId: string
  companyId?: string
  agencyId?: string
  status?: Status
  outcome?: Outcome
  prep: string
  participants: Participant[]
  steps: Step[] // undated Planned steps keep their array order
  version: number
}
export type Db = {
  roles: Role[]
  edges: RoleEdge[]
  companies: Company[]
  agencies: Agency[]
  persons: Person[]
  docs: Doc[]
  processes: Process[]
  stepKinds: string[]
  channels: string[]
  docKinds: string[]
  parts: string[]
}

const step = (s: Partial<Step> & Pick<Step, 'id' | 'kind' | 'state'>): Step => ({
  participants: [],
  docs: [],
  prep: '',
  reflection: '',
  feedback: [],
  ...s,
})

export const seed: Db = {
  roles: [
    { id: 'r-se', name: 'Software Engineer' },
    { id: 'r-be', name: 'Backend Engineer' },
    { id: 'r-pe', name: 'Platform Engineer' },
    { id: 'r-ml', name: 'ML Engineer' },
    { id: 'r-ai', name: 'AI Software Engineer' },
    { id: 'r-em', name: 'Engineering Manager' },
  ],
  edges: [
    { parent: 'r-se', child: 'r-be' },
    { parent: 'r-se', child: 'r-pe' },
    { parent: 'r-se', child: 'r-ai' },
    { parent: 'r-ml', child: 'r-ai' },
  ],
  companies: [
    { id: 'c-fern', name: 'Fernwick Systems', aliases: ['Fernwick Labs'] },
    { id: 'c-tide', name: 'Tidepool AI', aliases: [] },
    { id: 'c-halc', name: 'Halcyon Freight', aliases: [] },
    { id: 'c-orch', name: 'Orchard Ledger', aliases: ['OrchardPay'] },
  ],
  agencies: [{ id: 'a-bridge', name: 'Bridgeway Talent' }],
  persons: [
    { id: 'p-ada', name: 'Ada Kowal', links: ['linkedin.example/in/ada-kowal'] },
    { id: 'p-jonas', name: 'Jonas Petrik', links: ['jonas@bridgeway.example'] },
    { id: 'p-mira', name: 'Mira Sol', links: ['linkedin.example/in/mirasol'] },
    { id: 'p-theo', name: 'Theo Brandt', links: [] },
    { id: 'p-ph1', description: 'senior engineer from the platform team', links: [] },
    { id: 'p-ada2', name: 'A. Kowal', links: ['linkedin.example/in/ada-kowal'] },
  ],
  docs: [
    { id: 'd-cv3', sha: '3f9a…c21', kind: 'CV', direction: 'Sent' },
    { id: 'd-cv4', sha: '7b02…e9d', kind: 'CV', direction: 'Sent' },
    { id: 'd-jd1', sha: 'a1c4…077', kind: 'Job description', direction: 'Received' },
    { id: 'd-th1', sha: 'c88e…4f1', kind: 'Take-home brief', direction: 'Received' },
  ],
  processes: [
    {
      id: 'pr-fern',
      roleId: 'r-be',
      companyId: 'c-fern',
      status: 'Active',
      prep: 'They care about Postgres internals and on-call culture. Ask about team size.',
      participants: [
        { personId: 'p-ada', side: 'Talent team', parts: ['Recruiter'], decisionMaker: false },
        { personId: 'p-mira', side: 'Company', parts: ['Interviewer', 'Hiring manager'], decisionMaker: true },
        { personId: 'p-ph1', side: 'Company', parts: ['Interviewer'], decisionMaker: false },
      ],
      steps: [
        step({ id: 's1', kind: 'Application', state: 'Done', day: '2026-10-02', origin: true, channel: 'Company careers site', docs: [{ docId: 'd-cv3', fileName: 'cv-backend.pdf' }, { docId: 'd-jd1', fileName: 'jd-backend.pdf' }] }),
        step({ id: 's2', kind: 'Screening', state: 'Done', day: '2026-10-09', time: '10:00', participants: ['p-ada'], reflection: 'Went fine; salary range matches.', feedback: [{ day: '2026-10-10', text: 'Moving you to the technical round.', participantPersonId: 'p-ada' }] }),
        step({ id: 's3', kind: 'Live coding', state: 'Cancelled', day: '2026-10-16', time: '14:00', prep: 'Practise SQL window functions.' }),
        step({ id: 's4', kind: 'Live coding', state: 'Done', day: '2026-10-21', time: '14:00', participants: ['p-mira', 'p-ph1'], prep: 'Practise SQL window functions.', reflection: 'Ran out of time on part two.', feedback: [{ day: '2026-10-24', text: 'Strong on design, slow on the second task.', fromSide: 'Company' }] }),
        step({ id: 's5', kind: 'Take-home', state: 'Planned', day: '2026-11-20', endDay: '2026-11-27', docs: [{ docId: 'd-th1', fileName: 'brief.pdf' }] }),
        step({ id: 's6', kind: 'Culture fit', state: 'Planned' }),
        step({ id: 's7', kind: 'Hiring manager chat', state: 'Planned' }),
      ],
      version: 4,
    },
    {
      id: 'pr-tide',
      roleId: 'r-ai',
      companyId: 'c-tide',
      agencyId: 'a-bridge',
      status: 'Offer received',
      prep: 'Agency says the team ships evals tooling.',
      participants: [
        { personId: 'p-jonas', side: 'Agency', parts: ['Recruiter'], decisionMaker: false },
        { personId: 'p-theo', side: 'Company', parts: ['Executive'], decisionMaker: true },
      ],
      steps: [
        step({ id: 't1', kind: 'Recruiter outreach', state: 'Done', day: '2026-09-15', origin: true, channel: 'LinkedIn', participants: ['p-jonas'] }),
        step({ id: 't2', kind: 'Screening', state: 'Done', day: '2026-09-22', participants: ['p-jonas'], docs: [{ docId: 'd-cv3', fileName: 'Kandidat_CV.pdf' }] }),
        step({ id: 't3', kind: 'Onsite', state: 'Done', day: '2026-10-14', participants: ['p-theo'] }),
        step({ id: 't4', kind: 'Offer', state: 'Done', day: '2026-11-03' }),
      ],
      version: 9,
    },
    {
      id: 'pr-agency-unknown',
      roleId: 'r-pe',
      agencyId: 'a-bridge',
      status: 'On hold',
      prep: '',
      participants: [{ personId: 'p-jonas', side: 'Agency', parts: ['Recruiter'], decisionMaker: false }],
      steps: [step({ id: 'u1', kind: 'Recruiter outreach', state: 'Done', day: '2026-11-05', origin: true, channel: 'Email', participants: ['p-jonas'] })],
      version: 1,
    },
    {
      id: 'pr-halc',
      roleId: 'r-se',
      companyId: 'c-halc',
      outcome: 'Rejected',
      prep: '',
      participants: [{ personId: 'p-ada2', side: 'Talent team', parts: ['Recruiter'], decisionMaker: false }],
      steps: [
        step({ id: 'h1', kind: 'Application', state: 'Done', day: '2026-08-01', origin: true, channel: 'Job board', docs: [{ docId: 'd-cv3', fileName: 'cv.pdf' }] }),
        step({ id: 'h2', kind: 'Rejection', state: 'Done', day: '2026-08-20', feedback: [{ day: '2026-08-20', text: 'Looking for more frontend depth.', fromSide: 'Talent team' }] }),
        step({ id: 'h3', kind: 'Screening', state: 'Cancelled', day: '2026-08-25' }),
      ],
      version: 3,
    },
    {
      id: 'pr-orch',
      roleId: 'r-em',
      companyId: 'c-orch',
      status: 'Active',
      prep: 'First EM loop: prepare people-management stories.',
      participants: [],
      steps: [step({ id: 'o1', kind: 'Referral', state: 'Done', day: '2026-11-10', origin: true, channel: 'Referral' })],
      version: 1,
    },
  ],
  stepKinds: ['Application', 'Recruiter outreach', 'Referral', 'Screening', 'Live coding', 'Take-home', 'Onsite', 'Culture fit', 'Hiring manager chat', 'Offer', 'Rejection'],
  channels: ['LinkedIn', 'Job board', 'Company careers site', 'Email', 'Referral'],
  docKinds: ['CV', 'Cover letter', 'Job description', 'Take-home brief', 'Take-home submission', 'Offer letter', 'Notes', 'Other'],
  parts: ['Recruiter', 'Sourcer', 'Coordinator', 'Interviewer', 'Hiring manager', 'Team member', 'Referrer', 'Executive'],
}
