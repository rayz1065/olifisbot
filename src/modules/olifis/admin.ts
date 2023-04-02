import { createConversation } from '@grammyjs/conversations';
import { Edition, EditionType } from '@prisma/client';
import { Composer, InlineKeyboard } from 'grammy';
import { emoji } from 'node-emoji';
import { tgButtonsGrid, tgPaginated } from '../../lib/list';
import {
  conversationDelete,
  conversationEdit,
  ik,
  skipCommands,
  TgCallback,
  tgCallbackMiddleware,
  TgMessageData,
  tgValidate,
} from '../../lib/utils';
import { MyContext, MyConversation } from '../../main';
import queries, { EditionFull, QuestionsGroupFull } from './queries';
import validator from 'validator';
import assert from 'assert';
import dayjs, { Dayjs } from 'dayjs';
import { InlineKeyboardButton } from 'grammy/types';
import {
  calendarCallback,
  conversationDatePicker,
  tgCalendar,
} from '../../lib/calendar';
import { EDITIONS_PAGE_SIZE } from './index';
import { createQuestion, olifisManageQuestionModule } from './manage-question';
import { mainMenu } from './user';

export const olifisAdminModule = new Composer<MyContext>();

// main config menu

function olifisConfigMsg(ctx: MyContext) {
  return {
    text: ctx.t('olifis-config-title'),
    keyboard: [
      [
        manageEditionTypes.getBtn(
          `${ctx.t('olifis-config-manage-editions')} ${emoji.newspaper}`
        ),
      ],
      [mainMenu.getBtn(`${ctx.t('back-to-menu')}`)],
    ],
  };
}

olifisAdminModule.command('olifisconfig', async (ctx: MyContext) => {
  const { text, keyboard } = olifisConfigMsg(ctx);
  await ctx.reply(text, ik(keyboard));
});

export const adminConfig = new TgCallback('config', async (ctx) => {
  const { text, keyboard } = olifisConfigMsg(ctx);
  await ctx.editMessageText(text, ik(keyboard));
  await ctx.answerCallbackQuery(emoji.gear);
});

// manage editions types

const manageEditionTypes = new TgCallback('edition-types', async (ctx) => {
  const types = await queries.getEditionTypes();
  const text = `<b>${ctx.t('olifis-config-what-edition-type-to-manage')}</b>`;
  const keyboard = [
    ...tgButtonsGrid(types.map((x) => manageType.getBtn(x.code, x.code))),
    [adminConfig.getBtn(ctx.t('back'))],
  ];
  await ctx.editMessageText(text, ik(keyboard));
  await ctx.answerCallbackQuery(ctx.t('olifis-config-manage-editions'));
});

function manageTypeMsg(
  ctx: MyContext,
  type: EditionType,
  editions: Edition[],
  page: number
) {
  const text = `<b>${ctx.t('olifis-config-manage-type', {
    type: type.code,
  })}</b>\n\n${emoji.a} ${ctx.t('olifis-config-name', { name: type.name })}`;
  const keyboard = [
    [
      typeChangeName.getBtn(
        `${ctx.t('olifis-config-change-type-name')} ${emoji.pencil}`,
        type.code
      ),
    ],
    [
      createEdition.getBtn(
        `${ctx.t('olifis-config-create-edition')} ${emoji.heavy_plus_sign}`,
        type.code
      ),
    ],
    ...tgPaginated(
      editions.map((edition) =>
        manageEdition.getBtn(`${edition.year}`, edition.id)
      ),
      page,
      (page, text) => manageType.getBtn(text, type.code, page),
      { pageSize: EDITIONS_PAGE_SIZE, columns: 3 }
    ).keyboard,
    [manageEditionTypes.getBtn(ctx.t('back'))],
  ];
  return { text, keyboard };
}

const manageType = new TgCallback<[type: string, page?: number]>(
  'type',
  async (ctx) => {
    let [typeCode, page] = ctx.callbackParams;
    const type = await queries.findType(typeCode);
    page = page ?? 0;
    if (!type) {
      return await ctx.answerCallbackQuery(
        ctx.t('olifis-config-type-not-found')
      );
    }
    const editions = await queries.getEditionsPage(type.id, page);
    const { text, keyboard } = manageTypeMsg(ctx, type, editions, page);
    await ctx.conversation.exit();
    await ctx.editMessageText(text, ik(keyboard));
    await ctx.answerCallbackQuery(
      ctx.t('olifis-config-manage-type', { type: type.name })
    );
  }
);

