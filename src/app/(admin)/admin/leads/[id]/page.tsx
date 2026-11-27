'use client';

/**
 * Afzal Healthcare — Admin Lead Dossier Page
 */

import { use } from 'react';
import { LeadDossierWorkspace } from '@/components/crm/LeadDossierWorkspace';

export default function AdminLeadDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <LeadDossierWorkspace leadId={id} role="ADMIN" backHref="/admin/leads" />;
}
