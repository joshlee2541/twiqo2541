import { useEffect, useState } from "react";

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
      <div className="flex flex-col items-center gap-5">
        <img
          src="/icons/icon-512.png"
          alt="Twiqo"
          width={96}
          height={96}
          loading="eager"
          className="h-24 w-24 rounded-[24%] shadow-xl shadow-primary/20"
        />
        <h1 className="twiqo-logo text-5xl">Twiqo</h1>
      </div>
      <div className="text-xs text-muted-foreground">
        from <span className="font-semibold text-foreground">Lee Tech</span>
      </div>
    </div>
  );
}
