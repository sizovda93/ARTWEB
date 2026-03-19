-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STUDENT');

-- CreateEnum
CREATE TYPE "EmailTokenType" AS ENUM ('VERIFICATION', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "TariffTier" AS ENUM ('BASIC', 'STANDARD', 'PARTNER');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PromoCodeType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('VIDEO', 'TEXT', 'MIXED');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('TEXT', 'FILE_UPLOAD', 'TEST', 'CHOICE');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'AI_REVIEWED', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "KnowledgeItemType" AS ENUM ('DOCUMENT', 'TEMPLATE', 'WEBINAR_RECORDING');

-- CreateEnum
CREATE TYPE "WebinarStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REGISTRATION', 'PURCHASE', 'ACCESS_GRANTED', 'WEBINAR_START', 'AUTO_WEBINAR_START', 'ASSIGNMENT_REVIEWED', 'NEW_COURSE', 'REMINDER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'TELEGRAM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STUDENT',
    "is_partner" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "referred_by_id" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "type" "EmailTokenType" NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariffs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tier" "TariffTier" NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "duration_days" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "features" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariff_courses" (
    "id" TEXT NOT NULL,
    "tariff_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,

    CONSTRAINT "tariff_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tariff_id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "granted_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PromoCodeType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "max_usages" INTEGER,
    "current_usages" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "tariff_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_code_usages" (
    "id" TEXT NOT NULL,
    "promo_code_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_code_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "cover_url" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "LessonType" NOT NULL DEFAULT 'MIXED',
    "content" TEXT,
    "video_url" TEXT,
    "video_duration" INTEGER,
    "is_free" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "requires_assignment" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_files" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_progresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT NOT NULL,
    "completed_lessons" INTEGER NOT NULL DEFAULT 0,
    "total_lessons" INTEGER NOT NULL DEFAULT 0,
    "progress_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lesson_progresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AssignmentType" NOT NULL,
    "max_score" INTEGER NOT NULL DEFAULT 100,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_options" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "test_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "text_answer" TEXT,
    "file_url" TEXT,
    "selected_options" TEXT[],
    "score" INTEGER,
    "ai_score" INTEGER,
    "ai_comment" TEXT,
    "admin_comment" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklists" (
    "id" TEXT NOT NULL,
    "lesson_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_items" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "KnowledgeItemType" NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "file_url" TEXT,
    "video_url" TEXT,
    "category" TEXT,
    "tags" TEXT[],
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "min_tariff_tier" "TariffTier",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webinars" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "cover_url" TEXT,
    "status" "WebinarStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "recording_url" TEXT,
    "stream_url" TEXT,
    "min_tariff_tier" "TariffTier",
    "max_attendees" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webinars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webinar_attendances" (
    "id" TEXT NOT NULL,
    "webinar_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMP(3),

    CONSTRAINT "webinar_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webinar_chat_messages" (
    "id" TEXT NOT NULL,
    "webinar_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webinar_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_webinars" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "cover_url" TEXT,
    "video_url" TEXT NOT NULL,
    "video_duration" INTEGER,
    "min_tariff_tier" "TariffTier",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_webinars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_webinar_schedules" (
    "id" TEXT NOT NULL,
    "auto_webinar_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "auto_webinar_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_webinar_views" (
    "id" TEXT NOT NULL,
    "auto_webinar_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "watched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "watch_duration" INTEGER,

    CONSTRAINT "auto_webinar_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auto_webinar_materials" (
    "id" TEXT NOT NULL,
    "auto_webinar_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "auto_webinar_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "course_id" TEXT,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokens" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage_limits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "daily_requests" INTEGER NOT NULL DEFAULT 0,
    "monthly_requests" INTEGER NOT NULL DEFAULT 0,
    "last_reset_daily" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_reset_monthly" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telegram_links" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "username" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "referral_code" TEXT NOT NULL,
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "total_earnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pending_payout" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_referrals" (
    "id" TEXT NOT NULL,
    "partner_profile_id" TEXT NOT NULL,
    "referred_user_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "amount" DECIMAL(12,2),
    "commission" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_token_key" ON "sessions"("refresh_token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_tokens_token_key" ON "email_tokens"("token");

-- CreateIndex
CREATE INDEX "email_tokens_token_idx" ON "email_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "tariffs_slug_key" ON "tariffs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tariff_courses_tariff_id_course_id_key" ON "tariff_courses"("tariff_id", "course_id");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "subscriptions_tariff_id_idx" ON "subscriptions"("tariff_id");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "promo_code_usages_promo_code_id_user_id_key" ON "promo_code_usages"("promo_code_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "modules_course_id_idx" ON "modules"("course_id");

-- CreateIndex
CREATE INDEX "lessons_module_id_idx" ON "lessons"("module_id");

-- CreateIndex
CREATE INDEX "lesson_files_lesson_id_idx" ON "lesson_files"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_progresses_user_id_course_id_key" ON "course_progresses"("user_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progresses_user_id_lesson_id_key" ON "lesson_progresses"("user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "assignments_lesson_id_idx" ON "assignments"("lesson_id");

-- CreateIndex
CREATE INDEX "test_options_assignment_id_idx" ON "test_options"("assignment_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_user_id_idx" ON "assignment_submissions"("user_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_assignment_id_idx" ON "assignment_submissions"("assignment_id");

-- CreateIndex
CREATE INDEX "assignment_submissions_status_idx" ON "assignment_submissions"("status");

-- CreateIndex
CREATE INDEX "checklists_lesson_id_idx" ON "checklists"("lesson_id");

-- CreateIndex
CREATE INDEX "checklist_items_checklist_id_idx" ON "checklist_items"("checklist_id");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_items_slug_key" ON "knowledge_items"("slug");

-- CreateIndex
CREATE INDEX "knowledge_items_category_idx" ON "knowledge_items"("category");

-- CreateIndex
CREATE INDEX "knowledge_items_type_idx" ON "knowledge_items"("type");

-- CreateIndex
CREATE UNIQUE INDEX "webinars_slug_key" ON "webinars"("slug");

-- CreateIndex
CREATE INDEX "webinars_status_idx" ON "webinars"("status");

-- CreateIndex
CREATE INDEX "webinars_scheduled_at_idx" ON "webinars"("scheduled_at");

-- CreateIndex
CREATE INDEX "webinar_attendances_webinar_id_idx" ON "webinar_attendances"("webinar_id");

-- CreateIndex
CREATE INDEX "webinar_attendances_user_id_idx" ON "webinar_attendances"("user_id");

-- CreateIndex
CREATE INDEX "webinar_chat_messages_webinar_id_idx" ON "webinar_chat_messages"("webinar_id");

-- CreateIndex
CREATE UNIQUE INDEX "auto_webinars_slug_key" ON "auto_webinars"("slug");

-- CreateIndex
CREATE INDEX "auto_webinar_schedules_auto_webinar_id_idx" ON "auto_webinar_schedules"("auto_webinar_id");

-- CreateIndex
CREATE INDEX "auto_webinar_schedules_scheduled_at_idx" ON "auto_webinar_schedules"("scheduled_at");

-- CreateIndex
CREATE INDEX "auto_webinar_views_auto_webinar_id_idx" ON "auto_webinar_views"("auto_webinar_id");

-- CreateIndex
CREATE INDEX "auto_webinar_views_user_id_idx" ON "auto_webinar_views"("user_id");

-- CreateIndex
CREATE INDEX "auto_webinar_materials_auto_webinar_id_idx" ON "auto_webinar_materials"("auto_webinar_id");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_user_id_idx" ON "ai_chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "ai_chat_messages_session_id_idx" ON "ai_chat_messages"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_limits_user_id_key" ON "ai_usage_limits"("user_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_user_id_key" ON "telegram_links"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "telegram_links_chat_id_key" ON "telegram_links"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_profiles_user_id_key" ON "partner_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_profiles_referral_code_key" ON "partner_profiles"("referral_code");

-- CreateIndex
CREATE INDEX "partner_referrals_partner_profile_id_idx" ON "partner_referrals"("partner_profile_id");

-- CreateIndex
CREATE INDEX "partner_referrals_referred_user_id_idx" ON "partner_referrals"("referred_user_id");

-- CreateIndex
CREATE INDEX "security_logs_user_id_idx" ON "security_logs"("user_id");

-- CreateIndex
CREATE INDEX "security_logs_action_idx" ON "security_logs"("action");

-- CreateIndex
CREATE INDEX "security_logs_created_at_idx" ON "security_logs"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_tokens" ADD CONSTRAINT "email_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariff_courses" ADD CONSTRAINT "tariff_courses_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariffs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariff_courses" ADD CONSTRAINT "tariff_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariffs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modules" ADD CONSTRAINT "modules_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_files" ADD CONSTRAINT "lesson_files_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progresses" ADD CONSTRAINT "course_progresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_progresses" ADD CONSTRAINT "course_progresses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progresses" ADD CONSTRAINT "lesson_progresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progresses" ADD CONSTRAINT "lesson_progresses_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_options" ADD CONSTRAINT "test_options_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_attendances" ADD CONSTRAINT "webinar_attendances_webinar_id_fkey" FOREIGN KEY ("webinar_id") REFERENCES "webinars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_attendances" ADD CONSTRAINT "webinar_attendances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_chat_messages" ADD CONSTRAINT "webinar_chat_messages_webinar_id_fkey" FOREIGN KEY ("webinar_id") REFERENCES "webinars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_chat_messages" ADD CONSTRAINT "webinar_chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_webinar_schedules" ADD CONSTRAINT "auto_webinar_schedules_auto_webinar_id_fkey" FOREIGN KEY ("auto_webinar_id") REFERENCES "auto_webinars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_webinar_views" ADD CONSTRAINT "auto_webinar_views_auto_webinar_id_fkey" FOREIGN KEY ("auto_webinar_id") REFERENCES "auto_webinars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_webinar_views" ADD CONSTRAINT "auto_webinar_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_webinar_materials" ADD CONSTRAINT "auto_webinar_materials_auto_webinar_id_fkey" FOREIGN KEY ("auto_webinar_id") REFERENCES "auto_webinars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_partner_profile_id_fkey" FOREIGN KEY ("partner_profile_id") REFERENCES "partner_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
