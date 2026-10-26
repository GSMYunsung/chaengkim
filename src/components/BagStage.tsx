import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Pressable, useWindowDimensions } from 'react-native';
import { Icon, Text, type IconName } from './ui';
import { MASCOT, useReduceMotion } from './Mascot';
import { colors, space } from '../theme';
import { itemIcon } from '../utils/itemIcon';
import type { Item } from '../types';

const POSES = MASCOT;
type Pose = keyof typeof POSES;

const BAG = 190;
const FALL_MS = 560;
const STAGGER_MS = 190;
const MAX_DROPS = 10;

// Items already shown inside the bag during this app run. Null until the first pack, so a fresh
// launch replays every item dropping in; later visits only animate items that weren't there.
let packedIds: Set<string> | null = null;

type Drop = { item: Item; icon: IconName; value: Animated.Value; dx: number };

/** 외출 전 / 외출 중. While out, the dot pulses so it reads as something in progress. */
function StatusBadge({ out }: { out: boolean }) {
  const reduce = useReduceMotion();
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!out || reduce) { pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(pulse, {
      toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [out, reduce, pulse]);

  return (
    <View
      style={[styles.badge, out ? styles.badgeOut : styles.badgeHome]}
      accessible
      accessibilityLabel={out ? '외출 중' : '외출 전'}
    >
      <View style={styles.badgeDotWrap}>
        {out && (
          <Animated.View
            style={[
              styles.badgeDot, styles.badgePulse,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
              },
            ]}
          />
        )}
        <View style={[styles.badgeDot, { backgroundColor: out ? colors.onAction : colors.sub }]} />
      </View>
      <Text style={[styles.badgeText, { color: out ? colors.onAction : colors.sub }]}>
        {out ? '외출 중' : '외출 전'}
      </Text>
    </View>
  );
}

