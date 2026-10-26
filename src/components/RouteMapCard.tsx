import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Modal } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { RouteMap, PIN_COLORS, type Coord } from './RouteMap';
import { Icon, Text } from './ui';
import { colors, space, type } from '../theme';

const LEGEND = [
  ['출발', PIN_COLORS.start],
  ['머문 곳', PIN_COLORS.stop],
  ['지나간 곳', PIN_COLORS.path],
  ['마지막 위치', PIN_COLORS.end],
] as const;

function Legend({ large }: { large?: boolean }) {
  return (
    <View style={[styles.legend, large && styles.legendLarge]}>
      {LEGEND.map(([label, color]) => (
        <View key={label} style={[styles.legendItem, large && styles.legendChip]}>
          <View style={[styles.legendDot, large && styles.legendDotLarge, { backgroundColor: color }]} />
          <Text style={large ? styles.legendTextLarge : type.small}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Map preview card: tapping it opens the same route full screen, where it can be panned and zoomed.
 * The preview itself doesn't take touches so scrolling the page never drags the map.
 */
export function RouteMapCard({ coords, title, summary, height = 240, legend = true }: {
  coords: Coord[];
  title: string;
  /** Short line shown in the full-screen header, e.g. "3곳 머묾". */
  summary?: string;
  height?: number;
  legend?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <View style={styles.card}>
        <View>
          <RouteMap height={height} coords={coords} />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${title} 지도 크게 보기`}
          >
            <View style={styles.expand}>
              <Icon name="maximize-2" size={14} color={colors.ink} />
              <Text style={styles.expandText}>크게 보기</Text>
            </View>
          </Pressable>
        </View>
        {legend && <Legend />}
      </View>

      <RouteMapFullScreen
        visible={open}
        onClose={() => setOpen(false)}
        title={title}
        summary={summary}
        coords={coords}
      />
    </>
  );
}

/** The route full screen: pannable, zoomable map with a header and legend. */
export function RouteMapFullScreen({ visible, onClose, title, summary, coords }: {
  visible: boolean;
  onClose: () => void;
  title: string;
  summary?: string;
  coords: Coord[];
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      {/* A Modal renders outside the app's provider, so it needs its own to get real insets. */}
      <SafeAreaProvider>
        <SafeAreaView style={styles.full} edges={['top', 'bottom', 'left', 'right']}>
          <View style={styles.fullHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fullTitle} accessibilityRole="header">{title}</Text>
              {!!summary && <Text style={type.small}>{summary}</Text>}
            </View>
            <Pressable
              style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="닫기"
              hitSlop={8}
            >
              <Icon name="x" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <RouteMap fill coords={coords} />
          <View style={styles.fullFooter}>
            <Legend large />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

/** Compact "지도" button that opens the route full screen without rendering a preview map. */
export function RouteMapButton({ coords, title, summary }: { coords: Coord[]; title: string; summary?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.mapButton, pressed && { opacity: 0.75 }]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${title} 지도 보기`}
        hitSlop={6}
      >
        <Icon name="map" size={14} color={colors.blue} />
        <Text style={styles.mapButtonText}>지도</Text>
      </Pressable>
      <RouteMapFullScreen
        visible={open}
        onClose={() => setOpen(false)}
        title={title}
        summary={summary}
        coords={coords}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, padding: 8, overflow: 'hidden' },
  expand: {
    position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 4,
    minHeight: 32, paddingHorizontal: 10, borderRadius: 16, backgroundColor: colors.card,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  mapButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 30, paddingHorizontal: 10,
    borderRadius: 15, backgroundColor: colors.tint,
  },
  mapButtonText: { fontSize: 13, fontWeight: '600', color: colors.blue },
  expandText: { fontSize: 12, fontWeight: '600', color: colors.ink },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 6, paddingTop: 10, paddingBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLarge: { gap: 8, paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 },
  legendChip: {
    gap: 7, minHeight: 38, paddingHorizontal: 13, borderRadius: 19, backgroundColor: colors.surface,
  },
  legendDotLarge: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.card },
  legendTextLarge: { fontSize: 14, fontWeight: '600', color: colors.ink },
  full: { flex: 1, backgroundColor: colors.bg },
  fullHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60,
    paddingHorizontal: space.screen, paddingVertical: 8,
  },
  fullTitle: { fontSize: 17, fontWeight: '600', color: colors.ink },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  fullFooter: { paddingHorizontal: space.screen, paddingTop: 14, paddingBottom: 10 },
});
