import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';

import { ThemedText } from './themed-text';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Explores</TabButton>
          </TabTrigger>
          <TabTrigger name="admin" href="/admin" asChild>
            <TabButton>Dashboard</TabButton>
          </TabTrigger>
          <TabTrigger name="analytics" href="/analytics" asChild>
            <TabButton>Analytics</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const { ref, ...pressableProps } = props;
  void ref;

  return (
    <Pressable
      {...pressableProps}
      style={({ pressed }) => [styles.tabButton, isFocused && styles.tabButtonSelected, pressed && styles.pressed]}>
      <View style={styles.tabButtonView}>
        <ThemedText type="smallBold" style={isFocused ? styles.selectedLabel : styles.label}>
          {children}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const isDesktop = useResponsiveBreakpoint(760);

  return (
    <View {...props} style={[styles.tabListContainer, isDesktop && styles.desktopTabList]}>
      <View style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          FreshCart
        </ThemedText>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderTopWidth: 1,
    borderTopColor: '#e8eee8',
  },
  desktopTabList: {
    display: 'none',
  },
  innerContainer: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  brandText: {
    color: '#07552c',
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButton: {
    borderRadius: 20,
  },
  tabButtonSelected: {
    backgroundColor: '#dff3e3',
  },
  tabButtonView: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  label: {
    color: '#68756b',
  },
  selectedLabel: {
    color: '#138a39',
  },
});
