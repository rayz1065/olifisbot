import { Filter, Middleware } from 'grammy';
import {
  InlineKeyboardButton,
  InlineKeyboardMarkup,
  Message,
} from 'grammy/types';
import { emoji } from 'node-emoji';
import { MyContext, MyConversation } from '../main';
import { TranslationContext } from '@grammyjs/i18n/types/src/deps';

export interface TgMessageData {
  text: string;
  keyboard: InlineKeyboardButton[][];
  cbAnswer?: string;
}

type CallbackMiddleware<T extends any[] = any[]> = Middleware<
  Omit<Filter<MyContext, 'callback_query:data'>, 'callbackParams'> & {
    callbackParams: T;
  }
>;

/**
 * creates a callback with a string prefix and some params
 */
export class TgCallback<T extends any[] = any[]> {
  private prefix = 'tgb';
  public middleware: CallbackMiddleware<T>[];

  public constructor(
    private name: string,
    ...middleware: CallbackMiddleware<T>[]
  ) {
    if (this.name.indexOf('.') !== -1) {
      throw new Error("TgCallback name may not contain '.'");
    }
    this.middleware = middleware;
  }

  public setPrefix(prefix: string) {
    if (prefix.indexOf('.') !== -1) {
      throw new Error("TgCallback prefix may not contain '.'");
    }
    this.prefix = prefix;
    return this;
  }

  public getCb(values: T) {
    let valuesStr = JSON.stringify(values);
    valuesStr = valuesStr.substring(1, valuesStr.length - 1);
    return [this.prefix, this.name, valuesStr].join('.');
  }

  public getBtn(
    text: string,
    ...values: T
  ): InlineKeyboardButton.CallbackButton {
    return {
      text,
      callback_data: this.getCb(values),
    };
  }

  public match(prefix: string, name: string) {
    return this.prefix === prefix && this.name === name;
  }
}

export function cbValidate<T extends any[]>(
  key: number,
  validator: (value: string) => boolean
): CallbackMiddleware<T> {
  return async (ctx, next) => {
    if (validator(`${ctx.callbackParams[key]}`)) {
      return await next();
    }
    await ctx.answerCallbackQuery(`Invalid value for ${key}`);
  };
}

/**
 * Resulting array will have at most "limit" elements
 */
function splitWithTail(str: string, separator: string, limit: number) {
  const parts = str.split(separator);
  const tail = parts.slice(limit - 1).join(separator);
  const result = parts.slice(0, limit - 1);
  result.push(tail);

  return result;
}

export function findTgCallback(
  callbacks: TgCallback<any>[],
  cbData: string
): { match: TgCallback | null; values: any[] } {
  const sections = splitWithTail(cbData, '.', 3);
  if (sections.length !== 3) {
    return { match: null, values: [] };
  }
  const [prefix, name, valuesStr] = sections;
  let values: any;
  try {
    values = JSON.parse(`[${valuesStr}]`);
  } catch (error) {
    return { match: null, values: [] };
  }
  const match = callbacks.find((callback) => callback.match(prefix, name));
  return { match: match ?? null, values };
}

export function tgCallbackMiddleware(callbacks: TgCallback<any>[]) {
  return (ctx: MyContext) => {
    const { match, values } = findTgCallback(
      callbacks,
      ctx.callbackQuery?.data ?? ''
    );
    if (!match) {
      return [];
    }
    ctx.callbackParams = values;
    return match.middleware;
  };
}

/**
 * An error to be displayed to the user
 */
export class TgError extends Error {
  public context?: TranslationContext;

  public constructor(
    message: string,
    context?: TranslationContext | undefined
  ) {
    super(message);
    this.context = context;
  }
}

export function makeId(length: number) {
  const res = [];
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < length; i++) {
    res.push(chars.charAt(Math.floor(Math.random() * chars.length)));
  }
  return res.join('');
}

export function escapeHtml(text: string) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  };

  return text.replace(/[&<>]/g, (m) => map[m as keyof typeof map]);
}

export function ik(keyboard: InlineKeyboardButton[][]): {
  reply_markup: InlineKeyboardMarkup;
} {
  return { reply_markup: { inline_keyboard: keyboard } };
}

export function selectedBtnText(text: string, isMatched: boolean) {
  return isMatched ? `• ${text} •` : text;
}

/**
 * tries deleting the a message, on failure clears the message id
 * so that a new message can be sent
 */
export async function conversationDelete(ctx: MyContext, messageId: number) {
  if (!ctx.chat || !ctx.conversationData) {
    throw new Error('Conversation edit does not have relevant data');
  }
  try {
    await ctx.api.deleteMessage(ctx.chat.id, messageId);
  } catch (error) {
    // clear out the conversation message id
    ctx.conversationData.messageId = undefined;
  }
}

export async function conversationEdit(
  ctx: MyContext,
  ...args: Parameters<MyContext['editMessageText']>
) {
  if (!ctx.chat || !ctx.conversationData) {
    throw new Error('Conversation edit does not have relevant data');
  }
  if (ctx.conversationData.messageId) {
    await ctx.api.editMessageText(
      ctx.chat.id,
      ctx.conversationData.messageId,
      ...args
    );
  } else {
    const res = await ctx.reply(...args);
    ctx.conversationData.messageId = res.message_id;
  }
}

export async function skipCommands(
  conversation: MyConversation,
  message?: Message
) {
  if (message?.text && message.text.startsWith('/')) {
    await conversation.skip();
  }
}

type MaybePromise<T> = Promise<T> | T;

export async function tgValidate(
  conversation: MyConversation,
  ctx: MyContext,
  validator: () => MaybePromise<string | undefined>,
  options?: {
    getMessage?: (error: string) => {
      text: string;
      keyboard?: InlineKeyboardButton[][];
    };
    baseText?: string;
    keyboard?: InlineKeyboardButton[][];
  }
) {
  options ??= {};
  const baseText = options.baseText ?? '';
  const keyboard = options.keyboard ?? [];
  const getMessage =
    options.getMessage ??
    ((error) => ({
      text: `${baseText}\n\n${emoji.warning} ${error}`,
      keyboard,
    }));
  const error = await validator();
  if (error) {
    const { text, keyboard } = getMessage(error);
    try {
      await conversationEdit(ctx, text, ik(keyboard ?? []));
    } finally {
      await conversation.skip({ drop: true });
    }
  }
}
