import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  id: number;
  username: string;
  roles: string[];
  permissions: string[];
  branchId?: number;
}

/**
 * Decorator to get the current authenticated user from the request
 * Usage: @CurrentUser() user: CurrentUserData
 * Or to get a specific property: @CurrentUser('id') userId: number
 */
export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
