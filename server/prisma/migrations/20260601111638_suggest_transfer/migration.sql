-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "suggested_to" TEXT,
ADD COLUMN     "transfer_to" TEXT;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_suggested_to_fkey" FOREIGN KEY ("suggested_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_transfer_to_fkey" FOREIGN KEY ("transfer_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
