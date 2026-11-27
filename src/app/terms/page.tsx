import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../public/assets/logo.png';
import {
  Shield,
  FileText,
  AlertTriangle,
  CreditCard,
  Plane,
  Building2,
  Lock,
  HelpCircle,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms & Conditions — MediRoute India',
  description:
    'Terms of service and patient facilitation agreement for MediRoute India medical tourism services.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-surface-50 font-sans text-surface-800">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-surface-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src={logoImg} alt="MediRoute India" height={32} className="h-8 w-auto object-contain" priority />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/inquire"
              className="text-xs sm:text-sm font-semibold text-primary-700 hover:text-primary-800"
            >
              Get Free Quote
            </Link>
            <Link
              href="/login"
              className="px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-xs"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 text-white py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-primary-200 text-xs font-semibold border border-white/15">
            <FileText className="w-3.5 h-3.5" />
            <span>Effective Date: August 28, 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Terms & Conditions
          </h1>
          <p className="text-sm sm:text-base text-primary-200/80 max-w-2xl mx-auto font-light leading-relaxed">
            Please read these Terms of Service carefully before utilizing MediRoute India&apos;s medical travel coordination, hospital liaison, and concierge services.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        {/* Important Healthcare Facilitation Disclaimer Alert */}
        <div className="p-5 sm:p-6 bg-warning-50 border-2 border-warning-300 rounded-2xl flex items-start gap-4 shadow-xs">
          <AlertTriangle className="w-6 h-6 text-warning-700 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="text-base font-bold text-warning-900 uppercase tracking-wide">
              Medical Disclaimer & Nature of Services
            </h3>
            <p className="text-sm text-warning-800 leading-relaxed">
              <strong>MediRoute India Pvt. Ltd. is a healthcare facilitation, travel concierge, and medical coordination platform.</strong> MediRoute India is <strong>not</strong> a hospital, clinic, or medical practitioner. We do not provide medical advice, diagnosis, or treatment. All clinical evaluations, surgeries, diagnoses, and medical procedures are executed solely by independent, licensed partner hospitals and physicians in India.
            </p>
          </div>
        </div>

        {/* Section 1 */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-2xl border border-surface-200 shadow-2xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <Building2 className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">1. Scope of Facilitation Services</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-3">
            <p>
              MediRoute India connects foreign citizens and domestic patients with accredited Indian healthcare institutions (JCI & NABH accredited), specialized doctors, and ancillary support services. Our services encompass:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-surface-700">
              <li>Facilitating clinical reviews and pre-travel cost estimates with partner hospitals.</li>
              <li>Issuance of Visa Invitation Letters (VIL) for Indian Medical Visas (MED & MED-X).</li>
              <li>Airport transfers, local transport bookings, and medical hotel/hostel arrangements.</li>
              <li>Appointment scheduling, language interpreter support, and post-discharge follow-up coordination.</li>
            </ul>
          </div>
        </section>

        {/* Section 2 */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-2xl border border-surface-200 shadow-2xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <CreditCard className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">2. Financial Terms, Cost Estimates & Currency Conversion</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-3">
            <p>
              <strong>Cost Estimates vs. Final Hospital Invoices:</strong> All pre-travel treatment plan quotes and estimates provided via MediRoute are based on initial remote evaluation of uploaded medical reports. The final bill is determined by the treating hospital after comprehensive in-person diagnostics, pre-op examinations, and clinical needs.
            </p>
            <p>
              <strong>Currency Conversions:</strong> Non-INR amounts displayed across our portals (USD, AED, SAR, NGN, GBP, EUR, etc.) are converted using real-time or cached foreign exchange rates. Official legal invoicing and hospital settlements are calculated in base Indian Rupees (INR) or agreed contractual currencies.
            </p>
            <p>
              <strong>Facilitation Commissions & Partner Cuts:</strong> In accordance with our commercial contracts, MediRoute may receive referral commissions or administrative facilitation fees from partner hospitals, hotels, and logistics vendors. These arrangements do not alter or inflate the hospital&apos;s standard rack-rate package costs for international patients.
            </p>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-2xl border border-surface-200 shadow-2xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <Plane className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">3. Travel, Medical Visas & FRRO Compliance</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-3">
            <p>
              <strong>Visa Approval:</strong> MediRoute assists with official hospital invitation letters; however, the granting of Medical Visas remains at the sole discretion of Indian Embassies, Consulates, and the Ministry of External Affairs.
            </p>
            <p>
              <strong>FRRO Registration:</strong> Foreign patients whose stay in India exceeds 180 days or whose visa mandates registration must register with the Foreigners Regional Registration Office (FRRO) within 14 days of arrival. MediRoute coordinators provide documentation assistance.
            </p>
          </div>
        </section>

        {/* Section 4 */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-2xl border border-surface-200 shadow-2xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <Shield className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">4. Patient Responsibilities & Medical Records</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-3">
            <p>Patients and authorized caregivers agree to:</p>
            <ul className="list-disc pl-5 space-y-1.5 text-surface-700">
              <li>Provide accurate, genuine, and complete medical histories, previous surgeries, and medication records.</li>
              <li>Maintain valid passports with at least 6 months validity from the date of intended departure.</li>
              <li>Abide by all hospital admission rules, doctor advisories, and post-operative recovery schedules.</li>
              <li>Notify coordinators promptly of any changes in travel dates, cancellations, or medical complications.</li>
            </ul>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-2xl border border-surface-200 shadow-2xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <Lock className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">5. Limitation of Liability & Medical Malpractice</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-3">
            <p>
              To the maximum extent permitted by law, MediRoute India Pvt. Ltd., its directors, officers, and employees shall not be liable for any medical negligence, malpractice, surgical complications, adverse drug reactions, hospital delays, or post-treatment outcomes resulting from services rendered by third-party partner hospitals and doctors.
            </p>
            <p>
              All claims relating to medical treatment or professional negligence must be addressed directly to the respective healthcare facility or physician providing care.
            </p>
          </div>
        </section>

        {/* Section 6 */}
        <section className="space-y-3 bg-white p-6 sm:p-8 rounded-2xl border border-surface-200 shadow-2xs">
          <div className="flex items-center gap-2.5 text-primary-700">
            <HelpCircle className="w-5 h-5" />
            <h2 className="text-lg font-bold text-surface-900">6. Governing Law & Dispute Resolution</h2>
          </div>
          <div className="text-sm text-surface-600 leading-relaxed space-y-2">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts located in New Delhi / Uttar Pradesh, India.
            </p>
          </div>
        </section>

        {/* Contact Info Footer */}
        <div className="text-center pt-6 border-t border-surface-200 text-xs text-surface-500 space-y-2">
          <p>
            For legal inquiries regarding these Terms, contact our Compliance Department at{' '}
            <a href="mailto:legal@mediroute.in" className="text-primary-600 font-semibold underline">
              legal@mediroute.in
            </a>
          </p>
          <div className="flex justify-center gap-4 pt-2">
            <Link href="/privacy" className="text-primary-600 hover:underline">
              Privacy Policy
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
