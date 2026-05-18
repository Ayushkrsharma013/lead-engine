export const landingNavItems = [
  { href: "#features", name: "Features" },
  { href: "#pricing", name: "Pricing" },
  { href: "#faq", name: "FAQ" },
  { href: "/blog", name: "Blog" },
] as const;

export type NavItem = (typeof landingNavItems)[number];
