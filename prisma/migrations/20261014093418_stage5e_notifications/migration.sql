-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RESERVATION_REQUESTED', 'RESERVATION_APPROVED', 'RESERVATION_REJECTED', 'RESERVATION_CANCELLED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "actorUserId" UUID,
    "reservationId" UUID,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMPTZ(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_isRead_createdAt_idx" ON "notifications"("recipientUserId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_createdAt_idx" ON "notifications"("recipientUserId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "notifications_reservationId_idx" ON "notifications"("reservationId");

-- CreateIndex
CREATE INDEX "notifications_actorUserId_idx" ON "notifications"("actorUserId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
