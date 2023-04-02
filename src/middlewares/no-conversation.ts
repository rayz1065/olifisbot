import { Middleware } from 'grammy';
import { MyContext } from '../main';

async function hasPendingConversation(ctx: MyContext) {
  const activeConversations = await ctx.conversation.active();
  return Object.keys(activeConversations).length !== 0;
}

export const ensureNoConversation: Middleware<MyContext> = async (
  ctx,
  next
) => {
  if (await hasPendingConversation(ctx)) {
    return;
  }
  await next();
};
