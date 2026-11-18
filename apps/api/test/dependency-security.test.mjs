// Local-only compatibility checks for security-sensitive dependency upgrades.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import net from 'node:net';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { AuthHardeningService } from '../dist/auth/auth-hardening.service.js';
const require = createRequire(import.meta.url);

async function smtpFixture(t) {
  const commands = [], messages = [], sockets = new Set();
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let pending = '', data = false, body = '';
    socket.write('220 boxvault-fixture ESMTP\r\n');
    socket.on('data', chunk => {
      pending += chunk.toString('utf8');
      while (pending.includes('\r\n')) {
        const i = pending.indexOf('\r\n'), line = pending.slice(0, i);
        pending = pending.slice(i + 2);
        if (data) {
          if (line === '.') { messages.push(body); body = ''; data = false; socket.write('250 queued\r\n'); }
          else body += line + '\n';
        } else {
          const cmd = line.toUpperCase(); commands.push(cmd.split(' ')[0]);
          if (cmd.startsWith('EHLO')) socket.write('250-fixture\r\n250 SIZE 1000000\r\n');
          else if (cmd === 'DATA') { data = true; socket.write('354 message\r\n'); }
          else if (cmd === 'QUIT') { socket.end('221 bye\r\n'); }
          else if (/^(HELO|MAIL FROM|RCPT TO|RSET)/.test(cmd)) socket.write('250 ok\r\n');
          else socket.write('502 unsupported\r\n'); // Deliberately no STARTTLS support.
        }
      }
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); });
  return { port: server.address().port, commands, messages };
}
function mailEnvironment(t, port, mode) {
  const values = { NODE_ENV: mode, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port),
    SMTP_FROM: 'BoxVault <fixture@example.invalid>', PUBLIC_WEB_URL: 'https://example.invalid',
    SMTP_USER: 'fixture-only', SMTP_PASSWORD: 'fixture-only', SMTP_ALLOW_PLAINTEXT_TEST: 'true' };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  Object.assign(process.env, values);
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
}

test('mailer upgrade delivers verification and reset mail to the explicit loopback test sink', { timeout: 10000 }, async t => {
  const smtp = await smtpFixture(t); mailEnvironment(t, smtp.port, 'test');
  const service = new AuthHardeningService(); t.after(() => service.onModuleDestroy());
  await service.email('demo@example.invalid', 'verify-email', 'synthetic-verification');
  await service.email('demo@example.invalid', 'reset-password', 'synthetic-reset');
  assert.equal(smtp.messages.length, 2);
  assert.match(smtp.messages[0], /https:\/\/example\.invalid\/verify-email\?token=synthetic-verification/);
  assert.match(smtp.messages[1], /https:\/\/example\.invalid\/reset-password\?token=synthetic-reset/);
});

test('production mail rejects SMTP without STARTTLS even with the test flag set', { timeout: 10000 }, async t => {
  const smtp = await smtpFixture(t); mailEnvironment(t, smtp.port, 'production');
  const service = new AuthHardeningService(); t.after(() => service.onModuleDestroy());
  await assert.rejects(service.email('demo@example.invalid', 'verify-email', 'synthetic-token'), error => error.code === 'ETLS');
  assert.ok(smtp.commands.includes('STARTTLS'));
  assert.ok(!smtp.commands.includes('AUTH'), 'No SMTP credentials may be sent before TLS');
  assert.ok(!smtp.commands.includes('DATA'), 'No message or action token may be sent before TLS');
  assert.equal(smtp.messages.length, 0);
});

test('patched Nest glob copies nested assets and respects exclusions', { timeout: 30000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'boxvault-cli security '));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'src/templates/onboarding'), { recursive: true });
  await writeFile(join(dir, 'src/main.ts'), 'export const fixture = true;\n');
  await writeFile(join(dir, 'src/templates/onboarding/welcome.txt'), 'synthetic template');
  await writeFile(join(dir, 'src/templates/onboarding/ignored.private.txt'), 'excluded fixture');
  await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'commonjs', outDir: './dist', types: [] }, include: ['src/**/*.ts'] }));
  await writeFile(join(dir, 'nest-cli.json'), JSON.stringify({ sourceRoot: 'src', compilerOptions: { deleteOutDir: true, assets: [{ include: 'templates/**/*.txt', exclude: 'templates/**/*.private.txt' }] } }));
  execFileSync(process.execPath, [require.resolve('@nestjs/cli/bin/nest.js'), 'build'], { cwd: dir, timeout: 25000, stdio: 'pipe' });
  assert.equal(await readFile(join(dir, 'dist/templates/onboarding/welcome.txt'), 'utf8'), 'synthetic template');
  await assert.rejects(access(join(dir, 'dist/templates/onboarding/ignored.private.txt')));
  await access(join(dir, 'dist/main.js'));
});
