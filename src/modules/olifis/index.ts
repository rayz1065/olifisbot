import { Composer } from 'grammy';
import { MyContext } from '../../main';
import { isAdmin } from '../../middlewares/is-admin';
import { olifisAdminModule } from './admin';
import { olifisQuestionModule } from './question';
import { getRandomSplash, olifisUserModule } from './user';

export const olifisModule = new Composer<MyContext>();

export const EDITIONS_PAGE_SIZE = 24;
export const QUESTIONS_PAGE_SIZE = 48;
export const EDITION_TYPES = {
  firstLevel: 'first-level',
  secondLevel: 'second-level',
  nationals: 'nationals',
  teamsQualifiers: 'teams-qualifiers',
  teamsNationals: 'teams-nationals',
} as const;
export const QUESTION_TYPES = {
  closed: 'closed',
  open: 'open',
  formula: 'formula',
  selfEvaluation: 'self-eval',
} as const;
export type QuestionType =
  | typeof QUESTION_TYPES.closed
  | typeof QUESTION_TYPES.open
  | typeof QUESTION_TYPES.formula;

olifisModule.filter(isAdmin).use(olifisAdminModule);
olifisModule.use(olifisUserModule);
olifisModule.use(olifisQuestionModule);

// fallback
olifisModule.chatType('private').on('message:text', async (ctx) => {
  const splash = await getRandomSplash(ctx);
  await ctx.reply(`${splash}\n${ctx.t('write-start-to-open-menu')}`, {
    reply_markup: { remove_keyboard: true },
  });
});