// change name of an edition type

async function olifisChangeTypeName(
  conversation: MyConversation,
  ctx: MyContext
) {
  assert(ctx.conversationData?.type);
  const type = ctx.conversationData.type;
  let editionType: EditionType = ctx.conversationData.type;
  const text = `<b>${ctx.t('olifis-config-send-new-name', {
    type: type.code,
  })}</b>`;
  const keyboard = [[manageType.getBtn(ctx.t('cancel'), type.code)]];
  await conversationEdit(ctx, text, ik(keyboard));

  const { message } = await conversation.waitFor('message:text');
  await skipCommands(conversation, message);
  await conversationDelete(ctx, message.message_id);
  await tgValidate(
    conversation,
    ctx,
    () => {
      if (!validator.isLength(message.text, { min: 1, max: 32 })) {
        return ctx.t('olifis-config-name-between', { min: 1, max: 32 });
      }
    },
    { baseText: text, keyboard: keyboard }
  );

  editionType = await conversation.external(() =>
    queries.updateEditionType(editionType.id, { name: message.text })
  );
  const editions = await conversation.external(() =>
    queries.getEditionsPage(editionType.id, 0)
  );
  {
    const { text, keyboard } = manageTypeMsg(ctx, editionType, editions, 0);
    await conversationEdit(ctx, text, ik(keyboard));
  }
}

// manage a specific edition

async function olifisEditionChangeDate(
  conversation: MyConversation,
  ctx: MyContext
) {
  const data = ctx.conversationData;
  assert(data?.edition);
  let edition = data.edition;
  data.type = edition.type;
  data.year = edition.year;
  const date = await convEditionGetDate(conversation, ctx, () => ({
    text: `<b>${ctx.t('olifis-config-send-new-date')}</b>\n\n${ctx.t(
      'olifis-config-send-date'
    )}`,
    keyboard: [[manageEdition.getBtn(ctx.t('cancel'), data.type.id)]],
  }));
  await convGetConfirmation(conversation, ctx, () => ({
    text: ctx.t('olifis-config-is-date', {
      date: date.format('dddd D MMMM YYYY'),
    }),
    keyboard: [[manageEdition.getBtn(ctx.t('cancel'), data.type.id)]],
  }));

  edition = await queries.updateEdition(data.edition.id, {
    competition_date: date.toDate(),
  });
  const { text, keyboard } = manageEditionMsg(ctx, edition);
  await ctx.editMessageText(text, ik(keyboard));
}

export function manageEditionMsg(
  ctx: MyContext,
  edition: EditionFull | QuestionsGroupFull['edition'],
  questionsGroup?: QuestionsGroupFull
) {
  const type = edition.type;
  const date = dayjs(edition.competition_date);
  const keyboard = new InlineKeyboard();
  let text =
    `<b>${ctx.t('olifis-config-manage-edition', {
      year: edition.year,
    })}</b>\n\n` +
    `${emoji.abcd} <b>${ctx.t('type')}</b>: ${type.name}\n` +
    `${emoji.calendar} <b>${ctx.t('date')}</b>: ${date.format(
      'dddd D MMMM YYYY'
    )}`;
  if (!questionsGroup) {
    const editionFull = edition as EditionFull;
    const changeDate = editionEditDate.getBtn(
      `${ctx.t('olifis-config-change-date')} ${emoji.calendar}`,
      edition.id
    );
    const createGroup = createQuestionsGroup.getBtn(
      `${ctx.t('olifis-config-create-question-group')} ${
        emoji.heavy_plus_sign
      }`,
      edition.id
    );
    const back = manageType.getBtn(ctx.t('back'), type.code);
    const groups = tgButtonsGrid(
      editionFull.questions_groups.map((x) =>
        manageQuestionsGroup.getBtn(x.title, x.id)
      )
    );
    keyboard.row(changeDate);
    groups.forEach((row) => keyboard.row(...row));
    keyboard.row(createGroup).row(back);
  } else {
    const createQuestionBtn = createQuestion.getBtn(
      `${ctx.t('olifis-config-create-question')} ${emoji.heavy_plus_sign}`,
      questionsGroup.id
    );
    const editTitle = editQuestionsGroupTitle.getBtn(
      `${ctx.t('olifis-config-change-group-title')} ${emoji.pencil}`,
      questionsGroup.id
    );
    const back = manageEdition.getBtn(ctx.t('back'), edition.id);
    keyboard.row(editTitle).row(createQuestionBtn).row(back);
    const questionsCount = questionsGroup.questions.length;
    text = `${text}\n<b>${emoji.star} ${ctx.t('questions-group')}</b>: ${
      questionsGroup.title
    }\n${emoji.question} <b>${ctx.t('questions')}</b>: ${questionsCount}`;
  }
  return {
    text,
    keyboard: keyboard.inline_keyboard,
  };
}

