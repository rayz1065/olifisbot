-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "telegram_chat_id" INTEGER NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "username" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "language" TEXT,
    "invited_by_id" INTEGER,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditionType" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "EditionType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Edition" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "competition_date" TIMESTAMP(3) NOT NULL,
    "archive_url" TEXT,
    "text_file_id" TEXT,
    "solution_file_id" TEXT,
    "type_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Edition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionsGroup" (
    "id" SERIAL NOT NULL,
    "edition_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "code" TEXT NOT NULL DEFAULT 'default',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionsGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" SERIAL NOT NULL,
    "questions_group_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "question_image" TEXT,
    "solution_image" TEXT,
    "answer_type" TEXT NOT NULL,
    "closed_answer" TEXT,
    "answer_hint" TEXT,
    "open_answer" DOUBLE PRECISION,
    "open_answer_range" DOUBLE PRECISION,
    "open_answer_unit" TEXT,
    "answer_formula" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionQuestionTag" (
    "question_id" INTEGER NOT NULL,
    "question_tag_id" INTEGER NOT NULL,

    CONSTRAINT "QuestionQuestionTag_pkey" PRIMARY KEY ("question_id","question_tag_id")
);

-- CreateTable
CREATE TABLE "QuestionTag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "icon" TEXT,

    CONSTRAINT "QuestionTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuestion" (
    "question_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "solved" BOOLEAN NOT NULL DEFAULT false,
    "saw_solution" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserQuestion_pkey" PRIMARY KEY ("user_id","question_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegram_chat_id_key" ON "User"("telegram_chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "EditionType_code_key" ON "EditionType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Edition_type_id_year_key" ON "Edition"("type_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionsGroup_edition_id_code_key" ON "QuestionsGroup"("edition_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Question_questions_group_id_number_key" ON "Question"("questions_group_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionTag_code_key" ON "QuestionTag"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Edition" ADD CONSTRAINT "Edition_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "EditionType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionsGroup" ADD CONSTRAINT "QuestionsGroup_edition_id_fkey" FOREIGN KEY ("edition_id") REFERENCES "Edition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_questions_group_id_fkey" FOREIGN KEY ("questions_group_id") REFERENCES "QuestionsGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionQuestionTag" ADD CONSTRAINT "QuestionQuestionTag_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionQuestionTag" ADD CONSTRAINT "QuestionQuestionTag_question_tag_id_fkey" FOREIGN KEY ("question_tag_id") REFERENCES "QuestionTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestion" ADD CONSTRAINT "UserQuestion_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuestion" ADD CONSTRAINT "UserQuestion_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
