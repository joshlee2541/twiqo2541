import { useEffect, useState } from "react";
import logoAsset from "@/assets/vibelink-logo.png.asset.json";

export function SplashScreen() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("vibelink-splash-shown")) return;
    setShow(true);
    const t = setTimeout(() => {
      sessionStorage.setItem("vibelink-splash-shown", "1");
      setShow(false);
    }, 1400);
    return () => clearTimeout(t);
  }, []);

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
