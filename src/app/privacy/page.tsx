import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../public/assets/logo.png';
import {
  Shield,
  Lock,
  Eye,
  Globe2,
  Database,
  UserCheck,
  Clock,
  Mail,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy — MediRoute India',
  description:
    'Privacy policy and protected health information (ePHI) data protection standards for MediRoute India.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-surface-100 font-sans text-surface-800">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-surface-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src={logoImg} alt="MediRoute India" height={32} className="h-8 w-auto object-contain" priority />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/terms"
              className="text-xs sm:text-sm font-semibold text-surface-600 hover:text-surface-900"
            >
              Terms of Service
            </Link>
            <Link
              href="/login"
              className="px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Document Header */}
      <section className="bg-white border-b border-surface-200 py-10 sm:py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-50 text-primary-800 text-xs font-semibold border border-primary-200">
            <Shield className="w-3.5 h-3.5" />
            <span>HIPAA &amp; DPDP Act Compliance</span>
          </div>
          <h1 className="text-3xl font-bold text-surface-900 tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-surface-600 max-w-2xl leading-relaxed">
            How MediRoute India collects, protects, and shares electronic protected health information (ePHI), passport records, and travel data.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        {/* Commitment Highlight */}
        <div className="p-5 bg-primary-50 border border-primary-200 rounded-xl flex items-start gap-3.5">
          <Lock className="w-5 h-5 text-primary-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-primary-950">
              Data Protection Commitment
            </h2>
            <p className="text-sm text-primary-900 leading-relaxed">
              MediRoute India Pvt. Ltd. applies technical and administrative safeguards aligned with the <strong>Health Insurance Portability and Accountability Act (HIPAA)</strong> and India&apos;s <strong>Digital Personal Data Protection Act (DPDP)</strong>.
            </p>
          </div>
        </div>

        {/* Section 1 */}
        <section className="space-y-3 bg-white p-6 sm:p-7 rounded-xl border border-surface-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <Database className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">1. Information We Collect</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-3">
            <p>To coordinate your medical travel and treatment in India, we collect:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-surface-700">
              <li><strong>Patient Identity & PII:</strong> Full legal name, date of birth, nationality, passport number (encrypted via AES-256), email address, and phone number.</li>
              <li><strong>Electronic Protected Health Information (ePHI):</strong> Medical condition details, diagnosis notes, uploaded DICOM/MRI/CT scans, blood test reports, allergy profiles, previous surgeries, and doctor prescriptions.</li>
              <li><strong>Logistics & Travel Data:</strong> Flight arrival/departure itineraries, accompanying attendant details, medical hotel booking preferences, and transfer requirements.</li>
              <li><strong>Billing & Financial Data:</strong> Invoices, payment records, currency preferences, and wire transfer reference numbers.</li>
            </ul>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-xl border border-surface-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <Eye className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">2. How We Use Your Protected Health Information</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-3">
            <p>We process your data strictly for authorized healthcare coordination purposes:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-surface-700">
              <li>Sharing diagnostic reports securely with accredited partner hospital medical boards to formulate itemized Treatment Plans and cost estimates.</li>
              <li>Generating official Hospital Visa Invitation Letters (VIL) required for Indian Medical Visas (MED / MED-X).</li>
              <li>Coordinating hospital appointments, doctor consultations, and post-discharge recovery follow-ups.</li>
              <li>Managing medical hotel bookings and specialized wheelchair/ambulance transfers.</li>
            </ul>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-xl border border-surface-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <Globe2 className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">3. Cross-Border Transfers & Third-Party Sharing</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-3">
            <p>
              Your medical files are shared exclusively with certified healthcare entities participating directly in your care:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-surface-700">
              <li><strong>JCI & NABH Partner Hospitals:</strong> Authorized clinical and international patient coordinators.</li>
              <li><strong>Treating Physicians & Specialists:</strong> Doctors reviewing your case for clinical feasibility.</li>
              <li><strong>Accommodation & Logistics Partners:</strong> Guest houses and transport coordinators (shared only on a need-to-know basis without disclosing underlying medical diagnoses).</li>
            </ul>
            <p className="pt-1">
              <strong>We never sell, rent, or monetize patient personal or medical information under any circumstances.</strong>
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-xl border border-surface-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <Shield className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">4. Technical Safeguards & Data Security</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-3">
            <p>We enforce strict technical security standards across all layers:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-surface-700">
              <li><strong>AES-256-GCM Encryption at Rest:</strong> Sensitive identity fields (such as passport records) are encrypted using AES-256 before database insertion.</li>
              <li><strong>In-Transit TLS 1.3 Encryption:</strong> All client-server communications use HTTPS/TLS with strict transport security.</li>
              <li><strong>Role-Based Access Control (RBAC):</strong> Strict access controls ensure patients can only access their own documents, and coordinators only access their assigned cohort.</li>
              <li><strong>Automated Inactivity Timeout:</strong> Enforces an automatic 15-minute logoff per HIPAA § 164.312(a)(2)(iii).</li>
              <li><strong>Access & Download Audit Trail:</strong> Every document view, download, status update, and case transition is immutably logged with Actor ID, timestamp, and IP address.</li>
            </ul>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-xl border border-surface-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <UserCheck className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">5. Your Privacy Rights</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-3">
            <p>As a patient, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-surface-700">
              <li><strong>Access & Portability:</strong> View and download your complete medical document vault, treatment plans, and payment records at any time.</li>
              <li><strong>Rectification:</strong> Request corrections to inaccurate personal or emergency contact information.</li>
              <li><strong>Revocation of Consent:</strong> Withdraw your consent for ongoing medical coordination by notifying your assigned Case Manager.</li>
              <li><strong>Data Deletion / Erasure:</strong> Request the deletion of your account, subject to mandatory legal and clinical record retention requirements.</li>
            </ul>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-xl border border-surface-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <Clock className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">6. Cookies & Regional Localization</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-2">
            <p>
              We utilize functional cookies and local storage exclusively to persist your viewing currency preference (e.g. USD, AED, NGN, GBP), country localization, and secure session tokens. We do not use intrusive third-party cross-site tracking cookies.
            </p>
          </div>
        </section>

        {/* Section 7 */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-xl border border-surface-200 shadow-xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <Mail className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">7. Data Protection Officer & Privacy Inquiries</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-2">
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or your health data security, please contact our Data Protection Officer:
            </p>
            <div className="p-4 bg-surface-50 rounded-xl border border-surface-200 space-y-1 font-medium text-surface-800">
              <p><strong>Data Protection Officer (DPO)</strong></p>
              <p>MediRoute India Pvt. Ltd.</p>
              <p>Plot 42, Sector 18, Noida, Uttar Pradesh 201301, India</p>
              <p>Email: <a href="mailto:privacy@mediroute.in" className="text-primary-600 underline">privacy@mediroute.in</a> / <a href="mailto:compliance@mediroute.in" className="text-primary-600 underline">compliance@mediroute.in</a></p>
            </div>
          </div>
        </section>

        {/* Footer Navigation */}
        <div className="text-center pt-6 border-t border-surface-200 text-xs text-surface-500 space-y-2">
          <p>© 2026 MediRoute India Pvt. Ltd. All rights reserved.</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link href="/terms" className="text-primary-600 hover:underline">
              Terms & Conditions
            </Link>
            <span>•</span>
            <Link href="/inquire" className="text-primary-600 hover:underline">
              Inquire Treatment
            </Link>
            <span>•</span>
            <Link href="/login" className="text-primary-600 hover:underline">
              Portal Sign In
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
