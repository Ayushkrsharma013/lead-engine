import { Star } from "lucide-react";

interface TestimonialCard {
  quote: string;
  author: string;
  role?: string;
  company?: string;
  earlyAccess?: boolean;
}

const testimonials: TestimonialCard[] = [
  {
    quote: "We're an early-stage product built by operators who've been in the trenches of B2B sales. Our first users are getting 40-60 qualified leads per batch — real results from real outreach.",
    author: "Ayush Kumar Sharma",
    role: "Founder",
    company: "Flow-Forges",
    earlyAccess: true,
  },
  {
    quote: "Your results may vary. Every ICP is different — some get 80 leads, some get 30. We optimize until it works.",
    author: "Early Access Partner",
    company: "B2B SaaS",
  },
  {
    quote: "We're looking for 10 early clients to shape the product. If you're a founder who needs leads, let's talk. Honest feedback in exchange for a steep discount.",
    author: "Early Access Partner",
    company: "Tech Startup",
  },
];

export default function Testimonials() {
  return (
    <section
      className="py-24 px-6"
      style={{ background: "var(--surface, #0a0a0a)" }}
      aria-labelledby="testimonials-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2
            id="testimonials-heading"
            className="text-[28px] md:text-[36px] font-bold tracking-[-0.02em] mb-3"
            style={{ color: "var(--ink, #f5f4f1)" }}
          >
            What Early Users Say
          </h2>
          <p
            className="text-[15px] max-w-xl mx-auto"
            style={{ color: "var(--ink-3, #808080)" }}
          >
            Honest feedback from our first partners. No fake reviews, no stock photos.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <article
              key={i}
              className="rounded-2xl p-6 relative flex flex-col"
              style={{
                background: "var(--surface-2, #0E0E0E)",
                border: "1px solid var(--line, rgba(255,255,255,0.06))",
              }}
            >
              {t.earlyAccess && (
                <span
                  className="inline-flex self-start px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.06em] mb-4"
                  style={{
                    background: "rgba(232,168,64,0.10)",
                    color: "var(--accent, #E8A840)",
                    border: "1px solid rgba(232,168,64,0.20)",
                  }}
                >
                  Early Access
                </span>
              )}

              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star
                    key={s}
                    size={13}
                    fill="var(--accent, #E8A840)"
                    stroke="none"
                  />
                ))}
              </div>

              <blockquote
                className="text-[14px] leading-relaxed mb-6 flex-1"
                style={{ color: "var(--ink-2, #B0B0B0)" }}
              >
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              <footer className="pt-4 border-t" style={{ borderColor: "var(--line, rgba(255,255,255,0.06))" }}>
                <p className="text-[13px] font-semibold" style={{ color: "var(--ink, #f5f4f1)" }}>
                  {t.author}
                </p>
                {(t.role || t.company) && (
                  <p className="text-[12px]" style={{ color: "var(--ink-3, #808080)" }}>
                    {[t.role, t.company].filter(Boolean).join(" · ")}
                  </p>
                )}
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
