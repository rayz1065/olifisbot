import {
  Edition,
  EditionType,
  QuestionsGroup,
  UserQuestion,
} from '@prisma/client';
import assert from 'assert';
import { Composer, InputFile } from 'grammy';
import { emoji } from 'node-emoji';
import path from 'path';
import { tgButtonsGrid, tgPaginated } from '../../lib/list';
import {
  escapeHtml,
  ik,
  TgCallback,
  tgCallbackMiddleware,
} from '../../lib/utils';
import { MyContext } from '../../main';
import { isAdmin } from '../../middlewares/is-admin';
import { adminConfig } from './admin';
import {
  EDITIONS_PAGE_SIZE,
  EDITION_TYPES,
  QUESTIONS_PAGE_SIZE,
} from './index';
import queries, {
  EditionFull,
  QuestionFull,
  QuestionWithTags,
} from './queries';
import { enterQuestionById, randomQuestion } from './question';

export const olifisUserModule = new Composer<MyContext>();

function mainMenuMsg(ctx: MyContext) {
  let infoButton = botInfo.getBtn(`${ctx.t('info')} ${emoji.book}`);
  if (ctx.session.mainMenuInfoButton === 'stats') {
    infoButton = botStats.getBtn(`${ctx.t('stats')} ${emoji.bar_chart}`);
  }
  const keyboard = [
    [
      randomQuestion.getBtn(`${ctx.t('random-question')} 🎲`),
      searchByTopic.getBtn(
        `${emoji.fire} ${ctx.t('search-by-topic')} ${emoji.atom_symbol}`
      ),
    ],
    [
      editionsList.getBtn(`${ctx.t('editions')} ${emoji.newspaper}`),
      profile.getBtn(`${ctx.t('profile')} ${emoji.bust_in_silhouette}`),
      infoButton,
    ],
    [
      contactMe.getBtn(`${ctx.t('contact-me')} ${emoji.sos}`),
      botConfig.getBtn(`${ctx.t('config')} ${emoji.gear}`),
    ],
  ];
  if (isAdmin(ctx)) {
    keyboard.push([
      adminConfig.getBtn(`${ctx.t('admin-config')} ${emoji.wrench}`),
    ]);
  }
  return { text: `${emoji.wave} ${ctx.t('welcome-msg')}`, keyboard };
}

olifisUserModule.command('start', async (ctx) => {
  const { text, keyboard } = mainMenuMsg(ctx);
  await ctx.reply(text, ik(keyboard));
});

export const mainMenu = new TgCallback('menu', async (ctx) => {
  const { text, keyboard } = mainMenuMsg(ctx);
  await ctx.answerCallbackQuery(ctx.t('main-menu'));
  if (ctx.callbackQuery.message?.photo) {
    await ctx.reply(text, ik(keyboard));
    await ctx.deleteMessage();
  } else {
    await ctx.editMessageText(text, ik(keyboard));
  }
});

function getLanguages() {
  return [
    { name: `Italiano ${emoji.it}`, code: 'it' },
    { name: `English ${emoji.gb}`, code: 'en' },
  ];
}

function configMsg(ctx: MyContext) {
  const languages = getLanguages();
  const keyboard = [
    ...tgButtonsGrid(
      languages.map((x) => configSetLanguage.getBtn(x.name, x.code))
    ),
    [mainMenu.getBtn(ctx.t('back'))],
  ];
  const text = `<b>${ctx.t('choose-your-config')}</b>`;
  return { text, keyboard };
}

const configSetLanguage = new TgCallback<[code: string]>(
  'set-lang',
  async (ctx) => {
    const [code] = ctx.callbackParams;
    const languages = getLanguages();
    const language = languages.find((x) => x.code === code);
    if (!language) {
      return await ctx.answerCallbackQuery(ctx.t('language-not-found'));
    }
    ctx.dbUser = await queries.updateUser(ctx.dbUser.id, {
      language: code,
    });
    await ctx.i18n.renegotiateLocale();

    const { text, keyboard } = configMsg(ctx);
    await ctx.editMessageText(text, ik(keyboard));
    await ctx.answerCallbackQuery(language.name);
  }
);

const botConfig = new TgCallback('config', async (ctx) => {
  const { text, keyboard } = configMsg(ctx);
  await ctx.editMessageText(text, ik(keyboard));
  await ctx.answerCallbackQuery(ctx.t('config'));
});

const contactMe = new TgCallback('contact', async (ctx) => {
  await ctx.answerCallbackQuery({
    text: `🧑‍💻 @rayz1065`,
    show_alert: true,
  });
});

