import { Middleware } from 'grammy';
import { MyContext } from '../main';

export function isAdmin(ctx: MyContext): boolean {
  const userId = ctx.from?.id;
  if (!userId) {
    return false;
  }
  const adminUserId = process.env.ADMIN_USER_ID;
  if (!adminUserId) {
    return false;
  }
  return userId === +adminUserId;
}

export const ensureAdmin: Middleware<MyContext> = async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) {
    return;
  }
  const adminUserId = process.env.ADMIN_USER_ID;
  if (adminUserId && userId === +adminUserId) {
    await next();
  }
};
