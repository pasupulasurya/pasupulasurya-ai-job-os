import { ProductDemo } from "./product-demo";

export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-24">
      {/* Ambient depth — faint accent glow behind the composition */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[120px]"
        style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
        <div className="text-text-tertiary mb-6 text-xs font-medium tracking-[0.2em] uppercase">
          AI Job OS
        </div>

        <h1 className="text-text-primary text-5xl font-bold tracking-[-0.03em] sm:text-7xl">
          Stop scrolling job boards.
          <br />
          <span className="text-accent">Start getting matched.</span>
        </h1>

        <p className="text-text-secondary mt-6 max-w-xl text-base leading-relaxed sm:text-lg">
          We watch 100+ companies verified against federal H-1B records, read every posting with AI,
          and score each one against you — so you apply to the right roles, not all of them.
        </p>

        {/* Live product-loop demo */}
        <ProductDemo />
      </div>
    </section>
  );
}
