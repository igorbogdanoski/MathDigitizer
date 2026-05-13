export type PedagogyPriority = 'balanced' | 'scaffolded' | 'mastery';

export interface PedagogyPolicyOptions {
  priority?: PedagogyPriority;
  language?: string;
}

const BASE_PROTOCOL = [
  'Користи CRA progression (Concrete -> Representational -> Abstract) кога е применливо.',
  'Вгради Socratic questioning за активна когнитивна обработка наместо пасивно меморирање.',
  'Усогласи чекори со Bloom (Understand -> Apply -> Analyze) и означи кое ниво се адресира.',
  'Постави DoK-усогласена сложеност и избегнувај скокови што ја рушат зоната на проксимален развој (Vygotsky ZPD).',
  'Додај metacognitive checkpoint: кратка self-check рефлексија за ученикот.',
  'Одржи кратки, јасни и проверливи математички чекори со нотациска конзистентност.'
];

const PRIORITY_RULES: Record<PedagogyPriority, string[]> = {
  balanced: [
    'Баланс меѓу концептуална длабочина и оперативна брзина.',
    'Дај 1 краток пример и 1 мини-вежба за трансфер на знаење.'
  ],
  scaffolded: [
    'Подели решение во микро-чекори со постепено намалување на поддршката.',
    'По секој клучен чекор постави проверка: "Што се смени и зошто?"'
  ],
  mastery: [
    'Барај аргументирана верификација на резултатот со барем 1 алтернативен метод.',
    'Интегрирај retrieval cue за долгорочно задржување (spaced recall signal).'
  ]
};

export function getPedagogyProtocol(options: PedagogyPolicyOptions = {}): string[] {
  const priority = options.priority ?? 'balanced';
  const language = options.language ?? 'македонски';

  return [
    ...BASE_PROTOCOL,
    ...PRIORITY_RULES[priority],
    `Јазик на објаснување: ${language}.`
  ];
}

export function getPedagogyHardRules(options: PedagogyPolicyOptions = {}): string[] {
  const priority = options.priority ?? 'balanced';

  return [
    'Педагошката вредност е прва, математичката точност е апсолутна.',
    'Ниту еден чекор не смее да биде "магичен" без објаснување.',
    `Приоритетен педагошки режим: ${priority}.`
  ];
}
