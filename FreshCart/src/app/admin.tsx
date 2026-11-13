import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
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
import { supabase } from '@/lib/supabase';

type Partner = {
  id: string;
  company: string;
  email: string;
  phone: string;
  category: string;
  appliedOn: string;
  status: 'pending' | 'approved';
  initials: string;
  color: string;
  contactName: string;
  gstin: string;
  licenseNumber: string;
  fssaiNumber: string;
  district: string;
  address: string;
  licenseDocumentPath: string | null;
};

type BusinessNotificationRecord = {
  business_profile_id: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

const avatarColors = ['#e1f3df', '#f8ead2', '#f5e1dc', '#f6edce', '#e2e8fa', '#e2f0df'];

const partnerTypes = ['All types', 'Manufacturer', 'Retailer', 'Wholesaler', 'Distributor'] as const;

export default function AdminScreen() {
  const isWide = useResponsiveBreakpoint(850);
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [informedPartnerIds, setInformedPartnerIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<(typeof partnerTypes)[number]>('All types');
  const [rejectPartnerTarget, setRejectPartnerTarget] = useState<Partner | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvePartnerTarget, setApprovePartnerTarget] = useState<Partner | null>(null);
  const [manualNotificationTarget, setManualNotificationTarget] = useState<Partner | null>(null);
  const [manualNotificationMessage, setManualNotificationMessage] = useState('');
  const [detailsPartner, setDetailsPartner] = useState<Partner | null>(null);
  const [licenseImageUrl, setLicenseImageUrl] = useState<string | null>(null);
  const [licensePreviewError, setLicensePreviewError] = useState('');
  const [licensePreviewLoading, setLicensePreviewLoading] = useState(false);
  const [licenseZoomVisible, setLicenseZoomVisible] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingPartnerId, setSavingPartnerId] = useState<string | null>(null);
  const [adminProfileId, setAdminProfileId] = useState<string | null>(null);
  const [welcomeVisible, setWelcomeVisible] = useState(
    () => welcome === 'true',
  );
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [manufacturerSectionY, setManufacturerSectionY] = useState(0);
  const dashboardScroll = useRef<ScrollViewInstance>(null);

  const loadPartners = useCallback(async () => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      setLoading(true);
      setPartners([]);
      setInformedPartnerIds(new Set());
      setAdminProfileId(null);
      setNotice('');
      setNoticeIsError(false);
      if (userError) throw userError;
      if (!userData.user) {
        router.replace('/');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('auth_user_id', userData.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (profile?.role !== 'admin') {
        router.replace('/');
        return;
      }
      setAdminProfileId(profile.id);

      const { data, error } = await supabase
        .from('business_profiles')
        .select(
          'id, business_name, business_type, contact_name, contact_email, contact_phone, license_number, gstin, fssai_number, district, address, license_document_path, created_at, approval_status',
        )
        .in('approval_status', ['pending', 'approved'])
        .order('created_at', { ascending: false });
      if (error) throw error;

      setPartners(
        (data ?? []).map((business, index) => {
          const company = String(business.business_name || 'Business');
          const initials = company
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0])
            .join('')
            .toUpperCase();

          return {
            id: business.id,
            company,
            email: business.contact_email ?? '',
            phone: business.contact_phone ?? '',
            category: business.business_type ?? 'Other',
            appliedOn: business.created_at
              ? new Date(business.created_at).toLocaleString()
              : '—',
            status: business.approval_status === 'approved' ? 'approved' : 'pending',
            initials: initials || 'B',
            color: avatarColors[index % avatarColors.length],
            contactName: business.contact_name ?? '',
            gstin: business.gstin ?? '',
            licenseNumber: business.license_number ?? '',
            fssaiNumber: business.fssai_number ?? '',
            district: business.district ?? '',
            address: business.address ?? '',
            licenseDocumentPath: business.license_document_path ?? null,
          };
        }),
      );

      const { data: sentMessages, error: sentMessagesError } = await supabase.rpc(
        'admin_list_business_notifications',
      );
      if (sentMessagesError) {
        setNotice(
          `Business applications loaded, but the informed-business list could not be loaded: ${getErrorMessage(sentMessagesError, 'Unknown error')}`,
        );
        setNoticeIsError(true);
        return;
      }
      setInformedPartnerIds(
        new Set(
          (sentMessages ?? []).map(
            (message: BusinessNotificationRecord) => message.business_profile_id,
          ),
        ),
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Unable to load business applications.',
      );
      setNoticeIsError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadPartners();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadPartners]);

  const filteredPartners = useMemo(
    () =>
      partners.filter((partner) => {
        const matchesSearch = `${partner.company} ${partner.email} ${partner.phone} ${partner.category}`
          .toLowerCase()
          .includes(query.trim().toLowerCase());
        const matchesType = typeFilter === 'All types' || partner.category === typeFilter;
        return matchesSearch && matchesType;
      }),
    [partners, query, typeFilter],
  );
  const pending = useMemo(
    () =>
      filteredPartners.filter(
        (partner) =>
          partner.status === 'pending' && !informedPartnerIds.has(partner.id),
      ),
    [filteredPartners, informedPartnerIds],
  );
  const informedPending = useMemo(
    () =>
      filteredPartners.filter(
        (partner) =>
          partner.status === 'pending' && informedPartnerIds.has(partner.id),
      ),
    [filteredPartners, informedPartnerIds],
  );
  const approved = useMemo(
    () => filteredPartners.filter((partner) => partner.status === 'approved'),
    [filteredPartners],
  );

  if (!adminProfileId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.accessGate}>
          <Text style={styles.accessGateTitle}>
            {loading ? 'Verifying admin access...' : 'Admin access required'}
          </Text>
          {!loading && notice ? <Text style={styles.accessGateMessage}>{notice}</Text> : null}
          {!loading ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/')}
              style={styles.accessGateButton}>
              <Text style={styles.accessGateButtonText}>Back to storefront</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  async function approvePartner(partner: Partner) {
    if (!adminProfileId || savingPartnerId) return;
    setSavingPartnerId(partner.id);
    setNotice('');
    try {
      const { error } = await supabase.rpc('admin_review_business', {
        p_business_id: partner.id,
        p_decision: 'approved',
      });
      if (error) throw error;

      setPartners((current) =>
        current.map((item) =>
          item.id === partner.id ? { ...item, status: 'approved' } : item,
        ),
      );
      setNotice(`${partner.company} has been approved.`);
      setNoticeIsError(false);
      setApprovePartnerTarget(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to approve this business.');
      setNoticeIsError(true);
    } finally {
      setSavingPartnerId(null);
    }
  }

  async function rejectBusiness() {
    const reason = rejectionReason.trim();
    if (!rejectPartnerTarget || !reason || savingPartnerId) return;
    setSavingPartnerId(rejectPartnerTarget.id);
    setNotice('');
    try {
      const { error } = await supabase.rpc('admin_review_business', {
        p_business_id: rejectPartnerTarget.id,
        p_decision: 'rejected',
        p_message: reason,
      });
      if (error) throw error;

      setPartners((current) => current.filter((item) => item.id !== rejectPartnerTarget.id));
      setNotice(`${rejectPartnerTarget.company} has been rejected.`);
      setNoticeIsError(false);
      setRejectPartnerTarget(null);
      setRejectionReason('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to reject this business.');
      setNoticeIsError(true);
    } finally {
      setSavingPartnerId(null);
    }
  }

  async function sendManualNotification() {
    const message = manualNotificationMessage.trim();
    if (!adminProfileId || !manualNotificationTarget || !message || savingPartnerId) return;

    setSavingPartnerId(manualNotificationTarget.id);
    setNotice('');
    try {
      const { error } = await supabase.rpc('admin_send_business_notification', {
        p_business_id: manualNotificationTarget.id,
        p_message: message,
      });
      if (error) throw error;

      setNotice(`Information sent to ${manualNotificationTarget.company}.`);
      setNoticeIsError(false);
      setInformedPartnerIds((current) => new Set(current).add(manualNotificationTarget.id));
      setManualNotificationTarget(null);
      setManualNotificationMessage('');
    } catch (error) {
      setNotice(getErrorMessage(error, 'Unable to send this message.'));
      setNoticeIsError(true);
    } finally {
      setSavingPartnerId(null);
    }
  }

  async function openPartnerDetails(partner: Partner) {
    setDetailsPartner(partner);
    setLicenseImageUrl(null);
    setLicensePreviewError('');
    setLicensePreviewLoading(Boolean(partner.licenseDocumentPath));
    if (!partner.licenseDocumentPath) return;

    try {
      const { data, error } = await supabase.storage
        .from('business-licenses')
        .createSignedUrl(partner.licenseDocumentPath, 600);
      if (error) throw error;
      setLicenseImageUrl(data.signedUrl);
    } catch (error) {
      setLicensePreviewError(
        error instanceof Error ? error.message : 'Unable to load the license image.',
      );
    } finally {
      setLicensePreviewLoading(false);
    }
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
          <Text style={styles.emptyTitle}>
            {loading
              ? 'Loading business applications...'
              : `No ${type === 'pending' ? 'pending requests' : 'approved partners'} found`}
          </Text>
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View details for ${partner.company}`}
            onPress={() => void openPartnerDetails(partner)}
            style={styles.detailsButton}>
            <Text style={styles.detailsButtonText}>Details</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Send an information message to ${partner.company}`}
            disabled={savingPartnerId !== null}
            onPress={() => {
              setManualNotificationMessage('');
              setManualNotificationTarget(partner);
            }}
            style={({ pressed }) => [
              styles.informButton,
              pressed && styles.pressed,
              savingPartnerId !== null && styles.disabledButton,
            ]}>
            <Text style={styles.informButtonText}>✉ <Text style={styles.actionLabel}>Inform</Text></Text>
          </Pressable>
          {type === 'pending' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Approve ${partner.company}`}
              disabled={savingPartnerId !== null}
              onPress={() => setApprovePartnerTarget(partner)}
              style={({ pressed }) => [
                styles.approveButton,
                pressed && styles.pressed,
                savingPartnerId === partner.id && styles.disabledButton,
              ]}>
              <Text style={styles.approveButtonText}>
                ✓ <Text style={styles.actionLabel}>
                  {savingPartnerId === partner.id ? 'Saving...' : 'Approve'}
                </Text>
              </Text>
            </Pressable>
          ) : (
            <View style={styles.approvedStatus}>
              <Text style={styles.approvedStatusText}>✓ <Text style={styles.actionLabel}>Approved</Text></Text>
            </View>
          )}
          {type === 'pending' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reject ${partner.company}`}
              disabled={savingPartnerId !== null}
              onPress={() => {
                setRejectionReason('');
                setRejectPartnerTarget(partner);
              }}
              style={({ pressed }) => [
                styles.deleteButton,
                pressed && styles.pressed,
                savingPartnerId !== null && styles.disabledButton,
              ]}>
              <Text style={styles.deleteButtonText}>× <Text style={styles.actionLabel}>Reject</Text></Text>
            </Pressable>
          ) : null}
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
              <SidebarItem icon="▤" label="Analytics" onPress={() => router.push('/analytics')} />
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
                    accessibilityLabel="More dashboard options"
                    accessibilityState={{ expanded: mobileMenuVisible }}
                    onPress={() => setMobileMenuVisible(true)}
                    style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
                    <Text style={styles.menuDots}>⋮</Text>
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
                <Text style={styles.categoryTabCount}>
                  {pending.length + informedPending.length + approved.length}
                </Text>
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

            <View style={styles.partnerFilters}>
              <Text style={styles.partnerFilterLabel}>Business type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.partnerFilterOptions}>
                {partnerTypes.map((type) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: typeFilter === type }}
                    key={type}
                    onPress={() => setTypeFilter(type)}
                    style={[
                      styles.partnerFilterChip,
                      typeFilter === type && styles.partnerFilterChipSelected,
                    ]}>
                    <Text
                      style={[
                        styles.partnerFilterChipText,
                        typeFilter === type && styles.partnerFilterChipTextSelected,
                      ]}>
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {typeFilter !== 'All types' ? (
                <Text style={styles.partnerFilterResult}>
                  Showing {pending.length + informedPending.length + approved.length}{' '}
                  {typeFilter.toLowerCase()}
                  {pending.length + informedPending.length + approved.length === 1 ? '' : 's'}
                </Text>
              ) : null}
            </View>

            {notice ? (
              <View
                accessibilityLiveRegion="polite"
                style={[styles.notice, noticeIsError && styles.noticeError]}>
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
                <Text style={styles.sectionSubtitle}>Review new applications that have not been informed.</Text>
              </View>
              <View style={styles.sectionHeaderActions}>
                <View style={styles.pendingCount}>
                  <Text style={styles.pendingCountText}>{pending.length} to review</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Refresh partner list"
                  disabled={loading}
                  onPress={() => void loadPartners()}
                  style={styles.refreshButton}>
                  <Text style={styles.refreshButtonText}>
                    ↻ <Text style={styles.actionLabel}>{loading ? 'Loading...' : 'Refresh'}</Text>
                  </Text>
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

            <View style={[styles.sectionHeader, styles.informedSectionHeader]}>
              <View style={styles.sectionIconInformed}><Text style={styles.sectionIconText}>✉</Text></View>
              <View style={styles.sectionTitleBlock}>
                <Text style={styles.sectionTitle}>Pending information follow-up</Text>
                <Text style={styles.sectionSubtitle}>
                  Businesses you have informed; approve or reject them when ready.
                </Text>
              </View>
              <View style={styles.informedCount}>
                <Text style={styles.informedCountText}>{informedPending.length} informed</Text>
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
              {renderTableRows(informedPending, 'pending')}
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
              Business applications are loaded from Supabase.
            </Text>
          </View>
        </ScrollView>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setDetailsPartner(null)}
        transparent
        visible={detailsPartner !== null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.detailsCard}>
            <View style={styles.detailsHeader}>
              <View style={styles.detailsTitleBlock}>
                <Text style={styles.detailsEyebrow}>BUSINESS APPLICATION</Text>
                <Text style={styles.detailsTitle}>{detailsPartner?.company}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close business details"
                onPress={() => setDetailsPartner(null)}
                style={styles.detailsCloseButton}>
                <Text style={styles.detailsCloseText}>×</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.detailsScroll} contentContainerStyle={styles.detailsContent}>
              <DetailsItem label="Contact name" value={detailsPartner?.contactName} />
              <DetailsItem label="Shop / business name" value={detailsPartner?.company} />
              <DetailsItem label="Phone number" value={detailsPartner?.phone} />
              <DetailsItem label="Email" value={detailsPartner?.email} />
              <DetailsItem label="GST number" value={detailsPartner?.gstin} />
              <DetailsItem label="License number" value={detailsPartner?.licenseNumber} />
              <DetailsItem label="FSSAI number" value={detailsPartner?.fssaiNumber} />
              <DetailsItem label="District" value={detailsPartner?.district} />
              <DetailsItem label="Address" value={detailsPartner?.address} />
              <Text style={styles.detailsImageLabel}>License photo</Text>
              {licensePreviewLoading ? (
                <Text style={styles.detailsImagePlaceholder}>Loading license photo...</Text>
              ) : licenseImageUrl ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open license photo"
                  onPress={() => setLicenseZoomVisible(true)}>
                  <Image
                    source={{ uri: licenseImageUrl }}
                    style={styles.licenseThumbnail}
                    contentFit="contain"
                  />
                  <Text style={styles.imageHint}>Tap the photo to view full size</Text>
                </Pressable>
              ) : licensePreviewError ? (
                <Text accessibilityRole="alert" style={styles.detailsImageError}>
                  {licensePreviewError}
                </Text>
              ) : (
                <Text style={styles.detailsImagePlaceholder}>No license photo uploaded.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setLicenseZoomVisible(false)}
        transparent
        visible={licenseZoomVisible && licenseImageUrl !== null}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close full-size license photo"
          onPress={() => setLicenseZoomVisible(false)}
          style={styles.licenseZoomBackdrop}>
          {licenseImageUrl ? (
            <Image
              source={{ uri: licenseImageUrl }}
              style={styles.licenseFullImage}
              contentFit="contain"
            />
          ) : null}
          <Text style={styles.licenseZoomClose}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setApprovePartnerTarget(null)}
        transparent
        visible={approvePartnerTarget !== null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.approveConfirmIcon}><Text style={styles.confirmIconText}>✓</Text></View>
            <Text style={styles.confirmTitle}>Approve this business?</Text>
            <Text style={styles.confirmMessage}>
              {approvePartnerTarget?.company} will receive an automatic approval notification.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                disabled={savingPartnerId !== null}
                onPress={() => setApprovePartnerTarget(null)}
                style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={savingPartnerId !== null}
                onPress={() => approvePartnerTarget && void approvePartner(approvePartnerTarget)}
                style={[styles.approveConfirmButton, savingPartnerId !== null && styles.disabledButton]}>
                <Text style={styles.deleteConfirmText}>
                  {savingPartnerId === approvePartnerTarget?.id ? 'Approving...' : 'Approve & notify'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
                icon="▤"
                label="Analytics"
                onPress={() => {
                  setMobileMenuVisible(false);
                  router.push('/analytics');
                }}
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
        onRequestClose={() => setRejectPartnerTarget(null)}
        transparent
        visible={rejectPartnerTarget !== null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}><Text style={styles.confirmIconText}>!</Text></View>
            <Text style={styles.confirmTitle}>Reject this request?</Text>
            <Text style={styles.confirmMessage}>
              {rejectPartnerTarget?.company} will receive the automatic rejection notice followed by your message in the same notification.
            </Text>
            <Text style={styles.rejectionReasonLabel}>Message to business *</Text>
            <TextInput
              accessibilityLabel="Message to the rejected business"
              editable={savingPartnerId === null}
              multiline
              onChangeText={setRejectionReason}
              placeholder="Write a note explaining what needs to be corrected..."
              placeholderTextColor="#8b958d"
              style={styles.rejectionReasonInput}
              textAlignVertical="top"
              value={rejectionReason}
            />
            <View style={styles.confirmActions}>
              <Pressable
                disabled={savingPartnerId !== null}
                onPress={() => setRejectPartnerTarget(null)}
                style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!rejectionReason.trim() || savingPartnerId !== null}
                onPress={() => void rejectBusiness()}
                style={[
                  styles.deleteConfirmButton,
                  (!rejectionReason.trim() || savingPartnerId !== null) && styles.disabledButton,
                ]}>
                <Text style={styles.deleteConfirmText}>
                  {savingPartnerId === rejectPartnerTarget?.id ? 'Rejecting...' : 'Reject & notify'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setManualNotificationTarget(null)}
        transparent
        visible={manualNotificationTarget !== null}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.informConfirmIcon}><Text style={styles.informConfirmIconText}>✉</Text></View>
            <Text style={styles.confirmTitle}>Send information?</Text>
            <Text style={styles.confirmMessage}>
              Send a separate in-app notification to {manualNotificationTarget?.company}.
            </Text>
            <Text style={styles.rejectionReasonLabel}>Message *</Text>
            <TextInput
              accessibilityLabel="Information message to the business"
              editable={savingPartnerId === null}
              multiline
              onChangeText={setManualNotificationMessage}
              placeholder="Write the information you want to share..."
              placeholderTextColor="#8b958d"
              style={styles.rejectionReasonInput}
              textAlignVertical="top"
              value={manualNotificationMessage}
            />
            <View style={styles.confirmActions}>
              <Pressable
                disabled={savingPartnerId !== null}
                onPress={() => setManualNotificationTarget(null)}
                style={styles.cancelButton}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!manualNotificationMessage.trim() || savingPartnerId !== null}
                onPress={() => void sendManualNotification()}
                style={[
                  styles.informConfirmButton,
                  (!manualNotificationMessage.trim() || savingPartnerId !== null) && styles.disabledButton,
                ]}>
                <Text style={styles.informConfirmButtonText}>
                  {savingPartnerId === manualNotificationTarget?.id ? 'Sending...' : 'Send information'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setWelcomeVisible(false)}
        transparent
        visible={welcomeVisible}>
        <View style={styles.welcomeBackdrop}>
          <View
            accessibilityRole="alert"
            accessibilityViewIsModal
            style={styles.welcomeCard}>
            <View pointerEvents="none" style={styles.welcomeConfetti}>
              <View style={[styles.welcomeConfettiDot, styles.welcomeDotOne]} />
              <View style={[styles.welcomeConfettiDot, styles.welcomeDotTwo]} />
              <View style={[styles.welcomeConfettiDot, styles.welcomeDotThree]} />
              <View style={[styles.welcomeConfettiDot, styles.welcomeDotFour]} />
            </View>
            <View style={styles.welcomeIcon}>
              <Text style={styles.welcomeCheck}>✓</Text>
            </View>
            <Text style={styles.welcomeTitle}>Welcome back, Admin!</Text>
            <Text style={styles.welcomeMessage}>
              You’re signed in. Your business applications are ready for review.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setWelcomeVisible(false)}
              style={({ pressed }) => [
                styles.welcomeButton,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.welcomeButtonText}>Continue</Text>
              <Text style={styles.welcomeButtonArrow}>→</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailsItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.detailsItem}>
      <Text style={styles.detailsLabel}>{label}</Text>
      <Text style={styles.detailsValue}>{value?.trim() || 'Not provided'}</Text>
    </View>
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
  accessGate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  accessGateTitle: {
    color: '#293a2e',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  accessGateMessage: {
    color: '#748078',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
  },
  accessGateButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 18,
    borderRadius: 10,
    backgroundColor: '#238f40',
  },
  accessGateButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  welcomeBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(19,38,25,0.48)',
  },
  welcomeCard: {
    width: '100%',
    maxWidth: 390,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 34,
    paddingBottom: 28,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#173e27',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 10,
  },
  welcomeConfetti: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  welcomeConfettiDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  welcomeDotOne: {
    top: 34,
    left: '16%',
    backgroundColor: '#ffcb63',
  },
  welcomeDotTwo: {
    top: 38,
    right: '16%',
    backgroundColor: '#ef9d88',
  },
  welcomeDotThree: {
    top: 108,
    left: '9%',
    backgroundColor: '#75bd70',
  },
  welcomeDotFour: {
    top: 108,
    right: '9%',
    backgroundColor: '#8bb6e8',
  },
  welcomeIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: '#eaf7e9',
  },
  welcomeCheck: {
    color: '#21823d',
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
  },
  welcomeTitle: {
    color: '#293a2e',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 20,
  },
  welcomeMessage: {
    maxWidth: 300,
    color: '#748078',
    fontSize: 11,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
  welcomeButton: {
    minHeight: 46,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 25,
    borderRadius: 14,
    backgroundColor: '#238f40',
  },
  welcomeButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  welcomeButtonArrow: {
    color: '#ffffff',
    fontSize: 17,
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
  menuDots: {
    color: '#3e5a44',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
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
  partnerFilters: {
    gap: 8,
    marginBottom: 15,
  },
  partnerFilterLabel: {
    color: '#68766b',
    fontSize: 9,
    fontWeight: '700',
  },
  partnerFilterOptions: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 2,
  },
  partnerFilterChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e1e9e1',
    borderRadius: 17,
    backgroundColor: '#ffffff',
  },
  partnerFilterChipSelected: {
    borderColor: '#218c3d',
    backgroundColor: '#e9f8e5',
  },
  partnerFilterChipText: {
    color: '#627067',
    fontSize: 9,
    fontWeight: '600',
  },
  partnerFilterChipTextSelected: {
    color: '#216a35',
    fontWeight: '800',
  },
  partnerFilterResult: {
    color: '#78857b',
    fontSize: 9,
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
  noticeError: {
    borderColor: '#f0d0ce',
    backgroundColor: '#fff0ef',
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
  informedSectionHeader: {
    marginTop: 18,
    backgroundColor: '#eef5fb',
    borderColor: '#dce9f2',
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
  sectionIconInformed: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#4384a6',
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
  informedCount: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#dcecf6',
  },
  informedCountText: {
    color: '#356d8e',
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
    width: 312,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  mobileActionCell: {
    width: '100%',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
  },
  detailsButton: {
    minWidth: 56,
    minHeight: 31,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#dce8dc',
    borderRadius: 15,
    backgroundColor: '#f7fbf6',
  },
  detailsButtonText: {
    color: '#42654a',
    fontSize: 10,
    fontWeight: '700',
  },
  informButton: {
    minWidth: 70,
    minHeight: 31,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: '#c9e2f2',
    borderRadius: 15,
    backgroundColor: '#eef8fd',
  },
  informButtonText: {
    color: '#347292',
    fontSize: 10,
    fontWeight: '800',
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
  approveConfirmIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#e5f4e3',
  },
  approveConfirmButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: '#238f40',
  },
  disabledButton: {
    opacity: 0.55,
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
  detailsCard: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e8eee8',
  },
  detailsTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  detailsEyebrow: {
    color: '#589063',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  detailsTitle: {
    color: '#293a2e',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  detailsCloseButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#f2f6f2',
  },
  detailsCloseText: {
    color: '#54645a',
    fontSize: 22,
    lineHeight: 24,
  },
  detailsScroll: {
    flexShrink: 1,
  },
  detailsContent: {
    padding: 18,
  },
  detailsItem: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1ee',
  },
  detailsLabel: {
    color: '#7b897e',
    fontSize: 9,
    fontWeight: '700',
  },
  detailsValue: {
    color: '#304235',
    fontSize: 12,
    marginTop: 3,
  },
  detailsImageLabel: {
    color: '#425146',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  detailsImagePlaceholder: {
    padding: 14,
    borderRadius: 10,
    color: '#748078',
    fontSize: 10,
    backgroundColor: '#f5f8f5',
  },
  detailsImageError: {
    padding: 14,
    borderRadius: 10,
    color: '#a74740',
    fontSize: 10,
    backgroundColor: '#fff0ef',
  },
  licenseThumbnail: {
    width: '100%',
    height: 210,
    borderRadius: 10,
    backgroundColor: '#f3f6f3',
  },
  imageHint: {
    color: '#718174',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 5,
  },
  licenseZoomBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  licenseFullImage: {
    width: '100%',
    height: '85%',
  },
  licenseZoomClose: {
    color: '#ffffff',
    fontSize: 11,
    marginTop: 12,
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
  informConfirmIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#eaf5fb',
  },
  informConfirmIconText: {
    color: '#347292',
    fontSize: 18,
  },
  informConfirmButton: {
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 9,
    backgroundColor: '#347fa0',
  },
  informConfirmButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
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
  rejectionReasonLabel: {
    color: '#425146',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 6,
  },
  rejectionReasonInput: {
    minHeight: 100,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#e3e9e3',
    borderRadius: 9,
    color: '#324338',
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
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
