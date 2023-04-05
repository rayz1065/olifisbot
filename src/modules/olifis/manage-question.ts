import { createConversation } from '@grammyjs/conversations';
import { Question } from '@prisma/client';
import assert from 'assert';
import { Parser } from 'expr-eval';
import { Composer, InlineKeyboard, InputFile } from 'grammy';
import { InlineKeyboardButton } from 'grammy/types';
import { emoji } from 'node-emoji';
import path from 'path';
import validator from 'validator';
import {
  conversationDelete,
  conversationEdit,
  findTgCallback,
  ik,
  skipCommands,
  TgCallback,
  tgCallbackMiddleware,
  TgMessageData,
  tgValidate,
} from '../../lib/utils';
import { MyContext, MyConversation } from '../../main';
import {
  convGetConfirmation,
  manageEditionMsg,
  manageQuestionsGroup,
} from './admin';
import { QUESTION_TYPES } from './index';
import queries, { QuestionsGroupFull } from './queries';
import { getQuestionsGroupDirectory } from './user';
import fs from 'fs';

export const olifisManageQuestionModule = new Composer<MyContext>();

// create a new question

function createQuestionMsg(
  ctx: MyContext,
  questionsGroup: QuestionsGroupFull,
  step: 'question' | 'solution' | 'answer' | 'confirmation',
  questionData: Partial<Question>
) {
  let prompt = '';
  if (step === 'question') {
    prompt = ctx.t('olifis-config-send-question-image');
  } else if (step === 'solution') {
    prompt = ctx.t('olifis-config-send-solution-image');
  } else if (step === 'answer') {
    prompt = ctx.t('olifis-config-choose-answer-or-type');
  } else if (step === 'confirmation') {
    prompt = ctx.t('olifis-config-confirm-creation');
  }

  const { question_image: question, solution_image: solution } = questionData;
  const { edition } = questionsGroup;

  let answerTxt = emoji.x;
  if (questionData.answer_type === QUESTION_TYPES.closed) {
    answerTxt = `${questionData.closed_answer}`;
  } else if (questionData.answer_type === QUESTION_TYPES.open) {
    const ansMin = questionData.open_answer! - questionData.open_answer_range!;
    const ansMax = questionData.open_answer! + questionData.open_answer_range!;
    const ansUnit = questionData.open_answer_unit ?? ctx.t('adimensional');
    answerTxt = `${ansMin.toPrecision(6)} ≤ x ≤ ${ansMax.toPrecision(
      6
    )} [${ansUnit}]`;
  } else if (questionData.answer_type === QUESTION_TYPES.formula) {
    const formula = questionData.answer_formula!;
    const expression = Parser.parse(formula);
    const vars = expression.variables();
    answerTxt = `${expression} ${ctx.t('with-variables')} ${vars.join(', ')}`;
  }
  const text =
    `<b>${ctx.t('olifis-config-creating-question-for', {
      year: edition.year,
    })}</b>\n\n` +
    `${emoji['1234']} <b>${ctx.t('question-number')}</b>: ${
      questionData.number
    }\n` +
    `${emoji.grey_question} <b>${ctx.t('question')}</b>: ${
      question ? emoji.white_check_mark : emoji.x
    }\n` +
    `${emoji.grey_exclamation} <b>${ctx.t('solution')}</b>: ${
      solution ? emoji.white_check_mark : emoji.x
    }\n` +
    `${emoji.a} <b>${ctx.t('answer')}</b>: ${answerTxt}\n\n` +
    `${emoji.question} <i>${prompt}</i>`;
  return {
    text,
    keyboard: [
      [manageQuestionsGroup.getBtn(ctx.t('cancel'), questionsGroup.id)],
    ],
  };
}

async function photoInput(
  conversation: MyConversation,
  ctx: MyContext,
  getMessage: () => {
    text: string;
    keyboard: InlineKeyboardButton[][];
  }
) {
  const { text, keyboard } = getMessage();
  await conversationEdit(ctx, text, ik(keyboard));
  const { message } = await conversation.waitFor('message');
  await skipCommands(conversation, message);
  await conversationDelete(ctx, message.message_id);
  await tgValidate(
    conversation,
    ctx,
    () => {
      if (!message.photo) {
        return ctx.t('validation-photo-required');
      }
    },
    { baseText: text, keyboard }
  );
  assert(message.photo);
  return message.photo[message.photo.length - 1];
}

