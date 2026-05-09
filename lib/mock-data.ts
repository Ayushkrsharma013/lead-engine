import { Lead } from "./types";

export const MOCK_LINKEDIN: Lead[] = [
  { id:"l1", name:"Sarah Chen", title:"VP of Marketing", company:"Notion Labs", industry:"Computer Software", location:"San Francisco, CA", email:"sarah.chen@notion.so", emailStatus:"verified", linkedin:"https://linkedin.com/in/sarahchen", website:"notion.so", companySize:"51-200", score:94, source:"linkedin" },
  { id:"l2", name:"Marcus Rivera", title:"CEO & Co-Founder", company:"Linear", industry:"Internet", location:"San Francisco, CA", email:"marcus@linear.app", emailStatus:"verified", linkedin:"https://linkedin.com/in/marcusrivera", website:"linear.app", companySize:"11-50", score:97, source:"linkedin" },
  { id:"l3", name:"Priya Patel", title:"Director of Growth", company:"Vercel", industry:"Computer Software", location:"Remote, US", email:"priya.patel@vercel.com", emailStatus:"verified", linkedin:"https://linkedin.com/in/priyapatel", website:"vercel.com", companySize:"201-500", score:91, source:"linkedin" },
  { id:"l4", name:"Jake Thompson", title:"CTO", company:"Loom", industry:"Internet", location:"San Francisco, CA", email:"jake@loom.com", emailStatus:"verified", linkedin:"https://linkedin.com/in/jakethompson", website:"loom.com", companySize:"51-200", score:89, source:"linkedin" },
  { id:"l5", name:"Emily Zhang", title:"Head of Sales", company:"Figma", industry:"Computer Software", location:"New York, NY", email:"emily.zhang@figma.com", emailStatus:"verified", linkedin:"https://linkedin.com/in/emilyzhang", website:"figma.com", companySize:"201-500", score:93, source:"linkedin" },
  { id:"l6", name:"David Kim", title:"Founder & CEO", company:"Retool", industry:"Internet", location:"San Francisco, CA", email:"david@retool.com", emailStatus:"verified", linkedin:"https://linkedin.com/in/davidkim", website:"retool.com", companySize:"51-200", score:96, source:"linkedin" },
  { id:"l7", name:"Amanda Foster", title:"VP Sales", company:"Airtable", industry:"Computer Software", location:"Austin, TX", email:"amanda.foster@airtable.com", emailStatus:"risky", linkedin:"https://linkedin.com/in/amandafoster", website:"airtable.com", companySize:"201-500", score:82, source:"linkedin" },
  { id:"l8", name:"Chris Nakamura", title:"CMO", company:"Stripe", industry:"Financial Services", location:"San Francisco, CA", email:"chris@stripe.com", emailStatus:"verified", linkedin:"https://linkedin.com/in/chrisnakamura", website:"stripe.com", companySize:"501-1000", score:88, source:"linkedin" },
  { id:"l9", name:"Sofia Martinez", title:"Director of Marketing", company:"Segment", industry:"Computer Software", location:"Remote, US", email:"sofia@segment.com", emailStatus:"verified", linkedin:"https://linkedin.com/in/sofiamartinez", website:"segment.com", companySize:"201-500", score:85, source:"linkedin" },
  { id:"l10", name:"Ryan Brooks", title:"Co-Founder", company:"Webflow", industry:"Internet", location:"San Francisco, CA", email:"ryan@webflow.com", emailStatus:"verified", linkedin:"https://linkedin.com/in/ryanbrooks", website:"webflow.com", companySize:"201-500", score:95, source:"linkedin" },
];

export const MOCK_GMAPS: Lead[] = [
  { id:"g1", name:"James Wilson", title:"Owner", company:"TechServ Solutions", industry:"IT Services", location:"Austin, TX", email:"james@techserv.io", emailStatus:"verified", linkedin:"", website:"techserv.io", companySize:"11-50", score:78, source:"gmaps" },
  { id:"g2", name:"Linda Park", title:"Director", company:"CloudWave Consulting", industry:"Management Consulting", location:"Seattle, WA", email:"linda@cloudwave.co", emailStatus:"risky", linkedin:"", website:"cloudwave.co", companySize:"11-50", score:72, source:"gmaps" },
  { id:"g3", name:"Tom Baker", title:"CEO", company:"Digital Bridge", industry:"Internet", location:"Denver, CO", email:"tom@digitalbridge.io", emailStatus:"verified", linkedin:"", website:"digitalbridge.io", companySize:"2-10", score:81, source:"gmaps" },
];

export const MOCK_AMAZON: Lead[] = [
  { id:"a1", name:"Kelly Nguyen", title:"Head of E-commerce", company:"ShopMate", industry:"Retail", location:"Los Angeles, CA", email:"kelly@shopmate.com", emailStatus:"verified", linkedin:"", website:"shopmate.com", companySize:"11-50", score:76, source:"amazon" },
  { id:"a2", name:"Derek Stone", title:"Founder", company:"PrivateLabel Pro", industry:"E-commerce", location:"Miami, FL", email:"derek@privatelabelpro.com", emailStatus:"not_found", linkedin:"", website:"privatelabelpro.com", companySize:"2-10", score:65, source:"amazon" },
  { id:"a3", name:"Zoe Adams", title:"VP Operations", company:"FulfillmentOne", industry:"Logistics", location:"Chicago, IL", email:"zoe@fulfillmentone.com", emailStatus:"verified", linkedin:"", website:"fulfillmentone.com", companySize:"51-200", score:84, source:"amazon" },
];

export const LOG_STEPS: Record<string, Array<{ text: string; type: "info"|"success"|"warn" }>> = {
  linkedin: [
    { text: "Initializing Apify actor x_guru/Leads-Scraper-apollo-zoominfo", type: "info" },
    { text: "Applying filters: US · SaaS · B2B · verified emails", type: "info" },
    { text: "Querying 300M+ contact database...", type: "info" },
    { text: "Fetching page 1/4 — 50 profiles", type: "info" },
    { text: "Fetching page 2/4 — 100 profiles", type: "info" },
    { text: "Fetching page 3/4 — 150 profiles", type: "info" },
    { text: "Fetching page 4/4 — 200 profiles", type: "info" },
    { text: "Enriching with Hunter.io email verification...", type: "info" },
    { text: "Scoring leads by ICP relevance...", type: "info" },
    { text: "✓ 200 qualified leads ready • 86% email coverage", type: "success" },
  ],
  gmaps: [
    { text: "Launching Google Maps scraper actor...", type: "info" },
    { text: "Searching keyword: 'tech startups [location]'", type: "info" },
    { text: "Extracting business profiles...", type: "info" },
    { text: "Cross-referencing with LinkedIn data...", type: "info" },
    { text: "✓ 3 businesses scraped with contact info", type: "success" },
  ],
  amazon: [
    { text: "Scanning Amazon Seller Central profiles...", type: "info" },
    { text: "Filtering by category & revenue signals...", type: "info" },
    { text: "Resolving contact emails via Hunter.io...", type: "info" },
    { text: "✓ 3 Amazon sellers qualified", type: "success" },
  ],
};
