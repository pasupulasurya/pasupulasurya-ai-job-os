import type { ReactNode } from "react";

export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-8">
      <header className="md:col-span-4">
        <h2 className="text-text-primary text-sm font-medium">{title}</h2>
        {description && <p className="text-text-tertiary mt-1 text-xs">{description}</p>}
      </header>
      <div className="md:col-span-8">{children}</div>
    </section>
  );
}
