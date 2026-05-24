export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
      <div className="max-w-2xl w-full space-y-12 text-center">
        <div className="space-y-4">
          <div className="text-sm text-text-tertiary uppercase tracking-wider">
            AI Job OS
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-text-primary">
            Hunt deliberately.
          </h1>
          <p className="text-md text-text-secondary leading-relaxed max-w-md mx-auto">
            An operating system for your job search. Continuously scraping,
            intelligently matching, and tailoring — with you in the loop.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button className="px-6 py-3 rounded-md bg-accent text-accent-foreground font-medium hover:bg-accent-hover transition-colors">
            Get started
          </button>
          <button className="px-6 py-3 rounded-md border border-border-strong text-text-primary font-medium hover:bg-card transition-colors">
            Learn more
          </button>
        </div>

        <div className="pt-16 border-t border-border">
          <div className="text-xs text-text-tertiary uppercase tracking-wider">
            Design system verified
          </div>
        </div>
      </div>
    </main>
  );
}
