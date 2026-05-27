// Server component — renders a JSON-LD <script> tag.
// No "use client" — must run on the server so search engines & LLM crawlers
// see the JSON-LD without executing JavaScript.

import type { JsonLdData } from "@/lib/seo/schema";

interface JsonLdProps {
  data: JsonLdData | JsonLdData[];
  id?: string;
}

export default function JsonLd({ data, id }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      id={id}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
    />
  );
}