async function answerInput(
  conversation: MyConversation,
  ctx: MyContext,
  getMessage: () => TgMessageData
): Promise<
  | {
      answer_type: typeof QUESTION_TYPES.closed;
      closed_answer: string;
    }
  | {
      answer_type: typeof QUESTION_TYPES.open;
      open_answer: number;
      open_answer_range: number;
      open_answer_unit: string | null;
    }
  | {
      answer_type: typeof QUESTION_TYPES.formula;
      answer_formula: string;
    }
> {
  const answers = new InlineKeyboard();
  const possibleAnswers = 'ABCDE'.split('');
  possibleAnswers.forEach((answer) => {
    answers.add(answerDummy.getBtn(answer, 'closed', answer));
  });
  answers.row();
  let { text, keyboard } = getMessage();
  keyboard = [...answers.inline_keyboard, ...keyboard];
  await conversationEdit(ctx, text, ik(keyboard));
  const { message, callbackQuery } = await conversation.waitFor([
    'callback_query:data',
    'message:text',
  ]);
  if (callbackQuery) {
    const callbackData = callbackQuery.data;
    const { match, values } = findTgCallback([answerDummy], callbackData);
    if (!match) {
      await conversation.skip();
    }
    await tgValidate(
      conversation,
      ctx,
      () => {
        if (possibleAnswers.indexOf(values[1]) === -1) {
          return ctx.t('invalid-answer');
        }
      },
      { baseText: text, keyboard }
    );
    return {
      answer_type: 'closed',
      closed_answer: values[1],
    };
  }
  await skipCommands(conversation, message);
  await conversationDelete(ctx, message.message_id);

  if (message.text.startsWith('=')) {
    const formula = message.text.split('=', 2)[1];
    await tgValidate(
      conversation,
      ctx,
      () => {
        try {
          Parser.parse(formula);
        } catch (error) {
          return ctx.t('formula-parse-error');
        }
      },
      { baseText: text, keyboard }
    );
    return {
      answer_type: 'formula',
      answer_formula: formula,
    };
  }

  const numberRe = /\d+(?:\.\d*)?/.source;
  const unitRe = /[^\s]+/.source;
  const errorRe = /\d+(?:\.\d*)?%/.source;
  const formats: RegExp[] = [
    // capture groups are (from) (to) (error) (unit)
    new RegExp(`^(${numberRe})()()()$`),
    new RegExp(`^(${numberRe})\\s+(${numberRe})()()$`),
    new RegExp(`^(${numberRe})()\\s+(${errorRe})()$`),
    new RegExp(`^(${numberRe})()\\s+(${errorRe})\\s+(${unitRe})$`),
    new RegExp(`^(${numberRe})\\s+(${numberRe})()\\s+(${unitRe})$`),
    new RegExp(`^(${numberRe})()()\\s+(${unitRe})$`),
  ];
  let match: RegExpMatchArray | null = null;
  for (const regex of formats) {
    match = regex.exec(message.text);
    if (match) {
      break;
    }
  }
  await tgValidate(
    conversation,
    ctx,
    () => {
      if (!match) {
        return ctx.t('invalid-open-answer-format');
      } else if (!validator.isLength(match[3], { max: 40 })) {
        return ctx.t('validation-string-length', { min: 1, max: 40 });
      } else if (Math.abs(parseFloat(match[1]) - parseFloat(match[2])) < 1e-6) {
        return ctx.t('invalid-error');
      }
    },
    { baseText: text, keyboard }
  );
  assert(match);
  let ansMin = parseFloat(match[1]);
  let ansMax = match[2] !== '' ? parseFloat(match[2]) : null;
  const ansErr =
    match[3] !== '' ? parseFloat(match[3].split('%')[0]) / 100 : 0.1 / 100;
  const ansUnit = match[4] !== '' ? match[4] : null;

  if (ansMax === null) {
    // use error to compute min and max
    const ansMemo = ansMin;
    ansMin = ansMemo - ansMemo * ansErr;
    ansMax = ansMemo + ansMemo * ansErr;
  }

  const openAnswer = (ansMin + ansMax) / 2;
  const openAnswerRange = openAnswer - ansMin;
  return {
    answer_type: 'open',
    open_answer: openAnswer,
    open_answer_unit: ansUnit,
    open_answer_range: openAnswerRange,
  };
}

