import { Module } from '@nestjs/common';
import { TenantBoundaryService } from './tenant-boundary.service';
import { ContainerAccessService } from './container-access.service';

@Module({
  providers: [TenantBoundaryService, ContainerAccessService],
  exports: [TenantBoundaryService, ContainerAccessService],
})
export class SecurityBoundaryModule {}
