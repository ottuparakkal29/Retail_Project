import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
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
import { products } from '@/constants/products';
import { useCart } from '@/contexts/cart-context';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';

const GREEN = '#138a39';
const DARK_GREEN = '#07552c';
const MUTED = '#68756b';

const businessTypes = ['Manufacturer', 'Retailer', 'Wholesaler', 'Distributor'] as const;
const keralaDistricts = [
  'Thiruvananthapuram',
  'Kollam',
  'Pathanamthitta',
  'Alappuzha',
  'Kottayam',
  'Idukki',
  'Ernakulam',
  'Thrissur',
  'Palakkad',
  'Malappuram',
  'Kozhikode',
  'Wayanad',
  'Kannur',
  'Kasaragod',
];

const categories = [
  { name: 'Fruits', image: require('../../assets/images/store/apples.jpg') },
  { name: 'Vegetables', image: require('../../assets/images/store/spinach.jpg') },
  { name: 'Dairy', image: require('../../assets/images/store/milk.jpg') },
  { name: 'Snacks', image: require('../../assets/images/store/chips.jpg') },
  { name: 'Beverages', image: require('../../assets/images/store/oranges.jpg') },
  { name: 'Bakery', image: require('../../assets/images/store/bread.jpg') },
  { name: 'Household', image: require('../../assets/images/store/handwash.jpg') },
  { name: 'Personal care', image: require('../../assets/images/store/handwash.jpg') },
  { name: 'Organic', image: require('../../assets/images/store/avocado.jpg') },
];

const heroSlides = [
  {
    eyebrow: 'GOOD FOOD, GOOD MOOD',
    headline: 'Fresh & healthy',
    highlight: 'groceries for you!',
    subtitle: 'Shop fresh. Live healthy.',
    category: 'Fruits',
    image: require('../../assets/images/store/slider 1.jpg'),
    imageLabel: 'Fresh apples ready to enjoy',
  },
  {
    eyebrow: 'A LITTLE GREEN GOES A LONG WAY',
    headline: 'Greens that make',
    highlight: 'every meal better.',
    subtitle: 'Hand-picked goodness, delivered fresh.',
    category: 'Vegetables',
    image: require('../../assets/images/store/slider 2.jpg'),
    imageLabel: 'Fresh leafy greens at the market',
  },
  {
    eyebrow: 'FRESH FROM THE FARM',
    headline: 'Pick the best',
    highlight: 'from every season.',
    subtitle: 'Discover nature’s freshest picks.',
    category: 'Organic',
    image: require('../../assets/images/store/slider 3.avif'),
    imageLabel: 'Seasonal fresh produce',
  },
];

