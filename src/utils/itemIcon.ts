import type { LucideIconName } from '@react-native-vector-icons/lucide';

const RULES: [RegExp, LucideIconName][] = [
  [/지갑|카드/, 'wallet'],
  [/열쇠|키/, 'key-round'],
  [/에어팟|이어폰|헤드폰|버즈/, 'headphones'],
  [/충전기|케이블|보조배터리/, 'plug-zap'],
  [/노트북|맥북|랩탑/, 'laptop'],
  [/아이패드|태블릿/, 'tablet'],
  [/폰|핸드폰|휴대폰|아이폰/, 'smartphone'],
  [/우산/, 'umbrella'],
  [/안경|선글라스/, 'glasses'],
  [/시계|워치/, 'watch'],
  [/신분증|사원증|학생증/, 'id-card'],
  [/책|노트/, 'book-open'],
];

export function itemIcon(name: string): LucideIconName {
  return RULES.find(([re]) => re.test(name))?.[1] ?? 'package';
}
