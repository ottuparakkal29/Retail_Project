import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useCart, type CartProduct } from '@/contexts/cart-context';
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';
import { supabase } from '@/lib/supabase';

type Shop = {
  id: string;
  business_name: string;
  business_type: string | null;
  district: string | null;
  taluk: string | null;
  village: string | null;
};

type Category = {
  id: string;
  name: string;
  image_path: string | null;
};

type Product = {
  id: string;
  name: string;
  price: number;
  unit: string;
  stock_quantity: number;
  image_path: string | null;
  category_id: string;
  compare_at_price: number | null;
};

const GREEN = '#138a39';
const DARK_GREEN = '#07552c';

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Unable to load this shop. Please try again.';
}

function imageUrl(path: string | null) {
  return path
    ? supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl
    : null;
}

function categoryImageUrl(path: string | null) {
  return path
    ? supabase.storage.from('category-images').getPublicUrl(path).data.publicUrl
    : null;
}

export default function ShopStorefrontScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isWide = useResponsiveBreakpoint(1200);
  const isTablet = useResponsiveBreakpoint(700);
  const isDesktop = useResponsiveBreakpoint(760);
  const { addItem, error: cartError, dismissError } = useCart();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const catalogOffset = useRef(0);
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [addedProductId, setAddedProductId] = useState('');
  const [conflictProduct, setConflictProduct] = useState<CartProduct | null>(null);
  const [replacingCart, setReplacingCart] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadShop() {
      if (!id) {
        setLoadError('Shop not found.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError('');
      setSelectedCategory('all');
      setQuery('');
      const { data: shopData, error: shopError } = await supabase
        .from('business_profiles')
        .select(
          'id, business_name, business_type, district, taluk, village',
        )
        .eq('id', id)
        .eq('approval_status', 'approved')
        .maybeSingle();
      if (shopError) throw shopError;
      if (!shopData) {
        if (active) {
          setShop(null);
          setProducts([]);
          setCategories([]);
        }
        return;
      }

      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name, price, compare_at_price, unit, stock_quantity, image_path, category_id')
        .eq('business_id', shopData.id)
        .eq('is_active', true)
        .order('name');
      if (productError) throw productError;

      const productRows = (productData ?? []) as Product[];
      const categoryIds = Array.from(new Set(productRows.map((product) => product.category_id)));
      const { data: categoryData, error: categoryError } = categoryIds.length
        ? await supabase
            .from('categories')
            .select('id, name, image_path')
            .eq('is_active', true)
            .in('id', categoryIds)
            .order('name')
        : { data: [], error: null };
      if (categoryError) throw categoryError;
      if (!active) return;

      setShop(shopData as Shop);
      setProducts(productRows);
      setCategories((categoryData ?? []) as Category[]);
    }

    void loadShop()
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const visibleProducts = useMemo(
    () => {
      const search = query.trim().toLowerCase();
      return products.filter(
        (product) =>
          (selectedCategory === 'all' || product.category_id === selectedCategory) &&
          product.name.toLowerCase().includes(search),
      );
    },
    [products, selectedCategory, query],
  );
  function showProducts() {
    scrollRef.current?.scrollTo({ y: catalogOffset.current, animated: true });
  }

  async function addProductToCart(product: Product) {
    if (!shop) return;
    dismissError();
    const cartProduct: CartProduct = {
      id: product.id,
      name: product.name,
      unit: product.unit,
      price: Number(product.price),
      stock: product.stock_quantity == null ? null : Number(product.stock_quantity),
      image: imageUrl(product.image_path),
      businessId: shop.id,
    };
    const result = await addItem(cartProduct);
    if (result === 'shop-conflict') setConflictProduct(cartProduct);
    else if (result === 'ok') showAdded(product.id);
  }

  async function replaceCartWith(product: CartProduct) {
    setReplacingCart(true);
    try {
      if ((await addItem(product, { replaceCart: true })) === 'ok') showAdded(product.id);
    } finally {
      setReplacingCart(false);
      setConflictProduct(null);
    }
  }

  function showAdded(productId: string) {
    setAddedProductId(productId);
    setTimeout(() => setAddedProductId((current) =>
      current === productId ? '' : current,
    ), 1800);
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.page, { paddingBottom: isDesktop ? 36 : 100 }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {loading ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Opening shop…</Text>
            </View>
          ) : loadError ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>Couldn’t open this shop</Text>
              <Text style={styles.stateDetail}>{loadError}</Text>
              <Pressable onPress={() => router.replace('/')} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Explore shops</Text>
              </Pressable>
            </View>
          ) : !shop ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>This shop is no longer available</Text>
              <Text style={styles.stateDetail}>
                Only approved shops are shown in the directory.
              </Text>
              <Pressable onPress={() => router.replace('/')} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Explore shops</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={[styles.shopHero, isDesktop && styles.shopHeroWide]}>
                <View pointerEvents="none" style={styles.heroCircleLarge} />
                <View pointerEvents="none" style={styles.heroCircleSmall} />
                <View style={[styles.heroCopy, isDesktop && styles.heroCopyWide]}>
                  <Text style={styles.eyebrow}>✦  YOUR LOCAL STOREFRONT</Text>
                  <Text numberOfLines={2} style={[styles.heroTitle, isDesktop && styles.heroTitleWide]}>
                    {shop.business_name}
                  </Text>
                  <Text style={styles.heroSubtitle}>
                    Discover products from this FreshCart business.
                  </Text>
                  <View style={styles.heroDetails}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>
                        {shop.business_type || 'Business'}
                      </Text>
                    </View>
                    <Text numberOfLines={1} style={styles.shopLocation}>
                      ⌖ {[shop.village, shop.taluk, shop.district].filter(Boolean).join(', ') ||
                        'Location not listed'}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedCategory('all');
                      setQuery('');
                      showProducts();
                    }}
                    style={({ pressed }) => [
                      styles.heroButton,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.heroButtonText}>Shop this store →</Text>
                  </Pressable>
                </View>
                {isDesktop ? (
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    pointerEvents="none"
                    style={styles.heroIdentity}>
                    <View style={styles.heroIdentityIcon}>
                      <Text style={styles.heroIdentityInitial}>
                        {shop.business_name.trim().slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.heroIdentityLabel}>LOCAL BUSINESS</Text>
                    <Text numberOfLines={1} style={styles.heroIdentityName}>
                      {shop.business_name}
                    </Text>
                    <View style={styles.heroIdentityDivider} />
                    <Text style={styles.heroIdentityCount}>
                      {products.length} {products.length === 1 ? 'product' : 'products'} to explore
                    </Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.searchBar}>
                <TextInput
                  accessibilityLabel="Search this shop's products"
                  placeholder="Search products in this shop..."
                  placeholderTextColor="#8b958d"
                  value={query}
                  onChangeText={setQuery}
                  style={styles.searchInput}
                />
                <Text style={styles.searchIcon}>⌕</Text>
              </View>
              {categories.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryTiles}>
                  <CategoryTile
                    label="All products"
                    selected={selectedCategory === 'all'}
                    onPress={() => setSelectedCategory('all')}
                  />
                  {categories.map((category) => (
                    <CategoryTile
                      key={category.id}
                      label={category.name}
                      image={categoryImageUrl(category.image_path)}
                      selected={selectedCategory === category.id}
                      onPress={() => setSelectedCategory(category.id)}
                    />
                  ))}
                </ScrollView>
              ) : null}

              <View
                onLayout={(event) => {
                  catalogOffset.current = event.nativeEvent.layout.y;
                }}
                style={styles.catalogHeader}>
                <View>
                  <Text style={styles.catalogTitle}>Shop products</Text>
                  <Text style={styles.catalogSubtitle}>
                    {products.length} active {products.length === 1 ? 'product' : 'products'}
                  </Text>
                </View>
              </View>

              {cartError ? (
                <Pressable
                  accessibilityRole="alert"
                  onPress={dismissError}
                  style={styles.errorNotice}>
                  <Text style={styles.errorText}>{cartError}</Text>
                  <Text style={styles.dismissText}>×</Text>
                </Pressable>
              ) : null}

              {visibleProducts.length ? (
                <View style={styles.productGrid}>
                  {visibleProducts.map((product) => {
                    const image = imageUrl(product.image_path);
                    return (
                      <View
                        key={product.id}
                        style={[
                          styles.productCard,
                          {
                            flexBasis: isWide ? '15.6%' : isTablet ? '23.4%' : '47%',
                          },
                        ]}>
                        {image ? (
                          <Image
                            accessibilityLabel={product.name}
                            source={{ uri: image }}
                            contentFit="cover"
                            style={styles.productImage}
                          />
                        ) : (
                          <View style={[styles.productImage, styles.imagePlaceholder]}>
                            <Text style={styles.imagePlaceholderText}>✳</Text>
                          </View>
                        )}
                        {product.compare_at_price != null &&
                        Number(product.compare_at_price) > Number(product.price) ? (
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountText}>
                              {Math.round(
                                (1 - Number(product.price) / Number(product.compare_at_price)) *
                                  100,
                              )}% OFF
                            </Text>
                          </View>
                        ) : null}
                        <View style={styles.productInfo}>
                          <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
                          <Text style={styles.productUnit}>{product.unit}</Text>
                          <View style={[styles.productFooter, !isTablet && styles.productFooterStacked]}>
                            <View style={styles.priceGroup}>
                              <Text style={styles.productPrice}>
                                ₹{Number(product.price).toLocaleString('en-IN', {
                                  maximumFractionDigits: 2,
                                })}
                              </Text>
                              {product.compare_at_price != null &&
                              Number(product.compare_at_price) > Number(product.price) ? (
                                <Text style={styles.comparePrice}>
                                  ₹{Number(product.compare_at_price).toLocaleString('en-IN', {
                                    maximumFractionDigits: 2,
                                  })}
                                </Text>
                              ) : null}
                            </View>
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`Add ${product.name} to cart`}
                              onPress={() => void addProductToCart(product)}
                              style={({ pressed }) => [
                                styles.addButton,
                                pressed && styles.pressed,
                              ]}>
                              <Text style={styles.addButtonText}>
                                {addedProductId === product.id ? 'Added ✓' : 'Add to cart +'}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.stateCard}>
                  <Text style={styles.stateTitle}>
                    {products.length ? 'No matching products' : 'No products available yet'}
                  </Text>
                  <Text style={styles.stateDetail}>
                    {products.length
                      ? 'Try another search or category to view this shop’s products.'
                      : 'This shop has not listed active products yet.'}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
      <ConfirmDialog
        confirmLabel="Start new cart"
        destructive
        loading={replacingCart}
        message={`Your cart already has items from another shop. Adding ${
          conflictProduct?.name ?? 'this item'
        } will clear it and start a new cart with this shop.`}
        onCancel={() => setConflictProduct(null)}
        onConfirm={() => conflictProduct && void replaceCartWith(conflictProduct)}
        title="Start a new cart?"
        visible={conflictProduct !== null}
      />
    </SafeAreaView>
  );
}

function CategoryTile({
  image,
  label,
  onPress,
  selected,
}: {
  image?: string | null;
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.categoryTile, selected && styles.categoryTileSelected]}>
      {image ? (
        <Image source={{ uri: image }} contentFit="cover" style={styles.categoryImage} />
      ) : (
        <View style={[styles.categoryImage, styles.categoryImageFallback]}>
          <Text style={styles.categoryFallbackText}>✳</Text>
        </View>
      )}
      <Text numberOfLines={1} style={styles.categoryTileText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fbfcfb',
  },
  page: {
    flexGrow: 1,
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 1320,
    paddingHorizontal: 20,
  },
  shopHero: {
    minHeight: 300,
    marginTop: 8,
    marginBottom: 18,
    overflow: 'hidden',
    borderRadius: 20,
    backgroundColor: '#eaf5e7',
    borderWidth: 1,
    borderColor: '#dfedda',
  },
  shopHeroWide: {
    minHeight: 288,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 70,
  },
  heroCopy: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  heroCopyWide: {
    flex: 1,
    maxWidth: 640,
    paddingLeft: 38,
    paddingRight: 24,
  },
  heroTitle: {
    color: '#062e1b',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    marginTop: 8,
  },
  heroTitleWide: {
    fontSize: 38,
    lineHeight: 44,
  },
  heroSubtitle: {
    maxWidth: 430,
    color: '#46594b',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  heroDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  heroCircleLarge: {
    position: 'absolute',
    width: 430,
    height: 430,
    top: -150,
    right: -100,
    borderRadius: 215,
    backgroundColor: '#d3eacc',
  },
  heroCircleSmall: {
    position: 'absolute',
    width: 240,
    height: 240,
    bottom: -155,
    right: 180,
    borderRadius: 120,
    backgroundColor: '#dcefd4',
  },
  heroIdentity: {
    width: 220,
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#ffffff',
    backgroundColor: '#f9fdf7',
    shadowColor: '#1e562c',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 4,
  },
  heroIdentityIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#dcefd8',
  },
  heroIdentityInitial: {
    color: DARK_GREEN,
    fontSize: 30,
    fontWeight: '800',
  },
  heroIdentityLabel: {
    marginTop: 12,
    color: GREEN,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroIdentityName: {
    width: '100%',
    marginTop: 5,
    color: '#173a24',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroIdentityDivider: {
    width: 42,
    height: 1,
    marginVertical: 10,
    backgroundColor: '#cde4c8',
  },
  heroIdentityCount: {
    color: '#6c806e',
    fontSize: 10,
  },
  heroButton: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 18,
    borderRadius: 24,
    backgroundColor: GREEN,
  },
  heroButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
  shopLocation: {
    color: '#526456',
    fontSize: 10,
  },
  eyebrow: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  typeBadge: {
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#f1f5ef',
    flexShrink: 0,
  },
  typeBadgeText: {
    color: '#526155',
    fontSize: 10,
    fontWeight: '700',
  },
  searchBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dce4dd',
    borderRadius: 24,
    backgroundColor: '#ffffff',
    paddingHorizontal: 17,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: '#26392c',
    fontSize: 12,
  },
  searchIcon: {
    color: GREEN,
    fontSize: 24,
  },
  catalogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  catalogTitle: {
    color: '#18351f',
    fontSize: 20,
    fontWeight: '800',
  },
  catalogSubtitle: {
    color: '#738075',
    fontSize: 10,
    marginTop: 3,
  },
  categoryTiles: {
    gap: 11,
    paddingTop: 16,
    paddingBottom: 18,
  },
  categoryTile: {
    width: 102,
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#edf2ec',
    borderRadius: 14,
    backgroundColor: '#f3f8f2',
  },
  categoryTileSelected: {
    borderColor: '#b5d8b8',
    backgroundColor: '#eaf5e9',
  },
  categoryImage: {
    width: 58,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#e5eee3',
  },
  categoryImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryFallbackText: {
    color: '#80a17f',
    fontSize: 23,
  },
  categoryTileText: {
    maxWidth: 86,
    color: '#334438',
    fontSize: 9,
    fontWeight: '700',
  },
  errorNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f0d0ce',
    borderRadius: 10,
    backgroundColor: '#fff0ef',
  },
  errorText: {
    flex: 1,
    color: '#9e3733',
    fontSize: 11,
  },
  dismissText: {
    color: '#9e3733',
    fontSize: 18,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  productCard: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e4ebe4',
    borderRadius: 15,
    backgroundColor: '#ffffff',
  },
  productImage: {
    width: '100%',
    aspectRatio: 1.2,
    backgroundColor: '#edf3ed',
  },
  discountBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: GREEN,
  },
  discountText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '800',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    color: '#9eb49f',
    fontSize: 30,
  },
  productInfo: {
    gap: 4,
    padding: 12,
  },
  productName: {
    color: '#26392c',
    fontSize: 13,
    fontWeight: '700',
    minHeight: 36,
  },
  productPrice: {
    color: DARK_GREEN,
    fontSize: 13,
    fontWeight: '800',
  },
  productUnit: {
    color: '#78857b',
    fontSize: 9,
    fontWeight: '400',
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  productFooterStacked: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  priceGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  comparePrice: {
    color: '#98a199',
    fontSize: 9,
    textDecorationLine: 'line-through',
  },
  addButton: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderRadius: 18,
    backgroundColor: GREEN,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  stateCard: {
    alignItems: 'center',
    padding: 28,
    marginTop: 22,
    borderWidth: 1,
    borderColor: '#e4ebe4',
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  stateTitle: {
    color: '#203b27',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateDetail: {
    color: '#718073',
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
  },
  primaryButton: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: 15,
    marginTop: 16,
    borderRadius: 9,
    backgroundColor: GREEN,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
