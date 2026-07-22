export interface MathQuote {
  text: string;
  author: string;
}

export interface TestimonialAvatar {
  initials: string;
  avatarClass: string;
}

export const MATH_QUOTES: MathQuote[] = [
  { text: "Математиката е азбуката со која Бог го напишал универзумот.", author: "Галилео Галилеј" },
  { text: "Чистата математика е, на свој начин, поезија на логичките идеи.", author: "Алберт Ајнштајн" },
  { text: "Суштината на математиката не е да ги направи едноставните работи комплицирани, туку комплицираните работи едноставни.", author: "Стенли Гудер" },
  { text: "Во математиката не ги разбираш работите. Само се навикнуваш на нив.", author: "Џон фон Нојман" },
  { text: "Математиката е кралица на науките.", author: "Карл Фридрих Гаус" },
  { text: "Единствениот начин да научиш математика е да решаваш математика.", author: "Пол Халмос" },
  { text: "Природата е напишана во математички јазик.", author: "Галилео Галилеј" },
  { text: "Математиката не познава раси или географски граници; за математиката, културниот свет е една земја.", author: "Дејвид Хилберт" },
  { text: "Ако луѓето не веруваат дека математиката е едноставна, тоа е само затоа што не сфаќаат колку е комплициран животот.", author: "Џон фон Нојман" },
  { text: "Математиката се состои од докажување на најочигледните работи на најмалку очигледен начин.", author: "Џорџ Поја" }
];

export const TESTIMONIAL_AVATARS: TestimonialAvatar[] = [
  { initials: "МК", avatarClass: "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300" },
  { initials: "ТМ", avatarClass: "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300" },
  { initials: "ЕВ", avatarClass: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300" },
];