function editionsListMsg(
  ctx: MyContext,
  editionTypes: EditionType[],
  editions: Edition[]
) {
  assert(ctx.session.editions);
  const state = ctx.session.editions;
  const editionType =
    editionTypes.find((x) => x.id === state.typeId) ?? editionTypes[0];
  const { keyboard } = tgPaginated(
    editions.map((edition) =>
      editionQuestions.getBtn(`${edition.year}`, edition.id)
    ),
    state.page,
    (page, text) => editionsList.getBtn(text, page),
    { pageSize: EDITIONS_PAGE_SIZE, columns: 4 }
  );
  const otherTypes = editionTypes.filter((x) => x.id !== editionType.id);
  return {
    text:
      `<b>${editionType.name}</b>\n\n` +
      `<i>${ctx.t('choose-an-edition-to-see-questions')}</i>`,
    keyboard: [
      ...tgButtonsGrid(
        otherTypes.map((x) => editionSetFilter.getBtn(x.name, x.id))
      ),
      ...keyboard,
      [mainMenu.getBtn(ctx.t('back'))],
    ],
  };
}

const editionsList = new TgCallback<[page?: number]>(
  'editions',
  async (ctx) => {
    const [page] = ctx.callbackParams;
    const editionTypes = await queries.getEditionTypes();
    const firstLevel = editionTypes.find(
      (x) => x.code === EDITION_TYPES['firstLevel']
    );
    assert(firstLevel);
    ctx.session.editions ??= {
      page: 0,
      typeId: firstLevel.id,
    };
    const state = ctx.session.editions;
    if (page !== undefined) {
      state.page = page;
    }
    const editions = await queries.getEditionsPage(state.typeId, state.page);

    const { text, keyboard } = editionsListMsg(ctx, editionTypes, editions);
    await ctx.editMessageText(text, ik(keyboard));
    await ctx.answerCallbackQuery(`${state.page + 1}`);
  }
);

const editionSetFilter = new TgCallback<[typeId: number]>(
  'editions-filter',
  async (ctx) => {
    const [typeId] = ctx.callbackParams;
    const editionTypes = await queries.getEditionTypes();
    const editionType = editionTypes.find((x) => x.id === typeId);
    if (!editionType) {
      return await ctx.answerCallbackQuery('edition-type-not-found');
    }
    ctx.session.editions = {
      ...ctx.session.editions,
      page: 0,
      typeId: editionType.id,
    };
    const state = ctx.session.editions;
    const editions = await queries.getEditionsPage(state.typeId, state.page);

    const { text, keyboard } = editionsListMsg(ctx, editionTypes, editions);
    await ctx.editMessageText(text, ik(keyboard));
    await ctx.answerCallbackQuery(editionType.name);
  }
);

function questionGetIcon(
  question: QuestionWithTags,
  userQuestions: UserQuestion[]
) {
  const userQuestion = userQuestions.find((x) => x.question_id === question.id);
  let questionIcon = question.question_tags[0]?.question_tag?.icon ?? '';
  if (!userQuestion) {
  } else if (userQuestion.solved) {
    questionIcon = emoji.white_check_mark;
  } else if (userQuestion.saw_solution) {
    questionIcon = emoji.eyes;
  } else {
    questionIcon = emoji.x;
  }
  return questionIcon;
}

async function editionQuestionsMsg(ctx: MyContext, edition: EditionFull) {
  const textLines = [
    `<b>${edition.type.name} ${edition.year}</b>\n`,
    `${emoji.calendar} <b>${ctx.t('competition-date')}</b>: ${ctx.t(
      'formatted-date-long',
      { date: edition.competition_date }
    )}`,
    `${emoji.compression} <a href="${edition.archive_url}">${ctx.t(
      'archive-url'
    )}</a>\n`,
    `${emoji.question} <i>${ctx.t('choose-a-question-from-the-list')}</i>`,
  ];
  const defaultGroup = await queries.findQuestionsGroup({
    edition_id: edition.id,
    code: 'default',
  });
  const keyboard = [];
  if (defaultGroup) {
    const questions = defaultGroup.questions;
    const userQuestions = await queries.findUserQuestions({
      question_id: { in: questions.map((x) => x.id) },
      user_id: ctx.dbUser.id,
    });
    const questionButtons = questions.map((question) => {
      const buttonIcon = questionGetIcon(question, userQuestions);
      return enterQuestionById.getBtn(
        `${question.number} ${buttonIcon}`,
        question.id,
        'edition'
      );
    });
    keyboard.push(...tgButtonsGrid(questionButtons, { columns: 4 }));
  }
  keyboard.push([editionsList.getBtn(ctx.t('back'))]);

  return {
    text: textLines.join('\n'),
    keyboard,
  };
}

