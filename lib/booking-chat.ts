/* ─── Conversational Booking Engine ─────────────────────────────────────── */

export type BookingStep =
  | "idle"
  | "collecting_name"
  | "collecting_company"
  | "collecting_email"
  | "collecting_datetime"
  | "confirming"
  | "done";

export interface BookingData {
  name: string;
  company: string;
  email: string;
  date: string;
  time: string;
}

export interface BotMessage {
  text: string;
  quickReplies?: string[];
}

export function isBookingQuery(msg: string): boolean {
  const m = msg.toLowerCase().trim();
  return (
    m.includes("book a demo") ||
    m.includes("schedule") ||
    m.includes("demo") ||
    m.includes("appointment") ||
    m.includes("book demo")
  );
}

export function initialBookingState(): {
  step: BookingStep;
  data: Partial<BookingData>;
} {
  return { step: "idle", data: {} };
}

export function getNextStep(
  step: BookingStep,
  data: Partial<BookingData>,
  userInput: string
): {
  step: BookingStep;
  data: Partial<BookingData>;
  botMessage: BotMessage;
} {
  const input = userInput.trim();

  switch (step) {
    /* ─── Idle → Start booking ──────────────────────────────────────── */
    case "idle": {
      if (isBookingQuery(input)) {
        return {
          step: "collecting_name",
          data,
          botMessage: {
            text: "Awesome — let's get your demo booked! First, what's your full name?",
            quickReplies: [],
          },
        };
      }
      // General response
      return {
        step: "idle",
        data,
        botMessage: {
          text: getGeneralResponse(input),
          quickReplies: ["How it works", "Pricing", "Book a Demo", "Go-live time"],
        },
      };
    }

    /* ─── Collect name ──────────────────────────────────────────────── */
    case "collecting_name": {
      const next = { ...data, name: input };
      return {
        step: "collecting_company",
        data: next,
        botMessage: {
          text: `Nice to meet you, ${input.split(" ")[0]}! What company are you with?`,
          quickReplies: [],
        },
      };
    }

    /* ─── Collect company ───────────────────────────────────────────── */
    case "collecting_company": {
      const next = { ...data, company: input };
      return {
        step: "collecting_email",
        data: next,
        botMessage: {
          text: `Got it — ${input}. What's your work email? We'll send the calendar invite there.`,
          quickReplies: [],
        },
      };
    }

    /* ─── Collect email ─────────────────────────────────────────────── */
    case "collecting_email": {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)) {
        return {
          step: "collecting_email",
          data,
          botMessage: {
            text: "That doesn't look like a valid email. Can you double-check it?",
          },
        };
      }
      const next = { ...data, email: input };
      return {
        step: "collecting_datetime",
        data: next,
        botMessage: {
          text: "Perfect. Now, when works best for a 20-minute demo? Pick a date and time from the ones below — or type your preference.",
          quickReplies: getTimeQuickReplies(),
        },
      };
    }

    /* ─── Collect date/time ─────────────────────────────────────────── */
    case "collecting_datetime": {
      const timeMatch = input.match(/(\d{1,2}:\d{2})/);
      const dateMatch = input.match(/(\d{4}-\d{2}-\d{2})/);
      if (!timeMatch && !dateMatch) {
        return {
          step: "collecting_datetime",
          data,
          botMessage: {
            text: "Could you share a specific date and time? For example: 'May 20 at 10:30 AM' or pick one from the options.",
            quickReplies: getTimeQuickReplies(),
          },
        };
      }
      const next = {
        ...data,
        date: dateMatch ? dateMatch[0] : "Flexible",
        time: timeMatch ? timeMatch[0] : "Flexible",
      };
      return {
        step: "confirming",
        data: next,
        botMessage: {
          text: `Here's a quick summary:\n\n• **Name:** ${next.name}\n• **Company:** ${next.company}\n• **Email:** ${next.email}\n• **When:** ${next.date} at ${next.time}\n\nEverything look good?`,
          quickReplies: ["Yes, confirm", "No, change something"],
        },
      };
    }

    /* ─── Confirm ───────────────────────────────────────────────────── */
    case "confirming": {
      if (input.toLowerCase().includes("yes") || input.toLowerCase().includes("confirm")) {
        return {
          step: "done",
          data,
          botMessage: {
            text: `You're all set, ${data.name?.split(" ")[0]}! A calendar invite has been sent to **${data.email}**. We'll see you on ${data.date} at ${data.time} for your demo. In the meantime, explore the platform!`,
            quickReplies: ["Explore Platform", "How it works"],
          },
        };
      }
      // Restart
      return {
        step: "collecting_name",
        data: {},
        botMessage: {
          text: "No problem — let's start over. What's your full name?",
          quickReplies: [],
        },
      };
    }

    /* ─── Done ──────────────────────────────────────────────────────── */
    case "done": {
      return {
        step: "done",
        data,
        botMessage: {
          text: "Is there anything else I can help with?",
          quickReplies: ["How it works", "Pricing", "Go-live time"],
        },
      };
    }

    default:
      return { step: "idle", data, botMessage: { text: "How can I help?" } };
  }
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function getGeneralResponse(msg: string): string {
  const m = msg.toLowerCase().trim();
  if (m.includes("how it works") || m.includes("how does it"))
    return "1. Source leads via Sales Navigator\n2. Filter decision-makers only\n3. Score with AI (1–10 scale)\n4. Enrich with company context\n5. Deliver to your inbox daily\n\nWant a demo? Just say \"Book a Demo\"!";
  if (m.includes("pricing") || m.includes("price") || m.includes("cost"))
    return "**Basic:** $2,500 (one-time)\n**Pro:** $3,500/month (most popular)\n**Advanced:** $10K+/month\n\nWhich interests you?";
  if (m.includes("go-live") || m.includes("timeline"))
    return "Basic: ~4–6 hours\nPro: 2–3 days\nAdvanced: 1–2 weeks\n\nMost clients are live within the first week!";
  if (m.includes("guarantee") || m.includes("risk"))
    return "No 50 qualified leads on Pro in month 1? Month 2 is free. We'll refine your ICP at no cost.";
  if (m.includes("sales navigator") || m.includes("linkedin"))
    return "Yes — Sales Navigator ($99/mo) powers the pipeline. We'll help configure your filters during onboarding.";
  if (m.includes("explore") || m.includes("platform"))
    return "You're on the platform right now! Scroll up to see how Prospecting OS finds 500+ scored leads every month — or check out the pricing section.";
  return "I'm Pros Bot — your AI assistant. Ask me about:\n\n• How the platform works\n• Pricing plans\n• Go-live timelines\n\nOr say **\"Book a Demo\"** and I'll get you scheduled!";
}

function getTimeQuickReplies(): string[] {
  return [
    "Tomorrow 10:00 AM",
    "Tomorrow 2:00 PM",
    "This Friday 11:00 AM",
    "Next Monday 9:00 AM",
    "Pick another time",
  ];
}
