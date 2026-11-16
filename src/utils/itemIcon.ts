import type { LucideIconName } from '@react-native-vector-icons/lucide';

// One table for both places an item gets an icon: the app (Lucide) and the Lock Screen card,
// which is drawn by iOS and can only use SF Symbols. Same rule, so the two always agree.
const RULES: [RegExp, LucideIconName, string][] = [
  [/지갑|카드/, 'wallet', 'wallet.bifold'],
  [/열쇠|키/, 'key-round', 'key'],
  [/에어팟|이어폰|헤드폰|버즈/, 'headphones', 'headphones'],
  [/충전기|케이블|보조배터리/, 'plug-zap', 'powerplug'],
  [/노트북|맥북|랩탑/, 'laptop', 'laptopcomputer'],
  [/아이패드|태블릿/, 'tablet', 'ipad'],
  [/폰|핸드폰|휴대폰|아이폰/, 'smartphone', 'iphone'],
  [/우산/, 'umbrella', 'umbrella'],
  [/안경|선글라스/, 'glasses', 'eyeglasses'],
  [/시계|워치/, 'watch', 'applewatch'],
  [/신분증|사원증|학생증/, 'id-card', 'person.text.rectangle'],
  [/책|노트/, 'book-open', 'book'],
];

export function itemIcon(name: string): LucideIconName {
  return RULES.find(([re]) => re.test(name))?.[1] ?? 'package';
}

/** The SF Symbol for the same item, for views iOS draws itself (the Lock Screen card). */
export function itemSymbol(name: string): string {
  return RULES.find(([re]) => re.test(name))?.[2] ?? 'shippingbox';
}
