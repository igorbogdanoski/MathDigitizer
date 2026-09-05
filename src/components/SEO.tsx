import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SITE_NAME, composeTitle } from '../lib/seoHtml';

type JsonLdPayload = Record<string, unknown>;

interface HreflangAlternate {
  lang: string;
  href: string;
}

interface SEOProps {
  title: string;
  description?: string;
  keywords?: string;
  type?: string;
  canonical?: string;
  noindex?: boolean;
  image?: string;
  siteName?: string;
  locale?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  structuredData?: JsonLdPayload | JsonLdPayload[];
  hreflangAlternates?: HreflangAlternate[];
}

export const SEO: React.FC<SEOProps> = ({
  title,
  description = "MathDigitizer Pro - Напредна AI Едукација на македонски јазик.",
  keywords = "математика, образование, AI тутор, генератор на задачи",
  type = "website",
  canonical,
  noindex = false,
  image = '/og/default.png',
  siteName = 'MathDigitizer Pro',
  locale = 'mk_MK',
  twitterCard = 'summary_large_image',
  structuredData,
  hreflangAlternates
}) => {
  // Composed by the shared helper, not here: the build-time prerender uses the
  // same function, so the served <title> and the rendered one cannot drift.
  const siteTitle = siteName === SITE_NAME ? composeTitle(title) : `${title} | ${siteName}`;
  const canonicalHref = canonical && typeof window !== 'undefined'
    ? new URL(canonical, window.location.origin).toString()
    : canonical;
  const ogImage = image && typeof window !== 'undefined'
    ? new URL(image, window.location.origin).toString()
    : image;
  const robotsContent = noindex
    ? 'noindex,nofollow,max-snippet:-1,max-image-preview:none,max-video-preview:-1'
    : 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1';
  const jsonLdBlocks = Array.isArray(structuredData)
    ? structuredData
    : structuredData
      ? [structuredData]
      : [];

  return (
    <Helmet>
      <title>{siteTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content={robotsContent} />
      {canonicalHref && <link rel="canonical" href={canonicalHref} />}

      {/* Hreflang alternates for multilingual SEO */}
      {hreflangAlternates?.map((alt) => (
        <link key={`hreflang-${alt.lang}`} rel="alternate" hrefLang={alt.lang} href={alt.href} />
      ))}
      {hreflangAlternates && hreflangAlternates.length > 0 && (
        <link rel="alternate" hrefLang="x-default" href={hreflangAlternates[0].href} />
      )}

      {/* Open Graph */}
      <meta property="og:title" content={siteTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      {canonicalHref && <meta property="og:url" content={canonicalHref} />}
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content={locale} />
      {ogImage && <meta property="og:image" content={ogImage} />}
      
      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={siteTitle} />
      <meta name="twitter:description" content={description} />
      {canonicalHref && <meta name="twitter:url" content={canonicalHref} />}
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {jsonLdBlocks.map((payload, index) => (
        <script key={`seo-jsonld-${index}`} type="application/ld+json">
          {JSON.stringify(payload)}
        </script>
      ))}
    </Helmet>
  );
};
