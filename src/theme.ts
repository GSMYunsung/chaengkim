export const colors = {
  // Page background is white; grouped content sits on a soft gray inset.
  bg: "#FFFFFF",
  surface: "#F3F5F9",
  // Raised elements placed on top of a surface (inputs, pills, check cards).
  card: "#FFFFFF",
  ink: "#232529",
  sub: "#646B78",
  line: "#E9ECF2",
  border: "#E1E5EE",
  blue: "#6A81FD",
  tint: "#EEF0FF",
  tintStrong: "#E4E8FF",
  checkedBg: "#F5F6FF",
  checkedBorder: "#BFC7FF",
  muted: "#F0F2F6",
  track: "#DDE2F7",
  onAction: "#FFFFFF",
  disabledBg: "#E6E9F0",
  disabledText: "#656D7D",
  warn: "#875011",
  wash: "#FFF5E5",
};

// Pretendard (SIL OFL 1.1), embedded via the expo-font config plugin in app.json.
export const font = "Pretendard";

export const space = {
  screen: 22,
};

export const radius = {
  group: 16,
  button: 12,
  icon: 14,
};

export const type = {
  title: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: "700" as const,
    letterSpacing: -1,
    color: colors.ink,
  },
  heading: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600" as const,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  body: { fontSize: 14, lineHeight: 22, color: colors.sub },
  rowName: { fontSize: 15, fontWeight: "600" as const, color: colors.ink },
  small: { fontSize: 12, lineHeight: 17, color: colors.sub },
};
