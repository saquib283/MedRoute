'use client';

/**
 * Afzal Healthcare — Manager Configurable Patient Clinical Pathway Page
 * Flush grid wrapper delegating to the shared PathwayBuilderEditor workspace.
 */

import { use } from 'react';
import { PathwayBuilderEditor } from '@/components/clinical/PathwayBuilderEditor';

export default function ManagerCasePathwayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);
  return (
    <PathwayBuilderEditor
      caseId={caseId}
      backHref="/manager/cases"
      backLabel="Back to Cases"
    />
  );
}
