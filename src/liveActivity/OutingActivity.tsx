import { Button, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint, background, buttonBorderShape, buttonStyle, controlSize, font, foregroundStyle, frame,
  lineLimit, monospacedDigit, padding, resizable, shapes, tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

/** One carried item as a chip: its name and the SF Symbol picked by the app's icon rules. */
export type CardItem = { name: string; symbol: string };

/** What the outing card shows. Times are epoch milliseconds (props travel as JSON). */
export type OutingActivityProps = {
  /** The first few carried items; the rest are counted in `moreCount`. */
  items: CardItem[];
  moreCount: number;
  itemCount: number;
  outingStart: number;
  /** Where the user is now; null when hidden in settings or not known yet. */
  place: string | null;
  /** When the current stay began, for the "머문 시간" timer. */
  hereSince: number;
  /** Set while a leave is waiting for an answer: the stay that was left and its label. */
  leftStayId: string | null;
  leftPlace: string | null;
  /** Shown after the last leave was answered, e.g. "14:32 모두 챙겼어요". */
  checked: string | null;
  /** file:// URLs of the bag mascot copied to the shared folder; null until copied. */
  art: { walk: string; question: string; happy: string } | null;
};

/** Button target for "모두 있어요"; the stay id follows the colon so the answer can't hit another stay. */
export const ALL_CHECKED_TARGET = 'all_checked:';

// Everything the card uses must live inside the 'widget' function: it runs in the widget
// extension's own runtime, which only gets the function body and its props. Colors follow
// src/theme.ts (Pretendard can't be used: the extension draws with the system font).
const OutingActivity = (props: OutingActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  // Glass card: a translucent navy tint lets iOS blur the wallpaper through the platter (an
  // empty tint gives the opaque black default). Being always dark glass, text is always light,
  // so it reads on any wallpaper. Chips and buttons are translucent capsules on that glass:
  // the widget renderer drops views with glassEffect, so Liquid Glass itself can't be used here.
  const c = {
    platter: '#22252FA6',
    ink: '#FFFFFF',
    sub: '#FFFFFFE0',
    blue: environment.isLuminanceReduced ? '#D3D8EE' : '#B7C0E6',
    onBlue: '#FFFFFF',
    glassTint: '#FFFFFF1F',
    // The one key color: titles that ask, the main button, the filled link.
    key: '#6275ECEB',
  };
  const glass = (fill: string) => background(fill, shapes.capsule());
  const DAY = 24 * 60 * 60 * 1000;
  const asking = !!props.leftStayId;
  const answered = !asking && !!props.checked;
  const checkLink = `chaengkim://leave-check${props.leftStayId ? `?stayId=${props.leftStayId}` : ''}`;

  const timer = (start: number, size: number, color: string) => (
    <Text
      timerInterval={{ lower: new Date(start), upper: new Date(start + DAY) }}
      countsDown={false}
      modifiers={[font({ size, weight: 'semibold' }), monospacedDigit(), foregroundStyle(color)]}
    />
  );

  const bagArt = props.art ? (asking ? props.art.question : answered ? props.art.happy : props.art.walk) : null;
  const bag = (size: number) => bagArt
    ? <Image uiImage={bagArt} modifiers={[resizable(), frame({ width: size, height: size * 0.83 })]} />
    : <Image systemName="bag.fill" size={size * 0.5} color={c.blue} />;
  // The Dynamic Island is small and always black: a symbol reads there, the 3D mascot doesn't.
  // Walking while out, a bag with a question mark while asking.
  const islandSymbol = (size: number) => (
    <Image systemName={asking ? 'bag.badge.questionmark' : 'figure.walk'} size={size} color="#AEB7E0" />
  );

  // Carried items as one line, as on the canvas: "지갑 · 에어팟 · 열쇠 외 2개".
  const names = props.items.map(item => item.name).join(' · ');
  const itemsLine = (
    <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(c.sub), lineLimit(1)]}>
      {props.moreCount > 0 ? `${names} 외 ${props.moreCount}개` : names || '챙길 물건 없음'}
    </Text>
  );

  const hereLine = (color: string) => (
    <HStack spacing={4}>
      <Image systemName="mappin.and.ellipse" size={12} color={color} />
      <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(color), lineLimit(1)]}>
        {props.place ?? '지금 있는 곳'}
      </Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(color)]}>·</Text>
      {timer(props.hereSince, 13, color)}
    </HStack>
  );

  const title = (label: string, color: string) => (
    <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(color)]}>{label}</Text>
  );

  const head = asking ? (
    <VStack alignment="leading" spacing={2}>
      {title('다 챙기셨나요?', c.key)}
      <Text modifiers={[font({ size: 13 }), foregroundStyle(c.sub), lineLimit(1)]}>
        {`${props.leftPlace ?? '머물던 곳'}에서 일어났어요`}
      </Text>
    </VStack>
  ) : (
    <VStack alignment="leading" spacing={2}>
      {title('외출 중', c.ink)}
      {answered
        ? <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.blue)]}>{`✓ ${props.checked}`}</Text>
        : hereLine(c.sub)}
    </VStack>
  );

  const wide = frame({ maxWidth: 1000 });
  const filled = (label: string, url: string) => (
    <Link label={label} destination={url} modifiers={[
      font({ size: 14, weight: 'semibold' }), foregroundStyle(c.onBlue), wide,
      padding({ vertical: 9 }), glass(c.key),
    ]} />
  );
  const plain = (label: string, url: string) => (
    <Link label={label} destination={url} modifiers={[
      font({ size: 14, weight: 'semibold' }), foregroundStyle(c.blue), wide,
      padding({ vertical: 9 }), glass(c.glassTint),
    ]} />
  );

  // Asking: answer in place, or open the leave check of that stay (same link as before).
  const actions = asking ? (
    <HStack spacing={8}>
      <Button
        label="모두 있어요"
        target={`all_checked:${props.leftStayId}`}
        modifiers={[
          buttonStyle('borderedProminent'), buttonBorderShape('capsule'), controlSize('large'),
          tint(c.key), font({ size: 14, weight: 'semibold' }), wide,
        ]}
      />
      {plain('소지품 확인', checkLink)}
    </HStack>
  ) : (
    <HStack spacing={8}>
      {filled('소지품 확인', 'chaengkim://leave-check')}
      {plain('집에 도착했어요', 'chaengkim://return-check')}
    </HStack>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={11} modifiers={[padding({ all: 16 }), activityBackgroundTint(c.platter)]}>
        <HStack spacing={12}>
          {bag(62)}
          {head}
          <Spacer />
        </HStack>
        {itemsLine}
        {actions}
      </VStack>
    ),
    compactLeading: islandSymbol(15),
    compactTrailing: (
      <Text modifiers={[font({ size: 13, weight: asking ? 'bold' : 'semibold' }), foregroundStyle(c.blue)]}>
        {asking ? '확인?' : `${props.itemCount}개`}
      </Text>
    ),
    minimal: islandSymbol(14),
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 6, top: 4 })]}>
        {islandSymbol(17)}
        <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle('#FFFFFF')]}>{`${props.itemCount}개`}</Text>
      </HStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ trailing: 6, top: 4 })]}>{timer(props.outingStart, 15, '#FFFFFF')}</VStack>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ horizontal: 6, bottom: 4 })]}>
        {asking
          ? <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle('#FFFFFF')]}>{`${props.leftPlace ?? '머물던 곳'}에서 일어났어요`}</Text>
          : hereLine('#FFFFFFB3')}
        {actions}
      </VStack>
    ),
  };
};

export default createLiveActivity('OutingActivity', OutingActivity);
