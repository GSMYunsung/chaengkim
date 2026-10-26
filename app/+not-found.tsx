import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from '../src/components/ui';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.text}>화면을 찾을 수 없습니다</Text>
        <Link href="/" style={styles.link}>홈으로 돌아가기</Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  text: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  link: { fontSize: 16, color: '#4F8EF7' },
});
