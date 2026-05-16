import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Clock, Calendar, ArrowRight } from 'lucide-react';
import { SEO } from '../SEO';

interface BlogArticleProps {
  slug: string;
  title: string;
  description: string;
  keywords: string;
  date: string;
  readMinutes: number;
  children: React.ReactNode;
  ctaLabel: string;
  ctaHref: string;
}

export const BlogArticle: React.FC<BlogArticleProps> = ({
  slug, title, description, keywords, date, readMinutes, children, ctaLabel, ctaHref
}) => {
  const url = `https://math.mismath.net/blog/${slug}`;
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    datePublished: date,
    dateModified: date,
    image: 'https://math.mismath.net/og-image.png',
    inLanguage: 'mk',
    author: {
      '@type': 'Organization',
      name: 'MathDigitizer Pro',
      url: 'https://math.mismath.net',
    },
    publisher: {
      '@type': 'Organization',
      name: 'MathDigitizer Pro',
      url: 'https://math.mismath.net',
      logo: {
        '@type': 'ImageObject',
        url: 'https://math.mismath.net/pwa-icon.svg',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
  };

  return (
    <>
      <SEO
        title={title}
        description={description}
        keywords={keywords}
        canonical={`/blog/${slug}`}
        type="article"
        structuredData={articleSchema}
      />

      <div className="min-h-screen bg-white dark:bg-slate-950">
        {/* Hero */}
        <div className="bg-slate-950 pt-16 pb-20 px-4">
          <div className="max-w-3xl mx-auto">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-slate-500 mb-8" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-slate-300 transition-colors">MathDigitizer Pro</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/blog" className="hover:text-slate-300 transition-colors">Блог</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-400 truncate max-w-[200px]">{title}</span>
            </nav>

            <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">
              {title}
            </h1>
            <p className="text-slate-400 text-lg mb-6">{description}</p>

            <div className="flex items-center gap-5 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {new Date(date).toLocaleDateString('mk-MK', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {readMinutes} мин читање
              </span>
            </div>
          </div>
        </div>

        {/* Article body */}
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="[&>h2]:text-2xl [&>h2]:font-bold [&>h2]:text-slate-900 dark:[&>h2]:text-white [&>h2]:mt-10 [&>h2]:mb-4 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:text-slate-800 dark:[&>h3]:text-slate-100 [&>h3]:mt-8 [&>h3]:mb-3 [&>p]:text-slate-700 dark:[&>p]:text-slate-300 [&>p]:leading-relaxed [&>p]:mb-5 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-5 [&>ul>li]:text-slate-700 dark:[&>ul>li]:text-slate-300 [&>ul>li]:mb-1.5 [&>ul>li]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-white [&_code]:font-mono [&_code]:text-sm [&_code]:bg-slate-100 dark:[&_code]:bg-slate-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_em]:italic [&_a]:text-indigo-600 [&_a]:underline">
            {children}
          </div>

          {/* CTA */}
          <div className="mt-16 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-2xl p-8 text-center">
            <p className="text-slate-600 dark:text-slate-400 mb-4">Подготвен да го пробаш?</p>
            <Link
              to={ctaHref}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              {ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Back link */}
          <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800">
            <Link to="/" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1.5">
              ← Назад кон MathDigitizer Pro
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};
