-- CreateTable
CREATE TABLE "BusinessHours" (
    "id"           TEXT NOT NULL,
    "dayOfWeek"    INTEGER NOT NULL,
    "openTime"     TEXT NOT NULL,
    "closeTime"    TEXT NOT NULL,
    "slotInterval" INTEGER NOT NULL DEFAULT 30,
    "userId"       TEXT NOT NULL,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHours_userId_dayOfWeek_key" ON "BusinessHours"("userId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "BusinessHours_userId_idx" ON "BusinessHours"("userId");

-- AddForeignKey
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
