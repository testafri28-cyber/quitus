-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "leave_end" TIMESTAMP(3),
ADD COLUMN     "leave_kind" TEXT,
ADD COLUMN     "leave_start" TIMESTAMP(3);
