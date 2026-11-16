-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "chargeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chargeCurrency" TEXT NOT NULL DEFAULT '';
