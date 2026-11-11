import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import assert from 'node:assert/strict';
const url = process.env.AUTHZ_ADMIN_DATABASE_URL;
assert.ok(url,'Admin test URL required');
const db = new PrismaClient({datasources:{db:{url}}});
try {
  await db.user.create({
    data:{
      id:'70000000-0000-4000-8000-000000000001',
      email:'m1-auth-test@example.invalid',
      passwordHash:await argon2.hash('M1-Test-strong-password-123!',{type:argon2.argon2id}),
      emailVerifiedAt:new Date(),
    },
  });
} finally { await db.$disconnect(); }
