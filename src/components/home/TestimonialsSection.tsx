import React from 'react';
import type { TFunction } from 'i18next';
import { Star } from 'lucide-react';
import { motion } from 'motion/react';
import { TESTIMONIAL_AVATARS } from './constants';

interface TestimonialsSectionProps {
  t: TFunction<'home'>;
}

export const TestimonialsSection: React.FC<TestimonialsSectionProps> = ({ t }) => {
  const testimonials = t('testimonialsList', { returnObjects: true }) as { quote: string; author: string; role: string; city: string }[];

  return (
    <section className="max-w-7xl mx-auto px-6 py-4">
      <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-4 text-center tracking-tight">{t('testimonials.title')}</h2>
      <p className="text-slate-500 dark:text-slate-400 text-center mb-12 font-medium max-w-2xl mx-auto">Реални искуства од наставници кои го користат MathDigitizer Pro во македонски училишта.</p>
      <div className="grid gap-6 md:grid-cols-3">
        {testimonials.map((testimonial, idx) => {
          const avatar = TESTIMONIAL_AVATARS[idx] ?? TESTIMONIAL_AVATARS[0];
          return (
          <motion.div
            key={testimonial.author}
            whileHover={{ y: -4 }}
            className="rounded-5xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-8 shadow-sm hover:shadow-lg transition-all duration-300 backdrop-blur-xl flex flex-col"
          >
            <div className="flex gap-1 mb-6">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
              ))}
            </div>
            <blockquote className="text-slate-700 dark:text-slate-200 text-base leading-relaxed mb-8 flex-1 font-medium italic">
              "{testimonial.quote}"
            </blockquote>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${avatar.avatarClass}`}>
                {avatar.initials}
              </div>
              <div>
                <div className="font-black text-slate-900 dark:text-white text-sm">{testimonial.author}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{testimonial.role} · {testimonial.city}</div>
              </div>
            </div>
          </motion.div>
          );
        })}
      </div>
    </section>
  );
};
