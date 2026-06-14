import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  path: string | null | undefined;
  fallback?: string;
}

export function SignedImage({ path, fallback, className, alt = "", ...rest }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!path) { setUrl(null); return; }
    getSignedUrl(path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [path]);

  if (!url) {
    return (
      <div
        className={cn("bg-muted animate-pulse", className)}
        aria-label={alt}
      >
        {fallback && !path && (
          <img src={fallback} alt={alt} className={className} />
        )}
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} {...rest} />;
}
