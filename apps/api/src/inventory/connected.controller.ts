import { BadRequestException, Body, Controller, Delete, Get, Header, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AccessGuard } from '../auth/access.guard';
import type { AccessPrincipal } from '../auth/auth.service';
import { AuthHardeningService } from '../auth/auth-hardening.service';
import { TenantBoundaryService } from '../security/tenant-boundary.service';
type Authed = Request & { principal: AccessPrincipal };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value: unknown): string { if (typeof value !== 'string' || !UUID.test(value)) throw new BadRequestException('Invalid identifier'); return value.toLowerCase(); }
function bodyFields(body: unknown, keys: string[]): asserts body is Record<string, unknown> {
 if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key))) throw new BadRequestException('Invalid details');
}
function text(value: unknown, maximum = 200) { if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new BadRequestException('Enter a valid name'); return value.trim(); }
const proofHash = (token: string) => 'sha256:' + createHash('sha256').update(token).digest('hex');
@Controller()
@UseGuards(AccessGuard)
export class ConnectedInventoryController {
 constructor(private readonly boundary: TenantBoundaryService, private readonly hardening: AuthHardeningService) {}
 private async scope<T>(req: Authed, tenant: string, mode: 'read' | 'write', fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  try { return await this.boundary.withAuthorizedTenant(req.principal, tenant, fn, mode); }
  catch (error) { if (error instanceof Error && error.message === 'Access denied') throw new NotFoundException('Resource unavailable'); throw error; }
 }
 private async owned(tx: Prisma.TransactionClient, req: Authed, id: string, tenant: string) {
  const box = await tx.container.findFirst({ where: { id, tenantId: tenant, ownerUserId: req.principal.userId }, select: { id: true } });
  const member = await tx.tenantMember.findFirst({ where: { tenantId: tenant, userId: req.principal.userId, status: 'ACTIVE', role: { in: ['OWNER', 'EDITOR'] } }, select: { id: true } });
  if (!box || !member) throw new NotFoundException('Resource unavailable');
 }
 @Patch('containers/:id') @Header('Cache-Control', 'no-store')
 async update(@Req() req: Authed, @Param('id') raw: string, @Body() body: unknown) {
  bodyFields(body, ['tenantId','name','location']); const tenant = uuid(body.tenantId), id = uuid(raw), name = text(body.name);
  if (body.location !== undefined && (typeof body.location !== 'string' || body.location.length > 200)) throw new BadRequestException('Invalid location');
  return { data: await this.scope(req, tenant, 'write', async tx => { await this.owned(tx, req, id, tenant); return tx.container.update({ where: { id }, data: { name, location: typeof body.location === 'string' ? body.location.trim() : undefined }, select: { id: true, name: true, location: true, shareMode: true } }); }) };
 }
 @Get('containers/:id/items') @Header('Cache-Control', 'no-store')
 async items(@Req() req: Authed, @Param('id') raw: string, @Query('tenantId') rawTenant: string) {
  const id = uuid(raw), tenant = uuid(rawTenant);
  return { data: await this.scope(req, tenant, 'read', async tx => { if (!await tx.container.findFirst({ where: { id, tenantId: tenant }, select: { id: true } })) throw new NotFoundException('Resource unavailable'); return tx.item.findMany({ where: { containerId: id, tenantId: tenant }, select: { id: true, name: true, quantity: true, containerId: true }, orderBy: { id: 'asc' }, take: 1000 }); }) };
 }
 @Post('containers/:id/items') @Header('Cache-Control', 'no-store')
 async addItem(@Req() req: Authed, @Param('id') raw: string, @Body() body: unknown) {
  bodyFields(body, ['tenantId','name','quantity']); const tenant = uuid(body.tenantId), container = uuid(raw), name = text(body.name);
  const quantity = body.quantity ?? 1;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) throw new BadRequestException('Quantity must be a whole number from 0 to 1,000,000');
  return { data: await this.scope(req, tenant, 'write', async tx => {
   const [allowed] = await tx.$queryRaw<Array<{ allowed: boolean }>>`SELECT security.container_allowed(${container}::uuid,${tenant}::uuid,true) AS allowed`;
   if (!allowed?.allowed) throw new NotFoundException('Resource unavailable');
   const id = randomUUID(); await tx.item.createMany({ data: [{ id, tenantId: tenant, containerId: container, name, quantity }] }); return { id, name, quantity, containerId: container };
  }) };
 }
 @Patch('items/:id') @Header('Cache-Control', 'no-store')
 async updateItem(@Req() req: Authed, @Param('id') raw: string, @Body() body: unknown) {
  bodyFields(body, ['tenantId','name','quantity']); const tenant = uuid(body.tenantId), id = uuid(raw), name = text(body.name), quantity = body.quantity;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) throw new BadRequestException('Invalid quantity');
  return { data: await this.scope(req, tenant, 'write', async tx => {
   const item = await tx.item.findFirst({ where: { id, tenantId: tenant }, select: { containerId: true } });
   if (!item) throw new NotFoundException('Resource unavailable');
   const [allowed] = await tx.$queryRaw<Array<{ allowed: boolean }>>`SELECT security.container_allowed(${item.containerId}::uuid,${tenant}::uuid,true) AS allowed`;
   if (!allowed?.allowed) throw new NotFoundException('Resource unavailable');
   await tx.item.updateMany({ where: { id, tenantId: tenant }, data: { name, quantity } }); return { id, name, quantity, containerId: item.containerId };
  }) };
 }
 @Delete('items/:id') @Header('Cache-Control', 'no-store')
 async deleteItem(@Req() req: Authed, @Param('id') raw: string, @Query('tenantId') rawTenant: string) {
  const id = uuid(raw), tenant = uuid(rawTenant);
  return { data: await this.scope(req, tenant, 'write', async tx => {
   const item = await tx.item.findFirst({ where: { id, tenantId: tenant }, select: { containerId: true } }); if (!item) throw new NotFoundException('Resource unavailable');
   const [allowed] = await tx.$queryRaw<Array<{ allowed: boolean }>>`SELECT security.container_allowed(${item.containerId}::uuid,${tenant}::uuid,true) AS allowed`;
   if (!allowed?.allowed) throw new NotFoundException('Resource unavailable');
   await tx.item.deleteMany({ where: { id, tenantId: tenant } }); return { deleted: true };
  }) };
 }
 @Post('containers/:id/labels') @Header('Cache-Control', 'no-store')
 async label(@Req() req: Authed, @Param('id') raw: string, @Body() body: unknown) {
  bodyFields(body, ['tenantId']); const tenant = uuid(body.tenantId), id = uuid(raw);
  await this.hardening.limit('label-create', req.ip ?? 'unknown', req.principal.userId);
  const token = randomBytes(32).toString('base64url'), hash = proofHash(token);
  const origin = new URL(process.env.PUBLIC_WEB_URL || '');
  const loopback = ['localhost','127.0.0.1','[::1]'].includes(origin.hostname);
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && loopback && ['development','test'].includes(process.env.NODE_ENV || ''))) throw new BadRequestException('Label URL is not configured');
  await this.scope(req, tenant, 'write', async tx => { await this.owned(tx, req, id, tenant); await tx.container.updateMany({ where: { id, tenantId: tenant, ownerUserId: req.principal.userId }, data: { publicToken: hash } }); });
  // A locator, never a bearer credential. Delivered once to its authenticated
  // creator. No identity, tenant ID or customer content enters the QR payload.
  await this.hardening.audit('LABEL_ROTATED', req.principal.userId);
  const url = new URL('/scan', origin); url.hash = 'token=' + token;
  return { data: { url: url.toString(), rotated: true } };
 }
 @Post('labels/resolve') @Header('Cache-Control', 'no-store')
 async resolve(@Req() req: Authed, @Body() body: unknown) {
  bodyFields(body, ['tenantId','token']); const tenant = uuid(body.tenantId);
  if (typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) throw new NotFoundException('Resource unavailable');
  await this.hardening.limit('label-resolve', req.ip ?? 'unknown', req.principal.userId);
  const hash = proofHash(body.token);
  return { data: await this.scope(req, tenant, 'read', async tx => {
   const box = await tx.container.findFirst({ where: { tenantId: tenant, publicToken: hash }, select: { id: true, name: true, location: true, shareMode: true } });
   if (!box) throw new NotFoundException('Resource unavailable'); return box;
  }) };
 }
}
