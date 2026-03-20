-- Remove tariff/payment domain
-- All tables are empty (verified before migration).
-- Safe to drop without data loss.

-- ============================================================
-- Phase 1: Detach FK from access_grants
-- ============================================================
ALTER TABLE "access_grants" DROP CONSTRAINT IF EXISTS "access_grants_purchase_id_fkey";
ALTER TABLE "access_grants" DROP CONSTRAINT IF EXISTS "access_grants_tariff_id_fkey";
ALTER TABLE "access_grants" DROP COLUMN IF EXISTS "purchase_id";
ALTER TABLE "access_grants" DROP COLUMN IF EXISTS "tariff_id";

-- Drop the index that referenced purchase_id
DROP INDEX IF EXISTS "access_grants_purchase_id_idx";

-- ============================================================
-- Phase 2: Drop dependent tables (leaves → roots)
-- ============================================================
DROP TABLE IF EXISTS "billing_records";
DROP TABLE IF EXISTS "purchase_items";
DROP TABLE IF EXISTS "partner_commissions";
DROP TABLE IF EXISTS "promo_code_usages";
DROP TABLE IF EXISTS "tariff_features";
DROP TABLE IF EXISTS "tariff_courses";
DROP TABLE IF EXISTS "promo_codes";
DROP TABLE IF EXISTS "purchases";
DROP TABLE IF EXISTS "tariffs";

-- ============================================================
-- Phase 3: Clean Course — remove pricing fields
-- ============================================================
ALTER TABLE "courses" DROP COLUMN IF EXISTS "price";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "old_price";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "currency";
ALTER TABLE "courses" DROP COLUMN IF EXISTS "is_direct_purchase_available";

-- ============================================================
-- Phase 4: Rename TariffTier → AccessTier
-- ============================================================
ALTER TYPE "TariffTier" RENAME TO "AccessTier";

-- Rename column in knowledge_items
ALTER TABLE "knowledge_items" RENAME COLUMN "min_tariff_tier" TO "min_access_tier";

-- ============================================================
-- Phase 5: Rebuild AccessGrantSource enum (remove PURCHASE, PROMO_CODE; add SYSTEM)
-- ============================================================
-- No existing rows use PURCHASE or PROMO_CODE (verified).
CREATE TYPE "AccessGrantSource_new" AS ENUM ('ADMIN_GRANT', 'SYSTEM');
ALTER TABLE "access_grants"
  ALTER COLUMN "granted_via" TYPE "AccessGrantSource_new"
  USING "granted_via"::text::"AccessGrantSource_new";
DROP TYPE "AccessGrantSource";
ALTER TYPE "AccessGrantSource_new" RENAME TO "AccessGrantSource";

-- ============================================================
-- Phase 6: Rebuild NotificationType enum (remove PURCHASE_CONFIRMED)
-- No existing rows use PURCHASE_CONFIRMED (verified).
-- ============================================================
CREATE TYPE "NotificationType_new" AS ENUM (
  'REGISTRATION',
  'EMAIL_VERIFICATION',
  'PASSWORD_RESET',
  'ACCESS_GRANTED',
  'ACCESS_REVOKED',
  'WEBINAR_REMINDER',
  'WEBINAR_STARTED',
  'AUTO_WEBINAR_REMINDER',
  'AUTO_WEBINAR_STARTED',
  'ASSIGNMENT_REVIEWED',
  'NEW_COURSE',
  'SYSTEM'
);
ALTER TABLE "notifications"
  ALTER COLUMN "type" TYPE "NotificationType_new"
  USING "type"::text::"NotificationType_new";
DROP TYPE "NotificationType";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";

-- ============================================================
-- Phase 7: Drop unused enums
-- ============================================================
DROP TYPE IF EXISTS "TariffFeatureType";
DROP TYPE IF EXISTS "PromoCodeType";
DROP TYPE IF EXISTS "PurchaseStatus";
DROP TYPE IF EXISTS "PurchaseItemType";
DROP TYPE IF EXISTS "PaymentMethod";
DROP TYPE IF EXISTS "CommissionStatus";

-- ============================================================
-- Phase 8: Remove User.purchases / User.promoCodeUsages relations
-- (handled by Prisma schema, no SQL needed — relations are virtual)
-- ============================================================
-- Done. The Prisma schema update removes these relation fields.
