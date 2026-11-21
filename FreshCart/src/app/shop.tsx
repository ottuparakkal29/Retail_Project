import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText as Text } from '@/components/app-text';
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
  const { addItem, error: cartError, dismissError } = useCart();
  const scrollRef = useRef<ScrollView>(null);
  const catalogOffset = useRef(0);
  const [shop, setShop] = useState<Shop | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [addedProductId, setAddedProductId] = useState('');

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
    () =>
      products.filter(
        (product) =>
          selectedCategory === 'all' || product.category_id === selectedCategory,
      ),
    [products, selectedCategory],
  );
  async function addProductToCart(product: Product) {
    dismissError();
    const image = imageUrl(product.image_path);
    const cartProduct: CartProduct = {
      id: product.id,
      name: product.name,
      detail: product.unit,
      price: Number(product.price),
      image,
    };
    if (await addItem(cartProduct)) {
      setAddedProductId(product.id);
      setTimeout(() => setAddedProductId((current) =>
        current === product.id ? '' : current,
      ), 1800);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.content, isWide && styles.contentWide]}>
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
              <View style={[styles.shopHero, isWide && styles.shopHeroWide]}>
                <View style={styles.heroCopy}>
                  <Text style={styles.eyebrow}>FRESHCART · SHOP LOCAL</Text>
                  <Text style={styles.heroTitle}>{shop.business_name}</Text>
                  <Text style={styles.heroSubtitle}>
                    Fresh picks and everyday essentials, from your neighborhood shop.
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
                      scrollRef.current?.scrollTo({
                        y: catalogOffset.current + 20,
                        animated: true,
                      });
                    }}
                    style={({ pressed }) => [
                      styles.heroButton,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.heroButtonText}>Shop this store →</Text>
                  </Pressable>
                </View>
                <Image
                  accessibilityLabel="Fresh greens"
                  source={require('../../assets/images/store/hero-produce.jpg')}
                  contentFit="cover"
                  style={styles.heroImage}
                />
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
                  <Text style={styles.catalogTitle}>Popular Products</Text>
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
                            flexBasis: isWide ? '15.8%' : isTablet ? '23.8%' : '47.8%',
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
                    {products.length ? 'No products in this category' : 'No products available yet'}
                  </Text>
                  <Text style={styles.stateDetail}>
                    {products.length
                      ? 'Choose another category to view this shop’s products.'
                      : 'This shop has not listed active products yet.'}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
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
    backgroundColor: '#ffffff',
  },
  page: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 44,
  },
  content: {
    width: '100%',
    maxWidth: 760,
  },
  contentWide: {
    maxWidth: 1440,
  },
  shopHero: {
    overflow: 'hidden',
    gap: 18,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#e7f7c6',
  },
  shopHeroWide: {
    minHeight: 250,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 44,
    paddingVertical: 28,
  },
  heroCopy: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 10,
  },
  heroTitle: {
    maxWidth: 620,
    color: '#143e25',
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
  },
  heroSubtitle: {
    maxWidth: 540,
    color: '#304c36',
    fontSize: 13,
    lineHeight: 20,
  },
  heroDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 1,
  },
  heroImage: {
    width: '100%',
    height: 145,
    borderRadius: 15,
    backgroundColor: '#d8e9c2',
  },
  heroButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 5,
    borderRadius: 24,
    backgroundColor: GREEN,
  },
  heroButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
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
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e4ebe4',
    borderRadius: 15,
    backgroundColor: '#ffffff',
  },
  productImage: {
    width: '100%',
    aspectRatio: 1.45,
    backgroundColor: '#edf3ed',
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
    padding: 12,
  },
  productCategory: {
    color: GREEN,
    fontSize: 9,
    fontWeight: '700',
  },
  productName: {
    color: '#26392c',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  productDescription: {
    color: '#748176',
    fontSize: 9,
    marginTop: 4,
  },
  productPrice: {
    color: DARK_GREEN,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
  },
  productUnit: {
    color: '#78857b',
    fontSize: 9,
    fontWeight: '400',
  },
  addButton: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderRadius: 9,
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
  pressed: {
    opacity: 0.78,
  },
});
