# maestro-test project settings, sourced by run.sh (bash). See ~/.claude/skills/maestro-test.

# Bundle ID of the app on the simulator. Flows can use it as ${APP_ID}.
APP_ID="com.yuncastlee.chaengkim"
# Heading of report.html
REPORT_TITLE="챙김 화면 테스트"
# Simulator used when none is booted (or pass SIM=<UDID>)
SIM_MODEL="iPhone 17 Pro"

# Expo dev client: URL scheme and Metro port (8081 is taken by another checkout, so this project uses 8082).
EXPO_SCHEME="chaengkim"
METRO_PORT=8082

# Seoul (Seongsu), so home registration and nearby places work.
LOCATION="37.5446,127.0557"
# Location "always" so onboarding/home registration and leave detection work.
GRANT=(location-always)

# Turn on the simulator's Reduce Motion so looping animations stop and the screen settles between taps
# (the app should honor AccessibilityInfo.isReduceMotionEnabled). 0 to test with full motion.
REDUCE_MOTION=1