export const editionQuestions = new TgCallback<[editionId: number]>(
  'edition',
  async (ctx) => {
    const [editionId] = ctx.callbackParams;
    const edition = await queries.findEdition({ id: editionId });
    if (!edition) {
      return ctx.answerCallbackQuery(ctx.t('edition-not-found'));
    }
    const { text, keyboard } = await editionQuestionsMsg(ctx, edition);
    await ctx.answerCallbackQuery(`${edition.type.name} ${edition.year}`);
    if (ctx.callbackQuery.message?.photo) {
      await ctx.reply(text, ik(keyboard));
      await ctx.deleteMessage();
    } else {
      await ctx.editMessageText(text, ik(keyboard));
    }
  }
);

const searchByTopic = new TgCallback('topics', async (ctx) => {
  const tags = await queries.getQuestionTags();
  const keyboard = tgButtonsGrid(
    tags.map((tag) => questionsByTag.getBtn(`${tag.name} ${tag.icon}`, tag.id))
  );
  keyboard.push([mainMenu.getBtn(ctx.t('back'))]);
  const text = `<b>${ctx.t('choose-a-topic')}</b>`;
  await ctx.editMessageText(text, ik(keyboard));
  await ctx.answerCallbackQuery(ctx.t('search-by-topic'));
});

export const questionsByTag = new TgCallback<[tagId: number, page?: number]>(
  'questions-by-tag',
  async (ctx) => {
    const [tagId, page] = ctx.callbackParams;
    const tags = await queries.getQuestionTags();
    const tag = tags.find((x) => x.id === tagId);
    if (!tag) {
      return await ctx.answerCallbackQuery(ctx.t('tag-not-found'));
    }

    const firstLevel = await queries.findType(EDITION_TYPES.firstLevel);
    assert(firstLevel);
    ctx.session.editionsByTag ??= {};
    ctx.session.editionsByTag[tag.code] ??= {
      page: 0,
      typeId: firstLevel.id,
    };
    const state = ctx.session.editionsByTag[tag.code];
    if (page !== undefined) {
      state.page = page;
    }

    const questions = await queries.getQuestionPage(state.page, {
      question_tags: {
        some: {
          question_tag_id: tag.id,
        },
      },
    });
    const userQuestions = await queries.findUserQuestions({
      question_id: { in: questions.map((x) => x.id) },
      user_id: ctx.dbUser.id,
    });

    let { keyboard } = tgPaginated(
      questions.map((question) =>
        enterQuestionById.getBtn(
          `${question.questions_group.edition.year} - ${
            question.number
          } ${questionGetIcon(question, userQuestions)}`,
          question.id,
          `tag_${tagId}`
        )
      ),
      state.page,
      (page, text) => questionsByTag.getBtn(text, tagId, page),
      { columns: 3, pageSize: QUESTIONS_PAGE_SIZE }
    );
    keyboard.push([searchByTopic.getBtn(ctx.t('back'))]);
    const text = `${tag.icon} <b>${ctx.t('questions-with-tag', {
      tag: tag.name,
    })}</b>`;
    keyboard = [
      [
        randomQuestion.getBtn(
          `${ctx.t('random-question')} ${tag.icon}`,
          tag.id
        ),
      ],
      ...keyboard,
    ];

    await ctx.answerCallbackQuery(tag.name);
    if (ctx.callbackQuery.message?.photo) {
      await ctx.reply(text, ik(keyboard));
      await ctx.deleteMessage();
    } else {
      await ctx.editMessageText(text, ik(keyboard));
    }
  }
);

async function profileMsg(ctx: MyContext) {
  const stats = await queries.userStats(ctx.dbUser.id);

  const text = `<b>${ctx.t('your-profile-on-bot')}</b>
🆔 ${ctx.dbUser.telegram_chat_id}
👤 ${ctx.t('name')}: ${escapeHtml(ctx.dbUser.first_name)}
🏷 ${ctx.t('username')}: ${ctx.dbUser.username}
📆 ${ctx.t('subscription-date')}: ${ctx.t('formatted-date-long', {
    date: ctx.dbUser.created_at,
  })}

✅ ${ctx.t('solved-questions')}: ${stats.solved}
🔢 ${ctx.t('attempts-average')}: ${
    Math.round(stats.averageAttempts * 1000) / 1000
  }
⭐️ ${ctx.t('total-attempted')}: ${stats.totalAttempted}
👀 ${ctx.t('solutions-seen')}: ${stats.sawSolution}

✉️ ${ctx.t('friends-invited')}: ${stats.invitedUsers}`;
  const keyboard = [
    [
      userQuestionsList.getBtn(
        `${ctx.t('attempted-questions')} ${emoji.star2}`
      ),
    ],
    [mainMenu.getBtn(ctx.t('back'))],
  ];
  return { text, keyboard };
}

const profile = new TgCallback('profile', async (ctx) => {
  const { text, keyboard } = await profileMsg(ctx);
  await ctx.editMessageText(text, ik(keyboard));
  await ctx.answerCallbackQuery(emoji.bust_in_silhouette);
});

