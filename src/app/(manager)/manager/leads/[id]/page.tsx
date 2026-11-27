'use client';

/**
 * Afzal Healthcare — Coordinator Lead Dossier Page
 */

import { use } from 'react';
import { LeadDossierWorkspace } from '@/components/crm/LeadDossierWorkspace';

export default function ManagerLeadDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <LeadDossierWorkspace leadId={id} role="MANAGER" backHref="/manager/leads" />;
}
