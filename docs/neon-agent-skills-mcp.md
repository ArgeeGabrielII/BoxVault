# Neon agent skills and MCP integration

**Installation date:** 2026-11-11. **Scope:** BoxVault GitHub repository; no account authorization or environment secrets stored in Git.

## Existing configuration preservation

The repository was inspected before modification. There was no committed `.agents/` Neon skill directory or root `.mcp.json`. The existing `apps/api/prisma/schema.prisma`, `DATABASE_URL`, `DIRECT_URL` naming, `apps/api/.env.example`, GitHub Actions, and custom NestJS/Prisma auth/RLS architecture were preserved.

**Project:** `shiny-field-66278071` (organization `org-purple-surf-16785136`). No Neon cloud resources, databases, branches, schema, or connection strings were modified or retrieved by this change.

## Added

| Path | Description |
|---|---|
| `.agents/skills/neon/SKILL.md` | Canonical Neon parent agent skill copied from the official `neondatabase/agent-skills` repository |
| `.agents/skills/neon-postgres/SKILL.md` | Canonical Neon PostgreSQL skill for existing Prisma SQL, migrations, connection pooling and branches |
| `.mcp.json` | Project-level hosted Neon MCP endpoint with `type: http`, `https://mcp.neon.tech/mcp`, and **no API key** |

The requested URL `https://neon.com/.well-known/agent-skills/neon/SKILL.md` was not retrievable directly in this session; equivalent canonical skill content was fetched from `https://github.com/neondatabase/agent-skills/blob/main/skills/neon/SKILL.md`. The PostgreSQL child skill was fetched from the same official repository.

## Client support and OAuth

The committed `.mcp.json` is used by compatible project-level MCP clients (for example, certain Claude Code configurations); **not every agent automatically reads it**. ChatGPT's Neon plugin is a separate account-level connection and **is not installed or authorized by adding this file**. The owner must install and explicitly authorize Neon within ChatGPT if direct Neon tools are desired. OAuth is used to prevent committing tokens.

For tools with their own MCP settings (including Codex or Cursor), follow their Neon setup procedure. From the repository directory, after authenticating the Neon CLI manually, an agent-specific project installation can be created with:

```bash
neon mcp --oauth --project --agent <supported-agent-id> -y
neon skills -s neon --agent <supported-agent-id> -y
neon skills -s neon-postgres --agent <supported-agent-id> -y
```

**Do not run `neon init -y` blindly on an existing BoxVault checkout.** It can pull environment variables into local files and change configuration. First inspect `.neon`, `neon.ts`, existing `.env` and agent config; if linking, use `--no-env-pull` or an explicit alternate output file where appropriate. Never run unattended browser login. Never store a Neon API key in Git or screenshots.

## Compatibility with BoxVault

- Keep NestJS API + Prisma 6; do not replace them with Neon Functions, Data API or Neon Auth without a separate architecture decision.
- Keep pooled `DATABASE_URL` for runtime and direct `DIRECT_URL` for Prisma migrations, per `docs/neon-connection.md`.
- For M1 security tests use a **disposable test database/branch**, never the persistent production branch.
- Use separate, rigorously limited PostgreSQL identities for fixture administration and application runtime. Validate Neon managed-role limitations before using the RLS test harness.
- No secret fields are required in `.mcp.json`; user OAuth is done interactively by the client.

## Verification state

- [x] Canonical Neon skill files added to the repository.
- [x] OAuth-only MCP endpoint definition added to the repository.
- [x] Existing Prisma, NestJS, env examples, and docs configuration preserved.
- [ ] ChatGPT Neon plugin installed and OAuth connected.
- [ ] An MCP-compatible desktop/CLI agent loaded the project config and authenticated.
- [ ] `neon skills status` run in the user's local checkout.
- [ ] Neon database connectivity, migration, RLS checks and E2E tests executed.

**No claim of a working authenticated MCP session or successful database test is made.**

## Official sources

- https://github.com/neondatabase/agent-skills/tree/main/skills/neon
- https://github.com/neondatabase/agent-skills/tree/main/skills/neon-postgres
- https://neon.com/docs/ai/agent-skills
- https://neon.com/docs/ai/connect-mcp-clients-to-neon
