import type { LucideIcon } from "lucide-react";

export function FeatureCard({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: string;
}) {
  return (
    <article className="group rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition duration-300 hover:-translate-y-1 hover:border-primary/35 hover:bg-white/[0.055] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </article>
  );
}
