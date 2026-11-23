'use client';

import { createContext, useContext } from 'react';

export interface PatientSessionData {
  userId: string | null;
  fullName: string;
  email: string;
  isLoading: boolean;
}

export const PatientSessionContext = createContext<PatientSessionData>({
  userId: null,
  fullName: '',
  email: '',
  isLoading: true,
});

export function usePatientSession(): PatientSessionData {
  return useContext(PatientSessionContext);
}

