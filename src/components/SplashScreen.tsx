import { useEffect, useState } from "react";
import logoAsset from "@/assets/vibelink-logo.png.asset.json";

export function SplashScreen() {
  const [show, setShow] = useState(() => {
    if (typeof window === "undefined") return false;
    return !sessionStorage.getItem("vibelink-splash-shown");
  });

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      sessionStorage.setItem("vibelink-splash-shown", "1");
      setShow(false);
    }, 1400);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-between py-16 animate-in fade-in">
      <div className="flex-1" />
      <div className="flex flex-col items-center">
        <img src={logoAsset.url} alt="VibeLink" className="w-56 max-w-[70vw] object-contain" />
      </div>
      <div className="text-xs text-muted-foreground">
        from <span className="font-semibold text-foreground">Lee Tech</span>
      </div>
    </div>
  );
}
