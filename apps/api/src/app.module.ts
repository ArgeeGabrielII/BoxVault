import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { AccessGuard } from './auth/access.guard';
import { ContainerController } from './inventory/container.controller';
import { AdminController } from './admin/admin.controller';
import { TenantBoundaryService } from './security/tenant-boundary.service';
import { ContainerAccessService } from './security/container-access.service';

@Module({
  controllers: [HealthController, AuthController, ContainerController, AdminController],
  providers: [AuthService, AccessGuard, TenantBoundaryService, ContainerAccessService],
})
export class AppModule {}
