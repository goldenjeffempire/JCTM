/**
 * JCTM Design Tokens — Mobile
 *
 * Synced from jctm-platform/src/index.css custom properties.
 * Light palette: warm white + deep navy + cyan accent.
 * Dark palette: deep navy background + cyan primary.
 */

const colors = {
  light: {
    text: "#003366",
    tint: "#1BBFE8",

    background: "#FAFAF5",
    foreground: "#003366",

    card: "#FAF7F2",
    cardForeground: "#003366",

    primary: "#003366",
    primaryForeground: "#FFFFFF",

    secondary: "#EDF2F9",
    secondaryForeground: "#003366",

    muted: "#EDF0F5",
    mutedForeground: "#4D6FA5",

    accent: "#1BBFE8",
    accentForeground: "#FFFFFF",

    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",

    border: "#C8D8EC",
    input: "#C8D8EC",
  },

  dark: {
    text: "#E8F0FC",
    tint: "#1BBFE8",

    background: "#001533",
    foreground: "#E8F0FC",

    card: "#002244",
    cardForeground: "#E8F0FC",

    primary: "#1BBFE8",
    primaryForeground: "#001533",

    secondary: "#002A55",
    secondaryForeground: "#E8F0FC",

    muted: "#003366",
    mutedForeground: "#8AA8CC",

    accent: "#1BBFE8",
    accentForeground: "#001533",

    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",

    border: "#1A3A66",
    input: "#1A3A66",
  },

  radius: 12,
};

export default colors;
