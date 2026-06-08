-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TicketStatus" ADD VALUE 'A_TRIER';
ALTER TYPE "TicketStatus" ADD VALUE 'EN_ATTENTE_VALIDATION';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Urgency" ADD VALUE 'CRITIQUE';
ALTER TYPE "Urgency" ADD VALUE 'FAIBLE';

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "escalade_a" TIMESTAMP(3),
ADD COLUMN     "niveau_escalade" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pris_en_main_a" TIMESTAMP(3),
ADD COLUMN     "prise_en_main_avant" TIMESTAMP(3),
ADD COLUMN     "rappel_a" TIMESTAMP(3),
ADD COLUMN     "rappel_envoye" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "peut_dispatcher" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "politiques_sla" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "urgence" "Urgency" NOT NULL,
    "prise_en_main_h" DOUBLE PRECISION NOT NULL,
    "rappel_h" DOUBLE PRECISION NOT NULL,
    "escalade_h" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "politiques_sla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendriers_ouvres" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "jours" INTEGER[],
    "heure_debut" TEXT NOT NULL DEFAULT '08:00',
    "heure_fin" TEXT NOT NULL DEFAULT '16:30',
    "pause_debut" TEXT DEFAULT '12:00',
    "pause_fin" TEXT DEFAULT '14:00',

    CONSTRAINT "calendriers_ouvres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jours_feries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "date" DATE NOT NULL,
    "libelle" TEXT NOT NULL,

    CONSTRAINT "jours_feries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "politiques_sla_company_id_urgence_key" ON "politiques_sla"("company_id", "urgence");

-- CreateIndex
CREATE UNIQUE INDEX "calendriers_ouvres_company_id_key" ON "calendriers_ouvres"("company_id");

-- CreateIndex
CREATE INDEX "jours_feries_date_idx" ON "jours_feries"("date");
