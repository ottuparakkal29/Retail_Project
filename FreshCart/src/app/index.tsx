import { useEffect, useMemo, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { KeralaLocationSelectors } from '@/components/kerala-location-selectors';
import NotificationWrapper from '@/components/notification-wrapper';
import { useCart } from '@/contexts/cart-context';
import { useKeralaLocations } from '@/hooks/use-kerala-locations';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';
import { supabase } from '@/lib/supabase';

const GREEN = '#138a39';
const DARK_GREEN = '#07552c';
const MUTED = '#68756b';

const businessTypes = ['Manufacturer', 'Retailer', 'Wholesaler', 'Distributor'] as const;
type Shop = {
  id: string;
  business_name: string;
  business_type: string | null;
  district: string | null;
  taluk: string | null;
  village: string | null;
  address: string | null;
  contact_phone: string | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export default function HomeScreen() {
  const isWide = useResponsiveBreakpoint(760);
  const isTablet = useResponsiveBreakpoint(600);
  const { itemCount } = useCart();
  const {
    locations,
    loading: locationsLoading,
    error: locationsError,
  } = useKeralaLocations();
  const [query, setQuery] = useState('');
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopsLoading, setShopsLoading] = useState(true);
  const [shopsError, setShopsError] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTaluk, setSelectedTaluk] = useState('');
  const [selectedVillage, setSelectedVillage] = useState('');
  const [signupVisible, setSignupVisible] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupAddress, setSignupAddress] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupMessage, setSignupMessage] = useState('');
  const [signupMessageType, setSignupMessageType] = useState<'error' | 'success'>('error');
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [signupMode, setSignupMode] = useState<'customer' | 'business'>('customer');
  const [businessType, setBusinessType] = useState<(typeof businessTypes)[number] | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [businessContact, setBusinessContact] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessPassword, setBusinessPassword] = useState('');
  const [businessLicenseNumber, setBusinessLicenseNumber] = useState('');
  const [businessGstin, setBusinessGstin] = useState('');
  const [businessFssai, setBusinessFssai] = useState('');
  const [businessDistrict, setBusinessDistrict] = useState('');
  const [businessTaluk, setBusinessTaluk] = useState('');
  const [businessVillage, setBusinessVillage] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [licenseImageName, setLicenseImageName] = useState('');
  const [licenseImage, setLicenseImage] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [businessMessage, setBusinessMessage] = useState('');
  const [businessSubmitting, setBusinessSubmitting] = useState(false);
  const [loginVisible, setLoginVisible] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ title: string; message: string } | null>(null);
  const [homeNotice, setHomeNotice] = useState('');
  const [homeNoticeIsError] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedInEmail(session?.user.email ?? null);
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadShops() {
      setShopsLoading(true);
      setShopsError('');
      const { data, error } = await supabase
        .from('business_profiles')
        .select('id, business_name, business_type, district, taluk, village, address, contact_phone')
        .eq('approval_status', 'approved')
        .order('business_name');
      if (!active) return;
      if (error) {
        setShopsError(error.message);
      } else {
        setShops((data ?? []) as Shop[]);
      }
      setShopsLoading(false);
    }

    void loadShops().catch((error: unknown) => {
      if (active) {
        setShopsError(getErrorMessage(error, 'Unable to load shops right now.'));
        setShopsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const visibleShops = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return shops.filter((shop) => {
      const matchesDistrict =
        !selectedDistrict || shop.district?.trim() === selectedDistrict;
      const matchesTaluk = !selectedTaluk || shop.taluk?.trim() === selectedTaluk;
      const matchesVillage = !selectedVillage || shop.village?.trim() === selectedVillage;
      const matchesSearch =
        !normalizedQuery ||
        shop.business_name.toLowerCase().includes(normalizedQuery) ||
        (shop.business_type ?? '').toLowerCase().includes(normalizedQuery);
      return matchesDistrict && matchesTaluk && matchesVillage && matchesSearch;
    });
  }, [query, shops, selectedDistrict, selectedTaluk, selectedVillage]);

  async function signIn() {
    const email = loginUsername.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !loginPassword) {
      setLoginError('Enter a valid email address and password.');
      return;
    }

    setLoginSubmitting(true);
    setLoginError('');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: loginPassword,
      });
      if (error) throw error;
      if (!data.user) throw new Error('Supabase did not return a signed-in user.');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();
      if (profileError) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
        throw profileError;
      }
      setLoginVisible(false);
      setLoginError('');
      setLoginUsername('');
      setLoginPassword('');
      if (profile?.role === 'admin') {
        router.push({ pathname: '/admin', params: { welcome: 'true' } });
      } else {
        setCelebration({
          title: 'Welcome back!',
          message: 'You’re signed in and ready to shop fresh.',
        });
        router.replace('/');
      }
    } catch (error) {
      setLoginError(getErrorMessage(error, 'Unknown sign-in error. Please try again.'));
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function createCustomerAccount() {
    const fullName = signupName.trim();
    const email = signupEmail.trim().toLowerCase();
    const phone = signupPhone.trim();
    const address = signupAddress.trim();
    const phoneDigits = phone.replace(/\D/g, '');

    setSignupMessageType('error');
    if (
      !fullName ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      phoneDigits.length < 7 ||
      phoneDigits.length > 15 ||
      signupPassword.length < 8
    ) {
      setSignupMessage(
        'Enter your name, a valid email and phone number, and a password of at least 8 characters.',
      );
      return;
    }

    setSignupSubmitting(true);
    setSignupMessage('');
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: signupPassword,
        options: {
          data: {
            full_name: fullName,
            phone,
            address,
          },
        },
      });

      if (error) {
        setSignupMessage(error.message);
        return;
      }

      if (!data.user) {
        setSignupMessage('Supabase did not return a user. Please try again.');
        return;
      }

      setCelebration({
        title: 'Welcome to FreshCart!',
        message: data.session
          ? 'Your account is ready. Let’s find something fresh.'
          : 'Your account is created. Confirm your email to get started.',
      });
      setSignupVisible(false);
      router.replace('/');
      setSignupMessage('');
      setSignupPassword('');
    } catch (error) {
      setSignupMessage(
        `Unable to create your account. ${
          error instanceof Error ? error.message : 'Please try again.'
        }`,
      );
    } finally {
      setSignupSubmitting(false);
    }
  }

  async function chooseLicenseImage() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled) {
        setLicenseImage(result.assets[0]);
        setLicenseImageName(result.assets[0].name);
        setBusinessMessage('');
      }
    } catch (error) {
      setBusinessMessage(
        `Unable to open the image picker. ${
          error instanceof Error ? error.message : 'Please try again.'
        }`,
      );
    }
  }

  async function submitBusinessRegistration() {
    const phoneDigits = businessPhone.replace(/\D/g, '');
    const email = businessEmail.trim().toLowerCase();
    if (
      !businessType ||
      !businessName.trim() ||
      !businessContact.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      phoneDigits.length < 7 ||
      phoneDigits.length > 15 ||
      businessPassword.length < 8 ||
      !businessLicenseNumber.trim() ||
      !businessDistrict ||
      !businessTaluk ||
      !businessVillage ||
      !businessAddress.trim() ||
      !licenseImage
    ) {
      setBusinessMessage(
        'Complete all required fields, select a district, taluk, and village, upload a license image, and use a valid email, phone number, and password.',
      );
      return;
    }

    setBusinessSubmitting(true);
    setBusinessMessage('');
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: businessPassword,
        options: {
          data: {
            account_type: 'business',
            full_name: businessContact.trim(),
            phone: businessPhone.trim(),
            business_name: businessName.trim(),
            business_type: businessType,
            contact_name: businessContact.trim(),
            contact_email: email,
            contact_phone: businessPhone.trim(),
            license_number: businessLicenseNumber.trim(),
            gstin: businessGstin.trim() || null,
            fssai_number: businessFssai.trim() || null,
            district: businessDistrict,
            taluk: businessTaluk,
            village: businessVillage,
            address: businessAddress.trim(),
          },
        },
      });

      if (error) {
        setBusinessMessage(error.message);
        return;
      }

      if (!data.user) {
        setBusinessMessage('Supabase did not return a user. Please try again.');
        return;
      }

      if (!data.session) {
        setCelebration({
          title: 'Application received!',
          message:
            'Confirm your email to continue. Your business details are saved; sign in afterward to upload your license image.',
        });
        setSignupVisible(false);
        router.replace('/');
        setBusinessPassword('');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) {
        throw new Error('Your account was created, but its profile is not ready yet. Please sign in and try again.');
      }

      const { data: businessProfile, error: businessProfileError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (businessProfileError) throw businessProfileError;
      if (!businessProfile) {
        throw new Error('Your business application is not ready yet. Please sign in and try again.');
      }

      const safeFileName = licenseImage.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const documentPath = `${data.user.id}/${Date.now()}-${safeFileName}`;
      const fileResponse = await fetch(licenseImage.uri);
      if (!fileResponse.ok) {
        throw new Error('Could not read the selected license image.');
      }
      const file = await fileResponse.blob();
      const { error: uploadError } = await supabase.storage
        .from('business-licenses')
        .upload(documentPath, file, {
          contentType: licenseImage.mimeType ?? 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Business application saved, but license upload failed: ${uploadError.message}`);
      }

      const { error: pathError } = await supabase.rpc('set_business_license_path', {
        p_path: documentPath,
      });
      if (pathError) {
        throw new Error(
          `License uploaded, but its profile link could not be saved: ${pathError.message}`,
        );
      }

      setCelebration({
        title: 'Congratulations!',
        message: 'Your business application and license image are submitted for review.',
      });
      setSignupVisible(false);
      router.replace('/');
      setBusinessPassword('');
    } catch (error) {
      setBusinessMessage(
        error instanceof Error ? error.message : 'Unable to submit the business application.',
      );
    } finally {
      setBusinessSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: isWide ? 36 : 92 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={[styles.header, isWide && styles.wideHeader]}>
            <Pressable onPress={() => setQuery('')} style={styles.brand}>
              <Text style={styles.brandLeaf}>🌿</Text>
              <View>
                <Text style={styles.brandName}>FreshCart</Text>
                <Text style={styles.brandTagline}>Groceries made easy</Text>
              </View>
            </Pressable>

            {isWide && (
              <View style={[styles.searchBar, styles.wideSearchBar]}>
                <TextInput
                  accessibilityLabel="Search shops"
                  placeholder="Search shops..."
                  placeholderTextColor="#8b958d"
                  value={query}
                  onChangeText={setQuery}
                  style={styles.searchInput}
                />
                <View style={styles.searchIcon}>
                  <Text style={styles.searchIconText}>⌕</Text>
                </View>
              </View>
            )}

            <View style={[styles.headerActions, !isWide && styles.headerActionsCompact]}>
              {isWide && (
                <View style={styles.location}>
                  <Text style={styles.locationIcon}>⌖</Text>
                  <Text style={styles.locationText}>
                    {selectedDistrict || 'Kerala'}
                  </Text>
                </View>
              )}
              <View style={[styles.authActions, !isWide && styles.authActionsCompact]}>
                {signupVisible || loginVisible ? null : !signedInEmail ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open customer and business registration"
                    onPress={() => {
                      setSignupVisible(true);
                      setSignupMode('customer');
                    }}
                    style={({ pressed }) => [
                      styles.signupButton,
                      pressed && styles.authPressed,
                    ]}>
                    <View style={styles.personHead} />
                    <View style={styles.personShoulders} />
                  </Pressable>
                ) : (
                  <NotificationWrapper />
                )}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open cart, ${itemCount} items`}
                onPress={() => router.push('/cart')}
                style={styles.cartButton}>
                <Text style={styles.cartIcon}>🛒</Text>
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{itemCount}</Text>
                </View>
              </Pressable>
            </View>
          </View>

          {homeNotice ? (
            <View
              accessibilityLiveRegion="polite"
              style={[styles.homeNotice, homeNoticeIsError && styles.homeNoticeError]}>
              <Text style={styles.homeNoticeText}>{homeNotice}</Text>
              <Pressable
                accessibilityLabel="Dismiss notification"
                onPress={() => setHomeNotice('')}>
                <Text style={styles.homeNoticeDismiss}>×</Text>
              </Pressable>
            </View>
          ) : null}

          {!isWide && (
            <View style={styles.searchBar}>
              <TextInput
                accessibilityLabel="Search shops"
                placeholder="Search shops..."
                placeholderTextColor="#8b958d"
                value={query}
                onChangeText={setQuery}
                style={styles.searchInput}
              />
              <View style={styles.searchIcon}>
                <Text style={styles.searchIconText}>⌕</Text>
              </View>
            </View>
          )}

          <View style={styles.directoryIntro}>
            <Text style={styles.directoryEyebrow}>SHOP LOCAL, SHOP FRESH</Text>
            <Text style={styles.directoryTitle}>Find your next favourite shop</Text>
            <Text style={styles.directorySubtitle}>
              Browse approved FreshCart businesses by district, taluk, and village.
            </Text>
          </View>

          <View style={styles.locationFilters}>
            <KeralaLocationSelectors
              district={selectedDistrict}
              taluk={selectedTaluk}
              village={selectedVillage}
              locations={locations}
              onDistrictChange={setSelectedDistrict}
              onTalukChange={setSelectedTaluk}
              onVillageChange={setSelectedVillage}
              includeAllOptions
              direction={isTablet ? 'row' : 'column'}
              disabled={locationsLoading || Boolean(locationsError)}
            />
            {locationsError ? (
              <Text style={styles.locationError}>
                Unable to load Kerala locations: {locationsError}
              </Text>
            ) : null}
          </View>

          <View style={styles.shopSection}>
            <View style={styles.shopSectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>
                  {!selectedDistrict && !selectedTaluk && !selectedVillage
                    ? 'Explore shops'
                    : 'Shops near you'}
                </Text>
                <Text style={styles.shopCount}>
                  {shopsLoading ? 'Finding approved shops…' : `${visibleShops.length} shops`}
                </Text>
              </View>
              {selectedDistrict || selectedTaluk || selectedVillage ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSelectedDistrict('');
                    setSelectedTaluk('');
                    setSelectedVillage('');
                  }}>
                  <Text style={styles.viewAll}>Clear filters ×</Text>
                </Pressable>
              ) : null}
            </View>
            {shopsError ? (
              <View style={styles.directoryEmpty}>
                <Text style={styles.emptyTitle}>We couldn’t load shops</Text>
                <Text style={styles.emptyHint}>{shopsError}</Text>
              </View>
            ) : shopsLoading ? (
              <View style={styles.directoryEmpty}>
                <Text style={styles.emptyHint}>Loading approved shops…</Text>
              </View>
            ) : visibleShops.length ? (
              <View style={styles.shopGrid}>
                {visibleShops.map((shop) => (
                  <Pressable
                    key={shop.id}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${shop.business_name}, ${shop.business_type ?? 'business'}`}
                    onPress={() =>
                      router.push({ pathname: '/shop', params: { id: shop.id } })
                    }
                    style={({ pressed }) => [
                      styles.shopCard,
                      { flexBasis: isWide ? '31%' : isTablet ? '47%' : '100%' },
                      pressed && styles.shopCardPressed,
                    ]}>
                    <View style={styles.shopCardTop}>
                      <View style={styles.shopIcon}>
                        <Text style={styles.shopIconText}>
                          {shop.business_name.slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <Text numberOfLines={1} style={styles.businessTypeBadge}>
                        {shop.business_type || 'Business'}
                      </Text>
                    </View>
                    <Text numberOfLines={2} style={styles.shopName}>{shop.business_name}</Text>
                    <Text numberOfLines={1} style={styles.shopLocation}>
                      ⌖ {[shop.village, shop.taluk, shop.district].filter(Boolean).join(', ') || 'Kerala'}
                    </Text>
                    <Text style={styles.shopCardLink}>Visit shop <Text style={styles.buttonArrow}>→</Text></Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.directoryEmpty}>
                <Text style={styles.emptyEmoji}>⌖</Text>
                <Text style={styles.emptyTitle}>No shops found here yet</Text>
                <Text style={styles.emptyHint}>
                  Try another district, taluk, or village to discover approved shops.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => {
          setSignupVisible(false);
          setSignupMessage('');
          setBusinessMessage('');
        }}
        transparent
        visible={signupVisible}>
        <View style={styles.signupBackdrop}>
          <View style={styles.signupCard}>
            <ScrollView
              contentContainerStyle={styles.signupScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.signupScroll}>
              <View style={styles.signupHeading}>
                <View style={styles.signupIcon}>
                  <Text style={styles.signupIconText}>✳</Text>
                </View>
                <Pressable
                  accessibilityLabel="Close registration"
                  onPress={() => {
                    setSignupVisible(false);
                    setSignupMessage('');
                    setBusinessMessage('');
                  }}
                  style={styles.signupClose}>
                  <Text style={styles.signupCloseText}>×</Text>
                </Pressable>
              </View>
              <Text style={styles.signupTitle}>Join the FreshCart family</Text>
              <Text style={styles.signupSubtitle}>Choose the account you want to create.</Text>
              <View style={styles.registrationModes}>
                {(['customer', 'business'] as const).map((mode) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: signupMode === mode }}
                    key={mode}
                    onPress={() => {
                      setSignupMode(mode);
                      setSignupMessage('');
                      setBusinessMessage('');
                    }}
                    style={[
                      styles.registrationMode,
                      signupMode === mode && styles.registrationModeSelected,
                    ]}>
                    <Text
                      style={[
                        styles.registrationModeText,
                        signupMode === mode && styles.registrationModeTextSelected,
                      ]}>
                      {mode === 'customer' ? 'Customer' : 'Business'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {signupMode === 'customer' ? (
                <>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>Your name</Text>
                    <TextInput
                      accessibilityLabel="Your name"
                      onChangeText={setSignupName}
                      placeholder="Enter your name"
                      placeholderTextColor="#8b958d"
                      style={styles.signupInput}
                      value={signupName}
                    />
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>Email address</Text>
                    <TextInput
                      accessibilityLabel="Email address"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onChangeText={setSignupEmail}
                      placeholder="you@example.com"
                      placeholderTextColor="#8b958d"
                      style={styles.signupInput}
                      value={signupEmail}
                    />
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>Phone number</Text>
                    <TextInput
                      accessibilityLabel="Phone number"
                      autoComplete="tel"
                      keyboardType="phone-pad"
                      onChangeText={setSignupPhone}
                      placeholder="Enter your phone number"
                      placeholderTextColor="#8b958d"
                      style={styles.signupInput}
                      value={signupPhone}
                    />
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>Delivery address</Text>
                    <TextInput
                      accessibilityLabel="Delivery address"
                      autoComplete="street-address"
                      multiline
                      onChangeText={setSignupAddress}
                      placeholder="Street, town, and PIN code"
                      placeholderTextColor="#8b958d"
                      style={[styles.signupInput, styles.addressInput]}
                      value={signupAddress}
                    />
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>Password</Text>
                    <TextInput
                      accessibilityLabel="Create password"
                      onChangeText={setSignupPassword}
                      placeholder="At least 8 characters"
                      placeholderTextColor="#8b958d"
                      secureTextEntry
                      style={styles.signupInput}
                      value={signupPassword}
                    />
                  </View>
                  {signupMessage ? (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={[
                        styles.signupMessage,
                        signupMessageType === 'success' && styles.signupSuccessMessage,
                      ]}>
                      {signupMessage}
                    </Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={signupSubmitting}
                    onPress={createCustomerAccount}
                    style={({ pressed }) => [
                      styles.createAccountButton,
                      pressed && styles.authPressed,
                      signupSubmitting && styles.authButtonDisabled,
                    ]}>
                    <Text style={styles.createAccountText}>
                      {signupSubmitting ? 'Creating account...' : 'Create customer account'}
                    </Text>
                    {!signupSubmitting ? (
                      <Text style={styles.createAccountArrow}>→</Text>
                    ) : null}
                  </Pressable>
                  <Text style={styles.signupDisclaimer}>
                    Your password is securely handled by Supabase Auth.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.businessFormIntro}>
                    Register your organization once and select the role that best describes your business.
                  </Text>
                  <Text style={styles.signupLabel}>I am a</Text>
                  <View style={styles.businessTypes}>
                    {businessTypes.map((type) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: businessType === type }}
                        key={type}
                        onPress={() => setBusinessType(type)}
                        style={[
                          styles.businessTypeButton,
                          businessType === type && styles.businessTypeButtonSelected,
                        ]}>
                        <Text
                          style={[
                            styles.businessTypeText,
                            businessType === type && styles.businessTypeTextSelected,
                          ]}>
                          {type}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>Business name *</Text>
                    <TextInput
                      accessibilityLabel="Business name"
                      onChangeText={setBusinessName}
                      placeholder="Registered business name"
                      placeholderTextColor="#8b958d"
                      style={styles.signupInput}
                      value={businessName}
                    />
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>Authorized contact person *</Text>
                    <TextInput
                      accessibilityLabel="Authorized contact person"
                      onChangeText={setBusinessContact}
                      placeholder="Full name"
                      placeholderTextColor="#8b958d"
                      style={styles.signupInput}
                      value={businessContact}
                    />
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>Business email *</Text>
                    <TextInput
                      accessibilityLabel="Business email"
                      autoCapitalize="none"
                      keyboardType="email-address"
                      onChangeText={setBusinessEmail}
                      placeholder="business@example.com"
                      placeholderTextColor="#8b958d"
                      style={styles.signupInput}
                      value={businessEmail}
                    />
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>Phone number *</Text>
                    <TextInput
                      accessibilityLabel="Business phone number"
                      autoComplete="tel"
                      keyboardType="phone-pad"
                      onChangeText={setBusinessPhone}
                      placeholder="Enter business phone number"
                      placeholderTextColor="#8b958d"
                      style={styles.signupInput}
                      value={businessPhone}
                    />
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>Create password *</Text>
                    <TextInput
                      accessibilityLabel="Create business account password"
                      onChangeText={setBusinessPassword}
                      placeholder="At least 8 characters"
                      placeholderTextColor="#8b958d"
                      secureTextEntry
                      style={styles.signupInput}
                      value={businessPassword}
                    />
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>Business license / registration number *</Text>
                    <TextInput
                      accessibilityLabel="Business license or registration number"
                      onChangeText={setBusinessLicenseNumber}
                      placeholder="Enter license or registration number"
                      placeholderTextColor="#8b958d"
                      style={styles.signupInput}
                      value={businessLicenseNumber}
                    />
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>GSTIN (optional)</Text>
                    <TextInput
                      accessibilityLabel="GSTIN"
                      autoCapitalize="characters"
                      onChangeText={setBusinessGstin}
                      placeholder="Enter GSTIN"
                      placeholderTextColor="#8b958d"
                      style={styles.signupInput}
                      value={businessGstin}
                    />
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>FSSAI license (if applicable)</Text>
                    <TextInput
                      accessibilityLabel="FSSAI license number"
                      onChangeText={setBusinessFssai}
                      placeholder="Enter FSSAI license number"
                      placeholderTextColor="#8b958d"
                      style={styles.signupInput}
                      value={businessFssai}
                    />
                  </View>
                  <View style={styles.signupLocationFields}>
                    <KeralaLocationSelectors
                      district={businessDistrict}
                      taluk={businessTaluk}
                      village={businessVillage}
                      locations={locations}
                      onDistrictChange={setBusinessDistrict}
                      onTalukChange={setBusinessTaluk}
                      onVillageChange={setBusinessVillage}
                      disabled={locationsLoading || Boolean(locationsError)}
                    />
                    {locationsError ? (
                      <Text style={styles.signupMessage}>
                        Unable to load Kerala locations: {locationsError}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>Business address *</Text>
                    <TextInput
                      accessibilityLabel="Business address"
                      multiline
                      onChangeText={setBusinessAddress}
                      placeholder="Street, town, and PIN code"
                      placeholderTextColor="#8b958d"
                      style={[styles.signupInput, styles.addressInput]}
                      value={businessAddress}
                    />
                  </View>
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>License image *</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={chooseLicenseImage}
                      style={({ pressed }) => [
                        styles.uploadButton,
                        pressed && styles.authPressed,
                      ]}>
                      <Text style={styles.uploadIcon}>↑</Text>
                      <Text style={styles.uploadButtonText}>
                        {licenseImageName || 'Choose license image'}
                      </Text>
                    </Pressable>
                    <Text style={styles.uploadHint}>Select a JPG, PNG, or other image from your device.</Text>
                  </View>
                  {businessMessage ? (
                    <Text accessibilityLiveRegion="polite" style={styles.signupMessage}>
                      {businessMessage}
                    </Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={businessSubmitting}
                    onPress={submitBusinessRegistration}
                    style={({ pressed }) => [
                      styles.createAccountButton,
                      pressed && styles.authPressed,
                      businessSubmitting && styles.authButtonDisabled,
                    ]}>
                    <Text style={styles.createAccountText}>
                      {businessSubmitting ? 'Submitting application...' : 'Submit business registration'}
                    </Text>
                    {!businessSubmitting ? (
                      <Text style={styles.createAccountArrow}>→</Text>
                    ) : null}
                  </Pressable>
                  <Text style={styles.signupDisclaimer}>
                    Your application and license image are securely submitted for review.
                  </Text>
                </>
              )}
              <View style={styles.accountPrompt}>
                <Text style={styles.accountPromptText}>Already have an account?</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setSignupVisible(false);
                    setSignupMessage('');
                    setBusinessMessage('');
                    setLoginError('');
                    setLoginVisible(true);
                  }}>
                  <Text style={styles.accountPromptLink}>Log in</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => {
          setLoginVisible(false);
          setLoginError('');
        }}
        transparent
        visible={loginVisible}>
        <View style={styles.signupBackdrop}>
          <View style={styles.signupCard}>
            <View style={styles.signupHeading}>
              <View style={styles.signupIcon}>
                <Text style={styles.signupIconText}>↗</Text>
              </View>
              <Pressable
                accessibilityLabel="Close sign in"
                onPress={() => {
                  setLoginVisible(false);
                  setLoginError('');
                }}
                style={styles.signupClose}>
                <Text style={styles.signupCloseText}>×</Text>
              </Pressable>
            </View>
            <Text style={styles.signupTitle}>Welcome back</Text>
            <Text style={styles.signupSubtitle}>Sign in to your FreshCart account.</Text>
            <View style={styles.signupField}>
              <Text style={styles.signupLabel}>Email address</Text>
              <TextInput
                accessibilityLabel="Email address"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                onChangeText={setLoginUsername}
                onSubmitEditing={signIn}
                placeholder="Enter your email"
                placeholderTextColor="#8b958d"
                returnKeyType="next"
                style={styles.signupInput}
                value={loginUsername}
              />
            </View>
            <View style={styles.signupField}>
              <Text style={styles.signupLabel}>Password</Text>
              <TextInput
                accessibilityLabel="Password"
                onChangeText={setLoginPassword}
                onSubmitEditing={signIn}
                placeholder="Enter your password"
                placeholderTextColor="#8b958d"
                returnKeyType="done"
                secureTextEntry
                style={styles.signupInput}
                value={loginPassword}
              />
            </View>
            {loginError ? (
              <Text accessibilityLiveRegion="polite" style={styles.signupMessage}>
                {loginError}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={loginSubmitting}
              onPress={signIn}
              style={({ pressed }) => [styles.createAccountButton, pressed && styles.authPressed]}>
              <Text style={styles.createAccountText}>
                {loginSubmitting ? 'Signing in...' : 'Sign in'}
              </Text>
              {!loginSubmitting ? <Text style={styles.createAccountArrow}>→</Text> : null}
            </Pressable>
            <Text style={styles.signupDisclaimer}>
              Use your Supabase Auth email and password. Admin accounts must have the admin role.
            </Text>
          </View>
        </View>
      </Modal>
      <Modal
        animationType="fade"
        onRequestClose={() => setCelebration(null)}
        transparent
        visible={celebration !== null}>
        <View style={styles.celebrationBackdrop}>
          <View
            accessibilityRole="alert"
            accessibilityViewIsModal
            style={styles.celebrationCard}>
            <View pointerEvents="none" style={styles.celebrationConfetti}>
              <View style={[styles.confettiDot, styles.confettiDotOne]} />
              <View style={[styles.confettiDot, styles.confettiDotTwo]} />
              <View style={[styles.confettiDot, styles.confettiDotThree]} />
              <View style={[styles.confettiDot, styles.confettiDotFour]} />
              <View style={[styles.confettiDot, styles.confettiDotFive]} />
              <View style={[styles.confettiDot, styles.confettiDotSix]} />
            </View>
            <View style={styles.celebrationIcon}>
              <Text style={styles.celebrationCheck}>✓</Text>
            </View>
            <Text style={styles.celebrationTitle}>{celebration?.title}</Text>
            <Text style={styles.celebrationMessage}>{celebration?.message}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCelebration(null)}
              style={({ pressed }) => [
                styles.celebrationButton,
                pressed && styles.authPressed,
              ]}>
              <Text style={styles.celebrationButtonText}>Continue</Text>
              <Text style={styles.celebrationButtonArrow}>→</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  page: {
    alignItems: 'center',
    paddingBottom: 36,
  },
  content: {
    width: '100%',
    maxWidth: 1320,
    paddingHorizontal: 20,
  },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 10,
  },
  wideHeader: {
    minHeight: 68,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLeaf: {
    fontSize: 34,
  },
  brandName: {
    color: DARK_GREEN,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandTagline: {
    color: MUTED,
    fontSize: 10,
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  searchBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dce4dd',
    borderRadius: 24,
    backgroundColor: '#ffffff',
    paddingLeft: 17,
    paddingRight: 4,
    marginBottom: 14,
  },
  wideSearchBar: {
    flex: 1,
    maxWidth: 650,
    marginBottom: 0,
  },
  directoryIntro: {
    paddingTop: 16,
    paddingBottom: 18,
  },
  directoryEyebrow: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  directoryTitle: {
    color: DARK_GREEN,
    fontSize: 25,
    lineHeight: 33,
    fontWeight: '800',
    marginTop: 5,
  },
  directorySubtitle: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  locationFilters: {
    width: '100%',
    flexDirection: 'column',
    gap: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e5ece5',
    borderRadius: 16,
    backgroundColor: '#f8fbf8',
  },
  locationFiltersStacked: {
    flexDirection: 'column',
  },
  locationError: {
    color: '#a43e37',
    fontSize: 11,
  },
  signupLocationFields: {
    gap: 8,
  },
  filterColumn: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: 6,
  },
  filterLabel: {
    color: '#59685c',
    fontSize: 10,
    fontWeight: '700',
  },
  filterSelect: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#dce6dc',
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  filterSelectText: {
    color: '#26392c',
    fontSize: 12,
    fontWeight: '600',
  },
  filterOptions: {
    flexGrow: 0,
    maxHeight: 235,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e1e9e2',
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  filterOptionsContent: {
    gap: 2,
    padding: 6,
  },
  filterOption: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  filterOptionText: {
    color: '#526155',
    fontSize: 11,
  },
  filterEmpty: {
    padding: 8,
    color: MUTED,
    fontSize: 10,
  },
  shopSection: {
    paddingBottom: 30,
  },
  shopSectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  shopCount: {
    color: MUTED,
    fontSize: 10,
    marginTop: 3,
  },
  shopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 14,
  },
  shopCard: {
    minHeight: 176,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e4ebe4',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#18351f',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  shopCardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  shopCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  shopIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#eaf5e9',
  },
  shopIconText: {
    color: DARK_GREEN,
    fontSize: 17,
    fontWeight: '800',
  },
  businessTypeBadge: {
    overflow: 'hidden',
    maxWidth: '70%',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#f1f5ef',
    color: '#526155',
    fontSize: 9,
    fontWeight: '700',
  },
  shopName: {
    color: '#1e3324',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 14,
  },
  shopLocation: {
    color: '#647166',
    fontSize: 10,
    marginTop: 6,
  },
  shopCardLink: {
    color: GREEN,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 14,
  },
  directoryEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 32,
    borderWidth: 1,
    borderColor: '#e5ece5',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins_400Regular',
    color: '#253129',
    fontSize: 14,
  },
  searchIcon: {
    width: 36,
    height: 36,
    borderRadius: 20,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIconText: {
    color: '#ffffff',
    fontSize: 27,
    lineHeight: 31,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  headerActionsCompact: {
    gap: 7,
  },
  authActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authActionsCompact: {
    gap: 6,
  },
  signupButton: {
    width: 34,
    height: 34,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    position: 'relative',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#cfe2d1',
    backgroundColor: '#f0f8ee',
  },
  homeNotice: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#cfe2d1',
    borderRadius: 10,
    backgroundColor: '#f0f8ee',
  },
  homeNoticeError: {
    borderColor: '#f0d0ce',
    backgroundColor: '#fff0ef',
  },
  homeNoticeText: {
    flex: 1,
    color: '#326643',
    fontSize: 11,
  },
  homeNoticeDismiss: {
    color: '#598366',
    fontSize: 20,
  },
  celebrationBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    backgroundColor: 'rgba(20,40,27,0.48)',
  },
  celebrationCard: {
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
  celebrationConfetti: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  confettiDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confettiDotOne: {
    top: 32,
    left: '18%',
    backgroundColor: '#ffcb63',
  },
  confettiDotTwo: {
    top: 62,
    left: '10%',
    width: 6,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#75bd70',
    transform: [{ rotate: '25deg' }],
  },
  confettiDotThree: {
    top: 28,
    right: '20%',
    width: 7,
    height: 12,
    borderRadius: 3,
    backgroundColor: '#ef9d88',
    transform: [{ rotate: '-25deg' }],
  },
  confettiDotFour: {
    top: 75,
    right: '11%',
    backgroundColor: '#8bb6e8',
  },
  confettiDotFive: {
    top: 135,
    left: '8%',
    backgroundColor: '#f0b857',
  },
  confettiDotSix: {
    top: 137,
    right: '9%',
    backgroundColor: '#73b982',
  },
  celebrationIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: '#eaf7e9',
  },
  celebrationCheck: {
    color: '#21823d',
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '700',
  },
  celebrationTitle: {
    color: '#25392b',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 20,
  },
  celebrationMessage: {
    maxWidth: 300,
    color: '#748078',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 8,
  },
  celebrationButton: {
    minHeight: 46,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 25,
    borderRadius: 14,
    backgroundColor: GREEN,
  },
  celebrationButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  celebrationButtonArrow: {
    color: '#ffffff',
    fontSize: 17,
  },
  personHead: {
    position: 'absolute',
    width: 8,
    height: 8,
    top: 7,
    borderRadius: 5,
    backgroundColor: '#287744',
  },
  personShoulders: {
    position: 'absolute',
    width: 16,
    height: 9,
    bottom: 6,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
    backgroundColor: '#287744',
  },
  authPressed: {
    opacity: 0.75,
  },
  authButtonDisabled: {
    opacity: 0.65,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  locationIcon: {
    color: '#26332a',
    fontSize: 24,
  },
  locationText: {
    color: '#253129',
    fontSize: 13,
    fontWeight: '600',
  },
  chevron: {
    color: '#66726a',
    fontSize: 16,
  },
  cartButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartIcon: {
    fontSize: 23,
  },
  cartBadge: {
    position: 'absolute',
    right: -2,
    top: -1,
    minWidth: 18,
    height: 18,
    borderRadius: 10,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  hero: {
    minHeight: 242,
    borderRadius: 17,
    backgroundColor: '#e5f7c1',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    paddingHorizontal: 36,
    paddingVertical: 24,
    position: 'relative',
  },
  heroCompact: {
    minHeight: 260,
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  heroCopy: {
    flex: 1,
    zIndex: 1,
  },
  eyebrow: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 7,
  },
  eyebrowCompact: {
    fontSize: 9,
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#153c22',
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  heroTitleCompact: {
    fontSize: 27,
    lineHeight: 31,
  },
  heroTitleGreen: {
    color: GREEN,
  },
  heroSubtitle: {
    marginTop: 7,
    color: '#263c2d',
    fontSize: 16,
    fontWeight: '500',
  },
  heroButton: {
    alignSelf: 'flex-start',
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: GREEN,
  },
  heroButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  buttonArrow: {
    fontSize: 15,
  },
  heroArt: {
    width: '43%',
    height: 190,
    overflow: 'hidden',
    borderRadius: 16,
  },
  heroPhoto: {
    width: '100%',
    height: '100%',
  },
  heroDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 7,
  },
  dotButton: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    width: 18,
    height: 7,
    borderRadius: 5,
    backgroundColor: GREEN,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  categories: {
    gap: 11,
    paddingTop: 12,
    paddingBottom: 10,
  },
  categoryCard: {
    width: 92,
    minHeight: 86,
    borderRadius: 13,
    backgroundColor: '#f1f8f0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 5,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categorySelected: {
    borderColor: GREEN,
    backgroundColor: '#e5f5e5',
  },
  categoryPhoto: {
    width: 52,
    height: 48,
    borderRadius: 9,
  },
  categoryName: {
    color: '#253129',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  categoryNameSelected: {
    color: DARK_GREEN,
    fontWeight: '800',
  },
  promoRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 1,
  },
  promoColumn: {
    flexDirection: 'column',
    gap: 9,
  },
  promoCard: {
    flex: 1,
    minHeight: 128,
    borderRadius: 15,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 19,
    paddingVertical: 14,
  },
  producePromo: {
    backgroundColor: '#e4f4be',
  },
  dairyPromo: {
    backgroundColor: '#fff0c8',
  },
  familyPromo: {
    backgroundColor: '#e4f5d6',
  },
  promoCopy: {
    width: '66%',
    zIndex: 1,
  },
  promoKicker: {
    color: DARK_GREEN,
    fontSize: 11,
    fontWeight: '700',
  },
  promoHeadline: {
    color: '#1c4326',
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '800',
  },
  promoDetail: {
    color: '#344739',
    fontSize: 12,
    marginTop: 1,
  },
  promoButton: {
    alignSelf: 'flex-start',
    marginTop: 9,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    backgroundColor: GREEN,
  },
  promoButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  promoImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '43%',
    height: '100%',
  },
  productSection: {
    marginTop: 18,
  },
  sectionHeading: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionLeaf: {
    fontSize: 22,
  },
  sectionTitle: {
    color: '#1d2b21',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    textTransform: 'capitalize',
  },
  viewAll: {
    color: GREEN,
    fontSize: 12,
    fontWeight: '700',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 13,
  },
  productCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e9ede9',
    borderRadius: 14,
    backgroundColor: '#ffffff',
  },
  productImage: {
    height: 142,
    position: 'relative',
  },
  productPhoto: {
    width: '100%',
    height: '100%',
  },
  discountBadge: {
    position: 'absolute',
    zIndex: 1,
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: GREEN,
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
  },
  productInfo: {
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  productName: {
    color: '#202a22',
    fontSize: 12,
    fontWeight: '700',
  },
  productDetail: {
    color: MUTED,
    fontSize: 10,
    marginTop: 2,
  },
  rating: {
    color: '#f2a900',
    fontSize: 11,
    marginTop: 4,
  },
  ratingText: {
    color: '#57625a',
    fontSize: 10,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 7,
    gap: 3,
  },
  priceGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  price: {
    color: '#1b2920',
    fontSize: 13,
    fontWeight: '800',
  },
  oldPrice: {
    color: '#9aa29b',
    fontSize: 9,
    textDecorationLine: 'line-through',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: GREEN,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  addPlus: {
    color: '#ffffff',
    fontSize: 13,
    lineHeight: 13,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 44,
  },
  emptyEmoji: {
    fontSize: 38,
  },
  emptyTitle: {
    color: '#253129',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  emptyHint: {
    color: MUTED,
    fontSize: 12,
    marginTop: 4,
  },
  signupBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(20,40,27,0.5)',
  },
  signupCard: {
    width: '100%',
    maxWidth: 430,
    maxHeight: '90%',
    padding: 24,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    shadowColor: '#173e27',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 10,
  },
  signupScroll: {
    flexShrink: 1,
  },
  signupScrollContent: {
    paddingBottom: 2,
  },
  signupHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  signupIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: '#eaf4e8',
  },
  signupIconText: {
    color: '#43804e',
    fontSize: 19,
  },
  signupClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#f2f5f2',
  },
  signupCloseText: {
    color: '#647166',
    fontSize: 22,
    lineHeight: 24,
  },
  signupTitle: {
    color: '#25392b',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 17,
  },
  signupSubtitle: {
    color: '#78857b',
    fontSize: 12,
    marginTop: 5,
    marginBottom: 18,
  },
  registrationModes: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    marginBottom: 18,
    borderRadius: 12,
    backgroundColor: '#f1f5f1',
  },
  registrationMode: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    borderRadius: 9,
  },
  registrationModeSelected: {
    backgroundColor: '#ffffff',
    shadowColor: '#173e27',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 1,
  },
  registrationModeText: {
    color: '#78857b',
    fontSize: 11,
    fontWeight: '700',
  },
  registrationModeTextSelected: {
    color: DARK_GREEN,
  },
  businessFormIntro: {
    color: MUTED,
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 12,
  },
  businessTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 14,
  },
  businessTypeButton: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#dce7dc',
    borderRadius: 18,
    backgroundColor: '#fbfcfb',
  },
  businessTypeButtonSelected: {
    borderColor: GREEN,
    backgroundColor: '#eaf5e9',
  },
  businessTypeText: {
    color: '#647166',
    fontSize: 10,
    fontWeight: '600',
  },
  businessTypeTextSelected: {
    color: DARK_GREEN,
  },
  signupField: {
    marginBottom: 12,
  },
  signupLabel: {
    color: '#34463a',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
  },
  signupInput: {
    minHeight: 43,
    paddingHorizontal: 12,
    fontFamily: 'Poppins_400Regular',
    borderWidth: 1,
    borderColor: '#e1e9e2',
    borderRadius: 10,
    color: '#26392c',
    fontSize: 11,
    backgroundColor: '#fbfcfb',
  },
  selectField: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e1e9e2',
    borderRadius: 10,
    backgroundColor: '#fbfcfb',
  },
  selectFieldText: {
    color: '#26392c',
    fontSize: 11,
  },
  selectFieldPlaceholder: {
    color: '#8b958d',
  },
  selectChevron: {
    color: '#647166',
    fontSize: 16,
  },
  districtOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 7,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e1e9e2',
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  districtOption: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#f7f9f7',
  },
  districtOptionSelected: {
    backgroundColor: '#eaf5e9',
  },
  districtOptionText: {
    color: '#647166',
    fontSize: 9,
  },
  districtOptionTextSelected: {
    color: DARK_GREEN,
    fontWeight: '700',
  },
  addressInput: {
    minHeight: 76,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  uploadButton: {
    minHeight: 45,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#a8c6ab',
    borderRadius: 10,
    backgroundColor: '#f7fbf6',
  },
  uploadIcon: {
    color: GREEN,
    fontSize: 17,
    fontWeight: '700',
  },
  uploadButtonText: {
    flexShrink: 1,
    color: '#347044',
    fontSize: 10,
    fontWeight: '600',
  },
  uploadHint: {
    color: '#8a958c',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 5,
  },
  signupMessage: {
    color: '#9a5743',
    fontSize: 10,
    lineHeight: 16,
    marginBottom: 10,
  },
  signupSuccessMessage: {
    color: DARK_GREEN,
  },
  createAccountButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
    borderRadius: 11,
    backgroundColor: GREEN,
  },
  createAccountText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  createAccountArrow: {
    color: '#d8efcf',
    fontSize: 17,
  },
  signupDisclaimer: {
    color: '#8a958c',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 13,
  },
  accountPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 13,
  },
  accountPromptText: {
    color: '#78857b',
    fontSize: 10,
  },
  accountPromptLink: {
    color: '#267145',
    fontSize: 10,
    fontWeight: '800',
  },
});
