-- Expand DocumentCategory enum with DISCHARGE_SUMMARY
ALTER TABLE `documents`
  MODIFY COLUMN `category` ENUM(
    'PASSPORT',
    'VISA',
    'VISA_INVITATION_LETTER',
    'PROFORMA_INVOICE',
    'MEDICAL_OPINION',
    'MEDICAL_REPORT',
    'PRESCRIPTION',
    'FIT_TO_FLY_CERTIFICATE',
    'FRRO_REGISTRATION',
    'INSURANCE',
    'DISCHARGE_SUMMARY'
  ) NOT NULL;

-- Add passport_expiry to patients for 6-month MVT visa validity checks
ALTER TABLE `patients`
  ADD COLUMN `passport_expiry` DATETIME(3) NULL;

-- Add clinical team relations and structured JSON lifecycle payloads to cases
ALTER TABLE `cases`
  ADD COLUMN `hospital_id` VARCHAR(191) NULL,
  ADD COLUMN `primary_doctor_id` VARCHAR(191) NULL,
  ADD COLUMN `treatment_plan` JSON NULL,
  ADD COLUMN `travel_logistics` JSON NULL,
  ADD COLUMN `post_return_follow_ups` JSON NULL;

CREATE INDEX `cases_hospital_id_idx` ON `cases`(`hospital_id`);
CREATE INDEX `cases_primary_doctor_id_idx` ON `cases`(`primary_doctor_id`);

ALTER TABLE `cases`
  ADD CONSTRAINT `cases_hospital_id_fkey`
  FOREIGN KEY (`hospital_id`) REFERENCES `hospitals`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `cases`
  ADD CONSTRAINT `cases_primary_doctor_id_fkey`
  FOREIGN KEY (`primary_doctor_id`) REFERENCES `doctors`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add teleconsultation mode, meeting link, and interpreter language to appointments
ALTER TABLE `appointments`
  ADD COLUMN `mode` ENUM('TELECONSULTATION', 'IN_PERSON') NOT NULL DEFAULT 'IN_PERSON',
  ADD COLUMN `meeting_url` VARCHAR(500) NULL,
  ADD COLUMN `interpreter_language` VARCHAR(100) NULL;

-- Add IATA MEDIF physiological checklist, SSR code, and flight metadata to fit_to_fly_clearances
ALTER TABLE `fit_to_fly_clearances`
  ADD COLUMN `checklist` JSON NULL,
  ADD COLUMN `ssr_code` VARCHAR(32) NULL DEFAULT 'NONE',
  ADD COLUMN `requires_medif` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `flight_number` VARCHAR(64) NULL,
  ADD COLUMN `departure_date` DATETIME(3) NULL;