export default function HomeScreen() {
  const isWide = useResponsiveBreakpoint(760);
  const isTablet = useResponsiveBreakpoint(600);
  const { addItem, itemCount } = useCart();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [signupVisible, setSignupVisible] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupMessage, setSignupMessage] = useState('');
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
  const [businessAddress, setBusinessAddress] = useState('');
  const [licenseImageName, setLicenseImageName] = useState('');
  const [districtPickerVisible, setDistrictPickerVisible] = useState(false);
  const [businessMessage, setBusinessMessage] = useState('');
  const [loginVisible, setLoginVisible] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      const matchesSearch =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.category.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesSearch;
    });
  }, [query, selectedCategory]);

  function signIn() {
    if (loginUsername.trim() === 'admin' && loginPassword === 'admin') {
      setLoginVisible(false);
      setLoginError('');
      setLoginPassword('');
      router.push('/admin');
      return;
    }

    setLoginError('That username and password do not match. Please try again.');
  }

  async function chooseLicenseImage() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (!result.canceled) {
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

  function submitBusinessRegistration() {
    const phoneDigits = businessPhone.replace(/\D/g, '');
    if (
      !businessType ||
      !businessName.trim() ||
      !businessContact.trim() ||
      !businessEmail.includes('@') ||
      phoneDigits.length < 7 ||
      phoneDigits.length > 15 ||
      businessPassword.length < 8 ||
      !businessLicenseNumber.trim() ||
      !businessDistrict ||
      !businessAddress.trim() ||
      !licenseImageName
    ) {
      setBusinessMessage(
        'Complete all required fields, choose a business type and district, upload a license image, and use a valid email, phone number, and password.',
      );
      return;
    }

    setBusinessMessage(
      `${businessType} application details are complete. This demo does not save or send registrations yet.`,
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[styles.page, { paddingBottom: isWide ? 36 : 92 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={[styles.header, isWide && styles.wideHeader]}>
            <Pressable onPress={() => setSelectedCategory('')} style={styles.brand}>
              <Text style={styles.brandLeaf}>🌿</Text>
              <View>
                <Text style={styles.brandName}>FreshCart</Text>
                <Text style={styles.brandTagline}>Groceries made easy</Text>
              </View>
            </Pressable>

            {isWide && (
              <View style={[styles.searchBar, styles.wideSearchBar]}>
                <TextInput
                  accessibilityLabel="Search products"
                  placeholder="Search for products..."
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
                <Pressable style={styles.location}>
                  <Text style={styles.locationIcon}>⌖</Text>
                  <Text style={styles.locationText}>Kerala</Text>
                  <Text style={styles.chevron}>⌄</Text>
                </Pressable>
              )}
              <View style={[styles.authActions, !isWide && styles.authActionsCompact]}>
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

          {!isWide && (
            <View style={styles.searchBar}>
              <TextInput
                accessibilityLabel="Search products"
                placeholder="Search fresh groceries..."
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

          {isWide && (
            <View style={styles.navigation}>
              <Pressable style={styles.allCategories}>
                <Text style={styles.menuIcon}>☰</Text>
                <Text style={styles.allCategoriesText}>All categories</Text>
                <Text style={styles.chevron}>⌄</Text>
              </Pressable>
              <View style={styles.navLinks}>
                <Text style={styles.navActive}>Home</Text>
                <Text style={styles.navLink}>Categories</Text>
                <Text style={styles.navLink}>Offers</Text>
                <Text style={styles.navLink}>My orders</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/admin')}
                  style={styles.dashboardNavButton}>
                  <Text style={styles.dashboardNavText}>Dashboard</Text>
                </Pressable>
              </View>
              <View style={styles.deliveryNote}>
                <Text style={styles.deliveryIcon}>🚚</Text>
                <Text style={styles.deliveryText}>Free delivery on orders above ₹499</Text>
              </View>
            </View>
          )}

          <View style={[styles.hero, !isWide && styles.heroCompact]}>
            <View style={styles.heroCopy}>
              <Text style={[styles.eyebrow, !isWide && styles.eyebrowCompact]}>
                {heroSlides[activeSlide].eyebrow}
              </Text>
              <Text style={[styles.heroTitle, !isWide && styles.heroTitleCompact]}>
                {heroSlides[activeSlide].headline}{'\n'}
                <Text style={styles.heroTitleGreen}>{heroSlides[activeSlide].highlight}</Text>
              </Text>
              <Text style={styles.heroSubtitle}>{heroSlides[activeSlide].subtitle}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedCategory(heroSlides[activeSlide].category)}
                style={styles.heroButton}>
                <Text style={styles.heroButtonText}>Shop fresh <Text style={styles.buttonArrow}>→</Text></Text>
              </Pressable>
            </View>
            <View style={styles.heroArt}>
              <Image
                accessibilityLabel={heroSlides[activeSlide].imageLabel}
                source={heroSlides[activeSlide].image}
                style={styles.heroPhoto}
                contentFit="cover"
                transition={300}
              />
            </View>
            <View style={styles.heroDots}>
              {heroSlides.map((slide, index) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Show slide ${index + 1}: ${slide.eyebrow}`}
                  accessibilityState={{ selected: activeSlide === index }}
                  key={slide.eyebrow}
                  onPress={() => setActiveSlide(index)}
                  style={styles.dotButton}>
                  <View style={[styles.dot, activeSlide === index && styles.dotActive]} />
                </Pressable>
              ))}
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categories}>
            {categories.map((category) => {
              const isSelected = selectedCategory === category.name;
              return (
                <Pressable
                  key={category.name}
                  onPress={() =>
                    setSelectedCategory(isSelected ? '' : category.name)
                  }
                  style={[styles.categoryCard, isSelected && styles.categorySelected]}>
                  <Image source={category.image} style={styles.categoryPhoto} contentFit="cover" />
                  <Text style={[styles.categoryName, isSelected && styles.categoryNameSelected]}>
                    {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.promoRow, !isTablet && styles.promoColumn]}>
            <View style={[styles.promoCard, styles.producePromo]}>
              <Image
                source={require('../../assets/images/store/promo-produce.jpg')}
                style={styles.promoImage}
                contentFit="cover"
              />
              <View style={styles.promoCopy}>
                <Text style={styles.promoKicker}>UP TO</Text>
                <Text style={styles.promoHeadline}>50% OFF</Text>
                <Text style={styles.promoDetail}>Fresh produce</Text>
                <Pressable onPress={() => setSelectedCategory('Vegetables')} style={styles.promoButton}>
                  <Text style={styles.promoButtonText}>Shop now →</Text>
                </Pressable>
              </View>
            </View>
            <View style={[styles.promoCard, styles.dairyPromo]}>
              <Image
                source={require('../../assets/images/store/promo-dairy.jpg')}
                style={styles.promoImage}
                contentFit="cover"
              />
              <View style={styles.promoCopy}>
                <Text style={styles.promoKicker}>SPECIAL OFFER</Text>
                <Text style={styles.promoHeadline}>Flat 30% OFF</Text>
                <Text style={styles.promoDetail}>on dairy products</Text>
                <Pressable onPress={() => setSelectedCategory('Dairy')} style={styles.promoButton}>
                  <Text style={styles.promoButtonText}>Shop now →</Text>
                </Pressable>
              </View>
            </View>
            <View style={[styles.promoCard, styles.familyPromo]}>
              <Image
                source={require('../../assets/images/store/promo-family.jpg')}
                style={styles.promoImage}
                contentFit="cover"
              />
              <View style={styles.promoCopy}>
                <Text style={styles.promoKicker}>LIVE WELL</Text>
                <Text style={styles.promoHeadline}>Healthy living</Text>
                <Text style={styles.promoDetail}>better tomorrow</Text>
                <Pressable onPress={() => setSelectedCategory('Organic')} style={styles.promoButton}>
                  <Text style={styles.promoButtonText}>Shop now →</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.productSection}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionLeaf}>🌿</Text>
                <Text style={styles.sectionTitle}>
                  {selectedCategory || 'Popular products'}
                </Text>
              </View>
              {selectedCategory ? (
                <Pressable onPress={() => setSelectedCategory('')}>
                  <Text style={styles.viewAll}>Clear filter ×</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => setSelectedCategory('')}>
                  <Text style={styles.viewAll}>View all →</Text>
                </Pressable>
              )}
            </View>
            {visibleProducts.length ? (
              <View style={styles.productGrid}>
                {visibleProducts.map((product) => (
                  <View
                    key={product.name}
                    style={[
                      styles.productCard,
                      { flexBasis: isWide ? '15%' : isTablet ? '31%' : '47%' },
                    ]}>
                    <View style={styles.productImage}>
                      <Image
                        source={product.image}
                        style={styles.productPhoto}
                        contentFit="cover"
                        transition={160}
                      />
                      <Text style={styles.discountBadge}>{product.discount}% OFF</Text>
                    </View>
                    <View style={styles.productInfo}>
                      <Text numberOfLines={1} style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productDetail}>{product.detail}</Text>
                      <Text style={styles.rating}>★ <Text style={styles.ratingText}>{product.rating} ({product.reviews})</Text></Text>
                      <View style={styles.priceRow}>
                        <View style={styles.priceGroup}>
                          <Text style={styles.price}>₹{product.price}</Text>
                          <Text style={styles.oldPrice}>₹{product.oldPrice}</Text>
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Add ${product.name} to cart`}
                          onPress={() => addItem(product)}
                          style={styles.addButton}>
                          <Text style={styles.addButtonText}>Add to cart</Text>
                          <Text style={styles.addPlus}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🥬</Text>
                <Text style={styles.emptyTitle}>No groceries found</Text>
                <Text style={styles.emptyHint}>Try another search or category.</Text>
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
                    <Text accessibilityLiveRegion="polite" style={styles.signupMessage}>
                      {signupMessage}
                    </Text>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      const phoneDigits = signupPhone.replace(/\D/g, '');
                      if (
                        !signupName.trim() ||
                        !signupEmail.includes('@') ||
                        phoneDigits.length < 7 ||
                        phoneDigits.length > 15 ||
                        signupPassword.length < 8
                      ) {
                        setSignupMessage(
                          'Enter your name, a valid email and phone number, and a password of at least 8 characters.',
                        );
                        return;
                      }
                      setSignupMessage(
                        'Shopper signup is not connected yet. Your details have not been saved.',
                      );
                    }}
                    style={({ pressed }) => [styles.createAccountButton, pressed && styles.authPressed]}>
                    <Text style={styles.createAccountText}>Create customer account</Text>
                    <Text style={styles.createAccountArrow}>→</Text>
                  </Pressable>
                  <Text style={styles.signupDisclaimer}>
                    Demo form only. Account creation requires a connected authentication service.
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
                  <View style={styles.signupField}>
                    <Text style={styles.signupLabel}>District *</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Select district${businessDistrict ? `, ${businessDistrict}` : ''}`}
                      accessibilityState={{ expanded: districtPickerVisible }}
                      onPress={() => setDistrictPickerVisible((visible) => !visible)}
                      style={styles.selectField}>
                      <Text
                        style={[
                          styles.selectFieldText,
                          !businessDistrict && styles.selectFieldPlaceholder,
                        ]}>
                        {businessDistrict || 'Choose your Kerala district'}
                      </Text>
                      <Text style={styles.selectChevron}>{districtPickerVisible ? '⌃' : '⌄'}</Text>
                    </Pressable>
                    {districtPickerVisible ? (
                      <View style={styles.districtOptions}>
                        {keralaDistricts.map((district) => (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ selected: businessDistrict === district }}
                            key={district}
                            onPress={() => {
                              setBusinessDistrict(district);
                              setDistrictPickerVisible(false);
                            }}
                            style={[
                              styles.districtOption,
                              businessDistrict === district && styles.districtOptionSelected,
                            ]}>
                            <Text
                              style={[
                                styles.districtOptionText,
                                businessDistrict === district && styles.districtOptionTextSelected,
                              ]}>
                              {district}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
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
                    onPress={submitBusinessRegistration}
                    style={({ pressed }) => [styles.createAccountButton, pressed && styles.authPressed]}>
                    <Text style={styles.createAccountText}>Submit business registration</Text>
                    <Text style={styles.createAccountArrow}>→</Text>
                  </Pressable>
                  <Text style={styles.signupDisclaimer}>
                    Demo form only. Registration details and documents are not saved or sent.
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
              <Text style={styles.signupLabel}>Username</Text>
              <TextInput
                accessibilityLabel="Username"
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setLoginUsername}
                onSubmitEditing={signIn}
                placeholder="Enter your username"
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
              onPress={signIn}
              style={({ pressed }) => [styles.createAccountButton, pressed && styles.authPressed]}>
              <Text style={styles.createAccountText}>Sign in</Text>
              <Text style={styles.createAccountArrow}>→</Text>
            </Pressable>
            <Text style={styles.signupDisclaimer}>
              Demo admin access: admin / admin
            </Text>
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
  navigation: {
    height: 44,
    marginHorizontal: -20,
    paddingHorizontal: 24,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    marginBottom: 10,
  },
  allCategories: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuIcon: {
    color: '#ffffff',
    fontSize: 17,
  },
  allCategoriesText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 25,
  },
  dashboardNavButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  dashboardNavText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  navActive: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  navLink: {
    color: '#eff9f0',
    fontSize: 12,
    fontWeight: '600',
  },
  deliveryNote: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#dff3bd',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  deliveryIcon: {
    fontSize: 13,
  },
  deliveryText: {
    color: DARK_GREEN,
    fontSize: 11,
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
