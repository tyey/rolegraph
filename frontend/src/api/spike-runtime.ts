import { rolesCreateRole, rolesListRoles, rolesDeleteRole } from './generated/endpoints/roles/roles'
import { RolesListRolesResponse, RolesCreateRoleBody } from './generated/zod/roles/roles.zod'

const created = await rolesCreateRole(RolesCreateRoleBody.parse({ title: 'Engineer' }))
console.log('create', created.status)
const bad = await rolesCreateRole({ title: '' })
console.log('invalid create', bad.status, bad.status === 422 ? bad.data.detail?.[0]?.type : '')
const list = await rolesListRoles({ limit: 5 })
console.log('list', list.status, JSON.stringify(list.data))
const parsed = RolesListRolesResponse.safeParse(list.data)
console.log('zod parse', parsed.success, parsed.success ? '' : JSON.stringify(parsed.error.issues.map(i => [i.path, i.message])))
if (created.status === 201) console.log('delete', (await rolesDeleteRole(created.data.id)).status)
