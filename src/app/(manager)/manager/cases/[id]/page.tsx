'use client';

/**
 * Afzal Healthcare — Manager Case Command Workspace Page
 * Flush grid wrapper delegating to the shared 5-tab CaseCommandWorkspace.
 */

import { use } from 'react';
import { CaseCommandWorkspace } from '@/components/clinical/CaseCommandWorkspace';

export default function ManagerCaseWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);
  return (
    <CaseCommandWorkspace
      caseId={caseId}
      role="MANAGER"
      backHref="/manager/cases"
    />
  );
}
