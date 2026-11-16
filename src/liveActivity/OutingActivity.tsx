import { Button, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint, buttonBorderShape, buttonStyle, controlSize, font, foregroundStyle, frame,
  glassEffect, lineLimit, monospacedDigit, padding, resizable, tint,
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
  // Glass card: the system's translucent Lock Screen platter shows the wallpaper through, and
  // chips and buttons sit on Liquid Glass capsules (iOS 26). Text follows the platter's scheme.
  const dark = environment.colorScheme === 'dark';
  const c = {
    ink: dark ? '#FFFFFF' : '#232529',
    sub: dark ? '#FFFFFFB3' : '#232529A6',
    blue: environment.isLuminanceReduced ? '#C9D1FF' : dark ? '#9AAAFF' : '#6A81FD',
    onBlue: '#FFFFFF',
    glassTint: dark ? '#FFFFFF14' : '#FFFFFF59',
    blueTint: '#6A81FDCC',
  };
  const glass = (tint: string, interactive = false) =>
    glassEffect({ glass: { variant: 'regular', tint, interactive }, shape: 'capsule' });
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
  const islandBag = (size: number) => (
    <Image systemName={asking ? 'questionmark.circle.fill' : 'bag.fill'} size={size} color="#9AAAFF" />
  );

  const pill = (label: string, tintColor: string, color: string) => (
    <Text modifiers={[
      font({ size: 12, weight: 'semibold' }), foregroundStyle(color),
      padding({ horizontal: 9, vertical: 4 }), glass(tintColor),
    ]}>{label}</Text>
  );

  const chips = (
    <HStack spacing={6}>
      {props.items.map(item => (
        <HStack
          key={item.name}
          spacing={4}
          modifiers={[padding({ horizontal: 10, vertical: 6 }), glass(c.glassTint)]}
        >
          <Image systemName={item.symbol as any} size={12} color={c.blue} />
          <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(c.ink), lineLimit(1)]}>{item.name}</Text>
        </HStack>
      ))}
      {props.moreCount > 0 ? pill(`+${props.moreCount}`, c.glassTint, c.sub) : null}
      <Spacer />
    </HStack>
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

  const head = asking ? (
    <VStack alignment="leading" spacing={1}>
      <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(c.ink)]}>잠깐,</Text>
      <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(c.blue)]}>다 챙기셨나요?</Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(c.sub), lineLimit(1)]}>
        {`${props.leftPlace ?? '머물던 곳'}에서 일어났어요`}
      </Text>
    </VStack>
  ) : (
    <VStack alignment="leading" spacing={5}>
      <HStack spacing={6}>
        {pill('● 외출 중', c.blueTint, c.onBlue)}
        <Spacer />
        {timer(props.outingStart, 15, c.ink)}
      </HStack>
      {hereLine(c.sub)}
      {answered ? pill(`✓ ${props.checked}`, c.glassTint, c.blue) : null}
    </VStack>
  );

  const wide = frame({ maxWidth: 1000 });
  const filled = (label: string, url: string) => (
    <Link label={label} destination={url} modifiers={[
      font({ size: 14, weight: 'semibold' }), foregroundStyle(c.onBlue), wide,
      padding({ vertical: 9 }), glass(c.blueTint, true),
    ]} />
  );
  const plain = (label: string, url: string) => (
    <Link label={label} destination={url} modifiers={[
      font({ size: 14, weight: 'semibold' }), foregroundStyle(c.blue), wide,
      padding({ vertical: 9 }), glass(c.glassTint, true),
    ]} />
  );

  const actions = asking ? (
    <HStack spacing={8}>
      <Button
        label="모두 있어요"
        target={`all_checked:${props.leftStayId}`}
        modifiers={[
          buttonStyle('glassProminent'), buttonBorderShape('capsule'), controlSize('large'),
          tint(c.blue), font({ size: 14, weight: 'semibold' }), wide,
        ]}
      />
      {plain('확인하기', checkLink)}
    </HStack>
  ) : (
    <HStack spacing={8}>
      {filled('소지품 확인', 'chaengkim://leave-check')}
      {plain('집에 도착했어요', 'chaengkim://return-check')}
    </HStack>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={12} modifiers={[padding({ all: 16 }), activityBackgroundTint(null)]}>
        <HStack spacing={12}>
          {bag(62)}
          {head}
        </HStack>
        {chips}
        {actions}
      </VStack>
    ),
    compactLeading: islandBag(15),
    compactTrailing: asking
      ? <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(c.blue)]}>확인?</Text>
      : <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.blue)]}>{`${props.itemCount}개`}</Text>,
    minimal: islandBag(14),
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 6, top: 4 })]}>
        {islandBag(17)}
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
