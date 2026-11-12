# <Application/component> — <phase and audit title>

**Snapshot date/time (timezone):** YYYY-MM-DD HH:mm Asia/Manila  
**Status:** NOT STARTED / IN REVIEW / VERIFIED / BLOCKED / FAILED  
**Area:** API / Database / Web / Mobile / Assets / Platform  
**Environment:** local / disposable CI / Neon test / production (be explicit)  
**Repository branch / PR / commit:**  
**Change authorization:** who approved what operation; link to ticket/record where available. Never imply approval from a CI pass.

## Objective and scope

Describe the intent and the exact affected applications, schemas and services. State excluded environments.

## Preconditions and safety controls

- Connection/role check (never record credentials or complete URLs):
- Backup/recovery point or available rollback method:
- Known preservation baseline:
- Prerequisite review/approval:

## Execution timeline

| Timestamp and timezone | Operator or system | Action | Expected | Observed | Evidence |
|---|---|---|---|---|---|
| | | | | | |

## Technical changes

Link files/migrations and describe tables, functions, routes, policies, role grants or UI paths affected.

## Test evidence

| Test ID / command | Test environment | Expected | Observed | Status | Source |
|---|---|---|---|---|---|
| | | | | PENDING | |

## Security and data-integrity review

Note least privilege, RLS, negative tests, secret handling, preserved records, audit logging and any exceptions.

## Risks, dependencies, and next gate

Open issues, owner (if named), steps required, and whether deployment/merge is authorized.

## Sign-off

**Engineering reviewer:** Pending  
**Security reviewer:** Pending  
**Release decision:** Not granted without documented approval
