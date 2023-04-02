import path from 'path';
import fs from 'fs';
import { prisma } from '../main';
import { Edition, Prisma, QuestionsGroup, QuestionTag } from '@prisma/client';
import olifisQueries from '../modules/olifis/queries';
import { EDITION_TYPES, QUESTION_TYPES } from '../modules/olifis/index';
import dayjs from 'dayjs';
import assert from 'assert';

const STORAGE_DIR = path.join(__dirname, '..', '..', 'storage');
const DATA_DIR = path.join(STORAGE_DIR, 'old-data');
const PROBLEMS_PATH = path.join(DATA_DIR, 'problemi.json');
const EDITIONS_PATH = path.join(DATA_DIR, 'questionari.json');

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

async function assignTags(problems: OldProblem[]) {
  const tags = await olifisQueries.getQuestionTags();
  const tagCodesMap: Record<string, string> = {
    meccanica: 'mechanics',
    termodinamica: 'thermodynamics',
    elettromagnetismo: 'electromagnetism',
    subatomica: 'subatomic',
    'fisica-moderna': 'modern',
    'ottica-geometrica': 'optics',
    onde: 'waves',
  };
  const tagsMap: Record<string, QuestionTag> = {};
  for (const oldCode in tagCodesMap) {
    const newCode = tagCodesMap[oldCode];
    const tag = tags.find((x) => x.code === newCode);
    assert(tag);
    tagsMap[oldCode] = tag;
  }
  problems.forEach((problem) => {
    problem.newTagIds = [];
    if (problem.tags === '') {
      return;
    }
    const tags: Record<string, any> = JSON.parse(problem.tags);
    for (const oldTagCode in tags) {
      const tag = tagsMap[oldTagCode];
      assert(tag);
      problem.newTagIds.push(tag.id);
    }
  });
}

async function assignQuestionsGroups(
  problems: OldProblem[],
  editions: (Edition & {
    questions_groups: QuestionsGroup[];
  })[]
) {
  const editionMap: Record<number, (typeof editions)[number]> = {};
  editions.forEach((edition) => {
    editionMap[edition.year] = edition;
  });
  for (const problem of problems) {
    const edition = editionMap[problem.anno];
    assert(edition);
    const questionsGroup = edition.questions_groups.find(
      (x) => x.code === 'default'
    );
    assert(questionsGroup);
    problem.questionsGroupId = questionsGroup.id;
  }
}

async function getProblems(
  editions: (Edition & {
    questions_groups: QuestionsGroup[];
  })[]
): Promise<Prisma.QuestionCreateInput[]> {
  const problems: OldProblem[] = JSON.parse(
    fs.readFileSync(PROBLEMS_PATH, { encoding: 'utf-8' })
  )['problemi'];
  await assignTags(problems);
  await assignQuestionsGroups(problems, editions);
  return problems.map((problem) => ({
    answer_type: QUESTION_TYPES.closed,
    number: problem.numero,
    created_at: dayjs(problem.dataaggiunta).toDate(),
    questions_group: { connect: { id: problem.questionsGroupId } },
    question_tags: {
      createMany: {
        data: problem.newTagIds.map((tagId) => ({
          question_tag_id: tagId,
        })),
      },
    },
    closed_answer: problem.risposta,
  }));
}

async function importData() {
  await prisma.$transaction(
    async (tx) => {
      const editions = await getEditions();
      for (const edition of editions) {
        await tx.edition.create({
          data: edition,
        });
      }
      const allEditions = await tx.edition.findMany({
        include: {
          questions_groups: true,
        },
      });
      const problems = await getProblems(allEditions);
      for (const problem of problems) {
        await tx.question.create({
          data: problem,
        });
        console.count('problems');
      }
    },
    { maxWait: 60000 }
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
