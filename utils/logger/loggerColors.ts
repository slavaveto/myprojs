// utils/logger/loggerColors.ts
// Общие константы цветов для логгера

export interface ColorInfo {
   key: string;
   label: string;
   hex: string;           // CSS hex цвет (#ef4444)
   class: string;         // Tailwind bg класс (bg-red-500)
   iconClass: string;     // Tailwind text класс (text-red-500)
   bgClass: string;       // Tailwind bg с opacity (bg-red-500/20)
}

export const AVAILABLE_COLORS: ColorInfo[] = [
   { 
      key: 'black', 
      label: 'Черный', 
      hex: 'var(--foreground)',
      class: 'bg-gray-800', 
      iconClass: 'text-default-400', 
      bgClass: 'bg-default-400/20' 
   },
   { 
      key: 'red', 
      label: 'Красный', 
      hex: '#ef4444',
      class: 'bg-red-500', 
      iconClass: 'text-red-500', 
      bgClass: 'bg-red-500/20' 
   },
   { 
      key: 'orange', 
      label: 'Оранжевый', 
      hex: '#f97316',
      class: 'bg-orange-500', 
      iconClass: 'text-orange-500', 
      bgClass: 'bg-orange-500/20' 
   },
   { 
      key: 'yellow', 
      label: 'Желтый', 
      hex: '#eab308',
      class: 'bg-yellow-500', 
      iconClass: 'text-yellow-500', 
      bgClass: 'bg-yellow-500/20' 
   },
   { 
      key: 'lime', 
      label: 'Лайм', 
      hex: '#84cc16',
      class: 'bg-lime-500', 
      iconClass: 'text-lime-500', 
      bgClass: 'bg-lime-500/20' 
   },
   { 
      key: 'green', 
      label: 'Зеленый', 
      hex: '#22c55e',
      class: 'bg-green-500', 
      iconClass: 'text-green-500', 
      bgClass: 'bg-green-500/20' 
   },
   { 
      key: 'teal', 
      label: 'Бирюзовый', 
      hex: '#14b8a6',
      class: 'bg-teal-500', 
      iconClass: 'text-teal-500', 
      bgClass: 'bg-teal-500/20' 
   },
   { 
      key: 'cyan', 
      label: 'Голубой', 
      hex: '#06b6d4',
      class: 'bg-cyan-500', 
      iconClass: 'text-cyan-500', 
      bgClass: 'bg-cyan-500/20' 
   },
   { 
      key: 'sky', 
      label: 'Небесный', 
      hex: '#0ea5e9',
      class: 'bg-sky-500', 
      iconClass: 'text-sky-500', 
      bgClass: 'bg-sky-500/20' 
   },
   { 
      key: 'blue', 
      label: 'Синий', 
      hex: '#3b82f6',
      class: 'bg-blue-500', 
      iconClass: 'text-blue-500', 
      bgClass: 'bg-blue-500/20' 
   },
   { 
      key: 'indigo', 
      label: 'Индиго', 
      hex: '#6366f1',
      class: 'bg-indigo-500', 
      iconClass: 'text-indigo-500', 
      bgClass: 'bg-indigo-500/20' 
   },
   { 
      key: 'violet', 
      label: 'Фиолетовый', 
      hex: '#8b5cf6',
      class: 'bg-violet-500', 
      iconClass: 'text-violet-500', 
      bgClass: 'bg-violet-500/20' 
   },
   { 
      key: 'fuchsia', 
      label: 'Фуксия', 
      hex: '#d946ef',
      class: 'bg-fuchsia-500', 
      iconClass: 'text-fuchsia-500', 
      bgClass: 'bg-fuchsia-500/20' 
   },
   { 
      key: 'pink', 
      label: 'Розовый', 
      hex: '#ec4899',
      class: 'bg-pink-500', 
      iconClass: 'text-pink-500', 
      bgClass: 'bg-pink-500/20' 
   },
   { 
      key: 'rose', 
      label: 'Роза', 
      hex: '#f43f5e',
      class: 'bg-rose-500', 
      iconClass: 'text-rose-500', 
      bgClass: 'bg-rose-500/20' 
   },
];

// Маппинг ключ → hex цвет (для inline styles)
export const COLOR_MAP: Record<string, string> = AVAILABLE_COLORS.reduce((acc, color) => {
   acc[color.key] = color.hex;
   return acc;
}, {} as Record<string, string>);

// Маппинг ключ → Tailwind iconClass (для className)
export const ICON_CLASS_MAP: Record<string, string> = AVAILABLE_COLORS.reduce((acc, color) => {
   acc[color.key] = color.iconClass;
   return acc;
}, {} as Record<string, string>);

export function convertTailwindToCSS(colorName: string): string {
   if (!colorName) return '';

   // Определяем тему (проверяем класс на html элементе или через CSS переменную)
   const isDarkTheme =
      typeof window !== 'undefined' &&
      (document.documentElement.classList.contains('dark') ||
         window.matchMedia('(prefers-color-scheme: dark)').matches);

   // Цвета для светлой темы
   const lightColors: Record<string, string> = {
      slate: '#475569',
      gray: '#4B5563',
      zinc: '#52525B',
      neutral: '#525252',
      stone: '#57534E',
      red: '#DC2626',
      orange: '#EA580C',
      amber: '#D97706',
      yellow: '#CA8A04',
      lime: '#65A30D',
      green: '#16A34A',
      emerald: '#059669',
      teal: '#0D9488',
      cyan: '#0891B2',
      sky: '#0284C7',
      blue: '#2563EB',
      indigo: '#4F46E5',
      violet: '#7C3AED',
      purple: '#9333EA',
      fuchsia: '#C026D3',
      pink: '#DB2777',
      rose: '#E11D48',
      black: '#333',
      white: '#BBB',
      'gray-light': '#6B7280',
      'slate-light': '#64748B',
   };

   // Цвета для темной темы (более яркие)
   const darkColors: Record<string, string> = {
      slate: '#94A3B8',
      gray: '#9CA3AF',
      zinc: '#A1A1AA',
      neutral: '#A3A3A3',
      stone: '#A8A29E',
      red: '#EF4444',
      orange: '#F97316',
      amber: '#F59E0B',
      yellow: '#EAB308',
      lime: '#84CC16',
      green: '#22C55E',
      emerald: '#10B981',
      teal: '#14B8A6',
      cyan: '#06B6D4',
      sky: '#0EA5E9',
      blue: '#3B82F6',
      indigo: '#6366F1',
      violet: '#8B5CF6',
      purple: '#A855F7',
      fuchsia: '#D946EF',
      pink: '#EC4899',
      rose: '#F43F5E',
      black: '#BBB',
      white: '#333',
      'gray-light': '#D1D5DB',
      'slate-light': '#CBD5E1',
   };

   const colors = isDarkTheme ? darkColors : lightColors;
   return colors[colorName] || '#000000';
}
