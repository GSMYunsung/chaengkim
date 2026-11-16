import { Button, HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { buttonStyle, font, foregroundStyle, lineLimit, monospacedDigit, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

/** What the outing card shows. Times are epoch milliseconds (props travel as JSON). */
export type OutingActivityProps = {
  /** Carried items as one line, e.g. "지갑 · 열쇠 · 이어폰 외 2개". */
  items: string;
  itemCount: number;
  outingStart: number;
  /** Where the user is now; null when hidden in settings or not known yet. */
  place: string | null;
  /** When the current stay began, for the "머문 시간" timer. */
  hereSince: number;
  /** Set while a leave is waiting for an answer: the stay that was left and its label. */
  leftStayId: string | null;
  leftPlace: string | null;
  /** Shown after the last leave was answered, e.g. "14:32 다 챙겼어요". */
  checked: string | null;
};

/** Button target for "다 챙김"; the stay id follows the colon so the answer can't hit another stay. */
export const ALL_CHECKED_TARGET = 'all_checked:';

// Everything the card uses must live inside the 'widget' function: it runs in the widget
// extension's own runtime, which only gets the function body and its props.
const OutingActivity = (props: OutingActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const blue = environment.isLuminanceReduced ? '#FFFFFF' : '#3478F6';
  const sub = '#8E8E93';
  const DAY = 24 * 60 * 60 * 1000;
  const since = (start: number) => ({ lower: new Date(start), upper: new Date(start + DAY) });
  const asking = !!props.leftStayId;
  const leftText = `${props.leftPlace ?? '머물던 곳'}에서 일어났어요`;
  const checkLink = `chaengkim://leave-check${props.leftStayId ? `?stayId=${props.leftStayId}` : ''}`;

  const elapsed = (start: number, size: number) => (
    <Text
      timerInterval={since(start)}
      countsDown={false}
      modifiers={[font({ size, weight: 'semibold' }), monospacedDigit()]}
    />
  );

  const hereLine = (
    <HStack spacing={4}>
      <Image systemName="mappin.and.ellipse" size={13} color={sub} />
      <Text modifiers={[font({ size: 14, weight: 'medium' }), lineLimit(1)]}>{props.place ?? '지금 있는 곳'}</Text>
      <Text modifiers={[font({ size: 14 }), foregroundStyle(sub)]}>·</Text>
      {elapsed(props.hereSince, 14)}
    </HStack>
  );

  const buttons = asking ? (
    <HStack spacing={8}>
      <Button
        label="다 챙김"
        target={`all_checked:${props.leftStayId}`}
        modifiers={[buttonStyle('borderedProminent'), tint(blue)]}
      />
      <Link label="확인하기" destination={checkLink} modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle(blue)]} />
      <Spacer />
    </HStack>
  ) : (
    <HStack spacing={16}>
      <Link label="소지품 확인" destination="chaengkim://leave-check" modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle(blue)]} />
      <Link label="귀가 체크" destination="chaengkim://return-check" modifiers={[font({ size: 14, weight: 'medium' }), foregroundStyle(blue)]} />
      <Spacer />
    </HStack>
  );

  return {
    banner: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 14 })]}>
        <HStack spacing={6}>
          <Image systemName="bag.fill" size={15} color={blue} />
          <Text modifiers={[font({ size: 14, weight: 'bold' })]}>다챙김 · 외출 중</Text>
          <Spacer />
          {elapsed(props.outingStart, 14)}
        </HStack>
        {asking ? (
          <VStack alignment="leading" spacing={2}>
            <Text modifiers={[font({ size: 15, weight: 'bold' }), lineLimit(1)]}>{leftText}</Text>
            <Text modifiers={[font({ size: 14 }), foregroundStyle(sub)]}>두고 가는 물건은 없나요?</Text>
          </VStack>
        ) : hereLine}
        <Text modifiers={[font({ size: 13 }), foregroundStyle(sub), lineLimit(1)]}>{props.items}</Text>
        {!asking && props.checked ? (
          <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle('#34C759')]}>✓ {props.checked}</Text>
        ) : null}
        {buttons}
      </VStack>
    ),
    compactLeading: <Image systemName="bag.fill" color={blue} />,
    compactTrailing: asking
      ? <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(blue)]}>확인</Text>
      : <Text modifiers={[font({ size: 13, weight: 'semibold' })]}>{props.itemCount}</Text>,
    minimal: <Image systemName="bag.fill" color={blue} />,
    expandedLeading: (
      <HStack spacing={4} modifiers={[padding({ leading: 4 })]}>
        <Image systemName="bag.fill" color={blue} />
        <Text modifiers={[font({ size: 14, weight: 'semibold' })]}>{props.itemCount}개</Text>
      </HStack>
    ),
    expandedTrailing: elapsed(props.outingStart, 14),
    expandedBottom: (
      <VStack alignment="leading" spacing={6}>
        {asking
          ? <Text modifiers={[font({ size: 15, weight: 'bold' }), lineLimit(1)]}>{leftText}</Text>
          : hereLine}
        <Text modifiers={[font({ size: 13 }), foregroundStyle(sub), lineLimit(1)]}>{props.items}</Text>
        {buttons}
      </VStack>
    ),
  };
};

export default createLiveActivity('OutingActivity', OutingActivity);
