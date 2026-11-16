import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint, buttonBorderShape, buttonStyle, controlSize, fixedSize, font, foregroundStyle, frame,
  lineLimit, monospacedDigit, padding, resizable, tint, widgetURL,
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

// Layout (after ParkMobile's card, within Apple's HIG): a small mark and the carried items on
// top, one big live number as the hero, a short caption under it. A button only when an answer
// is needed, and only one; otherwise tapping the card opens the right screen.
//
// Everything the card uses must live inside the 'widget' function: it runs in the widget
// extension's own runtime, which only gets the function body and its props.
const OutingActivity = (props: OutingActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  // Translucent navy glass: iOS blurs the wallpaper through it, and light text reads on any
  // wallpaper. (Views with glassEffect aren't drawn by the widget renderer.)
  const c = {
    platter: '#1C2140A6',
    ink: '#FFFFFF',
    sub: '#FFFFFFA6',
    blue: environment.isLuminanceReduced ? '#C9D1FF' : '#A9B7FF',
    brand: '#6A81FD',
  };
  // Timers count up to this; fixedSize sizes them for "9:59:59" instead of the whole row.
  const SPAN = 10 * 60 * 60 * 1000;
  const asking = !!props.leftStayId;
  const answered = !asking && !!props.checked;
  const link = asking ? `chaengkim://leave-check?stayId=${props.leftStayId}` : 'chaengkim://';

  const timer = (start: number, size: number, color: string, weight: 'semibold' | 'bold' = 'semibold') => (
    <Text
      timerInterval={{ lower: new Date(start), upper: new Date(start + SPAN) }}
      countsDown={false}
      modifiers={[font({ size, weight }), monospacedDigit(), foregroundStyle(color), fixedSize()]}
    />
  );

  const art = props.art ? (asking ? props.art.question : answered ? props.art.happy : props.art.walk) : null;
  const mark = art
    ? <Image uiImage={art} modifiers={[resizable(), frame({ width: 34, height: 28 })]} />
    : <Image systemName="bag.fill" size={20} color={c.blue} />;

  // Top right: the carried items as symbols and the count, like ParkMobile's zone and car.
  const carried = (
    <HStack spacing={7}>
      {props.items.map(item => <Image key={item.name} systemName={item.symbol as any} size={15} color={c.blue} />)}
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), foregroundStyle(c.ink)]}>
        {props.moreCount > 0 ? `+${props.moreCount}` : `${props.itemCount}개`}
      </Text>
    </HStack>
  );

  const caption = (label: string, color = c.sub) => (
    <Text modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle(color), lineLimit(1)]}>{label}</Text>
  );

  const stayingHero = (
    <HStack spacing={8}>
      {timer(props.hereSince, 44, c.ink, 'bold')}
      <Spacer />
      <HStack spacing={5}>
        <Text modifiers={[font({ size: 15, weight: 'medium' }), foregroundStyle(c.sub)]}>외출</Text>
        {timer(props.outingStart, 20, c.ink)}
      </HStack>
    </HStack>
  );

  const askingHero = (
    <Text modifiers={[font({ size: 28, weight: 'bold' }), foregroundStyle(c.ink)]}>다 챙기셨나요?</Text>
  );

  const stayingCaption = answered
    ? caption(`✓ ${props.checked}`, c.blue)
    : caption(props.place ? `${props.place}에 머문 시간` : '지금 있는 곳에 머문 시간');
  const askingCaption = caption(`${props.leftPlace ?? '머물던 곳'}에서 일어났어요`);

  // The one control on the card, shown only while a leave waits for an answer.
  const answer = (
    <Button
      label="모두 있어요"
      target={`all_checked:${props.leftStayId}`}
      modifiers={[
        buttonStyle('borderedProminent'), buttonBorderShape('capsule'), controlSize('large'),
        tint(c.brand), font({ size: 15, weight: 'semibold' }), frame({ maxWidth: 1000 }),
      ]}
    />
  );

  const islandSymbol = asking ? 'bag.badge.questionmark' : 'bag.fill';
  const islandValue = asking ? '?' : `${props.itemCount}`;

  return {
    banner: (
      <VStack
        alignment="leading"
        spacing={4}
        modifiers={[padding({ all: 14 }), activityBackgroundTint(c.platter), widgetURL(link)]}
      >
        <HStack>
          {mark}
          <Spacer />
          {carried}
        </HStack>
        {asking ? askingHero : stayingHero}
        {asking ? askingCaption : stayingCaption}
        {asking ? <VStack modifiers={[padding({ top: 8 })]}>{answer}</VStack> : null}
      </VStack>
    ),
    // Dynamic Island: one piece of information across the camera — the bag and how many items.
    compactLeading: <Image systemName={islandSymbol} size={15} color={c.blue} />,
    compactTrailing: (
      <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(c.blue), monospacedDigit()]}>{islandValue}</Text>
    ),
    minimal: (
      <Text modifiers={[font({ size: 14, weight: 'bold' }), foregroundStyle(c.blue), monospacedDigit()]}>{islandValue}</Text>
    ),
    expandedLeading: (
      <HStack modifiers={[padding({ leading: 4 })]}>
        <Image systemName={islandSymbol} size={17} color={c.blue} />
      </HStack>
    ),
    expandedTrailing: <HStack modifiers={[padding({ trailing: 4 })]}>{carried}</HStack>,
    expandedBottom: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ horizontal: 4, bottom: 2 }), widgetURL(link)]}>
        {asking ? askingHero : stayingHero}
        {asking ? askingCaption : stayingCaption}
        {asking ? <VStack modifiers={[padding({ top: 6 })]}>{answer}</VStack> : null}
      </VStack>
    ),
  };
};

export default createLiveActivity('OutingActivity', OutingActivity);
