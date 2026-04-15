import { useColorScheme } from "react-native";

import colors from "@/constants/colors";

type Palette = typeof colors.light;

/**
 * Returns the design tokens for the current color scheme.
 * Picks the dark palette on dark devices, falls back to light otherwise.
 */
export function useColors(): Palette & { radius: number } {
  const scheme = useColorScheme();
  const palette: Palette = scheme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
