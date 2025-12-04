/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/Colors';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const system = useColorScheme() ?? 'light';
  let theme = system;
  try {
    // lazy require to avoid circular imports during module initialization
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const themeMod = require('@/context/theme') as any;
    if (themeMod && typeof themeMod.useTheme === 'function') {
      const ctx = themeMod.useTheme();
      if (ctx && ctx.theme) theme = ctx.theme;
    }
  } catch (e) {
    theme = system;
  }
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
