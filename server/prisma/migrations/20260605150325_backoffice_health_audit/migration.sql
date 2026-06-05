-- CreateEnum
CREATE TYPE "HealthBucket" AS ENUM ('SAIN', 'A_SURVEILLER', 'A_RISQUE');

-- AlterTable
ALTER TABLE "super_admin_audits" ADD COLUMN     "ip" TEXT,
ADD COLUMN     "target_user_id" TEXT,
ADD COLUMN     "tenant_id" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "escalations_over_24h" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "frontoffice_user_id" TEXT,
ADD COLUMN     "last_activity_at" TIMESTAMP(3),
ADD COLUMN     "open_escalations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tickets_30d" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tickets_90d_avg" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "health_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "bucket" "HealthBucket" NOT NULL,
    "usage" INTEGER NOT NULL,
    "engagement" INTEGER NOT NULL,
    "support" INTEGER NOT NULL,
    "billing" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_snapshots_tenant_id_computed_at_idx" ON "health_snapshots"("tenant_id", "computed_at");

-- AddForeignKey
ALTER TABLE "health_snapshots" ADD CONSTRAINT "health_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
