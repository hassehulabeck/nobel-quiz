-- CreateTable
CREATE TABLE "GuestPlayer" (
    "id" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestSubmission" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerOptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestPlayer_displayName_key" ON "GuestPlayer"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "GuestPlayer_token_key" ON "GuestPlayer"("token");

-- CreateIndex
CREATE INDEX "GuestSubmission_questionId_idx" ON "GuestSubmission"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestSubmission_guestId_questionId_key" ON "GuestSubmission"("guestId", "questionId");

-- AddForeignKey
ALTER TABLE "GuestSubmission" ADD CONSTRAINT "GuestSubmission_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestSubmission" ADD CONSTRAINT "GuestSubmission_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestSubmission" ADD CONSTRAINT "GuestSubmission_answerOptionId_fkey" FOREIGN KEY ("answerOptionId") REFERENCES "AnswerOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
