import { ToneBadge } from "@/components/messages/tone-badge";

interface MessagePreviewProps {
  subject: string;
  body: string;
  contactName?: string;
  contactEmail?: string;
  tone: string;
  variantLabel?: string | null;
}

export function MessagePreview({
  subject,
  body,
  contactName,
  contactEmail,
  tone,
  variantLabel,
}: MessagePreviewProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Email header */}
      <div className="border-b border-gray-200 bg-gray-50/80 px-6 py-4">
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="w-16 flex-shrink-0 font-medium text-gray-500">
              From:
            </span>
            <span className="text-gray-900">
              SalesPilot &lt;outreach@clubconcierge.com&gt;
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-16 flex-shrink-0 font-medium text-gray-500">
              To:
            </span>
            <span className="text-gray-900">
              {contactName ? (
                <>
                  {contactName}{" "}
                  {contactEmail && (
                    <span className="text-gray-500">
                      &lt;{contactEmail}&gt;
                    </span>
                  )}
                </>
              ) : (
                contactEmail ?? (
                  <span className="text-gray-400">No recipient</span>
                )
              )}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-16 flex-shrink-0 font-medium text-gray-500">
              Subject:
            </span>
            <span className="font-semibold text-gray-900">{subject}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <ToneBadge tone={tone} />
          {variantLabel && (
            <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
              {variantLabel}
            </span>
          )}
        </div>
      </div>

      {/* Email body */}
      <div className="px-6 py-5">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
          {body}
        </div>
      </div>

      {/* Signature */}
      <div className="border-t border-gray-100 px-6 py-4">
        <div className="text-xs text-gray-400">
          <p className="font-medium text-gray-500">Best regards,</p>
          <p className="mt-1">SalesPilot</p>
          <p>Corporate Travel Solutions</p>
          <p>www.clubconcierge.com</p>
        </div>
      </div>
    </div>
  );
}
