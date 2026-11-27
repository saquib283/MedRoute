import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Get a Free Medical Consultation — MediRoute India',
  description:
    'Submit your medical inquiry and get a personalised treatment plan from India\'s top JCI & NABH accredited hospitals. Free consultation for international patients.',
  keywords: [
    'medical tourism India',
    'free consultation',
    'hospital India',
    'medical treatment abroad',
    'international patient',
    'JCI accredited hospital',
  ],
};

export default function InquireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
