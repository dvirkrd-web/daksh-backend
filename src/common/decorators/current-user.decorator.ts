import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  /** users.id for customers, admin_users.id for admins. */
  id: string;
  type: 'customer' | 'admin';
  role?: string;
  email?: string;
  mobile?: string;
}

/** Injects the authenticated principal set by the auth guards. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
