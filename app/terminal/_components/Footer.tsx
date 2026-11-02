import { Volume2, Settings } from "lucide-react";

export function Footer() {
  return (
    <footer className="h-8 border-t border-border bg-background flex items-center gap-4 px-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-bull animate-pulse" />
        <span className="text-foreground/80">HashKey Chain · Onchain data live</span>
      </span>
      <span className="ml-auto flex items-center gap-4">
        <a className="hover:text-foreground" href="#">Terms</a>
        <a className="hover:text-foreground" href="#">Privacy</a>
        <a className="hover:text-foreground" href="#">Disclosures</a>
        <a className="hover:text-foreground" href="#">Help</a>
        <Settings className="h-3.5 w-3.5" />
        <Volume2 className="h-3.5 w-3.5" />
      </span>
    </footer>
  );
}
