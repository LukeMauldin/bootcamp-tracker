import type { SubmissionStatus } from "@bootcamp/shared/types";

const styles: Record<SubmissionStatus, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  verified: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  rejected: "bg-red-50 text-red-700 ring-red-200"
};

export function StatusPill({ status }: { readonly status: SubmissionStatus }) {
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ${styles[status]}`}>{status}</span>;
}
