import { Middleware } from 'grammy';
import { MyContext } from '../main';
import { TgError } from '../lib/utils';

export const catchTgErrors: Middleware<MyContext> = async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    if (!(error instanceof TgError)) {
      throw error;
    }
    const prettyError = ctx.t(error.message, error.context);

    try {
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery(prettyError);
      } else if (ctx.chat?.type === 'private') {
        await ctx.reply(prettyError);
      } else {
        console.error('catchTgErrors used but nowhere to show the error', ctx);
      }
    } catch (error) {
      console.error('error while showing error', error);
    }
  }
};