export const userQuestionsList = new TgCallback<[page?: number]>(
  'user-questions',
  async (ctx) => {
    let [page] = ctx.callbackParams;
    page ??= 0;
    const questions = await queries.getQuestionPage(page, {
      user_questions: { some: { user_id: ctx.dbUser.id } },
    });
    const userQuestions = await queries.findUserQuestions({
      question_id: { in: questions.map((x) => x.id) },
      user_id: ctx.dbUser.id,
    });
    const questionButtons = questions.map((x) => {
      const edition = x.questions_group.edition;
      return enterQuestionById.getBtn(
        `${edition.year} - ${x.number} ${questionGetIcon(x, userQuestions)}`,
        x.id,
        'profile'
      );
    });
    const { keyboard } = tgPaginated(
      questionButtons,
      page,
      (page, text) => userQuestionsList.getBtn(text, page),
      { pageSize: QUESTIONS_PAGE_SIZE, columns: 3 }
    );
    keyboard.push([profile.getBtn(ctx.t('back'))]);
    const { text } = await profileMsg(ctx);
    await ctx.answerCallbackQuery(emoji.star2);
    if (ctx.callbackQuery.message?.photo) {
      await ctx.reply(text, ik(keyboard));
      await ctx.deleteMessage();
    } else {
      await ctx.editMessageText(text, ik(keyboard));
    }
  }
);

const botInfo = new TgCallback('info', async (ctx) => {
  const text = `${emoji.book} ${ctx.t('bot-info-msg')}`;
  const keyboard = [
    [botStats.getBtn(`${ctx.t('stats')} ${emoji.bar_chart}`)],
    [mainMenu.getBtn(ctx.t('back'))],
  ];
  ctx.session.mainMenuInfoButton = 'info';
  await ctx.editMessageText(text, ik(keyboard));
  await ctx.answerCallbackQuery(emoji.book);
});

const botStats = new TgCallback('stats', async (ctx) => {
  const stats = await queries.botStats();

  const text = `<b>${emoji.bar_chart} ${ctx.t('info-and-stats')}</b>
${emoji.calendar} ${ctx.t('bot-created-on')} ${ctx.t('formatted-date-long', {
    date: new Date('2018-09-16'),
  })}
${emoji.bust_in_silhouette} ${ctx.t('subscribed-users')}: ${stats.totalUsers}
${emoji.question} ${ctx.t('questions-count')}: ${stats.totalQuestions}

${emoji.white_check_mark} ${ctx.t('solved-questions')}: ${stats.solved}
${emoji['1234']} ${ctx.t('attempts-average')}: ${
    Math.round(stats.averageAttempts * 100) / 100
  }
${emoji.star2} ${ctx.t('total-attempted')}: ${stats.totalAttempted}
${emoji.eyes} ${ctx.t('solutions-seen')}: ${stats.sawSolution}`;
  ctx.session.mainMenuInfoButton = 'stats';
  const keyboard = [
    [botInfo.getBtn(`${ctx.t('info')} ${emoji.book}`)],
    [mainMenu.getBtn(ctx.t('back'))],
  ];
  await ctx.editMessageText(text, ik(keyboard));
  await ctx.answerCallbackQuery(emoji.eyes);
});

export function getQuestionsDirectory() {
  return path.join(__dirname, '..', '..', '..', 'storage', 'questions');
}

export function getQuestionsGroupDirectory(
  questionsGroup: QuestionsGroup & {
    edition: Edition & {
      type: EditionType;
    };
  }
) {
  return path.join(
    getQuestionsDirectory(),
    `${questionsGroup.edition.type.code}`,
    `${questionsGroup.edition.year}`,
    `${questionsGroup.code}`
  );
}

export function getQuestionQuestionImage(question: QuestionFull) {
  if (question.question_image) {
    return question.question_image;
  }
  return new InputFile(
    path.join(
      getQuestionsGroupDirectory(question.questions_group),
      `q-${question.number}.jpg`
    )
  );
}

export function getQuestionSolutionImage(question: QuestionFull) {
  if (question.solution_image) {
    return question.solution_image;
  }
  return new InputFile(
    path.join(
      getQuestionsGroupDirectory(question.questions_group),
      `a-${question.number}.jpg`
    )
  );
}

const callbacks = [
  contactMe,
  editionsList,
  profile,
  searchByTopic,
  botInfo,
  botStats,
  mainMenu,
  editionSetFilter,
  editionQuestions,
  botConfig,
  questionsByTag,
  configSetLanguage,
  userQuestionsList,
].map((x) => x.setPrefix('olifis'));

olifisUserModule
  .on('callback_query:data')
  .lazy(tgCallbackMiddleware(callbacks));
