import { InlineKeyboard } from 'grammy';
import { InlineKeyboardButton } from 'grammy/types';
import { emoji } from 'node-emoji';

export function tgButtonsGrid(
  items: InlineKeyboardButton[],
  options?: { columns?: number }
) {
  options ??= {};
  const columns = options.columns ?? 2;
  const buttons = new InlineKeyboard();
  items.forEach((item, idx) => {
    buttons.add(item);
    if ((idx + 1) % columns === 0 || idx + 1 === items.length) {
      buttons.row();
    }
  });
  return buttons.inline_keyboard;
}

export function tgPaginated(
  buttons: InlineKeyboardButton[],
  page: number,
  pageCallback: (page: number, text: string) => InlineKeyboardButton,
  options?: {
    pageSize?: number;
    columns?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  }
) {
  options ??= {};
  const pageSize = options.pageSize ?? 10;
  const hasPrev = options.hasPrev ?? page > 0;
  const hasNext = options.hasNext ?? buttons.length > pageSize;
  buttons = buttons.filter((x, idx) => idx < pageSize);
  const buttonsGrid = tgButtonsGrid(buttons, options);
  const keyboard = new InlineKeyboard(buttonsGrid);
  if (hasPrev) {
    keyboard.add(pageCallback(page - 1, emoji.arrow_left));
  }
  if (hasNext) {
    keyboard.add(pageCallback(page + 1, emoji.arrow_right));
  }
  const firstShown = page * pageSize + 1;
  const lastShown = firstShown - 1 + buttons.length;
  return {
    text: `Page ${page + 1} from <i>${firstShown}</i> to <i>${lastShown}</i>`,
    keyboard: keyboard.inline_keyboard,
  };
}
