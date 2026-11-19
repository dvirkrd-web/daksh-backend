import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

interface JwtPayload {
  sub: string;
  type: 'customer' | 'admin';
  role?: string;
  email?: string;
  mobile?: string;
}

/**
 * Verifies the Bearer JWT and attaches `request.user`.
 * Customer tokens and admin tokens are distinguished by the `type`
 * claim so an admin token can never be used as a customer token and
 * vice versa.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(protected readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Login required. Please sign in.');
    }
    const token = header.slice('Bearer '.length).trim();
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }
    const user: AuthenticatedUser = {
      id: payload.sub,
      type: payload.type,
      role: payload.role,
      email: payload.email,
      mobile: payload.mobile,
    };
    request.user = user;
    return true;
  }
}

/** Only customer (mobile OTP) tokens. */
@Injectable()
export class CustomerGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest();
    if ((request.user as AuthenticatedUser).type !== 'customer') {
      throw new ForbiddenException('Customer login required.');
    }
    return true;
  }
}

/** Only admin tokens (owner / staff roles). */
@Injectable()
export class AdminGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    if (user.type !== 'admin' || !['owner', 'staff'].includes(user.role ?? '')) {
      throw new ForbiddenException('Admin access required.');
    }
    return true;
  }
}
