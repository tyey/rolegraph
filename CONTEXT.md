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
One attempt by the candidate to get hired by one Company for one Role, from the first interaction to its end. It hangs off exactly one Role. Applying to the same Company again creates a new Process.
_Avoid_: Application, opportunity, leaf, pipeline

**Company**:
The organisation that would employ the candidate. It is shared by all Processes with that organisation, which links them into one history.
_Avoid_: Employer, client, organisation
