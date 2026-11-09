import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { useCart } from '@/contexts/cart-context';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';

const GREEN = '#138a39';
const DARK_GREEN = '#07552c';

export default function ProfileScreen() {
  const isWide = useResponsiveBreakpoint(760);
  const { itemCount, subtotal } = useCart();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.pageScroll}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.content, isWide && styles.contentWide]}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
            <View>
              <Text style={styles.brandName}>FreshCart</Text>
              <Text style={styles.brandCaption}>YOUR ACCOUNT</Text>
            </View>
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>GUEST</Text>
            </View>
          </View>

          <View style={styles.heading}>
            <Text style={styles.eyebrow}>A LITTLE ABOUT YOU</Text>
            <Text style={styles.title}>My profile</Text>
            <Text style={styles.subtitle}>Your FreshCart account, all in one place.</Text>
          </View>

          <View style={[styles.mainGrid, isWide && styles.mainGridWide]}>
            <View style={[styles.primaryColumn, isWide && styles.primaryColumnWide]}>
              <View style={styles.profileCard}>
                <View style={styles.profileTopRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>G</Text>
                  </View>
                  <View style={styles.profileIdentity}>
                    <Text style={styles.profileName}>Welcome, shopper!</Text>
                    <Text style={styles.profileEmail}>You are browsing as a guest</Text>
                  </View>
                </View>
                <View style={styles.profileDivider} />
                <Text style={styles.profileHint}>
                  Sign in when you are ready to keep your details and orders together.
                </Text>
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeading}>
                  <View>
                    <Text style={styles.cardTitle}>Account details</Text>
                    <Text style={styles.cardSubtitle}>Your profile information</Text>
                  </View>
                  <View style={styles.cardIcon}><Text style={styles.cardIconText}>●</Text></View>
                </View>
                <DetailRow label="Account type" value="Guest shopper" icon="◉" />
                <DetailRow label="Email address" value="Not added yet" icon="✉" />
                <DetailRow label="Phone number" value="Not added yet" icon="☎" last />
              </View>

              <View style={styles.card}>
                <View style={styles.cardHeading}>
                  <View>
                    <Text style={styles.cardTitle}>Delivery address</Text>
                    <Text style={styles.cardSubtitle}>Where should we bring your fresh picks?</Text>
                  </View>
                  <View style={[styles.cardIcon, styles.addressIcon]}>
                    <Text style={[styles.cardIconText, styles.addressIconText]}>⌖</Text>
                  </View>
                </View>
                <View style={styles.addressEmpty}>
                  <Text style={styles.addressTitle}>No saved address yet</Text>
                  <Text style={styles.addressHint}>
                    Add your address during checkout to make your next order easier.
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.secondaryColumn, isWide && styles.secondaryColumnWide]}>
              <View style={styles.cartCard}>
                <View style={styles.cartCardTop}>
                  <View>
                    <Text style={styles.cartEyebrow}>YOUR SHOPPING</Text>
                    <Text style={styles.cartTitle}>Cart snapshot</Text>
                  </View>
                  <View style={styles.cartIcon}><Text style={styles.cartIconText}>🛒</Text></View>
                </View>
                <View style={styles.cartMetrics}>
                  <View style={styles.cartMetric}>
                    <Text style={styles.cartMetricValue}>{itemCount}</Text>
                    <Text style={styles.cartMetricLabel}>items</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.cartMetric}>
                    <Text style={styles.cartMetricValue}>₹{subtotal}</Text>
                    <Text style={styles.cartMetricLabel}>cart total</Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/cart')}
                  style={({ pressed }) => [styles.cartButton, pressed && styles.pressed]}>
                  <Text style={styles.cartButtonText}>View my cart</Text>
                  <Text style={styles.cartButtonArrow}>→</Text>
                </Pressable>
              </View>

              <View style={styles.noteCard}>
                <View style={styles.noteIcon}><Text style={styles.noteIconText}>✦</Text></View>
                <View style={styles.noteCopy}>
                  <Text style={styles.noteTitle}>Freshness made simple</Text>
                  <Text style={styles.noteBody}>
                    Browse the store and add your favourites whenever you like.
                  </Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/')}
                style={({ pressed }) => [styles.shopButton, pressed && styles.pressed]}>
                <Text style={styles.shopButtonText}>Continue shopping</Text>
                <Text style={styles.shopButtonArrow}>→</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  icon,
  label,
  last = false,
  value,
}: {
  icon: string;
  label: string;
  last?: boolean;
  value: string;
}) {
  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <View style={styles.detailIcon}><Text style={styles.detailIconText}>{icon}</Text></View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f6f8f5',
  },
  pageScroll: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 112,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  contentWide: {
    maxWidth: 1050,
  },
  brandRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GREEN,
  },
  brandMarkText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  brandName: {
    color: DARK_GREEN,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  brandCaption: {
    color: '#839087',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 1,
  },
  demoBadge: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#e7f4e8',
  },
  demoBadgeText: {
    color: GREEN,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  heading: {
    marginTop: 30,
    marginBottom: 20,
  },
  eyebrow: {
    color: GREEN,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  title: {
    color: '#203128',
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 38,
    marginTop: 4,
  },
  subtitle: {
    color: '#79867d',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  mainGrid: {
    gap: 14,
  },
  mainGridWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 18,
  },
  primaryColumn: {
    flex: 1,
    gap: 13,
  },
  primaryColumnWide: {
    flex: 1.35,
  },
  secondaryColumn: {
    gap: 13,
  },
  secondaryColumnWide: {
    flex: 0.85,
  },
  profileCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: DARK_GREEN,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2b7746',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 25,
    fontWeight: '800',
  },
  profileIdentity: {
    flex: 1,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
  },
  profileEmail: {
    color: '#c4dfca',
    fontSize: 11,
    marginTop: 3,
  },
  profileDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginVertical: 14,
  },
  profileHint: {
    color: '#e1efe4',
    fontSize: 11,
    lineHeight: 17,
  },
  card: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderWidth: 1,
    borderColor: '#e7ece7',
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 9,
  },
  cardTitle: {
    color: '#26392c',
    fontSize: 14,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#89948b',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eaf5eb',
  },
  cardIconText: {
    color: GREEN,
    fontSize: 15,
    fontWeight: '700',
  },
  detailRow: {
    minHeight: 57,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#eff2ef',
  },
  detailRowLast: {
    borderBottomWidth: 0,
  },
  detailIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f7f3',
  },
  detailIconText: {
    color: '#66816c',
    fontSize: 15,
  },
  detailCopy: {
    flex: 1,
  },
  detailLabel: {
    color: '#8a958c',
    fontSize: 9,
  },
  detailValue: {
    color: '#35473a',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  addressIcon: {
    backgroundColor: '#f1f0e5',
  },
  addressIconText: {
    color: '#9b883e',
    fontSize: 21,
  },
  addressEmpty: {
    paddingVertical: 15,
    paddingHorizontal: 13,
    marginBottom: 15,
    borderRadius: 12,
    backgroundColor: '#f7f9f6',
  },
  addressTitle: {
    color: '#455649',
    fontSize: 11,
    fontWeight: '700',
  },
  addressHint: {
    color: '#829087',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 4,
  },
  cartCard: {
    padding: 17,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7ece7',
  },
  cartCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartEyebrow: {
    color: GREEN,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  cartTitle: {
    color: '#26392c',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },
  cartIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eaf5eb',
  },
  cartIconText: {
    fontSize: 19,
  },
  cartMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 15,
  },
  cartMetric: {
    flex: 1,
  },
  cartMetricValue: {
    color: DARK_GREEN,
    fontSize: 20,
    fontWeight: '800',
  },
  cartMetricLabel: {
    color: '#89948b',
    fontSize: 9,
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#e9eee9',
    marginHorizontal: 12,
  },
  cartButton: {
    minHeight: 43,
    borderRadius: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: GREEN,
  },
  cartButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  cartButtonArrow: {
    color: '#ffffff',
    fontSize: 18,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 15,
    borderRadius: 16,
    backgroundColor: '#edf5e9',
  },
  noteIcon: {
    width: 31,
    height: 31,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dcebd6',
  },
  noteIconText: {
    color: GREEN,
    fontSize: 16,
  },
  noteCopy: {
    flex: 1,
  },
  noteTitle: {
    color: '#35573a',
    fontSize: 11,
    fontWeight: '800',
  },
  noteBody: {
    color: '#708675',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
  shopButton: {
    minHeight: 46,
    paddingHorizontal: 15,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d8e6d9',
    backgroundColor: '#ffffff',
  },
  shopButtonText: {
    color: DARK_GREEN,
    fontSize: 11,
    fontWeight: '700',
  },
  shopButtonArrow: {
    color: GREEN,
    fontSize: 18,
  },
  pressed: {
    opacity: 0.78,
  },
});