async function olifisCreateQuestion(
  conversation: MyConversation,
  ctx: MyContext
) {
  const data = ctx.conversationData;
  assert(data?.questionsGroup);
  const questionsGroup: QuestionsGroupFull = data.questionsGroup;
  let newQuestion: Partial<Question> = {
    number: questionsGroup.questions.length + 1,
  };
  const questionFilePath = path.join(
    getQuestionsGroupDirectory(questionsGroup),
    `q-${newQuestion.number}.jpg`
  );
  if (fs.existsSync(questionFilePath)) {
    try {
      const result = await ctx.replyWithPhoto(
        new InputFile(questionFilePath),
        ik([[deleteMessage.getBtn(emoji.wastebasket)]])
      );
      newQuestion.question_image = result.photo.at(-1)!.file_id;
      await conversationDelete(ctx, result.message_id);
    } catch (error) {}
  }
  if (!newQuestion.question_image) {
    newQuestion.question_image = (
      await photoInput(conversation, ctx, () =>
        createQuestionMsg(ctx, questionsGroup, 'question', newQuestion)
      )
    ).file_id;
  }

  const solutionFilePath = path.join(
    getQuestionsGroupDirectory(questionsGroup),
    `a-${newQuestion.number}.jpg`
  );
  if (fs.existsSync(solutionFilePath)) {
    try {
      const result = await ctx.replyWithPhoto(
        new InputFile(solutionFilePath),
        ik([[deleteMessage.getBtn(emoji.wastebasket)]])
      );
      newQuestion.solution_image = result.photo.at(-1)!.file_id;
    } catch (error) {}
  }
  if (!newQuestion.solution_image) {
    newQuestion.solution_image = (
      await photoInput(conversation, ctx, () =>
        createQuestionMsg(ctx, questionsGroup, 'solution', newQuestion)
      )
    ).file_id;
  }

  const answer = await answerInput(conversation, ctx, () =>
    createQuestionMsg(ctx, questionsGroup, 'answer', newQuestion)
  );
  await convGetConfirmation(conversation, ctx, () =>
    createQuestionMsg(ctx, questionsGroup, 'confirmation', {
      ...newQuestion,
      ...answer,
    })
  );

  newQuestion = { ...newQuestion, ...answer };

  const question = await conversation.external(() =>
    queries.createQuestion({
      ...newQuestion,
      number: newQuestion.number!,
      answer_type: newQuestion.answer_type!,
      questions_group: { connect: { id: questionsGroup.id } },
    })
  );
  questionsGroup.questions.push(question);
  const { text, keyboard } = manageEditionMsg(
    ctx,
    questionsGroup.edition,
    questionsGroup
  );
  return await ctx.editMessageText(text, ik(keyboard));
}

const deleteMessage = new TgCallback('del', async (ctx) => {
  try {
    await ctx.deleteMessage();
  } catch (error) {
    return await ctx.answerCallbackQuery(emoji.expressionless);
  }
  await ctx.answerCallbackQuery(emoji.wastebasket);
});

export const createQuestion = new TgCallback<[questionsGroupId: number]>(
  'create-question',
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
    await ctx.conversation.reenter('olifisCreateQuestion');
  }
);

const answerDummy = new TgCallback<[type: string, answer?: string]>('dummy');

const callbacks = [createQuestion, answerDummy, deleteMessage].map((x) =>
  x.setPrefix('olifis-admin')
);
olifisManageQuestionModule.use(createConversation(olifisCreateQuestion));
olifisManageQuestionModule
  .on('callback_query:data')
  .lazy(tgCallbackMiddleware(callbacks));
