-- Create ReferralPartner table
CREATE TABLE `referral_partners` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL,
  `partner_type` VARCHAR(191) NOT NULL,
  `country` VARCHAR(191) NOT NULL,
  `contact_name` VARCHAR(191) NULL,
  `contact_email` VARCHAR(191) NULL,
  `contact_phone` VARCHAR(191) NULL,
  `commission_percent` DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `referral_partners_code_key`(`code`),
  INDEX `referral_partners_partner_type_idx`(`partner_type`),
  INDEX `referral_partners_is_active_idx`(`is_active`),
  INDEX `referral_partners_country_idx`(`country`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create Lead table
CREATE TABLE `leads` (
  `id` VARCHAR(191) NOT NULL,
  `reference_no` VARCHAR(191) NOT NULL,
  `full_name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `whatsapp_number` VARCHAR(191) NULL,
  `nationality` VARCHAR(191) NOT NULL,
  `country_of_residence` VARCHAR(191) NULL,
  `preferred_language` VARCHAR(191) NULL,
  `medical_condition` TEXT NOT NULL,
  `specialty_interest` VARCHAR(191) NULL,
  `urgency_level` ENUM('ROUTINE', 'SEMI_URGENT', 'URGENT') NOT NULL DEFAULT 'ROUTINE',
  `has_diagnostic_reports` BOOLEAN NOT NULL DEFAULT false,
  `passport_ready` BOOLEAN NOT NULL DEFAULT false,
  `preferred_travel_window` VARCHAR(191) NULL,
  `estimated_budget_usd` DECIMAL(12, 2) NULL,
  `preliminary_quote_usd` DECIMAL(12, 2) NULL,
  `preliminary_quote_notes` TEXT NULL,
  `target_hospital_id` VARCHAR(191) NULL,
  `target_doctor_id` VARCHAR(191) NULL,
  `status` ENUM('NEW', 'CONTACTED', 'MEDICAL_RECORDS_REQUESTED', 'CLINICAL_REVIEW', 'QUOTE_SHARED', 'NURTURING', 'QUALIFIED', 'CONVERTED', 'LOST') NOT NULL DEFAULT 'NEW',
  `source` ENUM('WEBSITE_INQUIRY', 'WHATSAPP', 'PHONE_CALL', 'B2B_PARTNER', 'DOCTOR_REFERRAL', 'EMBASSY_SPONSOR', 'META_GOOGLE_ADS', 'EMAIL_CAMPAIGN', 'WALK_IN') NOT NULL DEFAULT 'WEBSITE_INQUIRY',
  `lead_score` INTEGER NOT NULL DEFAULT 0,
  `temperature` ENUM('HOT', 'WARM', 'COLD') NOT NULL DEFAULT 'WARM',
  `assigned_manager_id` VARCHAR(191) NULL,
  `referral_partner_id` VARCHAR(191) NULL,
  `utm_source` VARCHAR(191) NULL,
  `utm_medium` VARCHAR(191) NULL,
  `utm_campaign` VARCHAR(191) NULL,
  `first_response_due_at` DATETIME(3) NOT NULL,
  `first_responded_at` DATETIME(3) NULL,
  `last_contacted_at` DATETIME(3) NULL,
  `next_follow_up_at` DATETIME(3) NULL,
  `lost_reason` VARCHAR(191) NULL,
  `lost_notes` TEXT NULL,
  `converted_patient_id` VARCHAR(191) NULL,
  `converted_case_id` VARCHAR(191) NULL,
  `converted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `leads_reference_no_key`(`reference_no`),
  UNIQUE INDEX `leads_converted_case_id_key`(`converted_case_id`),
  INDEX `leads_status_idx`(`status`),
  INDEX `leads_assigned_manager_id_idx`(`assigned_manager_id`),
  INDEX `leads_source_idx`(`source`),
  INDEX `leads_temperature_lead_score_idx`(`temperature`, `lead_score`),
  INDEX `leads_first_response_due_at_idx`(`first_response_due_at`),
  INDEX `leads_next_follow_up_at_idx`(`next_follow_up_at`),
  INDEX `leads_email_idx`(`email`),
  INDEX `leads_phone_idx`(`phone`),
  INDEX `leads_referral_partner_id_idx`(`referral_partner_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create LeadActivity table
CREATE TABLE `lead_activities` (
  `id` VARCHAR(191) NOT NULL,
  `lead_id` VARCHAR(191) NOT NULL,
  `actor_id` VARCHAR(191) NULL,
  `activity_type` ENUM('NOTE', 'WHATSAPP', 'PHONE_CALL', 'EMAIL', 'QUOTE_ESTIMATE', 'STATUS_CHANGE', 'FOLLOW_UP_SCHEDULED', 'CONVERSION') NOT NULL,
  `summary` VARCHAR(191) NOT NULL,
  `details` JSON NULL,
  `due_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `lead_activities_lead_id_created_at_idx`(`lead_id`, `created_at`),
  INDEX `lead_activities_due_at_idx`(`due_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add referral_partner_id to cases
ALTER TABLE `cases`
  ADD COLUMN `referral_partner_id` VARCHAR(191) NULL;

CREATE INDEX `cases_referral_partner_id_idx` ON `cases`(`referral_partner_id`);

-- Add Foreign Keys
ALTER TABLE `cases`
  ADD CONSTRAINT `cases_referral_partner_id_fkey`
  FOREIGN KEY (`referral_partner_id`) REFERENCES `referral_partners`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `leads`
  ADD CONSTRAINT `leads_assigned_manager_id_fkey`
  FOREIGN KEY (`assigned_manager_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `leads`
  ADD CONSTRAINT `leads_referral_partner_id_fkey`
  FOREIGN KEY (`referral_partner_id`) REFERENCES `referral_partners`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `lead_activities`
  ADD CONSTRAINT `lead_activities_lead_id_fkey`
  FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `lead_activities`
  ADD CONSTRAINT `lead_activities_actor_id_fkey`
  FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
