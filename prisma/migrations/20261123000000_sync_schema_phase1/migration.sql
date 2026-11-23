-- Drop legacy tables removed from schema.prisma
DROP TABLE IF EXISTS `accommodation_bookings`;
DROP TABLE IF EXISTS `hostels`;

-- Normalize any legacy SUPER_ADMIN users before narrowing enum
UPDATE `users` SET `role` = 'ADMIN' WHERE `role` = 'SUPER_ADMIN';
ALTER TABLE `users` MODIFY `role` ENUM('PATIENT', 'MANAGER', 'ADMIN', 'DOCTOR') NOT NULL;

-- Expand CaseStatus to all 12 clinical lifecycle stages
ALTER TABLE `cases` MODIFY `status` ENUM(
  'INQUIRY_RECEIVED',
  'UNDER_REVIEW',
  'PRE_OP_CLEARANCE',
  'PLAN_CONFIRMED',
  'IN_TREATMENT',
  'ICU_RECOVERY',
  'WARD_RECOVERY',
  'POST_TREATMENT',
  'OUTPATIENT_RECUPERATION',
  'FIT_TO_FLY_CLEARED',
  'REMOTE_REHAB',
  'CLOSED'
) NOT NULL DEFAULT 'INQUIRY_RECEIVED';

-- Expand DocumentCategory and add verification + storageKey columns
ALTER TABLE `documents`
  MODIFY `category` ENUM(
    'PASSPORT',
    'VISA',
    'VISA_INVITATION_LETTER',
    'PROFORMA_INVOICE',
    'MEDICAL_OPINION',
    'MEDICAL_REPORT',
    'PRESCRIPTION',
    'FIT_TO_FLY_CERTIFICATE',
    'FRRO_REGISTRATION',
    'INSURANCE'
  ) NOT NULL,
  ADD COLUMN `storage_key` VARCHAR(191) NULL,
  ADD COLUMN `verification_status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `verified_by` VARCHAR(191) NULL,
  ADD COLUMN `verification_notes` TEXT NULL,
  ADD COLUMN `verified_at` DATETIME(3) NULL;

CREATE INDEX `documents_verification_status_idx` ON `documents`(`verification_status`);

-- Drop redundant duplicate index on refresh_tokens
DROP INDEX `refresh_tokens_token_idx` ON `refresh_tokens`;

-- Create PasswordResetToken table
CREATE TABLE `password_reset_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `otp_hash` VARCHAR(191) NOT NULL,
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `password_reset_tokens_user_id_expires_at_idx`(`user_id`, `expires_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create ClinicalStep table
CREATE TABLE `clinical_steps` (
  `id` VARCHAR(191) NOT NULL,
  `case_id` VARCHAR(191) NOT NULL,
  `stage_name` VARCHAR(191) NOT NULL DEFAULT 'Stage 1: Pre-Procedure Triage & Medical Clearance',
  `stage_order` INTEGER NOT NULL DEFAULT 1,
  `step_order` INTEGER NOT NULL DEFAULT 1,
  `title` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `decision_branch` VARCHAR(191) NULL,
  `doctor_notes` TEXT NULL,
  `action_type` VARCHAR(191) NULL,
  `required_role` VARCHAR(191) NULL,
  `action_url` VARCHAR(191) NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `clinical_steps_case_id_idx`(`case_id`),
  INDEX `clinical_steps_category_idx`(`category`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create FitToFlyClearance table
CREATE TABLE `fit_to_fly_clearances` (
  `id` VARCHAR(191) NOT NULL,
  `case_id` VARCHAR(191) NOT NULL,
  `is_cleared` BOOLEAN NOT NULL DEFAULT false,
  `cleared_by` VARCHAR(191) NULL,
  `clearance_date` DATETIME(3) NULL,
  `restrictions` TEXT NULL,
  `re_eval_date` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `fit_to_fly_clearances_case_id_key`(`case_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create MedicalBill table
CREATE TABLE `medical_bills` (
  `id` VARCHAR(191) NOT NULL,
  `case_id` VARCHAR(191) NOT NULL,
  `patient_id` VARCHAR(191) NOT NULL,
  `hospital_id` VARCHAR(191) NULL,
  `bill_number` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `category` VARCHAR(191) NOT NULL DEFAULT 'HOSPITAL_SURGERY',
  `total_amount` DECIMAL(12, 2) NOT NULL,
  `paid_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
  `currency` VARCHAR(191) NOT NULL DEFAULT 'USD',
  `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
  `due_date` DATETIME(3) NULL,
  `file_url` VARCHAR(191) NULL,
  `storage_key` VARCHAR(191) NULL,
  `file_name` VARCHAR(191) NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `medical_bills_bill_number_key`(`bill_number`),
  INDEX `medical_bills_case_id_idx`(`case_id`),
  INDEX `medical_bills_patient_id_idx`(`patient_id`),
  INDEX `medical_bills_status_idx`(`status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create BillItem table
CREATE TABLE `bill_items` (
  `id` VARCHAR(191) NOT NULL,
  `bill_id` VARCHAR(191) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `quantity` INTEGER NOT NULL DEFAULT 1,
  `unit_price` DECIMAL(12, 2) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `category` VARCHAR(191) NULL,
  INDEX `bill_items_bill_id_idx`(`bill_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create Hotel table
CREATE TABLE `hotels` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL,
  `address` TEXT NOT NULL,
  `near_hospital_id` VARCHAR(191) NULL,
  `distance_km` DOUBLE NOT NULL DEFAULT 2.5,
  `star_rating` DOUBLE NOT NULL DEFAULT 4.5,
  `nightly_rate_usd` DECIMAL(10, 2) NOT NULL,
  `commission_percent` DECIMAL(5, 2) NOT NULL DEFAULT 15.0,
  `amenities` JSON NULL,
  `images` JSON NULL,
  `description` TEXT NULL,
  `contact_phone` VARCHAR(191) NULL,
  `contact_email` VARCHAR(191) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `hotels_near_hospital_id_idx`(`near_hospital_id`),
  INDEX `hotels_city_idx`(`city`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create HotelBooking table
CREATE TABLE `hotel_bookings` (
  `id` VARCHAR(191) NOT NULL,
  `booking_no` VARCHAR(191) NOT NULL,
  `patient_id` VARCHAR(191) NOT NULL,
  `hotel_id` VARCHAR(191) NOT NULL,
  `case_id` VARCHAR(191) NULL,
  `check_in_date` DATETIME(3) NOT NULL,
  `check_out_date` DATETIME(3) NOT NULL,
  `room_type` VARCHAR(191) NOT NULL DEFAULT 'Deluxe Recovery Suite',
  `num_guests` INTEGER NOT NULL DEFAULT 2,
  `num_nights` INTEGER NOT NULL DEFAULT 3,
  `total_amount_usd` DECIMAL(10, 2) NOT NULL,
  `commission_amount_usd` DECIMAL(10, 2) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'CONFIRMED',
  `special_requests` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `hotel_bookings_booking_no_key`(`booking_no`),
  INDEX `hotel_bookings_patient_id_idx`(`patient_id`),
  INDEX `hotel_bookings_hotel_id_idx`(`hotel_id`),
  INDEX `hotel_bookings_case_id_idx`(`case_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add Foreign Keys
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `clinical_steps` ADD CONSTRAINT `clinical_steps_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `fit_to_fly_clearances` ADD CONSTRAINT `fit_to_fly_clearances_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `medical_bills` ADD CONSTRAINT `medical_bills_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `medical_bills` ADD CONSTRAINT `medical_bills_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `medical_bills` ADD CONSTRAINT `medical_bills_hospital_id_fkey` FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `medical_bills` ADD CONSTRAINT `medical_bills_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `bill_items` ADD CONSTRAINT `bill_items_bill_id_fkey` FOREIGN KEY (`bill_id`) REFERENCES `medical_bills`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hotels` ADD CONSTRAINT `hotels_near_hospital_id_fkey` FOREIGN KEY (`near_hospital_id`) REFERENCES `hospitals`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `hotel_bookings` ADD CONSTRAINT `hotel_bookings_patient_id_fkey` FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hotel_bookings` ADD CONSTRAINT `hotel_bookings_hotel_id_fkey` FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `hotel_bookings` ADD CONSTRAINT `hotel_bookings_case_id_fkey` FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
