-- CreateTable
CREATE TABLE "ticket_documents" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_documents_ticket_id_idx" ON "ticket_documents"("ticket_id");

-- AddForeignKey
ALTER TABLE "ticket_documents" ADD CONSTRAINT "ticket_documents_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_documents" ADD CONSTRAINT "ticket_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
