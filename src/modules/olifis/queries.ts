import { Prisma } from '@prisma/client';
import { prisma } from '../../main';
import {
  EDITIONS_PAGE_SIZE,
  EDITION_TYPES,
  QUESTIONS_PAGE_SIZE,
} from './index';

export type EditionFull = NonNullable<Awaited<ReturnType<typeof findEdition>>>;
export type QuestionsGroupFull = NonNullable<
  Awaited<ReturnType<typeof findQuestionsGroup>>
>;
export type QuestionFull = NonNullable<
  Awaited<ReturnType<typeof findQuestion>>
>;
export type QuestionWithTags = Omit<QuestionFull, 'questions_group'>;

async function getEditionTypes() {
  const types = await prisma.editionType.findMany();
  const missingTypes = Object.values(EDITION_TYPES).filter(
    (type) => types.find((x) => x.code === type) === undefined
  );
  if (missingTypes.length === 0) {
    return types;
  }
  await Promise.all(
    missingTypes.map(async (type) => {
      types.push(
        await prisma.editionType.create({
          data: {
            code: type,
            name: type,
          },
        })
      );
    })
  );
  return types;
}

async function createEdition(data: Prisma.EditionCreateInput) {
  return await prisma.edition.create({
    data,
    include: {
      type: true,
      questions_groups: true,
    },
  });
}

function updateEdition(id: number, data: Prisma.EditionUpdateInput) {
  return prisma.edition.update({
    where: { id },
    data: data,
    include: {
      type: true,
      questions_groups: true,
    },
  });
}

async function getEditionsPage(typeId: number, page = 0) {
  return await prisma.edition.findMany({
    where: { type_id: typeId },
    take: EDITIONS_PAGE_SIZE + 1,
    skip: EDITIONS_PAGE_SIZE * page,
    orderBy: {
      year: 'asc',
    },
  });
}

async function findType(code: string) {
  return await prisma.editionType.findFirst({
    where: { code },
  });
}

function updateEditionType(id: number, data: Prisma.EditionTypeUpdateInput) {
  return prisma.editionType.update({
    where: { id },
    data: data,
  });
}

function findEdition(where: Prisma.EditionWhereInput) {
  return prisma.edition.findFirst({
    where,
    include: {
      type: true,
      questions_groups: true,
    },
  });
}

const questionsGroupInclude = {
  edition: {
    include: {
      type: true,
    },
  },
  questions: {
    include: {
      question_tags: {
        include: {
          question_tag: true,
        },
      },
    },
  },
};

function createQuestionsGroup(data: Prisma.QuestionsGroupCreateInput) {
  return prisma.questionsGroup.create({
    data,
    include: questionsGroupInclude,
  });
}

function updateQuestionsGroup(
  id: number,
  data: Prisma.QuestionsGroupUpdateInput
) {
  return prisma.questionsGroup.update({
    where: {
      id,
    },
    data,
    include: questionsGroupInclude,
  });
}

function findQuestionsGroup(where: Prisma.QuestionsGroupWhereInput) {
  return prisma.questionsGroup.findFirst({
    where,
    include: questionsGroupInclude,
  });
}

const questionInclude = {
  questions_group: {
    include: {
      edition: {
        include: {
          type: true,
        },
      },
    },
  },
  question_tags: {
    include: {
      question_tag: true,
    },
  },
};

function createQuestion(data: Prisma.QuestionCreateInput) {
  return prisma.question.create({
    data,
    include: questionInclude,
  });
}

function findQuestion(where: Prisma.QuestionWhereInput) {
  return prisma.question.findFirst({
    where,
    include: questionInclude,
  });
}

function getQuestionPage(page: number, where: Prisma.QuestionWhereInput) {
  return prisma.question.findMany({
    include: questionInclude,
    where,
    take: QUESTIONS_PAGE_SIZE + 1,
    skip: page * QUESTIONS_PAGE_SIZE,
  });
}

function findUserQuestions(where: Prisma.UserQuestionWhereInput) {
  return prisma.userQuestion.findMany({
    where,
  });
}