export function BagStage({ label, items, ready, onAdd, canAdd = true, walking, children }: {
  label: string;
  /** During an outing the bag rests in its walking pose and waddles instead of breathing. */
  walking?: boolean;
  items: Item[];
  /** Show the "+ 담기" chip next to the items (hidden during an outing, when new items can't join the bag). */
  canAdd?: boolean;
  /** False until the screen has loaded its data, so the launch animation isn't spent on an empty list. */
  ready: boolean;
  onAdd: () => void;
  children?: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const reduce = useReduceMotion();
  const [pose, setPose] = useState<Pose>('idle');
  const [count, setCount] = useState(0);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [squash] = useState(() => new Animated.Value(0));
  const [float] = useState(() => new Animated.Value(0));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const ids = items.map(i => i.id).join(',');

  useEffect(() => {
    if (!ready) return;
    const known = packedIds;
    const fresh = items.filter(i => !known?.has(i.id));
    const current = new Set(items.map(i => i.id));
    if (reduce || fresh.length === 0) {
      const t = setTimeout(() => {
        packedIds = current;
        setDrops([]);
        setCount(items.length);
        setPose(items.length ? 'idle' : 'question');
      }, 0);
      return () => clearTimeout(t);
    }

    const queued = fresh.slice(0, MAX_DROPS);
    const next: Drop[] = queued.map((item, i) => ({
      item,
      icon: itemIcon(item.name),
      value: new Animated.Value(0),
      dx: (i % 2 ? 1 : -1) * (24 + (i % 3) * 14),
    }));
    // Started from a timer so a cancelled run (unmount, dev double-effect) replays next time.
    timers.current.push(setTimeout(() => {
      packedIds = current;
      setCount(items.length - queued.length);
      setPose('packing');
      setDrops(next);
    }, 0));

    next.forEach((d, i) => {
      timers.current.push(setTimeout(() => {
        Animated.timing(d.value, {
          toValue: 1, duration: FALL_MS, easing: Easing.in(Easing.quad), useNativeDriver: true,
        }).start(({ finished }) => {
          if (!finished) return;
          setCount(c => c + 1);
          squash.setValue(1);
          Animated.spring(squash, { toValue: 0, friction: 3.5, tension: 180, useNativeDriver: true }).start();
        });
      }, i * STAGGER_MS));
    });
    const total = (next.length - 1) * STAGGER_MS + FALL_MS;
    timers.current.push(setTimeout(() => { setDrops([]); setPose('happy'); }, total + 120));
    timers.current.push(setTimeout(() => setPose('idle'), total + 1500));

    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      timers.current = [];
      next.forEach(d => d.value.stopAnimation());
    };
    // Re-run only when the set of items (or readiness) changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, ready, reduce]);

  // Gentle breathing while idle.
  useEffect(() => {
    if (reduce || pose !== 'idle') { float.setValue(0); return; }
    const half = walking ? 380 : 1400;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: half, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pose, reduce, float, walking]);

  // 'idle' is the resting state; while out, resting means walking.
  const shownPose: Pose = pose === 'idle' && walking ? 'walk' : pose;

  const empty = ready && items.length === 0;
  const domeSize = width * 2.4;

  return (
    <View style={[styles.stage, { marginHorizontal: -space.screen }]}>
      <View
        pointerEvents="none"
        style={[styles.dome, { width: domeSize, height: domeSize, borderRadius: domeSize / 2, left: (width - domeSize) / 2 }]}
      />

      <View style={styles.head}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          <StatusBadge out={!!walking} />
        </View>
        <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="polite">
          {empty ? (
            <>가방이{'\n'}비어 있어요</>
          ) : walking ? (
            <><Text style={{ color: colors.blue }}>{count}개</Text>와 함께{'\n'}외출 중이에요</>
          ) : (
            <>가방에 <Text style={{ color: colors.blue }}>{count}개</Text>를{'\n'}담았어요</>
          )}
        </Text>
      </View>

      <View style={styles.bagArea}>
        <Animated.Image
          source={POSES[empty ? 'question' : shownPose]}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          accessible
          accessibilityLabel="챙김 가방"
          style={[
            styles.bag,
            {
              transform: [
                { translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, walking ? -7 : -5] }) },
                { rotate: float.interpolate({ inputRange: [0, 1], outputRange: walking ? ['-2.5deg', '2.5deg'] : ['0deg', '0deg'] }) },
                { translateY: squash.interpolate({ inputRange: [0, 1], outputRange: [0, BAG * 0.04] }) },
                { scaleX: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) },
                { scaleY: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) },
              ],
            },
          ]}
        />
        {drops.map(d => (
          <Animated.View
            key={d.item.id}
            pointerEvents="none"
            style={[
              styles.tile,
              {
                opacity: d.value.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateX: d.value.interpolate({ inputRange: [0, 1], outputRange: [d.dx, 0] }) },
                  { translateY: d.value.interpolate({ inputRange: [0, 1], outputRange: [-250, 0] }) },
                  { rotate: d.value.interpolate({ inputRange: [0, 1], outputRange: [d.dx > 0 ? '14deg' : '-14deg', '0deg'] }) },
                  { scale: d.value.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.9, 0.45] }) },
                ],
              },
            ]}
          >
            <Icon name={d.icon} size={22} color={colors.blue} />
          </Animated.View>
        ))}
      </View>

      <View style={styles.foot}>
        {empty ? (
          <>
            <Text style={styles.hint}>늘 챙기는 물건을 담아 두면{'\n'}나갈 때마다 함께 확인해요.</Text>
            <Pressable
              style={({ pressed }) => [styles.pill, pressed && { opacity: 0.75 }]}
              onPress={onAdd}
              accessibilityRole="button"
            >
              <Text style={styles.pillText}>소지품 담기</Text>
              <Icon name="plus" size={16} color={colors.ink} />
            </Pressable>
          </>
        ) : (
          <View style={styles.chips}>
            {items.map(item => (
              <View key={item.id} style={styles.chip}>
                <Icon name={itemIcon(item.name)} size={15} color={colors.blue} />
                <Text style={styles.chipText} numberOfLines={1}>{item.name}</Text>
              </View>
            ))}
            {canAdd && (
              <Pressable
                style={({ pressed }) => [styles.chip, styles.addChip, pressed && { opacity: 0.75 }]}
                onPress={onAdd}
                accessibilityRole="button"
                accessibilityLabel="소지품 담기"
                hitSlop={4}
              >
                <Icon name="plus" size={15} color={colors.blue} />
                <Text style={[styles.chipText, { color: colors.blue }]}>담기</Text>
              </Pressable>
            )}
          </View>
        )}
        {!empty && children}
      </View>

      {/* White sheet edge so the dome ends in a soft curve instead of a hard cut. */}
      <View pointerEvents="none" style={styles.sheetEdge} />
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { overflow: 'hidden', paddingTop: 6, paddingHorizontal: space.screen, paddingBottom: 54 },
  dome: { position: 'absolute', top: 248, backgroundColor: colors.tint },
  sheetEdge: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 28,
    backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
  },
  head: { zIndex: 1 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  label: { fontSize: 15, fontWeight: '600', color: colors.sub },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28, paddingHorizontal: 11, borderRadius: 14 },
  badgeHome: { backgroundColor: colors.surface },
  badgeOut: { backgroundColor: colors.blue },
  badgeDotWrap: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  badgeDot: { width: 8, height: 8, borderRadius: 4 },
  badgePulse: { position: 'absolute', backgroundColor: colors.onAction },
  badgeText: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 27, lineHeight: 37, fontWeight: '700', letterSpacing: -0.9, color: colors.ink },
  bagArea: { height: BAG + 16, alignItems: 'center', justifyContent: 'flex-end', marginTop: 8, zIndex: 2 },
  bag: { width: BAG, height: BAG },
  tile: {
    position: 'absolute', top: 54, width: 46, height: 46, borderRadius: 15, backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.blue, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 },
  },
  foot: { alignItems: 'center', marginTop: 18 },
  hint: { fontSize: 13, lineHeight: 20, color: colors.sub, textAlign: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, paddingHorizontal: 20, marginTop: 18,
    borderRadius: 24, backgroundColor: colors.card,
    shadowColor: colors.blue, shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  pillText: { fontSize: 15, fontWeight: '600', color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7, alignSelf: 'stretch' },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 34, maxWidth: '100%',
    paddingHorizontal: 11, borderRadius: 17, backgroundColor: colors.card,
  },
  addChip: { backgroundColor: 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.checkedBorder },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink, flexShrink: 1 },
});
