import type { AuthRoleRecord } from '../../api/auth-roles.js';
import { groupByArea } from './accessRoleForm.js';

/** <option>s for an access-role <select>: built-in roles grouped by area, then the centre's own roles. */
export default function AccessRoleOptions({ roles }: { roles: AuthRoleRecord[] }) {
  const own = roles.filter(r => !r.builtIn);
  return (
    <>
      {groupByArea(roles.filter(r => r.builtIn)).map(g => (
        <optgroup key={g.area} label={g.area}>
          {g.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </optgroup>
      ))}
      {own.length > 0 && (
        <optgroup label="Your roles">
          {own.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </optgroup>
      )}
    </>
  );
}
