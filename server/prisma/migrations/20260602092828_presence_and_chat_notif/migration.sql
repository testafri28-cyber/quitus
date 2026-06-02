-- CreateEnum
CREATE TYPE "Presence" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'ON_LEAVE');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "room_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "presence" "Presence" NOT NULL DEFAULT 'AVAILABLE';

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
