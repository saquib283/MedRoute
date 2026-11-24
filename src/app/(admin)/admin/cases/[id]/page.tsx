'use client';

/**
 * Afzal Healthcare — Admin Case Command Workspace Page
 * Flush grid wrapper delegating to the shared 5-tab CaseCommandWorkspace.
 */

import { use } from 'react';
import { CaseCommandWorkspace } from '@/components/clinical/CaseCommandWorkspace';

export default function AdminCaseWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);
  return (
    <CaseCommandWorkspace
      caseId={caseId}
      role="ADMIN"
      backHref="/admin/cases"
    />
  );
}
