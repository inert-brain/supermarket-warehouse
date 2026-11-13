import { Pressable, StyleSheet, Text } from 'react-native';
import { palette, hardShadow } from './theme';

type Props = { title: string; onPress: () => void; disabled?: boolean };
export function BrutalButton({ title, onPress, disabled = false }: Props) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, disabled && styles.disabled,
      pressed && !disabled && styles.pressed]}>
    <Text style={styles.label}>{title}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { backgroundColor: palette.lime, borderWidth: 2, borderColor: palette.ink,
    borderRadius: 3, minHeight: 48, padding: 13, marginVertical: 5,
    alignItems: 'center', justifyContent: 'center', ...hardShadow },
  disabled: { backgroundColor: palette.muted, opacity: 0.6, boxShadow: 'none' },
  pressed: { backgroundColor: palette.orange, transform: [{ translateX: 3 }, { translateY: 3 }], boxShadow: '1px 1px 0px #161712' },
  label: { fontSize: 14, fontWeight: '900', color: palette.ink, textAlign: 'center', letterSpacing: 0.5 },
});
