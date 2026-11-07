import { useMemo, useState } from 'react';
import { Image } from 'expo-image';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';

const GREEN = '#138a39';
const DARK_GREEN = '#07552c';
const MUTED = '#68756b';

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

const products = [
  { name: 'Fresh Apples', category: 'Fruits', detail: '1 kg', price: 120, oldPrice: 150, rating: '4.7', reviews: '2.5k', discount: 20, image: require('../../assets/images/store/apples.jpg') },
  { name: 'Organic Bananas', category: 'Fruits', detail: '1 kg', price: 60, oldPrice: 80, rating: '4.6', reviews: '1.8k', discount: 25, image: require('../../assets/images/store/bananas.jpg') },
  { name: 'Juicy Tomatoes', category: 'Vegetables', detail: '1 kg', price: 50, oldPrice: 65, rating: '4.5', reviews: '1.2k', discount: 23, image: require('../../assets/images/store/tomatoes.jpg') },
  { name: 'Fresh Spinach', category: 'Vegetables', detail: '250 g', price: 30, oldPrice: 40, rating: '4.6', reviews: '980', discount: 25, image: require('../../assets/images/store/spinach.jpg') },
  { name: 'Farm Fresh Milk', category: 'Dairy', detail: '1 L', price: 70, oldPrice: 90, rating: '4.7', reviews: '2.1k', discount: 22, image: require('../../assets/images/store/milk.jpg') },
  { name: 'Brown Bread', category: 'Bakery', detail: '400 g', price: 45, oldPrice: 60, rating: '4.5', reviews: '876', discount: 25, image: require('../../assets/images/store/bread.jpg') },
  { name: 'Crunchy Broccoli', category: 'Vegetables', detail: '500 g', price: 55, oldPrice: 70, rating: '4.6', reviews: '640', discount: 21, image: require('../../assets/images/store/broccoli.jpg') },
  { name: 'Orange Juice', category: 'Beverages', detail: '1 L', price: 95, oldPrice: 120, rating: '4.4', reviews: '530', discount: 20, image: require('../../assets/images/store/oranges.jpg') },
  { name: 'Potato Chips', category: 'Snacks', detail: '150 g', price: 35, oldPrice: 45, rating: '4.3', reviews: '720', discount: 22, image: require('../../assets/images/store/chips.jpg') },
  { name: 'Golden Croissants', category: 'Bakery', detail: '4 pcs', price: 80, oldPrice: 100, rating: '4.8', reviews: '390', discount: 20, image: require('../../assets/images/store/croissants.jpg') },
  { name: 'Natural Hand Wash', category: 'Personal care', detail: '250 ml', price: 110, oldPrice: 140, rating: '4.5', reviews: '310', discount: 21, image: require('../../assets/images/store/handwash.jpg') },
  { name: 'Organic Avocados', category: 'Organic', detail: '2 pcs', price: 85, oldPrice: 110, rating: '4.7', reviews: '460', discount: 23, image: require('../../assets/images/store/avocado.jpg') },
];

export default function HomeScreen() {
  const isWide = useResponsiveBreakpoint(760);
  const isTablet = useResponsiveBreakpoint(600);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cartCount, setCartCount] = useState(0);

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

            <View style={styles.headerActions}>
              {isWide && (
                <Pressable style={styles.location}>
                  <Text style={styles.locationIcon}>⌖</Text>
                  <Text style={styles.locationText}>Kerala</Text>
                  <Text style={styles.chevron}>⌄</Text>
                </Pressable>
              )}
              <Pressable accessibilityLabel={`Cart, ${cartCount} items`} style={styles.cartButton}>
                <Text style={styles.cartIcon}>🛒</Text>
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
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
                GOOD FOOD, GOOD MOOD
              </Text>
              <Text style={[styles.heroTitle, !isWide && styles.heroTitleCompact]}>
                Fresh & healthy{'\n'}
                <Text style={styles.heroTitleGreen}>groceries for you!</Text>
              </Text>
              <Text style={styles.heroSubtitle}>Shop fresh. Live healthy.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setSelectedCategory('Fruits')}
                style={styles.heroButton}>
                <Text style={styles.heroButtonText}>Shop fresh <Text style={styles.buttonArrow}>→</Text></Text>
              </Pressable>
            </View>
            <View style={styles.heroArt}>
              <Image
                accessibilityLabel="Fresh vegetables at the market"
                source={require('../../assets/images/store/hero-produce.jpg')}
                style={styles.heroPhoto}
                contentFit="cover"
                transition={180}
              />
            </View>
            <View style={styles.heroDots}>
              <View style={styles.dotActive} />
              <View style={styles.dot} />
              <View style={styles.dot} />
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
                          onPress={() => setCartCount((count) => count + 1)}
                          style={styles.addButton}>
                          <Text style={styles.addButtonText}>Add</Text>
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
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: GREEN,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 10,
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
});
