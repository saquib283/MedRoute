/**
 * Afzal Healthcare — Unified MVT Case Lifecycle & Stage-Gate Service
 * Re-exports client-safe lifecycle schemas & pure helpers alongside server-side case lifecycle orchestration.
 */

export {
  medicalAttendantSchema,
  treatmentPlanSchema,
  travelLogisticsSchema,
  fitToFlyChecklistSchema,
  followUpMilestoneSchema,
  assignClinicalTeamMutationSchema,
  publishTreatmentPlanMutationSchema,
  acceptTreatmentPlanMutationSchema,
  updateTravelLogisticsMutationSchema,
  recordFormCMutationSchema,
  submitFollowUpMutationSchema,
  lifecycleMutationSchema,
  CLEAN_PRESET_TEMPLATES,
  buildStandardMvtPathwaySteps,
  validateCaseStatusTransition,
  computeFormCSlaStatus,
  validateFitToFlySafetyChecklist,
  canShowRoadmapCertificateDownload,
  derivePatientNextActions,
  type MedicalAttendantRecord,
  type TreatmentPlanPayload,
  type TravelLogisticsPayload,
  type FitToFlyChecklistPayload,
  type FollowUpMilestone,
  type LifecycleMutationInput,
  type PresetStageStep,
  type PathwayPresetTemplate,
  type ValidateCaseStatusTransitionParams,
  type FormCSlaStatus,
  type PatientDocumentSummary,
  type PatientNextActionContext,
  type PatientNextActionKey,
  type PatientNextActionItem,
} from '@/lib/validation/lifecycle-schemas';

