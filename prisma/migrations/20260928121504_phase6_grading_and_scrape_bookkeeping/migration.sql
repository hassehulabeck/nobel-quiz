-- AlterTable
ALTER TABLE "AnswerOption" ADD COLUMN     "matchValue" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "gradingKey" TEXT;

-- AlterTable
ALTER TABLE "Result" ADD COLUMN     "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN     "scrapeAttempts" INTEGER NOT NULL DEFAULT 0;
