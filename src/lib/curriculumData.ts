export const MKT_CURRICULUM = {
  country: 'Македонија (БРО)',
  grades: [
    {
      level: 'VI одделение',
      topics: [
        { id: 'mk-6-1', name: 'Броеви и операции - Цели броеви' },
        { id: 'mk-6-2', name: 'Дропки, децимални броеви и проценти' },
        { id: 'mk-6-3', name: 'Геометрија - Агли и 2Д форми' },
        { id: 'mk-6-4', name: 'Мерење и решавање проблеми' }
      ]
    },
    {
      level: 'VII одделение',
      topics: [
        { id: 'mk-7-1', name: 'Рационални броеви' },
        { id: 'mk-7-2', name: 'Алгебра - Линеарни равенки со една непозната' },
        { id: 'mk-7-3', name: 'Геометрија - Плоштина и периметар' },
        { id: 'mk-7-4', name: 'Работа со податоци' }
      ]
    },
    {
      level: 'VIII одделение',
      topics: [
        { id: 'mk-8-1', name: 'Алгебра - Системи линеарни равенки' },
        { id: 'mk-8-2', name: 'Геометрија - Питагорова теорема' },
        { id: 'mk-8-3', name: 'Геометрија - Кружница и круг' },
        { id: 'mk-8-4', name: 'Функции и пропорционалност' }
      ]
    },
    {
      level: 'IX одделение',
      topics: [
        { id: 'mk-9-1', name: 'Алгебра - Квадратни равенки' },
        { id: 'mk-9-2', name: 'Геометрија - Стереометрија (3Д форми)' },
        { id: 'mk-9-3', name: 'Веројатност и статистика' },
        { id: 'mk-9-4', name: 'Вектори и транслација' }
      ]
    }
  ]
};

export const SRB_CURRICULUM = {
  country: 'Србија (ZOUV)',
  grades: [
    { level: 'V разред', topics: [{ id: 'sr-5-1', name: 'Скупови и бројеви' }, { id: 'sr-5-2', name: 'Геометрија - Основне фигуре' }] },
    { level: 'VI разред', topics: [{ id: 'sr-6-1', name: 'Цели бројеви' }, { id: 'sr-6-2', name: 'Троугао' }] },
  ]
};

export const ALB_CURRICULUM = {
  country: 'Albania (MAS)',
  grades: [
    { level: 'Klasa 6', topics: [{ id: 'al-6-1', name: 'Numrat dhe veprimet' }, { id: 'al-6-2', name: 'Gjeometria 2D' }] },
    { level: 'Klasa 7', topics: [{ id: 'al-7-1', name: 'Algjebra' }, { id: 'al-7-2', name: 'Ekuacionet' }] },
  ]
};

export const ALL_CURRICULUMS = [MKT_CURRICULUM, SRB_CURRICULUM, ALB_CURRICULUM];
