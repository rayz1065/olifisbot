import { createConversation } from '@grammyjs/conversations';
import { Prisma, QuestionTag, UserQuestion } from '@prisma/client';
import assert from 'assert';
import { Parser } from 'expr-eval';
import { Composer, InlineKeyboard, InputFile } from 'grammy';
import { emoji } from 'node-emoji';
import {
  conversationDelete,
  escapeHtml,
  ik,
  skipCommands,
  TgCallback,
  tgCallbackMiddleware,
} from '../../lib/utils';
import { MyContext, MyConversation } from '../../main';
import { QUESTION_TYPES } from './index';
import queries, { QuestionFull } from './queries';
import {
  editionQuestions,
  getQuestionsGroupDirectory,
  mainMenu,
  questionsByTag,
  userQuestionsList,
} from './user';
import path from 'path';
import fs from 'fs';

type EnterQuestionSource = 'rand' | `tag_${number}` | 'profile' | 'edition';

export const olifisQuestionModule = new Composer<MyContext>();

export function checkUserSolutionFormula(
  actualFormula: string,
  userFormula: string,
  maxErrorPercentage = 5
) {
  const solution = Parser.parse(actualFormula);
  const userSolution = Parser.parse(userFormula);
  let successful = 0;
  maxErrorPercentage /= 100;
  const testCount = 10;
  for (let i = 0; i < testCount; i++) {
    const mul = i < testCount / 2 ? 1 : 100;
    const subs = solution
      .variables()
      .reduce((acc, x) => ({ ...acc, [x]: (Math.random() + 0.01) * mul }), {});
    const trueRes = solution.evaluate(subs);
    const userRes = userSolution.evaluate(subs);
    successful += +(
      Math.sign(trueRes) === Math.sign(userRes) &&
      Math.abs(trueRes * (1 - maxErrorPercentage)) <= Math.abs(userRes) &&
      Math.abs(userRes) <= Math.abs(trueRes * (1 + maxErrorPercentage))
    );
  }
  return successful === testCount;
}

function questionMsg(
  ctx: MyContext,
  question: QuestionFull,
  source: EnterQuestionSource
) {
  const keyboard = new InlineKeyboard();
  if (question.answer_type === QUESTION_TYPES.closed) {
    keyboard.row(
      ...'ABCDE'
        .split('')
        .map((x) => closedAnswer.getBtn(x, question.id, x, source))
    );
  } else if (question.answer_type === QUESTION_TYPES.selfEvaluation) {
    keyboard.row(
      selfEvaluationCb.getBtn(ctx.t('self-evaluate'), question.id, source)
    );
  } else {
    keyboard.row(
      openAnswer.getBtn(
        `${ctx.t('attempt-answer')} ${emoji.pencil2}`,
        question.id,
        source
      )
    );
  }

  keyboard.row(
    showSolution.getBtn(`${ctx.t('show-solution')} ${emoji.eyes}`, question.id)
  );
  const questionsGroup = question.questions_group;
  const edition = questionsGroup.edition;
  const editionType = edition.type;
  const tags = question.question_tags.map((x) => x.question_tag);

  const textLines = [
    `${emoji.spiral_calendar_pad} <b>${editionType.name} ${edition.year}</b>`,
    `${emoji['1234']} ${ctx.t('question-number')} <b>${question.number}</b>`,
  ];
  if (tags.length) {
    textLines.push(tags.map((x) => `${x.icon} ${x.name}`).join(', '));
  }
  // buttons to add: create issue, share

  return {
    text: textLines.join('\n'),
    keyboard: [
      ...keyboard.inline_keyboard,
      ...questionNavigation(ctx, question, source),
    ],
  };
}

