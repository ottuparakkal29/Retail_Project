import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

function getFontFamily(fontWeight: TextStyle['fontWeight']) {
  const weight =
    typeof fontWeight === 'number'
      ? fontWeight
      : fontWeight === 'bold'
        ? 700
        : Number(fontWeight) || 400;

  if (weight >= 900) return 'Poppins_900Black';
  if (weight >= 800) return 'Poppins_800ExtraBold';
  if (weight >= 700) return 'Poppins_700Bold';
  if (weight >= 600) return 'Poppins_600SemiBold';
  if (weight >= 500) return 'Poppins_500Medium';
  return 'Poppins_400Regular';
}

export function AppText({ style, ...props }: TextProps) {
  const flattenedStyle = StyleSheet.flatten(style);

  return (
    <Text
      {...props}
      style={[
        {
          fontFamily:
            flattenedStyle?.fontFamily ?? getFontFamily(flattenedStyle?.fontWeight),
        },
        style,
      ]}
    />
  );
}