const editionEditDate = new TgCallback<[id: number]>(
  'man-edition-date',
  async (ctx) => {
    const edition = await queries.findEdition({ id: ctx.callbackParams[0] });
    if (!edition) {
      return ctx.answerCallbackQuery(ctx.t('olifis-config-edition-not-found'));
    }
    ctx.conversationData = {
      messageId: ctx.callbackQuery.message?.message_id,
      edition,
    };
    await ctx.conversation.reenter('olifisEditionChangeDate');
    await ctx.answerCallbackQuery(`${edition.year}`);
  }
);

export const manageEdition = new TgCallback<[id: number]>(
  'man-edition',
  async (ctx) => {
    const edition = await queries.findEdition({ id: ctx.callbackParams[0] });
    if (!edition) {
      return ctx.answerCallbackQuery(ctx.t('olifis-config-edition-not-found'));
    }
    const { text, keyboard } = manageEditionMsg(ctx, edition);
    await ctx.conversation.exit();
    await ctx.editMessageText(text, ik(keyboard));
    await ctx.answerCallbackQuery(`${edition.year}`);
  }
);

export const manageQuestionsGroup = new TgCallback<[id: number]>(
  'man-questions-group',
  async (ctx) => {
    const questionsGroup = await queries.findQuestionsGroup({
      id: ctx.callbackParams[0],
    });
    if (!questionsGroup) {
      return ctx.answerCallbackQuery(ctx.t('olifis-config-edition-not-found'));
    }
    const { text, keyboard } = manageEditionMsg(
      ctx,
      questionsGroup.edition,
      questionsGroup
    );
    await ctx.conversation.exit();
    await ctx.editMessageText(text, ik(keyboard));
    await ctx.answerCallbackQuery(`${questionsGroup.title}`);
  }
);

const typeChangeName = new TgCallback<[type: string]>(
  'change-type-name',
  async (ctx) => {
    const editionType = await queries.findType(ctx.callbackParams[0]);
    if (!editionType) {
      return await ctx.answerCallbackQuery(
        ctx.t('olifis-config-type-not-found')
      );
    }
    ctx.conversationData = {
      messageId: ctx.callbackQuery.message?.message_id,
      type: editionType,
    };
    await ctx.conversation.reenter('olifisChangeTypeName');
    await ctx.answerCallbackQuery(
      ctx.t('olifis-config-send-new-name', { type: editionType.code })
    );
  }
);

// create a new edition

async function createEditionGetYear(
  conversation: MyConversation,
  ctx: MyContext
) {
  const data = ctx.conversationData;
  assert(data?.type);
  const { text, keyboard } = createEditionMsg(ctx, data.type);
  await conversationEdit(ctx, text, ik(keyboard));

  const { message } = await conversation.waitFor('message:text');
  await skipCommands(conversation, message);
  await conversationDelete(ctx, message.message_id);
  const year = validator.toInt(message.text, 10);
  await tgValidate(
    conversation,
    ctx,
    async () => {
      if (!validator.isInt(`${year}`, { min: 1900, max: 2100 })) {
        return ctx.t('olifis-config-send-a-valid-year');
      }
      const existingEdition = await conversation.external(() =>
        queries.findEdition({ type_id: data.type.id, year })
      );
      if (existingEdition) {
        return ctx.t('olifis-config-edition-already-exists');
      }
    },
    {
      getMessage(error) {
        const { text, ...etc } = createEditionMsg(ctx, data.type);
        return { text: `${text}\n\n${emoji.warning} ${error}`, ...etc };
      },
    }
  );
  return year;
}

