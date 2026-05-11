import { useEffect, useState } from "react";

import { apiGet } from "../lib/api";

export function PhotoPreview({ submissionId }: { readonly submissionId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiGet<{ url: string }>(`/api/submissions/photos/${submissionId}`).then((payload) => {
      if (active) {
        setUrl(payload.url);
      }
    });
    return () => {
      active = false;
    };
  }, [submissionId]);

  if (!url) {
    return <div className="h-28 rounded-lg border border-dashed border-gray-300 bg-slate-50" />;
  }

  return <img src={url} alt="" className="h-28 w-full rounded-lg object-cover" />;
}
