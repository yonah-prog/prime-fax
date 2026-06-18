export default function TermsPage() {
  const sections = [
    {
      title: "1. Acceptance of Terms",
      body: "By accessing or using CareTend Fax you agree to be bound by these Terms of Service. If you do not agree, do not use the service.",
    },
    {
      title: "2. HIPAA Compliance",
      body: "CareTend Fax is designed as a HIPAA-compliant fax platform. Users are responsible for ensuring their use of the service complies with all applicable federal and state privacy laws, including HIPAA. We sign Business Associate Agreements (BAAs) upon request.",
    },
    {
      title: "3. Acceptable Use",
      body: "You may not use CareTend Fax to send unsolicited faxes (fax spam), transmit illegal content, or violate any applicable laws. Accounts found to be sending spam will be suspended immediately.",
    },
    {
      title: "4. Data Retention",
      body: "Fax records and transmitted documents are retained for a period determined by your account plan. You are responsible for maintaining copies of documents required for regulatory compliance beyond this retention period.",
    },
    {
      title: "5. Service Availability",
      body: "We strive for 99.9% uptime but do not guarantee uninterrupted service. Scheduled maintenance will be communicated in advance when possible. We are not liable for transmission failures caused by third-party carrier issues.",
    },
    {
      title: "6. Account Security",
      body: "You are responsible for maintaining the confidentiality of your account credentials. Notify us immediately at support@caretend.com if you suspect unauthorized access to your account.",
    },
    {
      title: "7. Limitation of Liability",
      body: "CareTend Fax shall not be liable for any indirect, incidental, or consequential damages arising from use of the service. Our total liability shall not exceed the fees paid in the prior 3 months.",
    },
    {
      title: "8. Changes to Terms",
      body: "We reserve the right to update these terms at any time. Continued use of the service after changes are posted constitutes acceptance of the updated terms. We will notify users of material changes by email.",
    },
  ]

  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline gap-3 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Terms of Service</h1>
        <span className="text-sm text-gray-400 border-l border-gray-200 pl-3">Last updated June 2026</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {sections.map((s) => (
          <div key={s.title} className="px-6 py-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1.5">{s.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-4 text-center">
        Questions? Contact us at <span className="text-blue-600">support@caretend.com</span>
      </p>
    </div>
  )
}
