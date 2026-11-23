import { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText as Text } from '@/components/app-text';
import { Palette } from '@/constants/palette';

type ProductImageProps = {
  uri: string | null;
  name: string;
  style?: StyleProp<ViewStyle>;
  fallbackFontSize?: number;
};

// Renders the product photo, or a tinted initial tile when there is no photo or it fails to load.
export function ProductImage({ uri, name, style, fallbackFontSize = 30 }: ProductImageProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = Boolean(uri) && failedUri !== uri;
  const initial = name.trim().slice(0, 1).toUpperCase() || '•';

  return (
    <View
      accessibilityLabel={showImage ? name : `${name}, no photo available`}
      accessibilityRole="image"
      style={[styles.frame, style]}>
      {showImage && uri ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={150}
          onError={() => setFailedUri(uri)}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Text style={[styles.initial, { fontSize: fallbackFontSize }]}>{initial}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: Palette.tint,
  },
  initial: {
    color: '#8db08f',
    fontWeight: '800',
  },
});
