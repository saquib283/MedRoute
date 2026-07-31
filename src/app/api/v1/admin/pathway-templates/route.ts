/**
 * Afzal Healthcare — Clinical Pathway Specialty Templates API
 * GET /api/v1/admin/pathway-templates — Retrieve specialty pathway preset templates (Cardiology, Oncology, Orthopedics, Transplant)
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/api/auth-helper';
import { apiSuccess } from '@/lib/api/response';

export interface PresetStageStep {
  stageName: string;
  stageOrder: number;
  stepOrder: number;
  title: string;
  category: string;
  status: string;
  decisionBranch?: string;
  actionType?: string;
  requiredRole?: string;
  doctorNotes?: string;
}

export interface PathwayPresetTemplate {
  id: string;
  specialtyName: string;
  description: string;
  icon: string;
  steps: PresetStageStep[];
}

const PRESET_TEMPLATES: PathwayPresetTemplate[] = [
  {
    id: 'CARDIOLOGY',
    specialtyName: 'Interventional Cardiology & Cardiac Surgery Pathway',
    description: 'Comprehensive 7-stage cardiac catheterization, stent placement, CCU telemetry, and Fit-to-Fly protocol.',
    icon: 'HeartPulse',
    steps: [
      // Stage 1
      { stageName: 'Stage 1: Pre-Travel Triage & Medical Clearance', stageOrder: 1, stepOrder: 1, title: 'Inquiry & Initial Medical DICOM Review', category: 'PRE_OP', status: 'COMPLETED', doctorNotes: 'Pre-op Angiography DICOM scans reviewed.', actionType: 'UPLOAD_DOCS', requiredRole: 'PATIENT' },
      { stageName: 'Stage 1: Pre-Travel Triage & Medical Clearance', stageOrder: 1, stepOrder: 2, title: 'Multi-Disciplinary Team (MDT) Board Clearance', category: 'PRE_OP', status: 'COMPLETED', decisionBranch: 'APPROVED_FOR_SURGERY', doctorNotes: 'MDT board approved surgical intervention.', actionType: 'VOTE_MDT', requiredRole: 'DOCTOR' },
      
      // Stage 2
      { stageName: 'Stage 2: MDT Board & Pro-Forma Invoice', stageOrder: 2, stepOrder: 1, title: 'Pro-Forma Treatment Cost Estimate Generation', category: 'PRE_OP', status: 'COMPLETED', actionType: 'ISSUE_PROFORMA', requiredRole: 'MANAGER' },
      { stageName: 'Stage 2: MDT Board & Pro-Forma Invoice', stageOrder: 2, stepOrder: 2, title: 'Hospital Bed & Cath Lab Reservation', category: 'PRE_OP', status: 'COMPLETED', actionType: 'RESERVE_BED', requiredRole: 'MANAGER' },

      // Stage 3
      { stageName: 'Stage 3: Visa Invitation (VIL), FRRO & Travel', stageOrder: 3, stepOrder: 1, title: 'Official Hospital Visa Invitation Letter (VIL) Issuance', category: 'PRE_OP', status: 'COMPLETED', actionType: 'ISSUE_VIL', requiredRole: 'MANAGER' },
      { stageName: 'Stage 3: Visa Invitation (VIL), FRRO & Travel', stageOrder: 3, stepOrder: 2, title: 'Flight Itinerary & Airport Transfer Confirmation', category: 'PRE_OP', status: 'COMPLETED', actionType: 'ARRANGE_LOGISTICS', requiredRole: 'MANAGER' },

      // Stage 4
      { stageName: 'Stage 4: Hospital Admission & Pre-Anesthesia (PAC)', stageOrder: 4, stepOrder: 1, title: 'Pre-Anesthesia Evaluation (PAC) & Cardiac Assessment', category: 'PRE_OP', status: 'COMPLETED', decisionBranch: 'FIT_FOR_ANESTHESIA', doctorNotes: 'PAC clearance granted.', actionType: 'SIGN_PAC', requiredRole: 'DOCTOR' },

      // Stage 5
      { stageName: 'Stage 5: Active Procedural / Surgical Intervention', stageOrder: 5, stepOrder: 1, title: 'Percutaneous Coronary Intervention & Stent Placement', category: 'TREATMENT', status: 'IN_PROGRESS', decisionBranch: 'UNCOMPLICATED_PROCEDURE', doctorNotes: 'Catheterization lab intervention scheduled.', actionType: 'OPERATIVE_SUMMARY', requiredRole: 'DOCTOR' },

      // Stage 6
      { stageName: 'Stage 6: ICU / CCU Telemetry & Ward Recovery', stageOrder: 6, stepOrder: 1, title: 'Post-Op Coronary Care Unit (CCU) Telemetry Monitoring', category: 'POST_OP', status: 'PENDING', decisionBranch: 'STABLE_STEARN_HEMODYNAMICS', actionType: 'HEMODYNAMICS_CLEARANCE', requiredRole: 'DOCTOR' },
      { stageName: 'Stage 6: ICU / CCU Telemetry & Ward Recovery', stageOrder: 6, stepOrder: 2, title: 'In-Patient Ward Recovery & Mobilization Protocol', category: 'POST_OP', status: 'PENDING', decisionBranch: 'NORMAL_RECOVERY_TRACK' },

      // Stage 7
      { stageName: 'Stage 7: Fit-to-Fly Certification, Discharge & Tele-Rehab', stageOrder: 7, stepOrder: 1, title: 'Fit-to-Fly Medical Travel Clearance Certificate', category: 'DISCHARGE', status: 'PENDING', decisionBranch: 'FIT_TO_FLY_GRANTED', actionType: 'SIGN_FIT_TO_FLY', requiredRole: 'DOCTOR' },
      { stageName: 'Stage 7: Fit-to-Fly Certification, Discharge & Tele-Rehab', stageOrder: 7, stepOrder: 2, title: 'Hospital Discharge Summary & Final Bill Settlement', category: 'DISCHARGE', status: 'PENDING', actionType: 'SETTLE_BILL', requiredRole: 'MANAGER' },
      { stageName: 'Stage 7: Fit-to-Fly Certification, Discharge & Tele-Rehab', stageOrder: 7, stepOrder: 3, title: 'Outpatient Tele-Rehabilitation & Follow-Up Consult', category: 'REHAB', status: 'PENDING', actionType: 'SCHEDULE_TELE_REHAB', requiredRole: 'DOCTOR' },
    ],
  },
  {
    id: 'ONCOLOGY',
    specialtyName: 'Oncology Surgical & Chemotherapy Pathway',
    description: 'Specialized 7-stage tumor board evaluation, surgical resection, chemotherapy infusion, and fit-to-fly clearance.',
    icon: 'Stethoscope',
    steps: [
      { stageName: 'Stage 1: Pre-Travel Tumor Board Triage', stageOrder: 1, stepOrder: 1, title: 'Histopathology & Biopsy Report Evaluation', category: 'PRE_OP', status: 'COMPLETED', actionType: 'UPLOAD_DOCS', requiredRole: 'PATIENT' },
      { stageName: 'Stage 2: MDT Tumor Board & Treatment Protocol', stageOrder: 2, stepOrder: 1, title: 'Multi-Specialty Tumor Board Surgical Consensus', category: 'PRE_OP', status: 'COMPLETED', decisionBranch: 'APPROVED_FOR_SURGERY', actionType: 'VOTE_MDT', requiredRole: 'DOCTOR' },
      { stageName: 'Stage 3: Visa Invitation Letter & Consulate Clearance', stageOrder: 3, stepOrder: 1, title: 'Official Emergency Medical Visa Invitation Letter', category: 'PRE_OP', status: 'COMPLETED', actionType: 'ISSUE_VIL', requiredRole: 'MANAGER' },
      { stageName: 'Stage 4: Hospital Admission & Pre-Op PAC', stageOrder: 4, stepOrder: 1, title: 'In-Patient Admission & Pre-Anesthesia Fitness', category: 'PRE_OP', status: 'IN_PROGRESS', actionType: 'SIGN_PAC', requiredRole: 'DOCTOR' },
      { stageName: 'Stage 5: Surgical Tumor Resection OT Procedure', stageOrder: 5, stepOrder: 1, title: 'Oncology Operating Suite Resection Procedure', category: 'TREATMENT', status: 'PENDING', actionType: 'OPERATIVE_SUMMARY', requiredRole: 'DOCTOR' },
      { stageName: 'Stage 6: Chemotherapy / Radiation Cycle', stageOrder: 6, stepOrder: 1, title: 'Post-Op Targeted Chemotherapy Infusion Cycle', category: 'POST_OP', status: 'PENDING' },
      { stageName: 'Stage 7: Fit-to-Fly Certification & Tele-Oncology', stageOrder: 7, stepOrder: 1, title: 'Fit-to-Fly Travel Certification', category: 'DISCHARGE', status: 'PENDING', actionType: 'SIGN_FIT_TO_FLY', requiredRole: 'DOCTOR' },
    ],
  },
  {
    id: 'ORTHOPEDICS',
    specialtyName: 'Orthopedic Total Joint Replacement Pathway',
    description: '7-stage total knee/hip arthroplasty, navigation OT, ward physiotherapy, and post-op rehabilitation.',
    icon: 'Activity',
    steps: [
      { stageName: 'Stage 1: Pre-Op Joint X-Ray & MRI Triage', stageOrder: 1, stepOrder: 1, title: 'Joint Radiology & Mobility Assessment', category: 'PRE_OP', status: 'COMPLETED', actionType: 'UPLOAD_DOCS', requiredRole: 'PATIENT' },
      { stageName: 'Stage 2: Ortho Board & Prosthetic Selection', stageOrder: 2, stepOrder: 1, title: 'Implant Prosthetic Selection & Cost Estimate', category: 'PRE_OP', status: 'COMPLETED', actionType: 'ISSUE_PROFORMA', requiredRole: 'MANAGER' },
      { stageName: 'Stage 3: Medical Visa (VIL) & Flight Booking', stageOrder: 3, stepOrder: 1, title: 'Hospital Visa Invitation Letter (VIL)', category: 'PRE_OP', status: 'COMPLETED', actionType: 'ISSUE_VIL', requiredRole: 'MANAGER' },
      { stageName: 'Stage 4: Admission & PAC Anesthesia Fitness', stageOrder: 4, stepOrder: 1, title: 'Pre-Anesthesia PAC Assessment', category: 'PRE_OP', status: 'IN_PROGRESS', actionType: 'SIGN_PAC', requiredRole: 'DOCTOR' },
      { stageName: 'Stage 5: Computer-Navigated Arthroplasty Procedure', stageOrder: 5, stepOrder: 1, title: 'Total Joint Arthroplasty OT Surgery', category: 'TREATMENT', status: 'PENDING', actionType: 'OPERATIVE_SUMMARY', requiredRole: 'DOCTOR' },
      { stageName: 'Stage 6: Ward Physiotherapy & Gait Rehabilitation', stageOrder: 6, stepOrder: 1, title: 'Post-Op Physical Therapy & Mobility Protocol', category: 'POST_OP', status: 'PENDING' },
      { stageName: 'Stage 7: Fit-to-Fly Certificate & Discharge', stageOrder: 7, stepOrder: 1, title: 'Fit-to-Fly Medical Travel Certification', category: 'DISCHARGE', status: 'PENDING', actionType: 'SIGN_FIT_TO_FLY', requiredRole: 'DOCTOR' },
    ],
  },
];

export async function GET(request: NextRequest) {
  try {
    const { user: authUser, error } = requireAuth(request);
    if (error) return error;

    return apiSuccess({ templates: PRESET_TEMPLATES });
  } catch (err) {
    console.error('[Pathway Templates GET Error]', err);
    return apiSuccess({ templates: PRESET_TEMPLATES });
  }
}
