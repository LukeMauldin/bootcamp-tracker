import { useEffect, useState } from "react";

import { apiBlob } from "../lib/api";

export function PhotoPreview({ submissionId }: { readonly submissionId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    void apiBlob(`/api/submissions/photos/${submissionId}`).then((blob) => {
      if (!active) {
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [submissionId]);

  if (!url) {
    return <div className="h-28 rounded-lg border border-dashed border-gray-300 bg-slate-50" />;
  }

  return <img src={url} alt="" className="h-28 w-full rounded-lg object-cover" />;
}
