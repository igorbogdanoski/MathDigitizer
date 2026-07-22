export interface QuickInsertItem {
  label: string;
  insert: string;
}

export interface QuickInsertGroup {
  group: string;
  items: QuickInsertItem[];
}

export const quickInsertGroups: QuickInsertGroup[] = [
  {
    group: "Основни",
    items: [
      { label: 'Дропка', insert: '\\frac{ }{ }' },
      { label: 'Корен', insert: '\\sqrt{ }' },
      { label: 'Степен', insert: '^{ }' },
      { label: 'Индекс', insert: '_{ }' },
    ]
  },
  {
    group: "Симболи",
    items: [
      { label: '±', insert: '\\pm ' },
      { label: '≈', insert: '\\approx ' },
      { label: '≠', insert: '\\neq ' },
      { label: '∞', insert: '\\infty ' },
      { label: '∀ (секој)', insert: '\\forall ' },
      { label: '∃ (постои)', insert: '\\exists ' },
    ]
  },
  {
    group: "Геометрија",
    items: [
      { label: 'Агол (∠)', insert: '\\angle ' },
      { label: 'Триаголник (△)', insert: '\\triangle ' },
      { label: 'Степен (°)', insert: '^{\\circ}' },
      { label: 'π', insert: '\\pi ' },
    ]
  },
  {
    group: "Калкулус",
    items: [
      { label: 'Сума (∑)', insert: '\\sum_{i=1}^{n} ' },
      { label: 'Интеграл (∫)', insert: '\\int_{a}^{b} ' },
      { label: 'Лимес', insert: '\\lim_{x \\to \\infty} ' },
    ]
  }
];
