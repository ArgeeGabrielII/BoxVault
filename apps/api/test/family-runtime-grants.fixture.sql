-- Disposable CI database ONLY. Existing content runtime, no auth-table grants.
GRANT EXECUTE ON FUNCTION security.family_workspaces(), security.family_members(uuid),
 security.family_invitations(uuid), security.family_invite(uuid,text,text,text),
 security.family_cancel(uuid,uuid), security.family_accept(text),
 security.family_change_role(uuid,uuid,text), security.family_remove(uuid,uuid)
 TO boxvault_runtime_m1;
