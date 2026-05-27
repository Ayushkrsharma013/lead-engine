// JSON-LD Schema builders for SEO/AEO/AGO
// All builders return plain objects suitable for JSON.stringify()
// CRITICAL: do not include fake reviews, fake aggregateRating, or fabricated ratingCount.

import { PLANS, type PlanKey } from "@/lib/stripe";

const SITE_URL = "https://app.flow-forges.com/prospecting-os";
const ORG_URL = "https://flow-forges.com";
const LOGO_URL = "https://app.flow-forges.com/prospecting-os/assets/Logo_Icon.png";
const ORG_NAME = "Flow-Forges";
const FOUNDER_NAME = "Ayush Kumar Sharma";
const CONTACT_EMAIL = "hello@flow-forges.com";
const FOUNDED = "2025";

export type JsonLdData = Record<string, unknown>;

/* ── Organization ─────────────────────────────────────────────────────────── */

export function organizationSchema(): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${ORG_URL}#organization`,
    name: ORG_NAME,
    url: ORG_URL,
    logo: LOGO_URL,
    foundingDate: FOUNDED,
    founder: {
      "@type": "Person",
      name: FOUNDER_NAME,
    },
    email: CONTACT_EMAIL,
    sameAs: [SITE_URL],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      url: `${SITE_URL}/book`,
      email: CONTACT_EMAIL,
      areaServed: "Worldwide",
      availableLanguage: "English",
    },
  };
}

/* ── Website ──────────────────────────────────────────────────────────────── */

export function websiteSchema(): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}#website`,
    url: SITE_URL,
    name: "Prospecting OS",
    description:
      "AI-powered B2B lead generation. 100-500 ICP-verified leads/month delivered with personalized icebreakers.",
    publisher: { "@id": `${ORG_URL}#organization` },
    inLanguage: "en-US",
  };
}

/* ── SoftwareApplication (Prospecting OS) ─────────────────────────────────── */

export function softwareAppSchema(): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}#software`,
    name: "Prospecting OS",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "LeadGeneration",
    operatingSystem: "Web",
    url: SITE_URL,
    description:
      "Prospecting OS is an AI-powered B2B lead generation system. Apify scrapers source leads, Anthropic Claude AI scores and writes icebreakers, and 100-500 qualified leads are delivered to Slack, Telegram, or your CRM every morning.",
    provider: { "@id": `${ORG_URL}#organization` },
    creator: {
      "@type": "Person",
      name: FOUNDER_NAME,
    },
    offers: (Object.keys(PLANS) as PlanKey[]).map((plan) => offerSchema(plan)),
  };
}

/* ── Offer (per plan) ─────────────────────────────────────────────────────── */

export function offerSchema(plan: PlanKey): JsonLdData {
  const p = PLANS[plan];
  if (!p) {
    return {
      "@context": "https://schema.org",
      "@type": "Offer",
      name: "Unknown plan",
      price: "0",
      priceCurrency: "USD",
    };
  }

  // Micro is one-time; the others have a setup + recurring monthly.
  if (plan === "micro") {
    return {
      "@context": "https://schema.org",
      "@type": "Offer",
      name: p.name,
      url: `${SITE_URL}/#pricing`,
      price: String(p.setupAmount),
      priceCurrency: "USD",
      priceSpecification: {
        "@type": "PriceSpecification",
        price: String(p.setupAmount),
        priceCurrency: "USD",
        valueAddedTaxIncluded: false,
      },
      eligibleRegion: "Worldwide",
      availability: "https://schema.org/InStock",
      description: p.features.join(" · "),
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: p.name,
    url: `${SITE_URL}/#pricing`,
    price: String(p.setupAmount),
    priceCurrency: "USD",
    priceSpecification: [
      {
        "@type": "UnitPriceSpecification",
        name: "Setup",
        price: String(p.setupAmount),
        priceCurrency: "USD",
      },
      {
        "@type": "UnitPriceSpecification",
        name: "Monthly",
        price: String(p.monthlyAmount),
        priceCurrency: "USD",
        billingIncrement: 1,
        unitCode: "MON",
      },
    ],
    eligibleRegion: "Worldwide",
    availability: "https://schema.org/InStock",
    description: p.features.join(" · "),
  };
}

/* ── FAQ ──────────────────────────────────────────────────────────────────── */

export function faqSchema(items: Array<{ q: string; a: string }>): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

/* ── Breadcrumb ───────────────────────────────────────────────────────────── */

export function breadcrumbSchema(
  items: Array<{ name: string; url: string }>
): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/* ── Person (founder) ─────────────────────────────────────────────────────── */

export function personSchema(): JsonLdData {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/about#founder`,
    name: FOUNDER_NAME,
    url: `${SITE_URL}/about`,
    jobTitle: "Founder",
    worksFor: { "@id": `${ORG_URL}#organization` },
    knowsAbout: [
      "B2B lead generation",
      "AI-powered prospecting",
      "Sales development automation",
      "Apify lead scraping",
      "Anthropic Claude AI",
    ],
  };
}