async function convEditionGetDate(
  conversation: MyConversation,
  ctx: MyContext,
  getMessage: () => { text: string; keyboard: InlineKeyboardButton[][] }
) {
  const data = ctx.conversationData;
  assert(data?.type && data?.year);

  const date = await conversationDatePicker(conversation, ctx, {
    getMessage(params) {
      const { text, keyboard, ...etc } = getMessage();
      const calendar = tgCalendar(params, (newParams, text) =>
        calendarCallback.getBtn(text, ...newParams)
      );
      return {
        text,
        keyboard: [...calendar.keyboard, ...keyboard],
        ...etc,
      };
    },
    initialParams: ['d-sel', data.year, 0],
  });
  return date;
}

export async function convGetConfirmation(
  conversation: MyConversation,
  ctx: MyContext,
  getMessage: () => {
    text: string;
    keyboard: InlineKeyboardButton[][];
  }
) {
  const time = await conversation.now();
  const confirmButton = dummy.getBtn(ctx.t('confirm'), time);
  const { text, keyboard } = getMessage();
  keyboard[0].splice(0, 0, confirmButton);
  await conversationEdit(ctx, text, ik(keyboard));
  await conversation.waitForCallbackQuery(confirmButton.callback_data);
}

async function olifisCreateEdition(
  conversation: MyConversation,
  ctx: MyContext
) {
  const data = ctx.conversationData;
  assert(data?.type);
  data.year = await createEditionGetYear(conversation, ctx);
  data.date = await convEditionGetDate(conversation, ctx, () =>
    createEditionMsg(ctx, data.type, 'date', data.year)
  );
  await convGetConfirmation(conversation, ctx, () =>
    createEditionMsg(ctx, data.type, 'confirm', data.year, data.date)
  );

  const edition = await conversation.external(() =>
    queries.createEdition({
      type: { connect: { id: data.type.id } },
      competition_date: data.date.toDate(),
      year: data.year,
      questions_groups: {
        create: {
          code: 'default',
          title: 'default',
        },
      },
    })
  );

  const { text, keyboard } = manageEditionMsg(ctx, edition);
  await conversationEdit(ctx, text, ik(keyboard));
}

function createEditionMsg(
  ctx: MyContext,
  type: EditionType,
  step: 'year' | 'date' | 'confirm' = 'year',
  year?: number,
  date?: Dayjs
) {
  const header = `<b>${ctx.t('olifis-config-create-edition-for', {
    type: type.name,
  })}</b>`;
  const dataLines: string[] = [];
  if (year) {
    dataLines.push(
      `${emoji.spiral_calendar_pad} ${ctx.t(
        'olifis-config-year'
      )}: <code>${year}</code>`
    );
  }
  if (date) {
    dataLines.push(`${emoji.calendar} ${date.format('dddd D MMMM YYYY')}`);
  }
  let prompt = '';
  const keyboard = [[manageType.getBtn(ctx.t('cancel'), type.code)]];
  if (step === 'year') {
    prompt = ctx.t('olifis-config-send-year-for-new-edition');
  } else if (step === 'date') {
    prompt = ctx.t('olifis-config-send-date');
  } else if (step === 'confirm') {
    prompt = ctx.t('olifis-config-confirm-creation');
  }
  const dataLinesTxt =
    dataLines.length > 0 ? `${dataLines.join('\n')}\n\n` : '';
  return {
    text: `${header}\n\n${dataLinesTxt}<i>${emoji.question} ${prompt}</i>`,
    keyboard,
  };
}

const dummy = new TgCallback('dummy', async (ctx) => {
  await ctx.answerCallbackQuery(ctx.t('no-operation-running'));
});

const createEdition = new TgCallback<[type: string]>(
  'create-edition',
  async (ctx) => {
    const type = await queries.findType(ctx.callbackParams[0]);
    if (!type) {
      return await ctx.answerCallbackQuery(
        ctx.t('olifis-config-type-not-found')
      );
    }
    ctx.conversationData = {
      messageId: ctx.callbackQuery.message?.message_id,
      type,
    };
    await ctx.conversation.reenter('olifisCreateEdition');
    await ctx.answerCallbackQuery(ctx.t('olifis-config-create-edition'));
  }
);

