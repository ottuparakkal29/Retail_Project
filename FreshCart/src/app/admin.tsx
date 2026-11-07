import { useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  type ScrollViewInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';

type Partner = {
  id: number;
  company: string;
  email: string;
  phone: string;
  category: string;
  appliedOn: string;
  status: 'pending' | 'approved';
  initials: string;
  color: string;
};

const startingPartners: Partner[] = [
  {
    id: 1,
    company: 'Green Harvest Co.',
    email: 'greenharvest@mail.com',
    phone: '+91 98765 43210',
    category: 'Manufacturer',
    appliedOn: 'Nov 07, 2026 · 09:42 AM',
    status: 'pending',
    initials: 'GH',
    color: '#e1f3df',
  },
  {
    id: 2,
    company: 'Malabar Dairy Co.',
    email: 'partners@malabardairy.com',
    phone: '+91 98470 12345',
    category: 'Distributor',
    appliedOn: 'Nov 07, 2026 · 08:16 AM',
    status: 'pending',
    initials: 'MD',
    color: '#f8ead2',
  },
  {
    id: 3,
    company: 'Harvest & Hearth',
    email: 'team@harvesthearth.com',
    phone: '+91 98950 67890',
    category: 'Retailer',
    appliedOn: 'Nov 06, 2026 · 04:15 PM',
    status: 'pending',
    initials: 'HH',
    color: '#f5e1dc',
  },
  {
    id: 4,
    company: 'Coastal Spice Works',
    email: 'hello@coastalspice.com',
    phone: '+91 94470 24680',
    category: 'Wholesaler',
    appliedOn: 'Nov 06, 2026 · 02:20 PM',
    status: 'pending',
    initials: 'CS',
    color: '#f6edce',
  },
  {
    id: 5,
    company: 'Nature Foods Co.',
    email: 'naturefoods@mail.com',
    phone: '+91 97460 13579',
    category: 'Manufacturer',
    appliedOn: 'Nov 05, 2026 · 11:15 AM',
    status: 'approved',
    initials: 'NF',
    color: '#e2e8fa',
  },
  {
    id: 6,
    company: 'Healthy Greens Inc.',
    email: 'hello@healthygreens.com',
    phone: '+91 95670 86420',
    category: 'Distributor',
    appliedOn: 'Nov 04, 2026 · 04:20 PM',
    status: 'approved',
    initials: 'HG',
    color: '#e2f0df',
  },
];

export default function AdminScreen() {
  const isWide = useResponsiveBreakpoint(850);
  const [partners, setPartners] = useState(startingPartners);
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Partner | null>(null);
  const [notice, setNotice] = useState('');
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [manufacturerSectionY, setManufacturerSectionY] = useState(0);
  const dashboardScroll = useRef<ScrollViewInstance>(null);

  const pending = useMemo(
    () =>
      partners.filter(
        (partner) =>
          partner.status === 'pending' &&
          `${partner.company} ${partner.email} ${partner.phone} ${partner.category}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [partners, query],
  );
  const approved = useMemo(
    () =>
      partners.filter(
        (partner) =>
          partner.status === 'approved' &&
          `${partner.company} ${partner.email} ${partner.phone} ${partner.category}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [partners, query],
  );

  function approvePartner(partner: Partner) {
    setPartners((current) =>
      current.map((item) =>
        item.id === partner.id ? { ...item, status: 'approved' } : item,
      ),
    );
    setNotice(`${partner.company} has been approved.`);
  }

  function deletePartner() {
    if (!confirmDelete) return;
    setPartners((current) => current.filter((item) => item.id !== confirmDelete.id));
    setNotice(`${confirmDelete.company} has been removed.`);
    setConfirmDelete(null);
  }

  function navigateMobileSection(section: 'dashboard' | 'manufacturers') {
    setMobileMenuVisible(false);
    dashboardScroll.current?.scrollTo({
      y: section === 'dashboard' ? 0 : manufacturerSectionY,
      animated: true,
    });
  }

  function renderTableRows(rows: Partner[], type: 'pending' | 'approved') {
    if (!rows.length) {
      return (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyTitle}>No {type === 'pending' ? 'pending requests' : 'approved partners'} found</Text>
          <Text style={styles.emptySubtitle}>Try another search or check back later.</Text>
        </View>
      );
    }

    return rows.map((partner, index) => (
      <View
        key={partner.id}
        style={[styles.tableRow, index % 2 === 1 && styles.alternateRow, !isWide && styles.mobileTableRow]}>
        {isWide ? <Text style={styles.numberCell}>{index + 1}</Text> : null}
        <View style={[styles.companyCell, !isWide && styles.mobileCompanyCell]}>
          <View style={[styles.companyAvatar, { backgroundColor: partner.color }]}>
            <Text style={styles.companyAvatarText}>{partner.initials}</Text>
          </View>
          <View style={styles.companyInfo}>
            <Text numberOfLines={1} style={styles.companyName}>{partner.company}</Text>
            {!isWide ? (
              <>
                <Text numberOfLines={1} style={styles.mobileContact}>{partner.email}</Text>
                <Text numberOfLines={1} style={styles.mobileContact}>{partner.phone}</Text>
              </>
            ) : null}
          </View>
        </View>
        {isWide ? <Text numberOfLines={1} style={styles.emailCell}>{partner.email}</Text> : null}
        {isWide ? <Text numberOfLines={1} style={styles.phoneCell}>{partner.phone}</Text> : null}
        <View style={[styles.categoryCell, !isWide && styles.mobileCategoryCell]}>
          <Text numberOfLines={1} style={styles.categoryPill}>{partner.category}</Text>
        </View>
        <Text numberOfLines={1} style={[styles.dateCell, !isWide && styles.mobileDateCell]}>{partner.appliedOn}</Text>
        <View style={[styles.actionCell, !isWide && styles.mobileActionCell]}>
          {type === 'pending' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Approve ${partner.company}`}
              onPress={() => approvePartner(partner)}
              style={({ pressed }) => [styles.approveButton, pressed && styles.pressed]}>
              <Text style={styles.approveButtonText}>✓ <Text style={styles.actionLabel}>Approve</Text></Text>
            </Pressable>
          ) : (
            <View style={styles.approvedStatus}>
              <Text style={styles.approvedStatusText}>✓ <Text style={styles.actionLabel}>Approved</Text></Text>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${type === 'pending' ? 'Reject' : 'Delete'} ${partner.company}`}
            onPress={() => setConfirmDelete(partner)}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
            <Text style={styles.deleteButtonText}>× <Text style={styles.actionLabel}>{type === 'pending' ? 'Reject' : 'Delete'}</Text></Text>
          </Pressable>
        </View>
      </View>
    ));
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appFrame}>
        {isWide ? (
          <View style={styles.sidebar}>
            <View style={styles.sidebarBrand}>
              <View style={styles.leafMark}><Text style={styles.leafMarkText}>F</Text></View>
              <View>
                <Text style={styles.sidebarBrandName}>FreshCart</Text>
                <Text style={styles.sidebarBrandCaption}>ADMIN PANEL</Text>
              </View>
            </View>
            <View style={styles.sidebarMenu}>
              <SidebarItem icon="⌂" label="Dashboard" active onPress={() => router.replace('/admin')} />
              <SidebarItem icon="▣" label="Partners" onPress={() => router.replace('/admin')} />
            </View>
            <View style={styles.sidebarBottom}>
              <View style={styles.sidebarPromo}>
                <Text style={styles.promoBasket}>🛒</Text>
                <Text style={styles.promoTitle}>FreshCart</Text>
                <Text style={styles.promoSubtitle}>Good things grow together.</Text>
              </View>
              <Pressable onPress={() => router.replace('/')} style={styles.logoutButton}>
                <Text style={styles.logoutIcon}>↪</Text>
                <Text style={styles.logoutLabel}>Back to storefront</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <ScrollView
          ref={dashboardScroll}
          style={styles.mainScroll}
          contentContainerStyle={styles.pageScroll}
          showsVerticalScrollIndicator={false}>
          <View style={[styles.dashboardContent, isWide && styles.dashboardContentWide]}>
            <View style={styles.topbar}>
              {!isWide ? (
                <View style={styles.mobileHeaderBrand}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open dashboard navigation"
                    accessibilityState={{ expanded: mobileMenuVisible }}
                    onPress={() => setMobileMenuVisible(true)}
                    style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
                    <View style={styles.menuLine} />
                    <View style={styles.menuLine} />
                    <View style={styles.menuLine} />
                  </Pressable>
                  <View style={styles.compactBrand}>
                    <View style={styles.compactMark}><Text style={styles.leafMarkText}>F</Text></View>
                    <Text style={styles.compactBrandName}>FreshCart</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.topbarLeading}>
                  <Text style={styles.topbarPage}>Partner management</Text>
                </View>
              )}
              <View style={styles.topbarActions}>
                <Pressable accessibilityLabel="Notifications" style={styles.notificationButton}>
                  <Text style={styles.bellIcon}>♧</Text>
                  {pending.length > 0 ? <View style={styles.notificationDot} /> : null}
                </Pressable>
                <View style={styles.adminProfile}>
                  <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>A</Text></View>
                  <Text style={styles.profileName}>Admin</Text>
                  <Text style={styles.profileChevron}>⌄</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroBanner}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>FRESHCART PARTNER NETWORK</Text>
                <Text style={styles.heroTitle}>Partner Management</Text>
                <Text style={styles.heroDescription}>
                  Approve and manage the makers behind your marketplace.
                </Text>
              </View>
              <View
                pointerEvents="none"
                style={[styles.heroArtwork, !isWide && styles.heroArtworkCompact]}>
                <View style={[styles.heroLeaf, styles.heroLeafOne]} />
                <View style={[styles.heroLeaf, styles.heroLeafTwo]} />
                <View style={[styles.heroLeaf, styles.heroLeafThree]} />
                <View style={styles.handshakeCircle}><Text style={styles.handshake}>🤝</Text></View>
                <View style={styles.heroDecorCircle} />
              </View>
            </View>

            <View style={styles.categoryTabs}>
              <View style={styles.categoryTabActive}>
                <Text style={styles.categoryTabIcon}>▣</Text>
                <Text style={styles.categoryTabActiveText}>Partners</Text>
                <Text style={styles.categoryTabCount}>{pending.length + approved.length}</Text>
              </View>
              <View style={[styles.searchBox, !isWide && styles.mobileSearchBox]}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  accessibilityLabel="Search partners"
                  onChangeText={setQuery}
                  placeholder="Search partners"
                  placeholderTextColor="#98a39b"
                  style={styles.searchInput}
                  value={query}
                />
              </View>
            </View>

            {notice ? (
              <View accessibilityLiveRegion="polite" style={styles.notice}>
                <Text style={styles.noticeText}>{notice}</Text>
                <Pressable accessibilityLabel="Dismiss notification" onPress={() => setNotice('')}>
                  <Text style={styles.noticeDismiss}>×</Text>
                </Pressable>
              </View>
            ) : null}

            <View
              onLayout={(event) => setManufacturerSectionY(event.nativeEvent.layout.y)}
              style={styles.sectionHeader}>
              <View style={styles.sectionIconPending}><Text style={styles.sectionIconText}>◷</Text></View>
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionTitle}>Pending requests</Text>
                <Text style={styles.sectionSubtitle}>Review and approve new partner applications.</Text>
              </View>
              <View style={styles.sectionHeaderActions}>
                <View style={styles.pendingCount}>
                  <Text style={styles.pendingCountText}>{pending.length} to review</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh partner list"
                  onPress={() => setQuery('')}
                  style={styles.refreshButton}>
                  <Text style={styles.refreshButtonText}>↻ <Text style={styles.actionLabel}>Refresh</Text></Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.tableCard}>
              {isWide ? (
                <View style={styles.tableHeader}>
                  <Text style={styles.numberHeader}>#</Text>
                  <Text style={styles.companyHeader}>Company name</Text>
                  <Text style={styles.emailHeader}>Email</Text>
                  <Text style={styles.phoneHeader}>Phone</Text>
                  <Text style={styles.typeHeader}>Type</Text>
                  <Text style={styles.dateHeader}>Applied on</Text>
                  <Text style={styles.actionsHeader}>Actions</Text>
                </View>
              ) : null}
              {renderTableRows(pending, 'pending')}
            </View>

            <View style={[styles.sectionHeader, styles.approvedSectionHeader]}>
              <View style={styles.sectionIconApproved}><Text style={styles.sectionIconText}>✓</Text></View>
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionTitle}>Approved partners</Text>
                <Text style={styles.sectionSubtitle}>Your trusted partners, ready to grow.</Text>
              </View>
              <View style={styles.approvedCount}>
                <Text style={styles.approvedCountText}>{approved.length} active</Text>
              </View>
            </View>

            <View style={styles.tableCard}>
              {isWide ? (
                <View style={styles.tableHeader}>
                  <Text style={styles.numberHeader}>#</Text>
                  <Text style={styles.companyHeader}>Company name</Text>
                  <Text style={styles.emailHeader}>Email</Text>
                  <Text style={styles.phoneHeader}>Phone</Text>
                  <Text style={styles.typeHeader}>Type</Text>
                  <Text style={styles.dateHeader}>Approved on</Text>
                  <Text style={styles.actionsHeader}>Actions</Text>
                </View>
              ) : null}
              {renderTableRows(approved, 'approved')}
            </View>

            <Text style={styles.disclaimer}>
              Sample partner data · Changes are temporary and reset when the app reloads.
            </Text>
          </View>
        </ScrollView>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setMobileMenuVisible(false)}
        transparent
        visible={mobileMenuVisible}>
        <View style={styles.drawerBackdrop}>
          <View style={styles.mobileDrawer}>
            <View style={styles.drawerHeader}>
              <View style={styles.sidebarBrand}>
                <View style={styles.leafMark}><Text style={styles.leafMarkText}>F</Text></View>
                <View>
                  <Text style={styles.sidebarBrandName}>FreshCart</Text>
                  <Text style={styles.sidebarBrandCaption}>ADMIN PANEL</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close navigation menu"
                onPress={() => setMobileMenuVisible(false)}
                style={styles.drawerClose}>
                <Text style={styles.drawerCloseText}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.drawerSectionLabel}>MENU</Text>
            <View style={styles.drawerMenu}>
              <SidebarItem
                icon="⌂"
                label="Dashboard"
                active
                onPress={() => navigateMobileSection('dashboard')}
              />
              <SidebarItem
                icon="▣"
                label="Partners"
                onPress={() => navigateMobileSection('manufacturers')}
              />
            </View>
            <View style={styles.drawerBottom}>
              <View style={styles.sidebarPromo}>
                <Text style={styles.promoBasket}>🛒</Text>
                <Text style={styles.promoTitle}>FreshCart</Text>
                <Text style={styles.promoSubtitle}>Good things grow together.</Text>
              </View>
              <Pressable onPress={() => router.replace('/')} style={styles.logoutButton}>
                <Text style={styles.logoutIcon}>↪</Text>
                <Text style={styles.logoutLabel}>Back to storefront</Text>
              </Pressable>
            </View>
          </View>
          <Pressable
            accessibilityLabel="Close navigation menu"
            onPress={() => setMobileMenuVisible(false)}
            style={styles.drawerScrim}
          />
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setConfirmDelete(null)}
        transparent
        visible={confirmDelete !== null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}><Text style={styles.confirmIconText}>!</Text></View>
            <Text style={styles.confirmTitle}>
              {confirmDelete?.status === 'pending' ? 'Reject this request?' : 'Delete this partner?'}
            </Text>
            <Text style={styles.confirmMessage}>
              {confirmDelete?.company} will be removed from this sample list.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable onPress={() => setConfirmDelete(null)} style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={deletePartner} style={styles.deleteConfirmButton}>
                <Text style={styles.deleteConfirmText}>
                  {confirmDelete?.status === 'pending' ? 'Reject request' : 'Delete partner'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SidebarItem({
  active = false,
  icon,
  label,
  onPress,
}: {
  active?: boolean;
  icon: string;
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.sidebarItem,
        active && styles.sidebarItemActive,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.sidebarItemIcon, active && styles.sidebarItemIconActive]}>{icon}</Text>
      <Text style={[styles.sidebarItemText, active && styles.sidebarItemTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f7f4',
  },
  appFrame: {
    flex: 1,
    flexDirection: 'row',
  },
  mainScroll: {
    flex: 1,
  },
  pageScroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingBottom: 34,
  },
  dashboardContent: {
    width: '100%',
    paddingHorizontal: 15,
  },
  dashboardContentWide: {
    maxWidth: 1360,
    paddingHorizontal: 28,
  },
  pressed: {
    opacity: 0.76,
  },
  sidebar: {
    width: 218,
    paddingHorizontal: 15,
    paddingVertical: 18,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e7ede7',
    justifyContent: 'space-between',
  },
  sidebarBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 9,
    paddingBottom: 25,
    borderBottomWidth: 1,
    borderBottomColor: '#edf0ed',
  },
  leafMark: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#dcf1d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafMarkText: {
    color: '#1b7539',
    fontSize: 22,
    fontWeight: '900',
  },
  sidebarBrandName: {
    color: '#176a35',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  sidebarBrandCaption: {
    color: '#7d8b7e',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginTop: 2,
  },
  sidebarMenu: {
    flex: 1,
    paddingTop: 17,
  },
  sidebarItem: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 11,
    marginBottom: 4,
    borderRadius: 10,
  },
  sidebarItemActive: {
    backgroundColor: '#e9f8e5',
  },
  sidebarItemIcon: {
    width: 20,
    color: '#526456',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  sidebarItemIconActive: {
    color: '#21823d',
  },
  sidebarItemText: {
    color: '#425146',
    fontSize: 11,
    fontWeight: '600',
  },
  sidebarItemTextActive: {
    color: '#216a35',
    fontWeight: '800',
  },
  sidebarBottom: {
    gap: 13,
  },
  sidebarPromo: {
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 15,
    backgroundColor: '#eff9e9',
  },
  promoBasket: {
    fontSize: 28,
  },
  promoTitle: {
    color: '#28713b',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  promoSubtitle: {
    color: '#789078',
    fontSize: 8,
    marginTop: 3,
  },
  logoutButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
  },
  logoutIcon: {
    color: '#546357',
    fontSize: 17,
  },
  logoutLabel: {
    color: '#536156',
    fontSize: 10,
    fontWeight: '600',
  },
  topbar: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e7ece7',
  },
  topbarLeading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topbarPage: {
    color: '#536357',
    fontSize: 11,
    fontWeight: '700',
  },
  compactBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mobileHeaderBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  menuButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5ebe5',
    backgroundColor: '#ffffff',
  },
  menuLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#3e5a44',
  },
  compactMark: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#dcf1d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactBrandName: {
    color: '#176a35',
    fontSize: 15,
    fontWeight: '900',
  },
  topbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  notificationButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e9eee9',
  },
  bellIcon: {
    color: '#536257',
    fontSize: 16,
  },
  notificationDot: {
    position: 'absolute',
    width: 7,
    height: 7,
    right: 7,
    top: 6,
    borderRadius: 4,
    backgroundColor: '#e25349',
  },
  adminProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  profileAvatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#238b42',
  },
  profileAvatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  profileName: {
    color: '#35443a',
    fontSize: 10,
    fontWeight: '700',
  },
  profileChevron: {
    color: '#748078',
    fontSize: 14,
  },
  drawerBackdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(20,37,24,0.42)',
  },
  drawerScrim: {
    flex: 1,
  },
  mobileDrawer: {
    width: 285,
    maxWidth: '84%',
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 18,
    backgroundColor: '#ffffff',
    justifyContent: 'space-between',
    shadowColor: '#172c1c',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#edf0ed',
  },
  drawerClose: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dfe9df',
    backgroundColor: '#f0f7ee',
  },
  drawerCloseText: {
    color: '#3e7048',
    fontSize: 24,
    lineHeight: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  drawerSectionLabel: {
    color: '#98a39a',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 20,
    marginBottom: 9,
    paddingHorizontal: 11,
  },
  drawerMenu: {
    flex: 1,
  },
  drawerBottom: {
    gap: 13,
  },
  heroBanner: {
    minHeight: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 17,
    paddingHorizontal: 22,
    paddingVertical: 20,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#d8f6ad',
  },
  heroCopy: {
    flex: 1,
    zIndex: 1,
  },
  heroEyebrow: {
    color: '#397641',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 7,
  },
  heroTitle: {
    color: '#153e20',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  heroDescription: {
    maxWidth: 450,
    color: '#325a37',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  heroArtwork: {
    width: 200,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroArtworkCompact: {
    width: 100,
  },
  handshakeCircle: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.65)',
    zIndex: 1,
  },
  handshake: {
    fontSize: 38,
  },
  heroDecorCircle: {
    position: 'absolute',
    width: 180,
    height: 180,
    right: -80,
    top: -30,
    borderRadius: 100,
    backgroundColor: 'rgba(100,190,67,0.2)',
  },
  heroLeaf: {
    position: 'absolute',
    width: 24,
    height: 48,
    borderTopLeftRadius: 24,
    borderBottomRightRadius: 24,
    backgroundColor: '#6fbd4b',
    transform: [{ rotate: '35deg' }],
  },
  heroLeafOne: {
    top: 8,
    right: 29,
  },
  heroLeafTwo: {
    bottom: 8,
    right: 5,
    transform: [{ rotate: '-35deg' }],
    backgroundColor: '#91ce63',
  },
  heroLeafThree: {
    top: 2,
    left: 18,
    height: 36,
    backgroundColor: '#57a943',
    transform: [{ rotate: '-38deg' }],
  },
  categoryTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 14,
    marginBottom: 17,
  },
  categoryTabActive: {
    minHeight: 37,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    backgroundColor: '#218c3d',
  },
  categoryTabIcon: {
    color: '#ffffff',
    fontSize: 13,
  },
  categoryTabActiveText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  categoryTabCount: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  searchBox: {
    height: 36,
    width: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e4eae4',
    borderRadius: 9,
    backgroundColor: '#ffffff',
  },
  searchIcon: {
    color: '#819087',
    fontSize: 19,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontFamily: 'Poppins_400Regular',
    color: '#324338',
    fontSize: 10,
  },
  mobileSearchBox: {
    width: '100%',
  },
  notice: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#d3e9d1',
    borderRadius: 10,
    backgroundColor: '#eef8ec',
  },
  noticeText: {
    color: '#326643',
    fontSize: 10,
    fontWeight: '600',
  },
  noticeDismiss: {
    color: '#598366',
    fontSize: 19,
    paddingHorizontal: 4,
  },
  sectionHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: '#eef8e9',
    borderWidth: 1,
    borderColor: '#e4eee2',
    borderBottomWidth: 0,
  },
  approvedSectionHeader: {
    marginTop: 18,
    backgroundColor: '#edf8eb',
  },
  sectionIconPending: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#34a648',
  },
  sectionIconApproved: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#259445',
  },
  sectionIconText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  sectionTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    color: '#26392c',
    fontSize: 14,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#6f7d71',
    fontSize: 10,
    marginTop: 3,
  },
  sectionHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingCount: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#fff2d6',
  },
  pendingCountText: {
    color: '#986d27',
    fontSize: 9,
    fontWeight: '800',
  },
  refreshButton: {
    minHeight: 29,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#208d3d',
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  approvedCount: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#dff3df',
  },
  approvedCountText: {
    color: '#347246',
    fontSize: 9,
    fontWeight: '800',
  },
  tableCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5eae5',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    backgroundColor: '#ffffff',
  },
  tableHeader: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#f4f6f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e8ece8',
  },
  numberHeader: {
    width: 34,
    color: '#566258',
    fontSize: 10,
    fontWeight: '800',
  },
  numberCell: {
    width: 34,
    color: '#69766d',
    fontSize: 10,
  },
  companyHeader: {
    flex: 1.1,
    color: '#566258',
    fontSize: 10,
    fontWeight: '800',
  },
  emailHeader: {
    flex: 1.15,
    color: '#566258',
    fontSize: 10,
    fontWeight: '800',
  },
  phoneHeader: {
    flex: 0.9,
    color: '#566258',
    fontSize: 10,
    fontWeight: '800',
  },
  typeHeader: {
    flex: 0.75,
    color: '#566258',
    fontSize: 10,
    fontWeight: '800',
  },
  dateHeader: {
    flex: 1.1,
    color: '#566258',
    fontSize: 10,
    fontWeight: '800',
  },
  actionsHeader: {
    width: 170,
    color: '#566258',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  tableRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#edf0ed',
  },
  alternateRow: {
    backgroundColor: '#fcfdfc',
  },
  mobileTableRow: {
    minHeight: 0,
    flexWrap: 'wrap',
    paddingVertical: 10,
    rowGap: 7,
  },
  mobileCompanyCell: {
    width: '100%',
    flexBasis: '100%',
    flexGrow: 0,
  },
  companyCell: {
    width: 30,
    flex: 1.15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  companyAvatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  companyAvatarText: {
    color: '#43644a',
    fontSize: 8,
    fontWeight: '800',
  },
  companyInfo: {
    flex: 1,
    minWidth: 0,
  },
  companyName: {
    color: '#29392e',
    fontSize: 10,
    fontWeight: '800',
  },
  mobileContact: {
    color: '#819087',
    fontSize: 9,
    marginTop: 3,
  },
  emailCell: {
    flex: 1.15,
    color: '#59665d',
    fontSize: 10,
  },
  phoneCell: {
    flex: 0.9,
    color: '#59665d',
    fontSize: 10,
  },
  categoryCell: {
    flex: 0.75,
    alignItems: 'flex-start',
  },
  mobileCategoryCell: {
    flex: 1,
  },
  categoryPill: {
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    color: '#387448',
    fontSize: 9,
    fontWeight: '700',
    backgroundColor: '#e4f6e4',
  },
  dateCell: {
    flex: 1.1,
    color: '#59665d',
    fontSize: 9,
  },
  mobileDateCell: {
    flex: 1,
    textAlign: 'right',
  },
  actionCell: {
    width: 170,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  mobileActionCell: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  approveButton: {
    minWidth: 82,
    minHeight: 31,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: '#238f40',
  },
  approveButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  actionLabel: {
    fontWeight: '700',
  },
  deleteButton: {
    minWidth: 74,
    minHeight: 31,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#f0d0ce',
    borderRadius: 15,
    backgroundColor: '#fff0ef',
  },
  deleteButtonText: {
    color: '#c84d47',
    fontSize: 10,
    fontWeight: '800',
  },
  approvedStatus: {
    minWidth: 82,
    minHeight: 31,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 15,
    backgroundColor: '#e7f6e6',
  },
  approvedStatusText: {
    color: '#3e8250',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyRow: {
    alignItems: 'center',
    paddingVertical: 25,
  },
  emptyTitle: {
    color: '#48594d',
    fontSize: 11,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: '#89948b',
    fontSize: 10,
    marginTop: 4,
  },
  disclaimer: {
    color: '#8a958d',
    fontSize: 8,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 17,
  },
  modalBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(19,38,25,0.48)',
  },
  confirmCard: {
    width: '100%',
    maxWidth: 390,
    padding: 23,
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  confirmIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#fbedeb',
  },
  confirmIconText: {
    color: '#a64c43',
    fontSize: 20,
    fontWeight: '800',
  },
  confirmTitle: {
    color: '#293a2e',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 16,
  },
  confirmMessage: {
    color: '#748078',
    fontSize: 11,
    lineHeight: 18,
    marginTop: 7,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 22,
  },
  cancelButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e3e9e3',
    borderRadius: 9,
  },
  cancelButtonText: {
    color: '#526157',
    fontSize: 10,
    fontWeight: '700',
  },
  deleteConfirmButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: '#a74740',
  },
  deleteConfirmText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
