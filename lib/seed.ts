import { supabase } from "./supabase";
import type { Lead } from "./types";

const SAMPLE_LEADS: Lead[] = [
  // ─── SaaS / Tech (5) ─────────────────────────────────────
  { id:"seed-1",name:"Jake Taylor",title:"CTO",company:"Loom",industry:"Internet",location:"San Francisco, CA",email:"jake@loom.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/jaketaylor",website:"loom.com",companySize:"201-500",score:89,source:"linkedin" },
  { id:"seed-2",name:"Emily Zhang",title:"Head of Sales",company:"Figma",industry:"Computer Software",location:"San Francisco, CA",email:"emily@figma.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/emilyzhang",website:"figma.com",companySize:"501-1000",score:93,source:"linkedin" },
  { id:"seed-3",name:"David Kim",title:"Founder & CEO",company:"Retool",industry:"Internet",location:"Austin, TX",email:"david@retool.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/davidkim",website:"retool.com",companySize:"201-500",score:96,source:"linkedin" },
  { id:"seed-4",name:"Amanda Foster",title:"VP Sales",company:"Airtable",industry:"Computer Software",location:"Los Angeles, CA",email:"amanda@airtable.com",emailStatus:"risky",linkedin:"https://linkedin.com/in/amandafoster",website:"airtable.com",companySize:"501-1000",score:82,source:"linkedin" },
  { id:"seed-5",name:"Chris Nakamura",title:"CMO",company:"Stripe",industry:"Financial Services",location:"Chicago, IL",email:"chris@stripe.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/chrisnakamura",website:"stripe.com",companySize:"1001-5000",score:88,source:"linkedin" },
  // ─── Founders (5) ─────────────────────────────────────────
  { id:"seed-6",name:"Sarah Chen",title:"Founder",company:"Notion Alt",industry:"Productivity",location:"Remote, US",email:"sarah@notionalt.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/sarahchen",website:"notionalt.com",companySize:"11-50",score:91,source:"linkedin" },
  { id:"seed-7",name:"Marcus Williams",title:"CEO",company:"AI Startup",industry:"Artificial Intelligence",location:"New York, NY",email:"marcus@aistartup.io",emailStatus:"verified",linkedin:"https://linkedin.com/in/marcuswilliams",website:"aistartup.io",companySize:"11-50",score:78,source:"linkedin" },
  { id:"seed-8",name:"Priya Sharma",title:"Co-Founder",company:"DevTools Co",industry:"Software Development",location:"Bangalore, IN",email:"priya@devtools.co",emailStatus:"risky",linkedin:"https://linkedin.com/in/priyasharma",website:"devtools.co",companySize:"11-50",score:85,source:"linkedin" },
  { id:"seed-9",name:"Alex Rodriguez",title:"Solo Founder",company:"MarTech SaaS",industry:"Marketing Technology",location:"Austin, TX",email:"alex@martechsaas.com",emailStatus:"not_found",linkedin:"https://linkedin.com/in/alexrodriguez",website:"martechsaas.com",companySize:"1-10",score:67,source:"linkedin" },
  { id:"seed-10",name:"Jordan Lee",title:"Founder & CTO",company:"Data Platform",industry:"Analytics",location:"Remote, US",email:"jordan@dataplatform.io",emailStatus:"verified",linkedin:"https://linkedin.com/in/jordanlee",website:"dataplatform.io",companySize:"51-200",score:94,source:"linkedin" },
  // ─── Agencies (5) ────────────────────────────────────────
  { id:"seed-11",name:"Rachel Kim",title:"Agency Director",company:"Growth Co",industry:"Marketing Agency",location:"New York, NY",email:"rachel@growthco.com",emailStatus:"verified",linkedin:"https://linkedin.com/in/rachelkim",website:"growthco.com",companySize:"11-50",score:87,source:"linkedin" },
  { id:"seed-12",name:"Tom Baker",title:"Head of Growth",company:"Performance",industry:"Digital Agency",location:"London, UK",email:"tom@performance.agency",emailStatus:"verified",linkedin:"https://linkedin.com/in/tombaker",website:"performance.agency",companySize:"11-50",score:72,source:"gmaps" },
  { id:"seed-13",name:"Nina Patel",title:"Consultant",company:"RevOps Firm",industry:"B2B Consulting",location:"Chicago, IL",email:"nina@revopsfirm.com",emailStatus:"risky",linkedin:"https://linkedin.com/in/ninapatel",website:"revopsfirm.com",companySize:"1-10",score:65,source:"gmaps" },
  { id:"seed-14",name:"Carlos Mendez",title:"Partner",company:"Creative Agency",industry:"Design Agency",location:"Miami, FL",email:"carlos@creativeagcy.com",emailStatus:"not_found",linkedin:"",website:"creativeagcy.com",companySize:"1-10",score:55,source:"gmaps" },
  { id:"seed-15",name:"Lisa Wong",title:"Director",company:"Content Studio",industry:"Content Marketing",location:"Seattle, WA",email:"lisa@contentstudio.com",emailStatus:"risky",linkedin:"https://linkedin.com/in/lisawong",website:"contentstudio.com",companySize:"11-50",score:38,source:"amazon" },
];

export async function seedIfEmpty(): Promise<boolean> {
  const { count, error } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  if (count && count > 0) return false;

  const now = new Date().toISOString();
  const rows = SAMPLE_LEADS.map(lead => ({
    id: lead.id,
    name: lead.name,
    title: lead.title,
    company: lead.company,
    industry: lead.industry,
    location: lead.location,
    email: lead.email,
    email_status: lead.emailStatus,
    linkedin: lead.linkedin,
    website: lead.website,
    company_size: lead.companySize,
    score: lead.score,
    source: lead.source,
    saved_at: now,
    fetched_at: now,
    tags: [],
  }));

  const { error: insertError } = await supabase.from("leads").upsert(rows, { onConflict: "id" });
  if (insertError) throw insertError;
  return true;
}
