import path from 'path';
import fs from 'fs';
import { prisma } from '../main';
import {
  Edition,
  Prisma,
  Question,
  QuestionsGroup,
  QuestionTag,
} from '@prisma/client';
import olifisQueries from '../modules/olifis/queries';
import { EDITION_TYPES, QUESTION_TYPES } from '../modules/olifis/index';
import dayjs from 'dayjs';
import assert from 'assert';

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage');
const DATA_DIR = path.join(STORAGE_DIR, 'old-data');
const QUESTIONS_PATH = path.join(DATA_DIR, 'problemi.json');
const EDITIONS_PATH = path.join(DATA_DIR, 'questionari.json');
const USERS_PATH = path.join(DATA_DIR, 'utenti.json');
const USERS_QUESTIONS_PATH = path.join(DATA_DIR, 'utentiquesiti.json');

interface OldProblem {
  IDproblema: number;
  IDquestionario: number;
  anno: number;
  numero: number;
  mediaquesito: string;
  mediarisposta: string;
  risposta: string;
  tags: string;
  dataaggiunta: string;

  newTagIds: number[];
  questionsGroupId: number;
}
interface OldEdition {
  IDquestionario: number;
  anno: number;
  dataGara: string;
  link: string;
  testo: string;
  soluzione: string;
}
interface OldUser {
  ID: number;
  nome: string;
  username: string;
  referral: number;
  dataiscrizione: string;
}
interface OldUserQuestion {
  ID: number;
  IDproblema: number;
  corretto: number;
  soluzionevista: number;
  tentativi: number;
  dataquesito: string;
}
interface OldUserQuestionWithQuestion extends OldUserQuestion {
  question: Question;
}

// map between the old tags and the new ones
const tagCodesMap: Record<string, string> = {
  meccanica: 'mechanics',
  termodinamica: 'thermodynamics',
  elettromagnetismo: 'electromagnetism',
  subatomica: 'subatomic',
  'fisica-moderna': 'modern',
  'ottica-geometrica': 'optics',
  onde: 'waves',
};

async function getTagsMap() {
  const tags = await olifisQueries.getQuestionTags();
  const tagsMap: Record<string, QuestionTag> = {};
  for (const oldCode in tagCodesMap) {
    const newCode = tagCodesMap[oldCode];
    const tag = tags.find((x) => x.code === newCode);
    assert(tag);
    tagsMap[oldCode] = tag;
  }

  return tagsMap;
}

// new types
interface EditionWithQuestionGroups extends Edition {
  questions_groups: QuestionsGroup[];
}

async function getEditions(): Promise<Prisma.EditionCreateInput[]> {
  const editions: OldEdition[] = JSON.parse(
    fs.readFileSync(EDITIONS_PATH, { encoding: 'utf-8' })
  )['questionari'];
  const firstLevel = (await olifisQueries.getEditionTypes()).find(
    (x) => x.code === EDITION_TYPES['firstLevel']
  );
  if (!firstLevel) {
    throw new Error(`Type ${EDITION_TYPES['firstLevel']} not found`);
  }
  const currentEditions = await prisma.edition.count();
  if (currentEditions > 0) {
    throw new Error('Editions table is not clean');
  }

  return editions.map((edition) => {
    return {
      type: { connect: { id: firstLevel.id } },
      competition_date: dayjs(edition.dataGara).toDate(),
      year: edition.anno,
      archive_url: edition.link,
      questions_groups: {
        create: {
          code: 'default',
          title: 'Quesiti',
        },
      },
    };
  });
}

