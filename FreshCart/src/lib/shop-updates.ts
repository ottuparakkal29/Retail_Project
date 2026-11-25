export const UPDATE_TYPES = [
  { value: 'daily_update', label: 'Daily update' },
  { value: 'offer', label: 'Offer' },
  { value: 'new_arrival', label: 'New arrival' },
  { value: 'festival_special', label: 'Festival special' },
] as const;

export type UpdateType = (typeof UPDATE_TYPES)[number]['value'];
export type ShopUpdate = {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  update_type: UpdateType;
  festival_tag: string | null;
  image_url: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
};

export type UpdateShop = {
  id: string;
  business_name: string;
  district: string | null;
  taluk: string | null;
  village: string | null;
};

export type FeedItem = { update: ShopUpdate; shop: UpdateShop };

export function joinShopUpdates(updates: ShopUpdate[], shops: UpdateShop[]): FeedItem[] {
  const byId = new Map(shops.map((shop) => [shop.id, shop]));
  return updates.flatMap((update) => {
    const shop = byId.get(update.business_id);
    return shop ? [{ update, shop }] : [];
  });
}

export function filterShopUpdates(
  items: FeedItem[],
  filters: { district: string; taluk: string; village: string; followed: Set<string> | null; now: number },
) {
  return items.filter(({ update, shop }) =>
    update.is_active &&
    (!filters.district || shop.district?.trim() === filters.district) &&
    (!filters.taluk || shop.taluk?.trim() === filters.taluk) &&
    (!filters.village || shop.village?.trim() === filters.village) &&
    (!update.valid_until || new Date(update.valid_until).getTime() >= filters.now) &&
    (!filters.followed || filters.followed.has(shop.id)),
  );
}

export function updateTypeLabel(type: UpdateType) {
  return UPDATE_TYPES.find((item) => item.value === type)?.label ?? type;
}
