// Spike (#19): exercises the generated hooks and Zod schemas so tsc checks real usage.
import { useQueryClient } from '@tanstack/react-query'
import {
  getRolesListRolesQueryKey,
  useRolesCreateRole,
  useRolesListRoles,
} from './generated/endpoints/roles/roles'
import { useProcessesListProcesses } from './generated/endpoints/processes/processes'
import { ProcessState, type RoleCreate, type RoleOut } from './generated/model'
import { RolesCreateRoleBody, RolesListRolesResponse } from './generated/zod/roles/roles.zod'

export function RolesSpike({ roleId }: { roleId: string }) {
  const queryClient = useQueryClient()
  const roles = useRolesListRoles({ limit: 10 })
  const processes = useProcessesListProcesses(roleId, { state: ProcessState.active })
  const createRole = useRolesCreateRole({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getRolesListRolesQueryKey() }),
    },
  })

  const submit = (input: unknown) => {
    const parsed = RolesCreateRoleBody.safeParse(input)
    if (!parsed.success) return parsed.error.issues
    const body: RoleCreate = parsed.data
    createRole.mutate({ data: body })
    return []
  }

  let list: RoleOut[] = []
  if (roles.data?.status === 200) {
    list = RolesListRolesResponse.parse(roles.data.data)
  }
  // @ts-expect-error: a 422 body is not RoleOut[], so the status narrowing must matter
  const wrong: RoleOut[] = roles.data?.data ?? []

  const states = processes.data?.status === 200 ? processes.data.data.map((p) => p.state) : []

  return (
    <button onClick={() => submit({ title: 'x' })}>
      {list.length} {wrong.length} {states.join(',')}
    </button>
  )
}