function remapProblem(
  question: OldProblem,
  editionsMap: Record<number, EditionWithQuestionGroups>,
  tagsMap: Record<string, QuestionTag>
): Prisma.QuestionCreateInput {
  // assign the new tags

  question.newTagIds = [];
  if (question.tags !== '') {
    const tags: Record<string, any> = JSON.parse(question.tags);
    for (const oldTagCode in tags) {
      const tag = tagsMap[oldTagCode];
      assert(tag);
      question.newTagIds.push(tag.id);
    }
  }

  // assign a question group to each question

  const edition = editionsMap[question.anno];
  assert(edition);
  const questionsGroup = edition.questions_groups.find(
    (x) => x.code === 'default'
  );
  assert(questionsGroup);
  question.questionsGroupId = questionsGroup.id;

  return {
    answer_type: QUESTION_TYPES.closed,
    number: question.numero,
    created_at: dayjs(question.dataaggiunta).toDate(),
    questions_group: { connect: { id: question.questionsGroupId } },
    question_tags: {
      createMany: {
        data: question.newTagIds.map((tagId) => ({
          question_tag_id: tagId,
        })),
      },
    },
    closed_answer: question.risposta,
  };
}

function remapUser(user: OldUser, questions: OldUserQuestionWithQuestion[]) {
  return {
    first_name: user.nome,
    last_name: null,
    username: user.username,
    telegram_chat_id: user.ID,
    created_at: user.dataiscrizione,
    is_personal_chat_open: true,
    invited_by: user.referral
      ? {
          connect: {
            telegram_chat_id: user.referral,
          },
        }
      : undefined,
    user_questions: {
      createMany: {
        data: questions.map((userQuestion) => ({
          attempts: userQuestion.tentativi,
          created_at: userQuestion.dataquesito,
          question_id: userQuestion.question.id,
          saw_solution: Boolean(userQuestion.soluzionevista),
          solved: Boolean(userQuestion.corretto),
          updated_at: userQuestion.dataquesito,
        })),
      },
    },
  } satisfies Prisma.UserCreateInput;
}

async function importData() {
  await prisma.$transaction(
    async (tx) => {
      // import the data for editions

      console.log('Importing the editions from', EDITIONS_PATH);
      // maps between <year> and the new edition
      const editionsMap: Record<number, EditionWithQuestionGroups> = {};
      const editions = await getEditions();
      for (const edition of editions) {
        editionsMap[edition.year] = await tx.edition.create({
          data: edition,
          include: { questions_groups: true },
        });
      }

      // import the problems

      console.log('Importing the questions from', QUESTIONS_PATH);
      const questions: OldProblem[] = JSON.parse(
        fs.readFileSync(QUESTIONS_PATH, { encoding: 'utf-8' })
      )['problemi'];
      const tagsMap = await getTagsMap();

      // maps between <old-id> to the new problem data
      const questionsMap: Record<number, Question> = {};
      for (const question of questions) {
        questionsMap[question.IDproblema] = await tx.question.create({
          data: remapProblem(question, editionsMap, tagsMap),
        });
      }

      // import the users and their questions

      console.log(
        'Importing the users from',
        USERS_PATH,
        'and their questions from',
        USERS_QUESTIONS_PATH
      );
      const users: OldUser[] = JSON.parse(
        fs.readFileSync(USERS_PATH, { encoding: 'utf-8' })
      )['utenti'];
      const userQuestions: OldUserQuestion[] = JSON.parse(
        fs.readFileSync(USERS_QUESTIONS_PATH, { encoding: 'utf-8' })
      )['utentiquesiti'];
      const questionsByUser: Record<number, OldUserQuestionWithQuestion[]> = {};
      userQuestions.forEach((userQuestion) => {
        questionsByUser[userQuestion.ID] ??= [];
        const question = questionsMap[userQuestion.IDproblema];
        assert(question);
        questionsByUser[userQuestion.ID].push({
          ...userQuestion,
          question,
        });
      });

      const remappedUsers = users.map((x) =>
        remapUser(x, questionsByUser[x.ID] ?? [])
      );
      for (const user of remappedUsers) {
        await tx.user.create({
          data: {
            ...user,
            invited_by: undefined,
          },
        });
      }

      // after all users are added, update invited_by
      console.log('Updating invited_by');
      for (const user of remappedUsers) {
        await tx.user.update({
          data: { invited_by: user.invited_by },
          where: { telegram_chat_id: user.telegram_chat_id },
        });
      }

      console.log('Done');
    },
    { maxWait: 60000, timeout: 60000 }
  );
}

importData()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
