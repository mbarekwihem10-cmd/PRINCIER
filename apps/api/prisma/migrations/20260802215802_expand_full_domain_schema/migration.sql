-- CreateEnum
CREATE TYPE "TravelDocumentType" AS ENUM ('passport', 'national_id', 'visa', 'driver_license');

-- CreateEnum
CREATE TYPE "TravelGroupMemberRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('planning', 'confirmed', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "TripMemberRole" AS ENUM ('owner', 'editor', 'member');

-- CreateEnum
CREATE TYPE "TripMemberStatus" AS ENUM ('invited', 'accepted', 'declined', 'removed');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('available', 'unavailable', 'maybe');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('aggregator', 'direct_partner');

-- CreateEnum
CREATE TYPE "ProviderOnboardingStatus" AS ENUM ('pending', 'verified', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "EstablishmentType" AS ENUM ('hotel', 'restaurant', 'activity_venue', 'car_rental_branch', 'event_venue');

-- CreateEnum
CREATE TYPE "EstablishmentStatus" AS ENUM ('active', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('pending_verification', 'active', 'suspended', 'deactivated');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('sedan', 'van', 'scooter', 'bike');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "DriverBackgroundCheckStatus" AS ENUM ('pending', 'passed', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('flight', 'stay', 'ride', 'car_rental', 'activity', 'restaurant', 'delivery', 'event', 'esim');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('pending', 'confirmed', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('card', 'wallet', 'mixed');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "CommissionRecipientType" AS ENUM ('platform', 'provider', 'driver');

-- CreateEnum
CREATE TYPE "PayoutRecipientType" AS ENUM ('provider', 'driver');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'processing', 'paid', 'failed');

-- CreateEnum
CREATE TYPE "InvoiceIssuedToType" AS ENUM ('user', 'provider');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'issued', 'paid', 'void');

-- CreateEnum
CREATE TYPE "InvoiceReferenceType" AS ENUM ('payment', 'commission_entry', 'expense');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "WalletTransactionReason" AS ENUM ('top_up', 'payment', 'refund', 'payout_received', 'adjustment');

-- CreateEnum
CREATE TYPE "WalletReferenceType" AS ENUM ('payment', 'refund', 'payout');

-- CreateEnum
CREATE TYPE "FavoriteTargetType" AS ENUM ('establishment', 'driver');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('establishment', 'driver');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_file_id" UUID,
ADD COLUMN     "email_verified_at" TIMESTAMPTZ,
ADD COLUMN     "locale" VARCHAR(10) NOT NULL DEFAULT 'fr-FR',
ADD COLUMN     "phone" VARCHAR(30),
ADD COLUMN     "timezone" VARCHAR(50) NOT NULL DEFAULT 'Europe/Paris';

-- CreateTable
CREATE TABLE "currencies" (
    "code" CHAR(3) NOT NULL,
    "symbol" VARCHAR(5) NOT NULL,
    "decimal_places" SMALLINT NOT NULL DEFAULT 2,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "owner_type" VARCHAR(30) NOT NULL,
    "owner_id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "key" VARCHAR(200) NOT NULL,
    "response_snapshot" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "key" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_percentage" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "provider" VARCHAR(50) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "external_event_id" VARCHAR(200) NOT NULL,
    "payload" JSONB NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "processing_error" TEXT,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_identities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "provider" VARCHAR(30) NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role_id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "key" VARCHAR(150) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "travel_documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "type" "TravelDocumentType" NOT NULL,
    "issuing_country" CHAR(2) NOT NULL,
    "document_number_masked" VARCHAR(20),
    "expiry_date" DATE NOT NULL,
    "file_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "travel_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "relationship" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_groups" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "name" VARCHAR(200) NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "travel_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_group_members" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "travel_group_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "TravelGroupMemberRole" NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "travel_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "cover_image_file_id" UUID,
    "destination" VARCHAR(200),
    "start_date" DATE,
    "end_date" DATE,
    "base_currency" CHAR(3) NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'planning',
    "travel_group_id" UUID,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_members" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "trip_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "TripMemberRole" NOT NULL DEFAULT 'member',
    "status" "TripMemberStatus" NOT NULL DEFAULT 'invited',
    "invited_by" UUID,
    "joined_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_invitations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "trip_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "invited_by" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "availabilities" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "trip_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "AvailabilityStatus" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "trip_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ,
    "location" VARCHAR(200),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_calendar_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "start_at" TIMESTAMPTZ NOT NULL,
    "end_at" TIMESTAMPTZ,
    "location" VARCHAR(200),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "personal_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "type" "ProviderType" NOT NULL,
    "business_name" VARCHAR(200) NOT NULL,
    "legal_name" VARCHAR(200),
    "tax_id" VARCHAR(50),
    "contact_email" VARCHAR(255),
    "contact_phone" VARCHAR(30),
    "commission_rate_default" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "onboarding_status" "ProviderOnboardingStatus" NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "establishments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "provider_id" UUID NOT NULL,
    "type" "EstablishmentType" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "address_line1" VARCHAR(255),
    "city" VARCHAR(120),
    "country_code" CHAR(2),
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "external_ref" VARCHAR(200),
    "commission_rate_override" DECIMAL(5,4),
    "status" "EstablishmentStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "establishments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "provider_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "DriverStatus" NOT NULL DEFAULT 'pending_verification',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "driver_id" UUID NOT NULL,
    "type" "VehicleType" NOT NULL,
    "plate_number" VARCHAR(20) NOT NULL,
    "brand" VARCHAR(100),
    "model" VARCHAR(100),
    "year" SMALLINT,
    "capacity" SMALLINT,
    "status" "VehicleStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_background_checks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "driver_id" UUID NOT NULL,
    "status" "DriverBackgroundCheckStatus" NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "external_check_id" VARCHAR(200),
    "checked_at" TIMESTAMPTZ NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_background_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_payout_accounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "provider_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "external_account_reference" VARCHAR(200) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_payout_accounts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "driver_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "external_account_reference" VARCHAR(200) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_payout_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "trip_id" UUID NOT NULL,
    "type" "BookingType" NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_reference" VARCHAR(200) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'pending',
    "total_amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "booked_by" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "booking_id" UUID NOT NULL,
    "origin_airport" CHAR(3) NOT NULL,
    "destination_airport" CHAR(3) NOT NULL,
    "departure_at" TIMESTAMPTZ NOT NULL,
    "arrival_at" TIMESTAMPTZ NOT NULL,
    "airline" VARCHAR(100) NOT NULL,
    "flight_number" VARCHAR(10) NOT NULL,
    "cabin_class" VARCHAR(20) NOT NULL,
    "raw_provider_payload" JSONB NOT NULL,
    "provider_payload_schema_version" VARCHAR(20) NOT NULL,

    CONSTRAINT "flight_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flight_passengers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "flight_booking_id" UUID NOT NULL,
    "trip_member_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "seat" VARCHAR(10),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flight_passengers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stay_bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "booking_id" UUID NOT NULL,
    "property_name" VARCHAR(200) NOT NULL,
    "address" TEXT,
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "guests_count" SMALLINT NOT NULL,
    "provider_property_id" VARCHAR(100),
    "raw_provider_payload" JSONB NOT NULL,
    "provider_payload_schema_version" VARCHAR(20) NOT NULL,

    CONSTRAINT "stay_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "booking_id" UUID NOT NULL,
    "driver_id" UUID,
    "vehicle_id" UUID,
    "pickup_location" VARCHAR(255) NOT NULL,
    "pickup_latitude" DECIMAL(9,6),
    "pickup_longitude" DECIMAL(9,6),
    "dropoff_location" VARCHAR(255) NOT NULL,
    "dropoff_latitude" DECIMAL(9,6),
    "dropoff_longitude" DECIMAL(9,6),
    "requested_at" TIMESTAMPTZ NOT NULL,
    "picked_up_at" TIMESTAMPTZ,
    "dropped_off_at" TIMESTAMPTZ,
    "raw_provider_payload" JSONB NOT NULL,
    "provider_payload_schema_version" VARCHAR(20) NOT NULL,

    CONSTRAINT "ride_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "car_rental_bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "booking_id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "vehicle_category" VARCHAR(100) NOT NULL,
    "pickup_at" TIMESTAMPTZ NOT NULL,
    "dropoff_at" TIMESTAMPTZ NOT NULL,
    "pickup_location" VARCHAR(255) NOT NULL,
    "dropoff_location" VARCHAR(255) NOT NULL,
    "driver_age" SMALLINT,
    "raw_provider_payload" JSONB NOT NULL,
    "provider_payload_schema_version" VARCHAR(20) NOT NULL,

    CONSTRAINT "car_rental_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "booking_id" UUID NOT NULL,
    "establishment_id" UUID,
    "activity_name" VARCHAR(200) NOT NULL,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "participants_count" SMALLINT NOT NULL,
    "raw_provider_payload" JSONB NOT NULL,
    "provider_payload_schema_version" VARCHAR(20) NOT NULL,

    CONSTRAINT "activity_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "booking_id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "reservation_at" TIMESTAMPTZ NOT NULL,
    "party_size" SMALLINT NOT NULL,
    "raw_provider_payload" JSONB NOT NULL,
    "provider_payload_schema_version" VARCHAR(20) NOT NULL,

    CONSTRAINT "restaurant_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "booking_id" UUID NOT NULL,
    "establishment_id" UUID NOT NULL,
    "driver_id" UUID,
    "delivery_address" VARCHAR(255) NOT NULL,
    "ordered_at" TIMESTAMPTZ NOT NULL,
    "delivered_at" TIMESTAMPTZ,
    "raw_provider_payload" JSONB NOT NULL,
    "provider_payload_schema_version" VARCHAR(20) NOT NULL,

    CONSTRAINT "delivery_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_bookings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "booking_id" UUID NOT NULL,
    "event_name" VARCHAR(200) NOT NULL,
    "venue_establishment_id" UUID,
    "event_at" TIMESTAMPTZ NOT NULL,
    "ticket_count" SMALLINT NOT NULL,
    "seat_info" JSONB,
    "raw_provider_payload" JSONB NOT NULL,
    "provider_payload_schema_version" VARCHAR(20) NOT NULL,

    CONSTRAINT "event_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "esim_orders" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "booking_id" UUID NOT NULL,
    "data_plan_name" VARCHAR(200) NOT NULL,
    "region" VARCHAR(100) NOT NULL,
    "activation_code" TEXT,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE NOT NULL,
    "raw_provider_payload" JSONB NOT NULL,
    "provider_payload_schema_version" VARCHAR(20) NOT NULL,

    CONSTRAINT "esim_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "trip_id" UUID NOT NULL,
    "paid_by" UUID NOT NULL,
    "description" VARCHAR(200) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "exchange_rate_to_base" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "amount_in_base_currency" DECIMAL(12,2) NOT NULL,
    "category" VARCHAR(30) NOT NULL DEFAULT 'other',
    "expense_date" DATE NOT NULL,
    "receipt_file_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_shares" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "expense_id" UUID NOT NULL,
    "trip_member_id" UUID NOT NULL,
    "share_amount" DECIMAL(12,2) NOT NULL,
    "is_settled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "trip_id" UUID NOT NULL,
    "from_member_id" UUID NOT NULL,
    "to_member_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "settled_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_balances" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "trip_id" UUID NOT NULL,
    "trip_member_id" UUID NOT NULL,
    "balance_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "booking_id" UUID NOT NULL,
    "payer_id" UUID NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "provider" VARCHAR(50) NOT NULL,
    "provider_reference" VARCHAR(200),
    "idempotency_key" VARCHAR(200) NOT NULL,
    "raw_provider_payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "payment_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reason" VARCHAR(255),
    "status" "RefundStatus" NOT NULL DEFAULT 'pending',
    "provider_reference" VARCHAR(200),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_entries" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "booking_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "recipient_type" "CommissionRecipientType" NOT NULL,
    "recipient_id" UUID,
    "rate_applied" DECIMAL(5,4) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "recipient_type" "PayoutRecipientType" NOT NULL,
    "recipient_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "payout_account_reference" VARCHAR(200) NOT NULL,
    "external_payout_id" VARCHAR(200),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMPTZ,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_line_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "payout_id" UUID NOT NULL,
    "commission_entry_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payout_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "issued_to_type" "InvoiceIssuedToType" NOT NULL,
    "issued_to_id" UUID NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "currency" CHAR(3) NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "issued_at" TIMESTAMPTZ,
    "due_at" TIMESTAMPTZ,
    "pdf_file_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "invoice_id" UUID NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference_type" "InvoiceReferenceType",
    "reference_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_balances" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "wallet_id" UUID NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "wallet_id" UUID NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "reason" "WalletTransactionReason" NOT NULL,
    "reference_type" "WalletReferenceType",
    "reference_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "trip_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID,
    "content" TEXT NOT NULL,
    "message_type" VARCHAR(20) NOT NULL DEFAULT 'text',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_reads" (
    "message_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reads_pkey" PRIMARY KEY ("message_id","user_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "payload" JSONB NOT NULL,
    "read_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "notification_type" VARCHAR(50) NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID NOT NULL,
    "target_type" "FavoriteTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v7(),
    "user_id" UUID,
    "booking_id" UUID NOT NULL,
    "target_type" "ReviewTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "files_owner_type_owner_id_idx" ON "files"("owner_type", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_key" ON "idempotency_keys"("key");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE INDEX "webhook_events_provider_received_at_idx" ON "webhook_events"("provider", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_external_event_id_key" ON "webhook_events"("provider", "external_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_identities_provider_provider_user_id_key" ON "auth_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "travel_group_members_travel_group_id_user_id_key" ON "travel_group_members"("travel_group_id", "user_id");

-- CreateIndex
CREATE INDEX "trips_created_by_idx" ON "trips"("created_by");

-- CreateIndex
CREATE INDEX "trips_status_idx" ON "trips"("status");

-- CreateIndex
CREATE INDEX "trip_members_user_id_idx" ON "trip_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_members_trip_id_user_id_key" ON "trip_members"("trip_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_invitations_token_key" ON "trip_invitations"("token");

-- CreateIndex
-- Modifié manuellement : index unique PARTIEL au lieu de l'index plein
-- généré par Prisma, pour n'empêcher qu'une invitation ACTIVE en double,
-- tout en permettant de réinviter la même adresse après expiration/déclin.
CREATE UNIQUE INDEX "trip_invitations_pending_key" ON "trip_invitations"("trip_id", "email") WHERE "status" = 'pending';

-- CreateIndex
CREATE INDEX "availabilities_trip_id_date_idx" ON "availabilities"("trip_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "availabilities_trip_id_user_id_date_key" ON "availabilities"("trip_id", "user_id", "date");

-- CreateIndex
CREATE INDEX "calendar_events_trip_id_start_at_idx" ON "calendar_events"("trip_id", "start_at");

-- CreateIndex
CREATE INDEX "personal_calendar_events_user_id_start_at_idx" ON "personal_calendar_events"("user_id", "start_at");

-- CreateIndex
CREATE INDEX "establishments_type_city_idx" ON "establishments"("type", "city");

-- CreateIndex
CREATE UNIQUE INDEX "establishments_provider_id_external_ref_key" ON "establishments"("provider_id", "external_ref");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_user_id_key" ON "drivers"("user_id");

-- CreateIndex
CREATE INDEX "driver_background_checks_driver_id_checked_at_idx" ON "driver_background_checks"("driver_id", "checked_at" DESC);

-- CreateIndex
CREATE INDEX "bookings_trip_id_type_idx" ON "bookings"("trip_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_provider_provider_reference_key" ON "bookings"("provider", "provider_reference");

-- CreateIndex
CREATE UNIQUE INDEX "flight_bookings_booking_id_key" ON "flight_bookings"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "stay_bookings_booking_id_key" ON "stay_bookings"("booking_id");

-- CreateIndex
CREATE INDEX "stay_bookings_check_in_date_check_out_date_idx" ON "stay_bookings"("check_in_date", "check_out_date");

-- CreateIndex
CREATE UNIQUE INDEX "ride_bookings_booking_id_key" ON "ride_bookings"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "car_rental_bookings_booking_id_key" ON "car_rental_bookings"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_bookings_booking_id_key" ON "activity_bookings"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_bookings_booking_id_key" ON "restaurant_bookings"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_orders_booking_id_key" ON "delivery_orders"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_bookings_booking_id_key" ON "event_bookings"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "esim_orders_booking_id_key" ON "esim_orders"("booking_id");

-- CreateIndex
CREATE INDEX "expenses_trip_id_expense_date_idx" ON "expenses"("trip_id", "expense_date");

-- CreateIndex
CREATE INDEX "expense_shares_trip_member_id_is_settled_idx" ON "expense_shares"("trip_member_id", "is_settled");

-- CreateIndex
CREATE UNIQUE INDEX "expense_shares_expense_id_trip_member_id_key" ON "expense_shares"("expense_id", "trip_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_balances_trip_id_trip_member_id_key" ON "trip_balances"("trip_id", "trip_member_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_payer_id_created_at_idx" ON "payments"("payer_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "payout_line_items_payout_id_commission_entry_id_key" ON "payout_line_items"("payout_id", "commission_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_balances_wallet_id_currency_key" ON "wallet_balances"("wallet_id", "currency");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx" ON "wallet_transactions"("wallet_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_trip_id_key" ON "conversations"("trip_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_notification_type_channel_key" ON "notification_preferences"("user_id", "notification_type", "channel");

-- CreateIndex
CREATE INDEX "favorites_user_id_idx" ON "favorites"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_target_type_target_id_key" ON "favorites"("user_id", "target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE INDEX "reviews_target_type_target_id_idx" ON "reviews"("target_type", "target_id");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_file_id_fkey" FOREIGN KEY ("avatar_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_documents" ADD CONSTRAINT "travel_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_documents" ADD CONSTRAINT "travel_documents_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_groups" ADD CONSTRAINT "travel_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_group_members" ADD CONSTRAINT "travel_group_members_travel_group_id_fkey" FOREIGN KEY ("travel_group_id") REFERENCES "travel_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_group_members" ADD CONSTRAINT "travel_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_cover_image_file_id_fkey" FOREIGN KEY ("cover_image_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_base_currency_fkey" FOREIGN KEY ("base_currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_travel_group_id_fkey" FOREIGN KEY ("travel_group_id") REFERENCES "travel_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_members" ADD CONSTRAINT "trip_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_invitations" ADD CONSTRAINT "trip_invitations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_invitations" ADD CONSTRAINT "trip_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availabilities" ADD CONSTRAINT "availabilities_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "availabilities" ADD CONSTRAINT "availabilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_calendar_events" ADD CONSTRAINT "personal_calendar_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "establishments" ADD CONSTRAINT "establishments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_background_checks" ADD CONSTRAINT "driver_background_checks_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_payout_accounts" ADD CONSTRAINT "provider_payout_accounts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_payout_accounts" ADD CONSTRAINT "driver_payout_accounts_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_booked_by_fkey" FOREIGN KEY ("booked_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_bookings" ADD CONSTRAINT "flight_bookings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_passengers" ADD CONSTRAINT "flight_passengers_flight_booking_id_fkey" FOREIGN KEY ("flight_booking_id") REFERENCES "flight_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flight_passengers" ADD CONSTRAINT "flight_passengers_trip_member_id_fkey" FOREIGN KEY ("trip_member_id") REFERENCES "trip_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stay_bookings" ADD CONSTRAINT "stay_bookings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_bookings" ADD CONSTRAINT "ride_bookings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_bookings" ADD CONSTRAINT "ride_bookings_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_bookings" ADD CONSTRAINT "ride_bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_rental_bookings" ADD CONSTRAINT "car_rental_bookings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "car_rental_bookings" ADD CONSTRAINT "car_rental_bookings_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_bookings" ADD CONSTRAINT "activity_bookings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_bookings" ADD CONSTRAINT "activity_bookings_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_bookings" ADD CONSTRAINT "restaurant_bookings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_bookings" ADD CONSTRAINT "restaurant_bookings_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_establishment_id_fkey" FOREIGN KEY ("establishment_id") REFERENCES "establishments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_orders" ADD CONSTRAINT "delivery_orders_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_bookings" ADD CONSTRAINT "event_bookings_venue_establishment_id_fkey" FOREIGN KEY ("venue_establishment_id") REFERENCES "establishments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "esim_orders" ADD CONSTRAINT "esim_orders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "trip_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_receipt_file_id_fkey" FOREIGN KEY ("receipt_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_trip_member_id_fkey" FOREIGN KEY ("trip_member_id") REFERENCES "trip_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_from_member_id_fkey" FOREIGN KEY ("from_member_id") REFERENCES "trip_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_to_member_id_fkey" FOREIGN KEY ("to_member_id") REFERENCES "trip_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_balances" ADD CONSTRAINT "trip_balances_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_balances" ADD CONSTRAINT "trip_balances_trip_member_id_fkey" FOREIGN KEY ("trip_member_id") REFERENCES "trip_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_balances" ADD CONSTRAINT "trip_balances_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_id_fkey" FOREIGN KEY ("payer_id") REFERENCES "trip_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_entries" ADD CONSTRAINT "commission_entries_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_line_items" ADD CONSTRAINT "payout_line_items_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_line_items" ADD CONSTRAINT "payout_line_items_commission_entry_id_fkey" FOREIGN KEY ("commission_entry_id") REFERENCES "commission_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_pdf_file_id_fkey" FOREIGN KEY ("pdf_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_balances" ADD CONSTRAINT "wallet_balances_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_balances" ADD CONSTRAINT "wallet_balances_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reads" ADD CONSTRAINT "message_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- Corrections manuelles (revue finale du schéma, non exprimables dans
-- schema.prisma) : index uniques partiels et contraintes CHECK.
-- ============================================================================

-- Index unique PARTIEL : remplace l'index plein "users_email_key" créé par
-- la migration 20260802183314_init_bootstrap. Un email reste unique parmi
-- les comptes actifs, mais redevient disponible après suppression RGPD
-- d'un compte (soft delete via deleted_at).
DROP INDEX "users_email_key";
CREATE UNIQUE INDEX "users_email_active_key" ON "users"("email") WHERE "deleted_at" IS NULL;

-- Contraintes CHECK — cohérence temporelle
ALTER TABLE "trips" ADD CONSTRAINT "chk_trip_dates" CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date");
ALTER TABLE "stay_bookings" ADD CONSTRAINT "chk_stay_dates" CHECK ("check_out_date" > "check_in_date");
ALTER TABLE "car_rental_bookings" ADD CONSTRAINT "chk_car_rental_dates" CHECK ("dropoff_at" > "pickup_at");
-- >= et non > strict : un forfait eSIM valable une seule journée doit rester valide.
ALTER TABLE "esim_orders" ADD CONSTRAINT "chk_esim_validity" CHECK ("valid_until" >= "valid_from");
ALTER TABLE "payouts" ADD CONSTRAINT "chk_payout_period" CHECK ("period_end" >= "period_start");

-- Contraintes CHECK — montants financiers
ALTER TABLE "bookings" ADD CONSTRAINT "chk_booking_amount" CHECK ("total_amount" >= 0);
ALTER TABLE "expenses" ADD CONSTRAINT "chk_expense_amount" CHECK ("amount" > 0);
ALTER TABLE "expense_shares" ADD CONSTRAINT "chk_expense_share_amount" CHECK ("share_amount" >= 0);
ALTER TABLE "settlements" ADD CONSTRAINT "chk_settlement_amount" CHECK ("amount" > 0);
ALTER TABLE "payments" ADD CONSTRAINT "chk_payment_amount" CHECK ("amount" > 0);
ALTER TABLE "refunds" ADD CONSTRAINT "chk_refund_amount" CHECK ("amount" > 0);
ALTER TABLE "commission_entries" ADD CONSTRAINT "chk_commission_amount" CHECK ("amount" >= 0);
ALTER TABLE "commission_entries" ADD CONSTRAINT "chk_commission_rate" CHECK ("rate_applied" >= 0 AND "rate_applied" <= 1);
ALTER TABLE "payouts" ADD CONSTRAINT "chk_payout_amount" CHECK ("amount" > 0);
ALTER TABLE "payout_line_items" ADD CONSTRAINT "chk_payout_line_amount" CHECK ("amount" > 0);
ALTER TABLE "invoices" ADD CONSTRAINT "chk_invoice_amount" CHECK ("total_amount" >= 0);
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "chk_wallet_tx_amount" CHECK ("amount" > 0);

-- Contrainte CHECK — bornes métier
ALTER TABLE "reviews" ADD CONSTRAINT "chk_review_rating" CHECK ("rating" BETWEEN 1 AND 5);