async function getQuestionsGroupTitle(
  conversation: MyConversation,
  ctx: MyContext,
  getMessage: () => TgMessageData
) {
  const { text, keyboard } = getMessage();
  await conversationEdit(ctx, text, ik(keyboard));
  const { message } = await conversation.waitFor('message:text');
  await skipCommands(conversation, message);
  await conversationDelete(ctx, message.message_id);
  const title = message.text;
  await tgValidate(
    conversation,
    ctx,
    () =>
      validator.isLength(title, { min: 1, max: 30 })
        ? undefined
        : ctx.t('validation-string-length'),
    { baseText: text, keyboard }
  );
  return title;
}

async function olifisCreateQuestionsGroup(
  conversation: MyConversation,
  ctx: MyContext
) {
  assert(ctx.conversationData?.edition);
  const edition: EditionFull = ctx.conversationData.edition;
  const title = await getQuestionsGroupTitle(conversation, ctx, () => ({
    text: `<b>${ctx.t('olifis-config-send-questions-group-title')}</b>`,
    keyboard: [[manageEdition.getBtn(ctx.t('cancel'), edition.id)]],
  }));
  const questionsGroup = await queries.createQuestionsGroup({
    title,
    edition: { connect: { id: edition.id } },
  });
  const { text, keyboard } = manageEditionMsg(ctx, edition, questionsGroup);
  await conversationEdit(ctx, text, ik(keyboard));
}

const createQuestionsGroup = new TgCallback<[editionId: number]>(
  'create-q-group',
  async (ctx) => {
    const [editionId] = ctx.callbackParams;
    const edition = await queries.findEdition({ id: editionId });
    if (!edition) {
      return await ctx.answerCallbackQuery(
        ctx.t('olifis-config-edition-not-found')
      );
    }
    ctx.conversationData = {
      messageId: ctx.callbackQuery.message?.message_id,
      edition,
    };
    await ctx.conversation.reenter('olifisCreateQuestionsGroup');
  }
);

async function olifisEditQuestionsGroupTitle(
  conversation: MyConversation,
  ctx: MyContext
) {
  assert(ctx.conversationData?.questionsGroup);
  let questionsGroup: QuestionsGroupFull = ctx.conversationData.questionsGroup;
  const title = await getQuestionsGroupTitle(conversation, ctx, () => ({
    text: `<b>${ctx.t('olifis-config-send-questions-group-title')}</b>`,
    keyboard: [
      [manageQuestionsGroup.getBtn(ctx.t('cancel'), questionsGroup.id)],
    ],
  }));
  questionsGroup = await queries.updateQuestionsGroup(questionsGroup.id, {
    title,
  });
  const { text, keyboard } = manageEditionMsg(
    ctx,
    questionsGroup.edition,
    questionsGroup
  );
  await conversationEdit(ctx, text, ik(keyboard));
}

const editQuestionsGroupTitle = new TgCallback<[questionsGroupId: number]>(
  'edit-group-title',
  async (ctx) => {
    const [questionsGroupId] = ctx.callbackParams;
    const questionsGroup = await queries.findQuestionsGroup({
      id: questionsGroupId,
    });
    if (!questionsGroup) {
      return await ctx.answerCallbackQuery(
        ctx.t('olifis-config-questions-group-not-found')
      );
    }
    ctx.conversationData = {
      messageId: ctx.callbackQuery.message?.message_id,
      questionsGroup,
    };
    await ctx.conversation.reenter('olifisEditQuestionsGroupTitle');
  }
);

olifisAdminModule.on('message:photo', async (ctx, next) => {
  if (ctx.message.caption === '/fileid') {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    assert(photo);
    await ctx.reply(photo.file_id);
  }
  await next();
});

const callbacks = [
  adminConfig,
  manageEditionTypes,
  manageType,
  manageEdition,
  typeChangeName,
  createEdition,
  editionEditDate,
  dummy,
  createQuestionsGroup,
  manageQuestionsGroup,
  editQuestionsGroupTitle,
].map((x) => x.setPrefix('olifis-admin'));
olifisAdminModule.use(createConversation(olifisChangeTypeName));
olifisAdminModule.use(createConversation(olifisCreateEdition));
olifisAdminModule.use(createConversation(olifisEditionChangeDate));
olifisAdminModule.use(createConversation(olifisCreateQuestionsGroup));
olifisAdminModule.use(createConversation(olifisEditQuestionsGroupTitle));
olifisAdminModule.use(olifisManageQuestionModule);
olifisAdminModule
  .on('callback_query:data')
  .lazy(tgCallbackMiddleware(callbacks));
