'use client';

/**
 * Afzal Healthcare — Admin Configurable Patient Clinical Pathway Page
 */

import { use } from 'react';
import { PathwayBuilderEditor } from '@/components/clinical/PathwayBuilderEditor';

export default function AdminCasePathwayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: caseId } = use(params);
  return (
    <PathwayBuilderEditor
      caseId={caseId}
      backHref="/admin/cases"
      backLabel="Back to All Cases"
    />
  );
}
