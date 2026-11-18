import { BadRequestException, Body, Controller, Delete, Get, Header, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessPrincipal } from '../auth/auth.service';
import { AccessGuard } from '../auth/access.guard';
import { AuthHardeningService, normalizeEmail } from '../auth/auth-hardening.service';
import { FamilyService } from './family.service';
type Authed = Request & { principal: AccessPrincipal };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIMPLE_EMAIL = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
function identifier(value: string) { if (!UUID.test(value)) throw new BadRequestException('Invalid identifier'); return value.toLowerCase(); }
function fields(body: unknown, allowed: string[]): asserts body is Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key)))
    throw new BadRequestException('Invalid family details');
}
function memberRole(value: unknown): 'EDITOR' | 'VIEWER' {
  if (value !== 'EDITOR' && value !== 'VIEWER') throw new BadRequestException('Choose Editor or Viewer');
  return value;
}
@Controller()
@UseGuards(AccessGuard)
export class FamilyController {
  constructor(private readonly family: FamilyService, private readonly hardening: AuthHardeningService) {}
  private limit(req: Authed, category: string) { return this.hardening.limit(category, req.ip ?? 'unknown', req.principal.userId); }

  @Get('tenants') @Header('Cache-Control', 'no-store')
  async tenants(@Req() req: Authed) { await this.limit(req, 'family-list'); return { data: await this.family.workspaces(req.principal) }; }

  @Get('tenants/:tenantId/members') @Header('Cache-Control', 'no-store')
  async members(@Req() req: Authed, @Param('tenantId') t: string) {
    identifier(t); await this.limit(req, 'family-members'); return { data: await this.family.members(req.principal, t) };
  }
  @Get('tenants/:tenantId/invitations') @Header('Cache-Control', 'no-store')
  async invitations(@Req() req: Authed, @Param('tenantId') t: string) {
    identifier(t); await this.limit(req, 'family-invitations'); return { data: await this.family.invitations(req.principal, t) };
  }
  @Post('tenants/:tenantId/invitations') @Header('Cache-Control', 'no-store')
  async invite(@Req() req: Authed, @Param('tenantId') t: string, @Body() body: unknown) {
    identifier(t); fields(body, ['email', 'role']); const role = memberRole(body.role);
    const email = normalizeEmail(body.email);
    if (!email || !SIMPLE_EMAIL.test(email)) throw new BadRequestException('Enter an email address without a display name');
    await this.limit(req, 'family-invite'); return { data: await this.family.invite(req.principal, t, email, role) };
  }
  @Delete('tenants/:tenantId/invitations/:invitationId') @Header('Cache-Control', 'no-store')
  async cancel(@Req() req: Authed, @Param('tenantId') t: string, @Param('invitationId') invitation: string) {
    identifier(t); identifier(invitation); await this.limit(req, 'family-cancel'); return { data: await this.family.cancel(req.principal, t, invitation) };
  }
  @Post('invitations/accept') @Header('Cache-Control', 'no-store')
  async accept(@Req() req: Authed, @Body() body: unknown) {
    fields(body, ['token']);
    if (typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) throw new BadRequestException('Invalid invitation proof');
    await this.limit(req, 'family-accept'); return { data: await this.family.accept(req.principal, body.token) };
  }
  @Patch('tenants/:tenantId/members/:memberId') @Header('Cache-Control', 'no-store')
  async changeRole(@Req() req: Authed, @Param('tenantId') t: string, @Param('memberId') member: string, @Body() body: unknown) {
    identifier(t); identifier(member); fields(body, ['role']); const role = memberRole(body.role);
    await this.limit(req, 'family-role'); return { data: await this.family.changeRole(req.principal, t, member, role) };
  }
  @Delete('tenants/:tenantId/members/:memberId') @Header('Cache-Control', 'no-store')
  async remove(@Req() req: Authed, @Param('tenantId') t: string, @Param('memberId') member: string) {
    identifier(t); identifier(member); await this.limit(req, 'family-remove'); return { data: await this.family.remove(req.principal, t, member) };
  }
}
