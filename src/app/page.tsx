export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-2xl space-y-12 text-center">
        <div className="space-y-4">
          <div className="text-text-tertiary text-sm tracking-wider uppercase">AI Job OS</div>
          <h1 className="text-text-primary text-4xl font-semibold tracking-tight">
            Hunt deliberately.
          </h1>
          <p className="text-md text-text-secondary mx-auto max-w-md leading-relaxed">
            An operating system for your job search. Continuously scraping, intelligently matching,
            and tailoring — with you in the loop.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button className="bg-accent text-accent-foreground hover:bg-accent-hover rounded-md px-6 py-3 font-medium transition-colors">
            Get started
          </button>
          <button className="border-border-strong text-text-primary hover:bg-card rounded-md border px-6 py-3 font-medium transition-colors">
            Learn more
          </button>
        </div>

        <div className="border-border space-y-3 border-t pt-16">
          <div className="text-text-tertiary text-xs tracking-wider uppercase">
            Design system verified
          </div>
          <div className="text-text-tertiary text-sm">
            Press{" "}
            <kbd className="bg-card border-border text-text-secondary rounded-md border px-2 py-1 font-mono text-xs">
              ⌘ K
            </kbd>{" "}
            to open the command palette
          </div>
        </div>
      </div>
    </main>
  );
}