async function findUserQuestion(questionId: number, userId: number) {
  let userQuestion = await prisma.userQuestion.findFirst({
    where: {
      question_id: questionId,
      user_id: userId,
    },
  });
  if (!userQuestion) {
    userQuestion = await createUserQuestion({
      question: { connect: { id: questionId } },
      user: { connect: { id: userId } },
    });
  }
  return userQuestion;
}

function createUserQuestion(data: Prisma.UserQuestionCreateInput) {
  return prisma.userQuestion.create({
    data,
    include: { question: true },
  });
}

function updateUserQuestion(
  questionId: number,
  userId: number,
  data: Prisma.UserQuestionUpdateInput
) {
  return prisma.userQuestion.update({
    data,
    where: {
      user_id_question_id: {
        question_id: questionId,
        user_id: userId,
      },
    },
  });
}

async function randomQuestion(userId: number, tagId?: number) {
  const where: Prisma.QuestionWhereInput = {
    questions_group: {
      edition: { type: { code: EDITION_TYPES['firstLevel'] } },
    },
    user_questions: { none: { user_id: userId } },
  };
  if (tagId) {
    where.question_tags = { some: { question_tag_id: tagId } };
  }
  const questionsCount = await prisma.question.count({ where });
  const skip = Math.floor(Math.random() * questionsCount);
  return await prisma.question.findFirst({
    where,
    skip,
    include: questionInclude,
  });
}

async function getQuestionTags() {
  const defaultTags = [
    'mechanics',
    'thermodynamics',
    'electromagnetism',
    'subatomic',
    'modern',
    'optics',
    'waves',
  ];
  let tags = await prisma.questionTag.findMany();
  const missingTags = defaultTags.filter(
    (tag) => !tags.find((x) => x.code === tag)
  );
  if (missingTags.length) {
    await prisma.questionTag.createMany({
      data: missingTags.map((tag) => ({
        code: tag,
        name: tag,
      })),
    });
    tags = await prisma.questionTag.findMany();
  }
  return tags;
}

async function questionStats(where?: Prisma.UserQuestionWhereInput) {
  const groupedStats = await prisma.userQuestion.groupBy({
    by: ['solved', 'saw_solution'],
    where,
    _sum: {
      attempts: true,
    },
    _count: true,
  });
  const stats = {
    sawSolution: 0,
    solved: 0,
    averageAttempts: 0,
    totalAttempted: 0,
  };
  for (const statGroup of groupedStats) {
    statGroup._sum.attempts ??= 0;
    if (statGroup.saw_solution) {
      stats.sawSolution += statGroup._count;
    }
    if (statGroup.solved) {
      stats.solved += statGroup._count;
      stats.averageAttempts += statGroup._sum.attempts;
    }
    if (statGroup._sum.attempts > 0) {
      stats.totalAttempted += statGroup._count;
    }
  }
  stats.averageAttempts /= Math.max(1, stats.solved);

  return stats;
}

async function botStats() {
  const totalUsers = await prisma.user.count();
  const totalQuestions = await prisma.question.count();

  const stats = {
    totalUsers,
    totalQuestions,
    ...(await questionStats()),
  };
  return stats;
}

async function userStats(userId: number) {
  const invitedUsers = await prisma.user.count({
    where: { invited_by_id: userId },
  });
  const stats = {
    ...(await questionStats({ user_id: userId })),
    invitedUsers,
  };

  return stats;
}

function updateUser(userId: number, data: Prisma.UserUpdateInput) {
  return prisma.user.update({
    data,
    where: { id: userId },
  });
}

const olifisQueries = {
  getEditionTypes,
  createEdition,
  updateEdition,
  getEditionsPage,
  findEdition,

  findType,
  updateEditionType,

  createQuestionsGroup,
  findQuestionsGroup,
  updateQuestionsGroup,

  createQuestion,
  findQuestion,
  randomQuestion,
  getQuestionPage,

  createUserQuestion,
  findUserQuestion,
  findUserQuestions,
  updateUserQuestion,

  getQuestionTags,

  updateUser,
  userStats,

  botStats,
};
export default olifisQueries;
