import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
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
import { useResponsiveBreakpoint } from '@/hooks/use-responsive-breakpoint';
import { supabase } from '@/lib/supabase';

type Category = {
  id: string;
  name: string;
  slug: string;
  image_path: string | null;
};

type Product = {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  unit: string;
  stock_quantity: number;
  image_path: string | null;
  category_id: string;
};

type Business = {
  id: string;
  name: string;
};

const GREEN = '#138a39';
const DARK = '#17331e';
const MUTED = '#718073';
const BUCKET = 'product-media';

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function imageUrl(path: string | null) {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export default function ProductsScreen() {
  const isWide = useResponsiveBreakpoint(850);
  const [business, setBusiness] = useState<Business | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeIsError, setNoticeIsError] = useState(false);
  const [activeModal, setActiveModal] = useState<'product' | 'category' | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryImage, setCategoryImage] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [unit, setUnit] = useState('piece');
  const [stock, setStock] = useState('0');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [productImage, setProductImage] =
    useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setBusiness(null);
    setNotice('');
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
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
      if (!profile || profile.role !== 'business') {
        router.replace('/');
        return;
      }

      const { data: businessProfile, error: businessError } = await supabase
        .from('business_profiles')
        .select('id, business_name')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (businessError) throw businessError;
      if (!businessProfile) {
        setBusiness(null);
        setNotice('Your business profile could not be found. Contact support for help.');
        setNoticeIsError(true);
        return;
      }

      const [categoryResult, productResult] = await Promise.all([
        supabase
          .from('categories')
          .select('id, name, slug, image_path')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('products')
          .select(
            'id, name, brand, sku, price, compare_at_price, unit, stock_quantity, image_path, category_id',
          )
          .eq('business_id', businessProfile.id)
          .order('created_at', { ascending: false }),
      ]);
      if (categoryResult.error) throw categoryResult.error;
      if (productResult.error) throw productResult.error;

      setBusiness({ id: businessProfile.id, name: businessProfile.business_name });
      setCategories((categoryResult.data ?? []) as Category[]);
      setProducts((productResult.data ?? []) as Product[]);
    } catch (error) {
      setNotice(errorMessage(error, 'Unable to load your product workspace.'));
      setNoticeIsError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData]);

  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );
  const inventoryValue = useMemo(
    () => products.reduce((total, product) => total + Number(product.price) * Number(product.stock_quantity), 0),
    [products],
  );
  const lowStockCount = useMemo(
    () => products.filter((product) => Number(product.stock_quantity) <= 5).length,
    [products],
  );

  async function chooseImage(
    setImage: (asset: DocumentPicker.DocumentPickerAsset | null) => void,
  ) {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (!result.canceled) setImage(result.assets[0]);
  }

  async function uploadImage(asset: DocumentPicker.DocumentPickerAsset, businessId: string) {
    const response = await fetch(asset.uri);
    if (!response.ok) throw new Error('Could not read the selected image.');
    const file = await response.blob();
    const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${businessId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: asset.mimeType ?? 'image/jpeg',
      upsert: false,
    });
    if (error) throw error;
    return path;
  }

  function closeModal() {
    setActiveModal(null);
    setCategoryPickerVisible(false);
  }

  async function createCategory() {
    const name = categoryName.trim();
    const slug = slugify(name);
    if (!business) return;
    if (!name || !slug) {
      setNotice('Enter a category name using at least one letter or number.');
      setNoticeIsError(true);
      return;
    }

    setSaving(true);
    setNotice('');
    try {
      const imagePath = categoryImage ? await uploadImage(categoryImage, business.id) : null;
      const { error } = await supabase.from('categories').insert({
        name,
        slug,
        image_path: imagePath,
        is_active: true,
      });
      if (error) throw error;
      setCategoryName('');
      setCategoryImage(null);
      closeModal();
      await loadData();
      setNotice('Your new category is ready.');
      setNoticeIsError(false);
    } catch (error) {
      setNotice(errorMessage(error, 'Unable to create this category.'));
      setNoticeIsError(true);
    } finally {
      setSaving(false);
    }
  }

  async function createProduct() {
    if (!business) return;
    const parsedPrice = Number(price);
    const parsedComparePrice = compareAtPrice.trim() ? Number(compareAtPrice) : null;
    const parsedStock = Number(stock);
    if (!productName.trim() || !selectedCategoryId || !unit.trim()) {
      setNotice('Add a product name, category, and unit before saving.');
      setNoticeIsError(true);
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setNotice('Enter a valid product price of zero or more.');
      setNoticeIsError(true);
      return;
    }
    if (
      parsedComparePrice !== null &&
      (!Number.isFinite(parsedComparePrice) || parsedComparePrice < 0)
    ) {
      setNotice('Enter a valid compare-at price or leave it blank.');
      setNoticeIsError(true);
      return;
    }
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      setNotice('Enter a valid stock quantity of zero or more.');
      setNoticeIsError(true);
      return;
    }

    setSaving(true);
    setNotice('');
    try {
      const imagePath = productImage ? await uploadImage(productImage, business.id) : null;
      const { error } = await supabase.from('products').insert({
        business_id: business.id,
        category_id: selectedCategoryId,
        name: productName.trim(),
        description: description.trim() || null,
        brand: brand.trim() || null,
        sku: sku.trim() || null,
        price: parsedPrice,
        compare_at_price: parsedComparePrice,
        unit: unit.trim(),
        stock_quantity: parsedStock,
        image_path: imagePath,
        is_active: true,
      });
      if (error) throw error;
      setProductName('');
      setBrand('');
      setSku('');
      setPrice('');
      setCompareAtPrice('');
      setUnit('piece');
      setStock('0');
      setDescription('');
      setProductImage(null);
      closeModal();
      await loadData();
      setNotice('Your product has been added to the catalog.');
      setNoticeIsError(false);
    } catch (error) {
      setNotice(errorMessage(error, 'Unable to add this product.'));
      setNoticeIsError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.appFrame}>
        {isWide ? (
          <View style={styles.sidebar}>
            <View>
              <View style={styles.sidebarBrand}>
                <View style={styles.leafMark}>
                  <Text style={styles.leafMarkText}>F</Text>
                </View>
                <View>
                  <Text style={styles.sidebarBrandName}>FreshCart</Text>
                  <Text style={styles.sidebarBrandCaption}>BUSINESS PANEL</Text>
                </View>
              </View>
              <View style={styles.sidebarMenu}>
                <SidebarItem icon="⌂" label="Dashboard" onPress={() => {}} />
                <SidebarItem icon="▣" label="Products" onPress={() => {}} />
                <SidebarItem
                  icon="◈"
                  label="Categories"
                  onPress={() => setActiveModal('category')}
                />
              </View>
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
          style={styles.mainScroll}
          contentContainerStyle={[styles.page, isWide && styles.pageWide]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.topbar}>
            {!isWide ? (
              <Pressable onPress={() => router.replace('/')} style={styles.brand}>
                <View style={styles.brandMark}><Text style={styles.brandMarkText}>F</Text></View>
                <View>
                  <Text style={styles.brandName}>FreshCart</Text>
                  <Text style={styles.brandCaption}>BUSINESS STUDIO</Text>
                </View>
              </Pressable>
            ) : (
              <Text style={styles.pageLabel}>Product management</Text>
            )}
            <Pressable onPress={() => router.replace('/')} style={styles.storeLink}>
              <Text style={styles.storeLinkText}>← Storefront</Text>
            </Pressable>
          </View>

        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>YOUR BUSINESS, IN ONE PLACE</Text>
            <Text style={styles.title}>Products & categories</Text>
            <Text style={styles.subtitle}>
              {business
                ? `Build the ${business.name} catalog your customers will love.`
                : 'Manage your catalog and keep your inventory fresh.'}
            </Text>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={!business || saving}
              onPress={() => {
                setNotice('');
                setActiveModal('category');
              }}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.pressed,
                (!business || saving) && styles.disabledButton,
              ]}>
              <Text style={styles.secondaryButtonText}>＋ Category</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!business || saving}
              onPress={() => {
                setNotice('');
                setActiveModal('product');
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
                (!business || saving) && styles.disabledButton,
              ]}>
              <Text style={styles.primaryButtonText}>＋ Add product</Text>
            </Pressable>
          </View>
        </View>

        {notice ? (
          <View style={[styles.notice, noticeIsError && styles.noticeError]}>
            <Text style={[styles.noticeText, noticeIsError && styles.noticeErrorText]}>{notice}</Text>
          </View>
        ) : null}

        <View style={styles.metrics}>
          <Metric label="Products listed" value={loading ? '—' : String(products.length)} icon="▣" />
          <Metric label="Categories" value={loading ? '—' : String(categories.length)} icon="◈" />
          <Metric
            label="Low stock"
            value={loading ? '—' : String(lowStockCount)}
            icon="↘"
            accent={lowStockCount > 0}
          />
          <Metric
            label="Stock value"
            value={loading ? '—' : `₹${inventoryValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
            icon="₹"
          />
        </View>

        <View style={[styles.contentGrid, isWide && styles.contentGridWide]}>
          <View style={styles.catalogCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Your products</Text>
                <Text style={styles.sectionSubtitle}>Every item in your catalog, at a glance.</Text>
              </View>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{products.length} items</Text>
              </View>
            </View>
            {loading ? (
              <Text style={styles.emptyState}>Loading your catalog…</Text>
            ) : products.length ? (
              <View style={styles.productList}>
                {products.map((product) => {
                  const image = imageUrl(product.image_path);
                  return (
                    <View key={product.id} style={styles.productRow}>
                      {image ? (
                        <Image source={{ uri: image }} style={styles.productImage} contentFit="cover" />
                      ) : (
                        <View style={styles.productImagePlaceholder}>
                          <Text style={styles.productImagePlaceholderText}>✳</Text>
                        </View>
                      )}
                      <View style={styles.productDetails}>
                        <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                        <Text style={styles.productMeta} numberOfLines={1}>
                          {categoryNames.get(product.category_id) ?? 'Uncategorised'}
                          {product.brand ? ` · ${product.brand}` : ''}
                          {product.sku ? ` · ${product.sku}` : ''}
                        </Text>
                      </View>
                      <View style={styles.productNumbers}>
                        <Text style={styles.productPrice}>
                          ₹{Number(product.price).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </Text>
                        <Text style={styles.productStock}>
                          {Number(product.stock_quantity)} {product.unit} in stock
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>✳</Text></View>
                <Text style={styles.emptyTitle}>Your catalog starts here</Text>
                <Text style={styles.emptySubtitle}>
                  Add a category, then create your first product to get started.
                </Text>
                <Pressable
                  disabled={!business}
                  onPress={() => setActiveModal('product')}
                  style={[styles.emptyButton, !business && styles.disabledButton]}>
                  <Text style={styles.emptyButtonText}>Add your first product</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={styles.categoriesCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Categories</Text>
                <Text style={styles.sectionSubtitle}>Keep products easy to find.</Text>
              </View>
              <Pressable
                disabled={!business}
                onPress={() => setActiveModal('category')}
                style={[styles.addCircle, !business && styles.disabledButton]}>
                <Text style={styles.addCircleText}>＋</Text>
              </Pressable>
            </View>
            {categories.length ? (
              <View style={styles.categoryList}>
                {categories.map((category, index) => {
                  const image = imageUrl(category.image_path);
                  return (
                    <View key={category.id} style={styles.categoryRow}>
                      {image ? (
                        <Image source={{ uri: image }} style={styles.categoryImage} contentFit="cover" />
                      ) : (
                        <View style={[styles.categoryIcon, { backgroundColor: ['#e7f5e8', '#fff1db', '#eaf0fc', '#f8e9e4'][index % 4] }]}>
                          <Text style={styles.categoryIconText}>{category.name.slice(0, 1).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={styles.categoryName} numberOfLines={1}>{category.name}</Text>
                      <Text style={styles.categoryArrow}>›</Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.categoryEmpty}>No categories yet. Add one to organize your products.</Text>
            )}
            <Pressable
              disabled={!business}
              onPress={() => setActiveModal('category')}
              style={[styles.addCategoryRow, !business && styles.disabledButton]}>
              <Text style={styles.addCategoryText}>＋ Create category</Text>
            </Pressable>
          </View>
        </View>
        </ScrollView>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={activeModal !== null}
        onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalEyebrow}>{activeModal === 'product' ? 'CATALOG ITEM' : 'ORGANIZE YOUR STORE'}</Text>
                  <Text style={styles.modalTitle}>
                    {activeModal === 'product' ? 'Add a product' : 'New category'}
                  </Text>
                </View>
                <Pressable onPress={closeModal} style={styles.closeButton}>
                  <Text style={styles.closeButtonText}>×</Text>
                </Pressable>
              </View>

              {activeModal === 'category' ? (
                <>
                  <Field label="Category name *" value={categoryName} onChangeText={setCategoryName} placeholder="e.g. Fresh produce" />
                  <Pressable onPress={() => void chooseImage(setCategoryImage)} style={styles.uploadBox}>
                    <Text style={styles.uploadIcon}>{categoryImage ? '✓' : '↑'}</Text>
                    <Text style={styles.uploadTitle}>
                      {categoryImage?.name ?? 'Add a category image'}
                    </Text>
                    <Text style={styles.uploadSubtitle}>Optional · JPG or PNG</Text>
                  </Pressable>
                  <Pressable
                    disabled={saving || !business}
                    onPress={() => void createCategory()}
                    style={[styles.submitButton, (saving || !business) && styles.disabledButton]}>
                    <Text style={styles.submitButtonText}>{saving ? 'Saving…' : 'Create category'}</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={() => void chooseImage(setProductImage)} style={styles.uploadBox}>
                    <Text style={styles.uploadIcon}>{productImage ? '✓' : '↑'}</Text>
                    <Text style={styles.uploadTitle}>{productImage?.name ?? 'Upload product photo'}</Text>
                    <Text style={styles.uploadSubtitle}>Optional · JPG or PNG</Text>
                  </Pressable>
                  <Field label="Product name *" value={productName} onChangeText={setProductName} placeholder="e.g. Organic avocados" />
                  <View style={styles.fieldPair}>
                    <Field label="Brand" value={brand} onChangeText={setBrand} placeholder="Brand name" />
                    <Field label="SKU" value={sku} onChangeText={setSku} placeholder="Optional code" />
                  </View>
                  <Pressable onPress={() => setCategoryPickerVisible(true)} style={styles.selectField}>
                    <Text style={styles.selectLabel}>Category *</Text>
                    <Text style={selectedCategoryId ? styles.selectValue : styles.selectPlaceholder}>
                      {categories.find((category) => category.id === selectedCategoryId)?.name ??
                        (categories.length ? 'Choose a category  ›' : 'Create a category first')}
                    </Text>
                  </Pressable>
                  <View style={styles.fieldPair}>
                    <Field label="Price (₹) *" value={price} onChangeText={setPrice} placeholder="0.00" keyboardType="decimal-pad" />
                    <Field label="Compare-at price" value={compareAtPrice} onChangeText={setCompareAtPrice} placeholder="Optional" keyboardType="decimal-pad" />
                  </View>
                  <View style={styles.fieldPair}>
                    <Field label="Unit *" value={unit} onChangeText={setUnit} placeholder="piece, kg, pack…" />
                    <Field label="Stock quantity" value={stock} onChangeText={setStock} placeholder="0" keyboardType="decimal-pad" />
                  </View>
                  <Field label="Description" value={description} onChangeText={setDescription} placeholder="Tell customers what makes it special…" multiline />
                  <Pressable
                    disabled={saving || !business || !categories.length}
                    onPress={() => void createProduct()}
                    style={[
                      styles.submitButton,
                      (saving || !business || !categories.length) && styles.disabledButton,
                    ]}>
                    <Text style={styles.submitButtonText}>{saving ? 'Saving…' : 'Add product to catalog'}</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        animationType="fade"
        visible={categoryPickerVisible}
        onRequestClose={() => setCategoryPickerVisible(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setCategoryPickerVisible(false)}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Choose a category</Text>
            {categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => {
                  setSelectedCategoryId(category.id);
                  setCategoryPickerVisible(false);
                }}
                style={styles.pickerOption}>
                <Text style={styles.pickerOptionText}>{category.name}</Text>
                {category.id === selectedCategoryId ? <Text style={styles.pickerCheck}>✓</Text> : null}
              </Pressable>
            ))}
            {!categories.length ? (
              <Text style={styles.categoryEmpty}>Create a category before adding a product.</Text>
            ) : null}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Metric({
  label,
  value,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: boolean;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, accent && styles.metricIconAccent]}>
        <Text style={[styles.metricIconText, accent && styles.metricIconTextAccent]}>{icon}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Field({
  label,
  multiline = false,
  ...props
}: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#a1aba2"
        style={[styles.input, multiline && styles.multilineInput]}
      />
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
  const [interacting, setInteracting] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onHoverIn={() => setInteracting(true)}
      onHoverOut={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={() => setInteracting(false)}
      style={({ pressed }) => [
        styles.sidebarItem,
        (active || interacting) && styles.sidebarItemActive,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.sidebarItemIcon, (active || interacting) && styles.sidebarItemIconActive]}>{icon}</Text>
      <Text style={[styles.sidebarItemText, (active || interacting) && styles.sidebarItemTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f8f3' },
  appFrame: { flex: 1, flexDirection: 'row' },
  mainScroll: { flex: 1 },
  page: { flexGrow: 1, padding: 18, paddingBottom: 48, gap: 22 },
  pageWide: { width: '100%', paddingHorizontal: 28, paddingTop: 18, maxWidth: 1500, alignSelf: 'center' },
  sidebar: { width: 218, paddingHorizontal: 15, paddingVertical: 18, backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#e7ede7', justifyContent: 'space-between' },
  sidebarBrand: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 9, paddingBottom: 25, borderBottomWidth: 1, borderBottomColor: '#edf0ed' },
  leafMark: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#dcf1d6', alignItems: 'center', justifyContent: 'center' },
  leafMarkText: { color: '#1b7539', fontSize: 22, fontWeight: '900' },
  sidebarBrandName: { color: '#176a35', fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  sidebarBrandCaption: { color: '#7d8b7e', fontSize: 8, fontWeight: '700', letterSpacing: 1.1, marginTop: 2 },
  sidebarMenu: { paddingTop: 17 },
  sidebarItem: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 11, marginBottom: 4, borderRadius: 10 },
  sidebarItemActive: { backgroundColor: '#e9f8e5' },
  sidebarItemIcon: { width: 20, color: '#526456', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  sidebarItemIconActive: { color: '#21823d' },
  sidebarItemText: { color: '#425146', fontSize: 11, fontWeight: '600' },
  sidebarItemTextActive: { color: '#216a35', fontWeight: '800' },
  sidebarBottom: { gap: 13 },
  sidebarPromo: { alignItems: 'center', paddingVertical: 15, borderRadius: 15, backgroundColor: '#eff9e9' },
  promoBasket: { fontSize: 28 },
  promoTitle: { color: '#28713b', fontSize: 14, fontWeight: '800', marginTop: 4 },
  promoSubtitle: { color: '#789078', fontSize: 8, marginTop: 3 },
  logoutButton: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10 },
  logoutIcon: { color: '#546357', fontSize: 17 },
  logoutLabel: { color: '#536156', fontSize: 10, fontWeight: '600' },
  pageLabel: { color: DARK, fontSize: 14, fontWeight: '700' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: 1, borderColor: '#e7ede5' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  brandName: { color: DARK, fontSize: 16, fontWeight: '800' },
  brandCaption: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  storeLink: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e3ebe1' },
  storeLinkText: { color: DARK, fontSize: 12, fontWeight: '600' },
  headingRow: { gap: 18 },
  headingCopy: { gap: 4 },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  title: { color: DARK, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: MUTED, fontSize: 12, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  primaryButton: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  secondaryButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce7dc', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center' },
  secondaryButtonText: { color: DARK, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.8 },
  notice: { padding: 12, borderRadius: 12, backgroundColor: '#e6f4e8', borderWidth: 1, borderColor: '#cde6cf' },
  noticeError: { backgroundColor: '#fff0ed', borderColor: '#f2d1ca' },
  noticeText: { color: '#276b38', fontSize: 12, lineHeight: 18 },
  noticeErrorText: { color: '#a34232' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { flexGrow: 1, flexBasis: '45%', minWidth: 135, backgroundColor: '#fff', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e9eee7', gap: 3 },
  metricIcon: { width: 29, height: 29, borderRadius: 10, backgroundColor: '#eaf6eb', alignItems: 'center', justifyContent: 'center', marginBottom: 5 },
  metricIconAccent: { backgroundColor: '#fff1dd' },
  metricIconText: { color: GREEN, fontSize: 14, fontWeight: '800' },
  metricIconTextAccent: { color: '#bb7417' },
  metricValue: { color: DARK, fontSize: 20, fontWeight: '800' },
  metricLabel: { color: MUTED, fontSize: 10, fontWeight: '500' },
  contentGrid: { gap: 16 },
  contentGridWide: { flexDirection: 'row', alignItems: 'flex-start' },
  catalogCard: { flex: 1.8, minWidth: 0, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e9eee7', padding: 17 },
  categoriesCard: { flex: 1, minWidth: 260, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e9eee7', padding: 17 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#eff2ee' },
  sectionTitle: { color: DARK, fontSize: 15, fontWeight: '800' },
  sectionSubtitle: { color: MUTED, fontSize: 10, marginTop: 3 },
  countPill: { backgroundColor: '#eef7ee', paddingVertical: 6, paddingHorizontal: 9, borderRadius: 20 },
  countPillText: { color: '#327345', fontSize: 9, fontWeight: '700' },
  productList: { gap: 0 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f0f3ef' },
  productImage: { width: 49, height: 49, borderRadius: 12, backgroundColor: '#f3f6f1' },
  productImagePlaceholder: { width: 49, height: 49, borderRadius: 12, backgroundColor: '#eff6ed', alignItems: 'center', justifyContent: 'center' },
  productImagePlaceholderText: { color: GREEN, fontSize: 22 },
  productDetails: { flex: 1, minWidth: 0, gap: 4 },
  productName: { color: DARK, fontSize: 12, fontWeight: '700' },
  productMeta: { color: MUTED, fontSize: 9 },
  productNumbers: { alignItems: 'flex-end', gap: 4 },
  productPrice: { color: DARK, fontSize: 12, fontWeight: '800' },
  productStock: { color: MUTED, fontSize: 9 },
  emptyState: { paddingVertical: 24, color: MUTED, fontSize: 12, textAlign: 'center' },
  emptyBox: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 32, gap: 8 },
  emptyIcon: { width: 49, height: 49, borderRadius: 17, backgroundColor: '#eaf6eb', alignItems: 'center', justifyContent: 'center' },
  emptyIconText: { color: GREEN, fontSize: 24 },
  emptyTitle: { color: DARK, fontSize: 14, fontWeight: '800' },
  emptySubtitle: { color: MUTED, fontSize: 10, textAlign: 'center', lineHeight: 16, maxWidth: 250 },
  emptyButton: { marginTop: 4, paddingVertical: 10, paddingHorizontal: 13, borderRadius: 10, backgroundColor: GREEN },
  emptyButtonText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addCircle: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#eaf6eb', alignItems: 'center', justifyContent: 'center' },
  addCircleText: { color: GREEN, fontSize: 18, fontWeight: '600' },
  categoryList: { paddingTop: 4 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f0f3ef' },
  categoryImage: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#f3f6f1' },
  categoryIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  categoryIconText: { color: DARK, fontSize: 12, fontWeight: '800' },
  categoryName: { flex: 1, color: DARK, fontSize: 11, fontWeight: '600' },
  categoryArrow: { color: '#9da99f', fontSize: 20 },
  categoryEmpty: { color: MUTED, fontSize: 10, lineHeight: 16, paddingVertical: 15 },
  addCategoryRow: { marginTop: 10, paddingVertical: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#d6e5d6', borderRadius: 10, alignItems: 'center' },
  addCategoryText: { color: GREEN, fontSize: 10, fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(18, 35, 21, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 540, maxHeight: '90%', backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalEyebrow: { color: GREEN, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  modalTitle: { color: DARK, fontSize: 21, fontWeight: '800', marginTop: 2 },
  closeButton: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#f1f5f0', alignItems: 'center', justifyContent: 'center' },
  closeButtonText: { color: DARK, fontSize: 22, lineHeight: 25 },
  field: { flex: 1, minWidth: 0, gap: 6, marginBottom: 12 },
  fieldLabel: { color: '#425446', fontSize: 10, fontWeight: '700' },
  input: { minHeight: 43, borderWidth: 1, borderColor: '#e1e9e0', backgroundColor: '#fcfdfb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: DARK, fontSize: 11 },
  multilineInput: { minHeight: 76, textAlignVertical: 'top' },
  fieldPair: { flexDirection: 'row', gap: 10 },
  selectField: { minHeight: 58, justifyContent: 'center', borderWidth: 1, borderColor: '#e1e9e0', backgroundColor: '#fcfdfb', borderRadius: 10, paddingHorizontal: 12, marginBottom: 12, gap: 3 },
  selectLabel: { color: '#425446', fontSize: 9, fontWeight: '700' },
  selectValue: { color: DARK, fontSize: 11 },
  selectPlaceholder: { color: '#a1aba2', fontSize: 11 },
  uploadBox: { minHeight: 96, marginBottom: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: '#c9dcc9', backgroundColor: '#f8fbf7', alignItems: 'center', justifyContent: 'center', gap: 4, padding: 12 },
  uploadIcon: { color: GREEN, fontSize: 18, fontWeight: '700' },
  uploadTitle: { color: DARK, fontSize: 10, fontWeight: '700' },
  uploadSubtitle: { color: MUTED, fontSize: 9 },
  submitButton: { minHeight: 45, marginTop: 5, borderRadius: 11, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  disabledButton: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  pickerBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(18, 35, 21, 0.48)' },
  pickerCard: { width: '100%', maxWidth: 380, borderRadius: 17, backgroundColor: '#fff', padding: 18 },
  pickerTitle: { color: DARK, fontSize: 15, fontWeight: '800', marginBottom: 9 },
  pickerOption: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eff2ee' },
  pickerOptionText: { color: DARK, fontSize: 12 },
  pickerCheck: { color: GREEN, fontWeight: '800' },
});
