import React from 'react';
import { TouchableOpacity, type TouchableOpacityProps, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ThemedText } from './ThemedText';
import { useTheme } from '@/context/theme';

export type ThemedButtonProps = TouchableOpacityProps & {
  title: string;
  lightColor?: string;
  darkColor?: string;
  style?: ViewStyle;
};

export function ThemedButton({ title, style, lightColor, darkColor, ...rest }: ThemedButtonProps) {
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'tint');
  const textToken = useThemeColor({}, 'text');
  const { theme } = useTheme();
  // Per request: button label should be black in dark mode
  const labelColor = theme === 'dark' ? '#000' : (textToken as string);

  return (
    <TouchableOpacity {...rest} style={[{ backgroundColor, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6 }, style]}>
      <ThemedText style={{ color: labelColor, textAlign: 'center', fontWeight: '600' }}>{title}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({});

export default ThemedButton;