function findImageFile(
  directory: string,
  filename: string,
  extensions = ['png', 'jpg']
) {
  for (const extension of extensions) {
    const filePath = path.join(directory, `${filename}.${extension}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
}

export function getQuestionQuestionImage(question: QuestionFull) {
  if (question.question_image) {
    return question.question_image;
  }
  const directory = getQuestionsGroupDirectory(question.questions_group);
  const filePath = findImageFile(directory, `q-${question.number}`);
  if (!filePath) {
    throw new Error(`Question file not found for question ${question.number}`);
  }
  return new InputFile(filePath);
}

export function getQuestionSolutionImage(question: QuestionFull) {
  if (question.solution_image) {
    return question.solution_image;
  }
  const directory = getQuestionsGroupDirectory(question.questions_group);
  const filePath = findImageFile(directory, `a-${question.number}`);
  if (!filePath) {
    throw new Error(`Solution file not found for question ${question.number}`);
  }
  return new InputFile(filePath);
}

export function getQuestionEvaluationImage(question: QuestionFull) {
  if (question.evaluation_image) {
    return question.evaluation_image;
  }
  const directory = getQuestionsGroupDirectory(question.questions_group);
  const filePath = findImageFile(directory, `e-${question.number}`);
  if (!filePath) {
    throw new Error(
      `Evaluation file not found for question ${question.number}`
    );
  }
  return new InputFile(filePath);
}

async function enterQuestion(
  ctx: MyContext,
  question: QuestionFull,
  source: EnterQuestionSource
) {
  const questionImage = getQuestionQuestionImage(question);
  const { text, keyboard } = questionMsg(ctx, question, source);
  try {
    if (ctx.callbackQuery?.message?.photo) {
      await ctx.editMessageMedia({
        type: 'photo',
        media: questionImage,
        caption: text,
        parse_mode: 'HTML',
      });
    } else {
      await ctx.replyWithPhoto(questionImage, {
        caption: text,
        ...ik(keyboard),
      });
    }
  } catch (error) {
    console.error('failed to get question', error);
    return await ctx.answerCallbackQuery(ctx.t('failed-to-get-question'));
  }
  const edition = question.questions_group.edition;
  await ctx.conversation.exit();
  await ctx.answerCallbackQuery(`${edition.year} - ${question.number}`);
  if (ctx.callbackQuery?.message?.photo) {
    await ctx.editMessageReplyMarkup(ik(keyboard));
  } else {
    await ctx.deleteMessage();
  }
}

export const randomQuestion = new TgCallback<[tagId?: number]>(
  'random',
  async (ctx) => {
    const [tagId] = ctx.callbackParams;
    let tag: QuestionTag | undefined = undefined;
    if (tagId !== undefined) {
      const tags = await queries.getQuestionTags();
      tag = tags.find((x) => x.id === tagId);
    }
    const question = await queries.randomQuestion(ctx.dbUser.id, tag?.id);
    if (!question) {
      return await ctx.answerCallbackQuery({
        text: ctx.t('no-random-question-found'),
        show_alert: true,
      });
    }
    const source: EnterQuestionSource = tag ? `tag_${tag.id}` : 'rand';
    await enterQuestion(ctx, question, source);
  }
);

export const enterQuestionById = new TgCallback<
  [questionId: number, source: EnterQuestionSource]
>('get-question', async (ctx) => {
  const [questionId, source] = ctx.callbackParams;
  const question = await queries.findQuestion({ id: questionId });
  if (!question) {
    return await ctx.answerCallbackQuery({
      text: ctx.t('question-not-found'),
      show_alert: true,
    });
  }
  await enterQuestion(ctx, question, source);
});

function prettyPrintAnswer(ctx: MyContext, question: QuestionFull) {
  if (question.answer_type === QUESTION_TYPES.closed) {
    return `${question.closed_answer}`;
  } else if (question.answer_type === QUESTION_TYPES.formula) {
    return `${question.answer_formula}`;
  } else if (question.answer_type === QUESTION_TYPES.open) {
    const openAnswer = question.open_answer ?? 0;
    const openAnswerRange = question.open_answer_range ?? 0;
    return `${+openAnswer.toPrecision(5)} ± ${+openAnswerRange.toPrecision(
      5
    )} [${question.open_answer_unit ?? ctx.t('adimensional')}]`;
  }

  return '🖼';
}

const showSolution = new TgCallback<[questionId: number]>(
  'show-solution',
  async (ctx) => {
    const [questionId] = ctx.callbackParams;
    const question = await queries.findQuestion({ id: questionId });
    if (!question) {
      return await ctx.answerCallbackQuery({
        text: ctx.t('question-not-found'),
        show_alert: true,
      });
    }

    let userQuestion = await queries.findUserQuestion(
      questionId,
      ctx.dbUser.id
    );
    if (!userQuestion.solved) {
      userQuestion = await queries.updateUserQuestion(
        questionId,
        ctx.dbUser.id,
        { saw_solution: true }
      );
    }

    try {
      await ctx.replyWithPhoto(getQuestionSolutionImage(question), {
        caption: `<b>${ctx.t('the-solution-is', {
          answer: prettyPrintAnswer(ctx, question),
        })}</b>`,
        ...ik([[hideSolution.getBtn(`${ctx.t('hide-solution')} ${emoji.x}`)]]),
      });
    } catch (error) {
      console.error('failed to get question', error);
      return await ctx.answerCallbackQuery(ctx.t('failed-to-get-question'));
    }
    await ctx.answerCallbackQuery(emoji.eyes);
  }
);

const hideSolution = new TgCallback('hide-solution', async (ctx) => {
  await ctx.answerCallbackQuery(emoji.x);
  await ctx.deleteMessage();
});

async function updateUserQuestion(
  userId: number,
  questionId: number,
  correctAnswer: boolean
) {
  const updateData: Prisma.UserQuestionUpdateInput = {};
  const userQuestion = await queries.findUserQuestion(questionId, userId);
  if (!userQuestion.solved) {
    updateData.attempts = { increment: 1 };
    updateData.solved = correctAnswer;
  }
  return await queries.updateUserQuestion(questionId, userId, updateData);
}

const closedAnswer = new TgCallback<
  [questionId: number, answer: string, source: EnterQuestionSource]
>('answer', async (ctx) => {
  const [questionId, answer, source] = ctx.callbackParams;
  const question = await queries.findQuestion({ id: questionId });
  if (!question) {
    return await ctx.answerCallbackQuery(ctx.t('question-not-found'));
  } else if (
    question.answer_type !== QUESTION_TYPES.closed ||
    !question.closed_answer
  ) {
    return await ctx.answerCallbackQuery(ctx.t('wrong-answer-type'));
  }

  const correctAnswer = question.closed_answer === answer;
  const userQuestion = await updateUserQuestion(
    ctx.dbUser.id,
    question.id,
    correctAnswer
  );

  if (!correctAnswer) {
    const { text, keyboard } = questionMsg(ctx, question, source);
    await ctx.answerCallbackQuery(answer);
    return await ctx.editMessageCaption({
      caption: `${text}\n\n${emoji.x} <i>${ctx.t('is-not-the-right-answer', {
        answer,
      })}</i>`,
      ...ik(keyboard),
    });
  }

  const { text, keyboard } = questionSolvedMsg(
    ctx,
    question,
    userQuestion,
    source
  );
  try {
    await ctx.editMessageMedia({
      type: 'photo',
      media: getQuestionSolutionImage(question),
      caption: text,
      parse_mode: 'HTML',
    });
  } catch (error) {
    return await ctx.answerCallbackQuery({
      text: ctx.t('failed-to-send-answer'),
      show_alert: true,
    });
  }
  await ctx.editMessageReplyMarkup(ik(keyboard));
  await ctx.answerCallbackQuery(emoji.trophy);
});

function questionSolvedMsg(
  ctx: MyContext,
  question: QuestionFull,
  userQuestion: UserQuestion,
  source: EnterQuestionSource
) {
  const textLines = [
    `<b>${ctx.t('the-solution-is', {
      answer: prettyPrintAnswer(ctx, question),
    })}</b>`,
    `${emoji.trophy} ` +
      ctx.t('you-solved-in-attempts', { attempts: userQuestion.attempts }),
  ];
  if (userQuestion.saw_solution) {
    textLines.push(`${emoji.eyes} <i>${ctx.t('you-saw-the-solution')}</i>`);
  }
  return {
    text: textLines.join('\n'),
    keyboard: questionNavigation(ctx, question, source),
  };
}

async function olifisOpenAnswer(conversation: MyConversation, ctx: MyContext) {
  const data = ctx.conversationData;
  assert(data?.question);
  const question: QuestionFull = data.question;
  assert(['formula', 'open'].indexOf(question.answer_type) !== -1);
  const { source } = data;

  let explanation = '?';
  if (question.answer_type === QUESTION_TYPES.open) {
    explanation = ctx.t('attempt-answer-open-explanation', {
      unit: question.open_answer_unit ?? ctx.t('adimensional'),
    });
  } else {
    const expression = Parser.parse(question.answer_formula!);
    const variables = expression.variables();
    explanation = ctx.t('attempt-answer-formula-explanation', {
      variables: variables.map((x) => `<code> ${x} </code>`).join(ctx.t('and')),
    });
  }

  let { text: baseText } = questionMsg(ctx, question, source);
  baseText = `${baseText}\n\n${emoji.question} ${explanation}`;
  const questionKeyboard = [
    [enterQuestionById.getBtn(ctx.t('cancel'), question.id, source)],
  ];
  await ctx.editMessageCaption({
    caption: baseText,
    ...ik(questionKeyboard),
    parse_mode: 'HTML',
  });
  const { message } = await conversation.waitFor('message:text');
  await skipCommands(conversation, message);
  await conversationDelete(ctx, message.message_id);
  let correct = false;
  if (question.answer_type === QUESTION_TYPES.formula) {
    try {
      correct = checkUserSolutionFormula(
        question.answer_formula!,
        message.text
      );
    } catch (error) {
      console.error(error);
      await ctx.editMessageCaption({
        caption: `${baseText}\n\n${emoji.warning} ${ctx.t('parse-error')}`,
        ...ik(questionKeyboard),
        parse_mode: 'HTML',
      });
      await conversation.skip({ drop: true });
    }
  } else {
    const userAnswer = parseFloat(message.text);
    if (isNaN(userAnswer)) {
      await ctx.editMessageCaption({
        caption: `${baseText}\n\n${emoji.warning} ${ctx.t(
          'validation-send-valid-number'
        )}`,
        ...ik(questionKeyboard),
        parse_mode: 'HTML',
      });
      await conversation.skip({ drop: true });
    }
    const answerMin = question.open_answer! - question.open_answer_range!;
    const answerMax = question.open_answer! + question.open_answer_range!;
    correct = answerMin <= userAnswer && userAnswer <= answerMax;
  }

  const userQuestion = await conversation.external(() =>
    updateUserQuestion(ctx.dbUser.id, question.id, correct)
  );

  if (!correct) {
    await ctx.editMessageCaption({
      caption: `${baseText}\n\n${ctx.t('is-not-the-right-answer', {
        answer: `<code>${escapeHtml(message.text)}</code>`,
      })}`,
      ...ik(questionKeyboard),
      parse_mode: 'HTML',
    });
    await conversation.skip({ drop: true });
  }

  let { text, keyboard } = questionSolvedMsg(
    ctx,
    question,
    userQuestion,
    source
  );
  try {
    await ctx.editMessageMedia({
      type: 'photo',
      media: getQuestionSolutionImage(question),
      caption: text,
      parse_mode: 'HTML',
    });
  } catch (error) {
    text = `${text}\n${ctx.t('failed-to-send-answer')}`;
    await ctx.editMessageCaption({
      caption: text,
      parse_mode: 'HTML',
    });
  }
  await ctx.editMessageReplyMarkup(ik(keyboard));
}

const openAnswer = new TgCallback<
  [questionId: number, source: EnterQuestionSource]
>('open-answer', async (ctx) => {
  const [questionId, source] = ctx.callbackParams;
  const question = await queries.findQuestion({ id: questionId });
  if (!question) {
    return await ctx.answerCallbackQuery(ctx.t('question-not-found'));
  } else if (
    question.answer_type !== QUESTION_TYPES.open &&
    question.answer_type !== QUESTION_TYPES.formula
  ) {
    return await ctx.answerCallbackQuery(ctx.t('wrong-answer-type'));
  }
  ctx.conversationData = {
    messageId: ctx.callbackQuery.message?.message_id,
    question,
    source,
  };
  await ctx.conversation.reenter('olifisOpenAnswer');
});

const selfEvaluationCb = new TgCallback<
  [questionId: number, source: EnterQuestionSource]
>('self-eval', async (ctx) => {
  const [questionId, source] = ctx.callbackParams;
  const question = await queries.findQuestion({ id: questionId });
  if (!question) {
    return await ctx.answerCallbackQuery(ctx.t('question-not-found'));
  } else if (question.answer_type !== QUESTION_TYPES.selfEvaluation) {
    return await ctx.answerCallbackQuery(ctx.t('wrong-answer-type'));
  }

  await ctx.editMessageMedia({
    type: 'photo',
    media: getQuestionEvaluationImage(question),
    caption: ctx.t('attempt-answer-evaluation-explanation'),
    parse_mode: 'HTML',
    has_spoiler: true,
  });
  await ctx.editMessageReplyMarkup(
    ik([
      [
        selfEvaluationMarkCb.getBtn(
          ctx.t('mark-solved'),
          question.id,
          source,
          true
        ),
        selfEvaluationMarkCb.getBtn(
          ctx.t('add-error'),
          question.id,
          source,
          false
        ),
      ],
      [enterQuestionById.getBtn(ctx.t('cancel'), question.id, source)],
    ])
  );
});

const selfEvaluationMarkCb = new TgCallback<
  [questionId: number, source: EnterQuestionSource, isCorrect: boolean]
>('self-eval-mark', async (ctx) => {
  const [questionId, source, isCorrect] = ctx.callbackParams;
  const question = await queries.findQuestion({ id: questionId });
  if (!question) {
    return await ctx.answerCallbackQuery(ctx.t('question-not-found'));
  } else if (question.answer_type !== QUESTION_TYPES.selfEvaluation) {
    return await ctx.answerCallbackQuery(ctx.t('wrong-answer-type'));
  }

  const userQuestion = await updateUserQuestion(
    ctx.dbUser.id,
    questionId,
    isCorrect
  );
  if (!isCorrect) {
    return await ctx.answerCallbackQuery({
      text: ctx.t('error-added'),
      show_alert: true,
    });
  }

  const { text, keyboard } = questionSolvedMsg(
    ctx,
    question,
    userQuestion,
    source
  );
  try {
    await ctx.editMessageMedia({
      type: 'photo',
      media: getQuestionSolutionImage(question),
      caption: text,
      parse_mode: 'HTML',
    });
  } catch (error) {
    return await ctx.answerCallbackQuery({
      text: ctx.t('failed-to-send-answer'),
      show_alert: true,
    });
  }
  await ctx.editMessageReplyMarkup(ik(keyboard));
  await ctx.answerCallbackQuery(emoji.trophy);
});

function questionNavigation(
  ctx: MyContext,
  question: QuestionFull,
  source: EnterQuestionSource
) {
  const edition = question.questions_group.edition;
  const tags = question.question_tags.map((x) => x.question_tag);

  const keyboard = new InlineKeyboard();
  let backButton = editionQuestions.getBtn(
    `${edition.year} ${emoji.back}`,
    edition.id
  );
  if (source === 'profile') {
    backButton = userQuestionsList.getBtn(
      `${ctx.t('attempted-questions')} ${emoji.back}`
    );
  } else if (source.startsWith('tag')) {
    const tagId = parseInt(source.split('_')[1], 10);
    const tag = tags.find((x) => x.id === tagId);
    if (tag) {
      backButton = questionsByTag.getBtn(`${tag.name} ${emoji.back}`, tag.id);
      keyboard.row(
        randomQuestion.getBtn(`${ctx.t('random-question')} ${tag.icon}`, tag.id)
      );
    }
  } else if (source === 'rand') {
    keyboard.row(randomQuestion.getBtn(`${ctx.t('random-question')} 🎲`));
  }
  keyboard.row(backButton, mainMenu.getBtn(ctx.t('back-to-menu')));
  return keyboard.inline_keyboard;
}

const callbacks = [
  closedAnswer,
  showSolution,
  hideSolution,
  randomQuestion,
  selfEvaluationCb,
  selfEvaluationMarkCb,
  enterQuestionById,
  openAnswer,
].map((x) => x.setPrefix('olifis-q'));

olifisQuestionModule.use(createConversation(olifisOpenAnswer));

olifisQuestionModule
  .on('callback_query:data')
  .lazy(tgCallbackMiddleware(callbacks));
