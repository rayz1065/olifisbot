import * as dotenv from 'dotenv';
import { Bot, Context, InlineKeyboard, session, SessionFlavor } from 'grammy';
import { hydrateReply, parseMode, ParseModeFlavor } from '@grammyjs/parse-mode';
import {
  Conversation,
  ConversationFlavor,
  conversations,
} from '@grammyjs/conversations';
import { escapeHtml, findTgCallback } from './lib/utils';
import { calendarCallbacks } from './lib/calendar';
import { PrismaClient, User } from '@prisma/client';
import { authenticate } from './middlewares/authenticate';
import { I18n, I18nFlavor } from '@grammyjs/i18n';
import path from 'path';
import { olifisModule } from './modules/olifis/index';
import { PrismaAdapter } from '@grammyjs/storage-prisma';

dotenv.config();
if (!process.env.BOT_TOKEN) {
  throw new Error('Bot token not found');
}

export type MySessionData = {
  editions?: {
    page: number;
    typeId: number;
  };
  editionsByTag?: Record<
    string,
    {
      page: number;
      typeId: number;
    }
  >;
  mainMenuInfoButton?: 'info' | 'stats';
};
export type MyContext = ParseModeFlavor<
  SessionFlavor<MySessionData> & ConversationFlavor<Context> & I18nFlavor
> & {
  callbackParams: any;
  dbUser: User;
  conversationData?: {
    messageId?: number;
  } & Record<string, any>;
};
export type MyConversation = Conversation<MyContext>;

// set up translations
export const i18n = new I18n<MyContext>({
  defaultLocale: process.env.DEFAULT_LOCALE ?? 'it',
  directory: path.join(__dirname, 'i18n'),
  fluentBundleOptions: {
    useIsolating: false,
  },
  localeNegotiator: (ctx) =>
    ctx.dbUser?.language ??
    ctx.from?.language_code ??
    process.env.DEFAULT_LOCALE ??
    'it',
  globalTranslationContext(ctx) {
    return {
      'user-name': escapeHtml(ctx.from?.first_name ?? ''),
    };
  },
});

// set up db connection and base bot configuration
export const prisma = new PrismaClient();
export const bot = new Bot<MyContext>(process.env.BOT_TOKEN);
bot.use(hydrateReply);
bot.api.config.use(parseMode('HTML'));
bot.use(
  session({
    initial: () => ({}),
    storage: new PrismaAdapter(prisma.session),
  })
);

bot.errorBoundary((err) => {
  console.error(err);
});

bot.use(i18n);

bot.use(authenticate);

bot.on('inline_query', async (ctx) => {
  await ctx.answerInlineQuery(
    [
      {
        id: 'share',
        type: 'photo',
        photo_file_id: process.env.LOGO_FILE_ID ?? '',
        caption: ctx.t('join-bot'),
        reply_markup: new InlineKeyboard().url(
          `${ctx.t('enter-bot')} ⚛️`,
          `https://t.me/${ctx.me.username}?start=ref_${ctx.dbUser.id}`
        ),
        parse_mode: 'HTML',
      },
    ],
    { cache_time: 0 }
  );
});

bot.use(conversations());

async function hasPendingConversation(ctx: MyContext) {
  const activeConversations = await ctx.conversation.active();
  return Object.keys(activeConversations).length !== 0;
}

bot.command('cancel', async (ctx) => {
  if (!(await hasPendingConversation(ctx))) {
    return await ctx.reply(ctx.t('no-pending-operation'));
  }
  await ctx.conversation.exit();
  await ctx.reply(ctx.t('operation-cancelled'));
});

// prevent unrelated messages in conversations
// bot.on('message').filter(hasPendingConversation, async (ctx) => {
//   await ctx.reply(ctx.t('write-cancel-to-cancel-operation'));
// });

// modules
bot.use(olifisModule);

bot.on('callback_query:data').lazy((ctx) => {
  const cbData = ctx.callbackQuery.data;
  const { match, values } = findTgCallback([...calendarCallbacks], cbData);
  if (match) {
    ctx.callbackParams = values;
    return match.middleware;
  }
  console.warn('No match for data', cbData);
  return [];
});

bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery('I did not understand the request');
});

bot.catch((error) => {
  if (error.message.indexOf('message is not modified:') !== -1) {
    return;
  }
  console.error(error);
});
