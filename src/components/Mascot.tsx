import React, { useEffect, useState } from 'react';
import { Animated, Easing, AccessibilityInfo, type StyleProp, type ImageStyle } from 'react-native';

// 챙김 mascot: the bag character. Cut from the character sheet with a white floor shadow baked in,
// so place it on white (colors.bg / colors.card) backgrounds.
export const MASCOT = {
  idle: require('../../assets/bag/bag-idle.png'),
  happy: require('../../assets/bag/bag-happy.png'),
  heart: require('../../assets/bag/bag-heart.png'),
  packing: require('../../assets/bag/bag-packing.png'),
  question: require('../../assets/bag/bag-question.png'),
  alert: require('../../assets/bag/bag-alert.png'),
  walk: require('../../assets/bag/bag-walk.png'),
  hum: require('../../assets/bag/bag-hum.png'),
  sleep: require('../../assets/bag/bag-sleep.png'),
};
export type MascotPose = keyof typeof MASCOT;

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** The mascot in a given pose. It breathes gently unless `still` or the user prefers reduced motion. */
export function Mascot({ pose, size = 120, still, style }: {
  pose: MascotPose;
  size?: number;
  still?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  const reduce = useReduceMotion();
  const [float] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (still || reduce) { float.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [still, reduce, float]);

  return (
    <Animated.Image
      source={MASCOT[pose]}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        { width: size, height: size },
        { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.025] }) }] },
        style,
      ]}
    />
  );
}
