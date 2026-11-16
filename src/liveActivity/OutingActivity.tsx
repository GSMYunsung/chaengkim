import { Button, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  activityBackgroundTint, background, buttonBorderShape, buttonStyle, controlSize, font, foregroundStyle, frame,
  lineLimit, monospacedDigit, padding, resizable, shapes, tint, widgetURL,
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

// Layout rules (Apple HIG for Live Activities, and how Uber and Flighty apply them):
// - one hero per state: "what I carry" while out, "did you pack everything?" after a leave
// - a button only when an answer is needed, and only one; otherwise tapping opens the right screen
// - the card is short while staying and grows when it asks
// - 14pt margins, medium-or-heavier text, the app's blue and bag mascot without a container
//
// Everything the card uses must live inside the 'widget' function: it runs in the widget
// extension's own runtime, which only gets the function body and its props.
const OutingActivity = (props: OutingActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  // Translucent navy glass: iOS blurs the wallpaper through it, and light text reads on any
  // wallpaper. (Views with glassEffect aren't drawn by the widget renderer, so capsules are plain.)
  const c = {
    platter: '#1C2140A6',
    ink: '#FFFFFF',
    sub: '#FFFFFFB8',
    blue: environment.isLuminanceReduced ? '#C9D1FF' : '#A9B7FF',
    brand: '#6A81FD',
    chip: '#FFFFFF1F',
  };
  const DAY = 24 * 60 * 60 * 1000;
  const asking = !!props.leftStayId;
  const answered = !asking && !!props.checked;
  const link = asking ? `chaengkim://leave-check?stayId=${props.leftStayId}` : 'chaengkim://';

  const timer = (start: number, size: number, color: string) => (
    <Text
      timerInterval={{ lower: new Date(start), upper: new Date(start + DAY) }}
      countsDown={false}
      modifiers={[font({ size, weight: 'semibold' }), monospacedDigit(), foregroundStyle(color)]}
    />
  );

  const art = props.art ? (asking ? props.art.question : answered ? props.art.happy : props.art.walk) : null;
  const bag = art
    ? <Image uiImage={art} modifiers={[resizable(), frame({ width: 52, height: 43 })]} />
    : <Image systemName="bag.fill" size={26} color={c.blue} />;

  const chips = (
    <HStack spacing={6}>
      {props.items.map(item => (
        <HStack
          key={item.name}
          spacing={4}
          modifiers={[padding({ horizontal: 10, vertical: 6 }), background(c.chip, shapes.capsule())]}
        >
          <Image systemName={item.symbol as any} size={12} color={c.blue} />
          <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(c.ink), lineLimit(1)]}>{item.name}</Text>
        </HStack>
      ))}
      {props.moreCount > 0 ? (
        <Text modifiers={[
          font({ size: 13, weight: 'medium' }), foregroundStyle(c.sub),
          padding({ horizontal: 10, vertical: 6 }), background(c.chip, shapes.capsule()),
        ]}>{`+${props.moreCount}`}</Text>
      ) : null}
      <Spacer />
    </HStack>
  );

  const placeLine = (color: string) => (
    <HStack spacing={4}>
      <Image systemName="mappin" size={12} color={color} />
      <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(color), lineLimit(1)]}>
        {props.place ?? '지금 있는 곳'}
      </Text>
      <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(color)]}>·</Text>
      {timer(props.hereSince, 13, color)}
    </HStack>
  );

  // Hero line while out: "3개 챙겨서 외출 중", the count in blue.
  const outHero = props.itemCount > 0 ? (
    <HStack spacing={0}>
      <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(c.blue)]}>{`${props.itemCount}개`}</Text>
      <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(c.ink)]}> 챙겨서 외출 중</Text>
    </HStack>
  ) : <Text modifiers={[font({ size: 17, weight: 'bold' }), foregroundStyle(c.ink)]}>외출 중</Text>;

  const askHero = (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: 20, weight: 'bold' }), foregroundStyle(c.ink)]}>다 챙기셨나요?</Text>
      <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle(c.sub), lineLimit(1)]}>
        {`${props.leftPlace ?? '머물던 곳'}에서 일어났어요`}
      </Text>
    </VStack>
  );

  const statusLine = answered
    ? <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(c.blue)]}>{`✓ ${props.checked}`}</Text>
    : placeLine(c.sub);

  const outHead = (
    <VStack alignment="leading" spacing={3}>
      <HStack spacing={8}>
        {outHero}
        <Spacer />
        {timer(props.outingStart, 15, c.sub)}
      </HStack>
      {statusLine}
    </VStack>
  );

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
        spacing={asking ? 12 : 10}
        modifiers={[padding({ all: 14 }), activityBackgroundTint(c.platter), widgetURL(link)]}
      >
        <HStack spacing={12}>
          {bag}
          {asking ? askHero : outHead}
        </HStack>
        {chips}
        {asking ? answer : null}
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
      <HStack spacing={6} modifiers={[padding({ leading: 4 })]}>
        <Image systemName={islandSymbol} size={17} color={c.blue} />
        <Text modifiers={[font({ size: 15, weight: 'bold' }), foregroundStyle(c.ink)]}>
          {asking ? '확인' : `${props.itemCount}개`}
        </Text>
      </HStack>
    ),
    expandedTrailing: (
      <HStack modifiers={[padding({ trailing: 4 })]}>{timer(props.outingStart, 15, c.sub)}</HStack>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={10} modifiers={[padding({ horizontal: 4, bottom: 2 }), widgetURL(link)]}>
        {asking ? askHero : statusLine}
        {chips}
        {asking ? answer : null}
      </VStack>
    ),
  };
};

export default createLiveActivity('OutingActivity', OutingActivity);
