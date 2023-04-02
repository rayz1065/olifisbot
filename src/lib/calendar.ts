import dayjs, { Dayjs } from 'dayjs';
import { InlineKeyboard } from 'grammy';
import { InlineKeyboardButton } from 'grammy/types';
import { emoji } from 'node-emoji';
import { tgButtonsGrid } from './list';
import { MyContext, MyConversation } from '../main';
import {
  conversationDelete,
  conversationEdit,
  findTgCallback,
  ik,
  skipCommands,
  TgCallback,
  tgValidate,
} from './utils';
import assert from 'assert';

type DateCallback = (day: Dayjs, text: string) => InlineKeyboardButton;
type DatePickerCallback = (month: Dayjs, text: string) => InlineKeyboardButton;
type MonthPickerCallback = (year: number, text: string) => InlineKeyboardButton;
type YearPickerCallback = (
  firstYear: number,
  text: string
) => InlineKeyboardButton;

export interface DatePickerMsgOptions {
  /** Used when a day is clicked */
  dateCallback?: DateCallback;
  /** Used to change month, omit for no navigation */
  datePickerCallback?: DatePickerCallback;
  /** Called when header month is clicked, omit for no action */
  monthPickerCallback?: MonthPickerCallback;
  /** 0 is sunday */
  weekStart?: number;
  /** Shown by default */
  showMonthHeader?: boolean;
}
export interface MonthPickerMsgOptions {
  /** Used when a month is chosen */
  datePickerCallback?: DatePickerCallback;
  /** Used to navigate between years, omit for no navigation */
  monthPickerCallback?: MonthPickerCallback;
  /** Called when header year is clicked, omit for no action */
  yearPickerCallback?: YearPickerCallback;
}
export interface YearPickerMsgOptions {
  /** Used when a year is chosen */
  monthPickerCallback?: MonthPickerCallback;
  /** Used to navigate between decades, omit for no navigation */
  yearPickerCallback?: YearPickerCallback;
}

export type TgCalendarParams =
  | [op: 'y-sel', firstYear: number]
  | [op: 'm-sel', year: number]
  | [op: 'd-sel', year: number, month: number]
  | [op: 'd-click', year: number, month: number, day: number];

export function getDateFromTgCalendar(params: TgCalendarParams) {
  if (params[0] === 'd-sel') {
    const [, year, month] = params;
    return dayjs().year(year).month(month).startOf('month');
  } else {
    const [, year] = params;
    return dayjs().year(year).startOf('year');
  }
}

export function datePickerMsg(
  year: number,
  month: number,
  options?: DatePickerMsgOptions
) {
  options ??= {};
  const currentMonth = dayjs().year(year).month(month).startOf('month');
  const daysInMonth = currentMonth.daysInMonth();
  const prevMonth = currentMonth.month(currentMonth.month() - 1);
  const nextMonth = currentMonth.month(currentMonth.month() + 1);
  const dateCallback = (options.dateCallback ??= (day, text) =>
    echo.getBtn(text, `You pressed: ${day.format('DD/MM/YYYY')}`));
  const monthPickerCallback =
    options.monthPickerCallback ??
    ((year, text) => echo.getBtn(text, currentMonth.format('MMMM YYYY')));
  const { datePickerCallback: datePickerCallback } = options;

  const dayButtons = [];
  const weekStart = options.weekStart ? options.weekStart % 7 : 1; // monday
  for (
    let i = 1 - ((currentMonth.day() + 7 - weekStart) % 7);
    i <= daysInMonth || dayButtons.length % 7 !== 0;
    i++
  ) {
    const day = currentMonth.date(i);
    dayButtons.push(dateCallback(day, dayBtnText(day)));
  }

  function dayBtnText(day: Dayjs) {
    if (day.month() !== currentMonth.month()) {
      return '-';
    } else if (day.format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')) {
      return `·${day.format('D')}·`;
    }
    return day.format('D');
  }

  const headerButtons = new InlineKeyboard();
  if (datePickerCallback) {
    headerButtons.add(datePickerCallback(prevMonth, emoji.arrow_left));
  }
  if (options.showMonthHeader ?? true) {
    headerButtons.add(
      monthPickerCallback(year, currentMonth.format('MMM YYYY'))
    );
  }
  if (datePickerCallback) {
    headerButtons.add(datePickerCallback(nextMonth, emoji.arrow_right));
  }
  headerButtons.row();
  for (let i = 0; i < 7; i++) {
    // buttons for days of the week
    const weekDay = dayjs().day(i + weekStart);
    headerButtons.add(
      echo.getBtn(weekDay.format('dd'), weekDay.format('dddd'))
    );
  }
  return {
    text: `${currentMonth.format('MMMM YYYY')}`,
    keyboard: [
      ...headerButtons.inline_keyboard,
      ...tgButtonsGrid(dayButtons, { columns: 7 }),
    ],
    cbAnswer: `${currentMonth.format('MMMM')}`,
  };
}

