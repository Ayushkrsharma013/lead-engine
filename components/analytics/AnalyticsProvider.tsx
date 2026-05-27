"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   AnalyticsProvider — Conditionally injects 5 trackers
   ───────────────────────────────────────────────────────────────────────────
   Tags only render when their NEXT_PUBLIC_* env var is present. Missing vars
   render NOTHING — no console warnings.

   Consent gating:
   - GA4, Meta Pixel, LinkedIn Insight Tag → require consent === "accepted"
     (non-EU users auto-accept via CookieConsent, so they always fire)
   - PostHog, Clarity → fire regardless (already privacy-friendly EU servers)

   SSR-safe: state is initialized empty; consent is read inside useEffect.
   Re-renders when "ff-consent-change" CustomEvent fires.
   ═══════════════════════════════════════════════════════════════════════════ */

import Script from "next/script";
import { useEffect, useState } from "react";
import { getStoredConsent, type ConsentValue } from "./CookieConsent";

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID || "";
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const LINKEDIN_PARTNER_ID = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID || "";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || "";
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export default function AnalyticsProvider() {
  const [consent, setConsent] = useState<ConsentValue | null>(null);

  useEffect(() => {
    setConsent(getStoredConsent());
    const onChange = (e: Event) => {
      const ce = e as CustomEvent<ConsentValue>;
      if (ce.detail === "accepted" || ce.detail === "declined") {
        setConsent(ce.detail);
      }
    };
    window.addEventListener("ff-consent-change", onChange);
    return () => window.removeEventListener("ff-consent-change", onChange);
  }, []);

  const consented = consent === "accepted";

  return (
    <>
      {/* ──────────── GA4 ──────────── */}
      {GA4_ID && consented && (
        <>
          <Script
            id="ga4-loader"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA4_ID}', { send_page_view: true });
            `}
          </Script>
        </>
      )}

      {/* ──────────── Meta Pixel ──────────── */}
      {META_PIXEL_ID && consented && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window,document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}

      {/* ──────────── LinkedIn Insight Tag ──────────── */}
      {LINKEDIN_PARTNER_ID && consented && (
        <Script id="linkedin-insight" strategy="afterInteractive">
          {`
            _linkedin_partner_id = "${LINKEDIN_PARTNER_ID}";
            window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
            window._linkedin_data_partner_ids.push(_linkedin_partner_id);
            (function(l) {
              if (!l){window.lintrk = function(a,b){window.lintrk.q.push([a,b])};
              window.lintrk.q=[];}
              var s = document.getElementsByTagName("script")[0];
              var b = document.createElement("script");
              b.type = "text/javascript"; b.async = true;
              b.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
              s.parentNode.insertBefore(b, s);
            })(window.lintrk);
          `}
        </Script>
      )}

      {/* ──────────── PostHog (no consent gate — privacy-friendly) ──────────── */}
      {POSTHOG_KEY && (
        <Script id="posthog-init" strategy="afterInteractive">
          {`
            !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
            posthog.init('${POSTHOG_KEY}', { api_host: '${POSTHOG_HOST}', capture_pageview: true, autocapture: true });
          `}
        </Script>
      )}

      {/* ──────────── Microsoft Clarity (no consent gate) ──────────── */}
      {CLARITY_ID && (
        <Script id="clarity-init" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_ID}");
          `}
        </Script>
      )}
    </>
  );
}
