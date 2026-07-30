import { useState } from "react";

/** Instagram-style collapsed caption with "... more" / "Show less". */
export function Caption({ text, limit = 125, prefix }: { text: string; limit?: number; prefix?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const long = text.length > limit;
  const shown = !long || open ? text : text.slice(0, limit).trimEnd();

  return (
    <p className="text-sm mt-1 whitespace-pre-wrap break-words">
      {prefix}
      {shown}
      {long && !open && (
        <>
          {"… "}
          <button onClick={() => setOpen(true)} className="text-muted-foreground font-medium">
            more
          </button>
        </>
      )}
      {long && open && (
        <>
          {" "}
          <button onClick={() => setOpen(false)} className="text-muted-foreground font-medium">
            Show less
          </button>
        </>
      )}
    </p>
  );
}