export function monthPickerMsg(year: number, options?: MonthPickerMsgOptions) {
  const currentYear = dayjs().year(year).startOf('year');
  options ??= {};
  const datePickerCallback =
    options.datePickerCallback ??
    ((month, text) => echo.getBtn(text, month.format('MMMM')));
  const { monthPickerCallback } = options;
  const yearPickerCallback =
    options.yearPickerCallback ??
    ((firstYear, text) => echo.getBtn(text, `${firstYear}`));

  const months = [];
  for (let i = 0; i < 12; i++) {
    const month = currentYear.month(i);
    months.push(datePickerCallback(month, month.format('MMMM')));
  }
  const headerButtons = new InlineKeyboard();
  if (monthPickerCallback) {
    headerButtons.add(
      monthPickerCallback(currentYear.year() - 1, emoji.arrow_left)
    );
  }
  headerButtons.add(
    yearPickerCallback(currentYear.year(), currentYear.format('YYYY'))
  );
  if (monthPickerCallback) {
    headerButtons.add(
      monthPickerCallback(currentYear.year() + 1, emoji.arrow_right)
    );
  }

  const keyboard = [
    ...headerButtons.inline_keyboard,
    ...tgButtonsGrid(months, { columns: 3 }),
  ];
  return {
    text: `${currentYear.format('YYYY')}`,
    keyboard,
    cbAnswer: `${currentYear.format('YYYY')}`,
  };
}

export function yearPickerMsg(
  firstYear: number,
  options?: YearPickerMsgOptions
) {
  firstYear -= firstYear % 10;
  const years = [];
  for (let i = -1; i < 11; i++) {
    years.push(firstYear + i);
  }
  options ??= {};
  const monthPickerCallback =
    options.monthPickerCallback ??
    ((year, text) => echo.getBtn(text, `${year}`));
  const { yearPickerCallback } = options;

  const headerButtons = new InlineKeyboard();
  if (yearPickerCallback) {
    headerButtons.add(
      yearPickerCallback(firstYear - 10, emoji.arrow_left),
      yearPickerCallback(firstYear + 10, emoji.arrow_right)
    );
  }
  const keyboard = [
    ...headerButtons.inline_keyboard,
    ...tgButtonsGrid(
      years.map((year) => monthPickerCallback(year, `${year}`)),
      { columns: 3 }
    ),
  ];
  return {
    text: `${firstYear} - ${firstYear + 9}`,
    keyboard,
    cbAnswer: `${firstYear} - ${firstYear + 9}`,
  };
}

const echo = new TgCallback<[message: string]>('echo', async (ctx) => {
  const [message] = ctx.callbackParams;
  await ctx.answerCallbackQuery(message);
});

