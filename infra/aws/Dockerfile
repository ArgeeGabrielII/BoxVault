# Build native Prisma/Argon2 dependencies on the same Amazon Linux runtime used
# by Lambda. This image only builds artifacts; it is not deployed or pushed.
FROM public.ecr.aws/lambda/nodejs:24 AS package
RUN dnf install -y zip findutils && dnf clean all
RUN npm install --global pnpm@10.18.0
WORKDIR /build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/ ./apps/api/
COPY infra/aws/sql/ /reviewed-sql/
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build
RUN pnpm install --frozen-lockfile --filter @boxvault/api...
RUN pnpm --filter @boxvault/api db:generate && pnpm --filter @boxvault/api build
RUN pnpm --filter @boxvault/api deploy --prod --legacy /opt/boxvault-package
WORKDIR /opt/boxvault-package
RUN node node_modules/prisma/build/index.js generate --schema prisma/schema.prisma
RUN mkdir -p aws-sql && cp /reviewed-sql/runtime-grants.sql aws-sql/runtime-grants.sql
RUN node -e "const fs=require('node:fs');fetch('https://truststore.pki.rds.amazonaws.com/ap-southeast-2/ap-southeast-2-bundle.pem').then(r=>{if(!r.ok)throw Error('RDS CA unavailable');return r.text()}).then(x=>{if(!x.includes('BEGIN CERTIFICATE'))throw Error('Invalid RDS CA');fs.writeFileSync('rds-ca.pem',x)})"
# No env files, source maps, test fixtures or dev-only UI are shipped to Lambda.
RUN rm -rf src test && find . -name '*.map' -delete
RUN node -e "require('@prisma/client');require('argon2');require('./dist/lambda.js');require('./dist/aws/migrate.js');require('./dist/aws/rotate-database.js');console.log('Amazon Linux runtime import checks passed')"
RUN mkdir -p /opt/artifacts && zip -q -r -y /opt/artifacts/api.zip .
RUN node -e "const fs=require('node:fs'),cp=require('node:child_process');let total=0;for(const x of cp.execFileSync('find',['.','-type','f','-printf','%s\\n'],{encoding:'utf8'}).trim().split('\\n'))total+=Number(x);if(total>240*1024*1024)throw Error('Lambda uncompressed artifact too large');console.log('Uncompressed package bytes: '+total);const z=fs.readFileSync('/opt/artifacts/api.zip');fs.writeFileSync('/opt/artifacts/api.sha256',require('node:crypto').createHash('sha256').update(z).digest('hex')+'\\n');"
