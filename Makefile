# BoxVault local development commands.
# Run from the repository root: make backend

.PHONY: backend

backend:
	@test -f apps/api/.env || { echo "Missing apps/api/.env. Copy apps/api/.env.example and configure development-only credentials."; exit 1; }
	@test -f apps/api/node_modules/@nestjs/cli/bin/nest.js || { echo "Missing API dependencies. Run pnpm install from the repository root."; exit 1; }
	@echo "Starting BoxVault NestJS API with apps/api/.env (development/watch mode)..."
	@cd apps/api && node --env-file=.env ./node_modules/@nestjs/cli/bin/nest.js start --watch