export function tgCalendar(
  params: TgCalendarParams,
  callback: (params: TgCalendarParams, text: string) => InlineKeyboardButton,
  options?: DatePickerMsgOptions &
    MonthPickerMsgOptions &
    YearPickerMsgOptions & {
      datePickerMsg?: typeof datePickerMsg;
      monthPickerMsg?: typeof monthPickerMsg;
      yearPickerMsg?: typeof yearPickerMsg;
    }
) {
  options ??= {};
  const dateCallback: DateCallback = (date, text) =>
    callback(['d-click', date.year(), date.month(), date.date()], text);
  const datePickerCallback: DatePickerCallback = (month, text) =>
    callback(['d-sel', month.year(), month.month()], text);
  const monthPickerCallback: MonthPickerCallback = (year, text) =>
    callback(['m-sel', year], text);
  const yearPickerCallback: YearPickerCallback = (firstYear, text) =>
    callback(['y-sel', firstYear], text);
  if (params[0] === 'd-sel' || params[0] === 'd-click') {
    const [, year, month] = params;
    const msgFunction = options.datePickerMsg ?? datePickerMsg;
    return msgFunction(year, month, {
      dateCallback,
      datePickerCallback,
      monthPickerCallback,
      showMonthHeader: true,
      ...options,
    });
  } else if (params[0] === 'm-sel') {
    const [, year] = params;
    const msgFunction = options.monthPickerMsg ?? monthPickerMsg;
    return msgFunction(year, {
      datePickerCallback,
      monthPickerCallback,
      yearPickerCallback,
    });
  } else if (params[0] == 'y-sel') {
    const [, year] = params;
    const msgFunction = options.yearPickerMsg ?? yearPickerMsg;
    return msgFunction(year, { monthPickerCallback, yearPickerCallback });
  }
  throw new Error('Invalid first param for calendar');
}

export async function handleCalendarCommand(ctx: MyContext) {
  const today = dayjs(Date.now());
  const { text, keyboard } = tgCalendar(
    ['d-sel', today.year(), today.month()],
    (params, text) => calendarCallback.getBtn(text, ...params)
  );
  await ctx.reply(text, ik(keyboard));
}

export const calendarCallback = new TgCallback<TgCalendarParams>(
  'cal',
  async (ctx) => {
    const params = ctx.callbackParams;
    const { text, keyboard, cbAnswer } = tgCalendar(params, (params, text) =>
      calendarCallback.getBtn(text, ...params)
    );
    await ctx.editMessageText(text, ik(keyboard));
    await ctx.answerCallbackQuery(cbAnswer);
  }
);

export async function conversationDatePicker(
  conversation: MyConversation,
  ctx: MyContext,
  options?: {
    getMessage?: (params: TgCalendarParams) => {
      text: string;
      keyboard: InlineKeyboardButton[][];
      cbAnswer?: string;
    };
    initialParams?: TgCalendarParams;
  }
): Promise<Dayjs> {
  options ??= {};
  const getMessage =
    options.getMessage ??
    ((params) =>
      tgCalendar(params, (params, text) =>
        calendarCallback.getBtn(text, ...params)
      ));
  const today = dayjs().startOf('date');
  const initialParams = options.initialParams ?? [
    'd-sel',
    today.year(),
    today.month(),
  ];
  const { text, keyboard } = getMessage(initialParams);
  await conversationEdit(ctx, text, ik(keyboard));
  const update = await conversation.waitFor([
    'message:text',
    'callback_query:data',
  ]);
  let date: Dayjs;
  if (update.callbackQuery) {
    const match = findTgCallback([calendarCallback], update.callbackQuery.data);
    if (!match.match) {
      await conversation.skip();
    }
    const params = match.values as TgCalendarParams;
    if (params[0] !== 'd-click') {
      const { text, keyboard, cbAnswer } = getMessage(params);
      await conversationEdit(ctx, text, ik(keyboard));
      await update.answerCallbackQuery(cbAnswer);
      await conversation.skip({ drop: true });
    }
    assert(params[0] === 'd-click');
    date = dayjs()
      .year(params[1])
      .month(params[2])
      .date(params[3])
      .startOf('date');
  } else {
    await skipCommands(conversation, update.message);
    await conversationDelete(ctx, update.message.message_id);
    date = dayjs(update.message.text, { format: 'YYYY-MM-DD' });
  }
  await tgValidate(
    conversation,
    ctx,
    () => (!date.isValid() ? ctx.t('olifis.config.invalid_date') : undefined),
    {
      getMessage(error) {
        const { text, ...etc } = getMessage(initialParams);
        return {
          text: `${text}\n\n${emoji.warning} ${error}`,
          ...etc,
        };
      },
    }
  );
  return date;
}

export const calendarCallbacks = [echo, calendarCallback].map((x) =>
  x.setPrefix('cal')
);
