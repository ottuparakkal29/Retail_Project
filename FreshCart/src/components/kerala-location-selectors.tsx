import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText as Text } from '@/components/app-text';
import type { KeralaLocation } from '@/hooks/use-kerala-locations';

type LocationLevel = 'district' | 'taluk' | 'village';

type Props = {
  locations: KeralaLocation[];
  district: string;
  taluk: string;
  village: string;
  onDistrictChange: (value: string) => void;
  onTalukChange: (value: string) => void;
  onVillageChange: (value: string) => void;
  includeAllOptions?: boolean;
  direction?: 'row' | 'column';
  disabled?: boolean;
};

const levelLabels: Record<LocationLevel, string> = {
  district: 'District',
  taluk: 'Taluk',
  village: 'Village',
};

export function KeralaLocationSelectors({
  locations,
  district,
  taluk,
  village,
  onDistrictChange,
  onTalukChange,
  onVillageChange,
  includeAllOptions = false,
  direction = 'column',
  disabled = false,
}: Props) {
  const [openLevel, setOpenLevel] = useState<LocationLevel | null>(null);
  const districtOptions = useMemo(
    () => uniqueValues(locations.map((location) => location.district)),
    [locations],
  );
  const talukOptions = useMemo(
    () =>
      uniqueValues(
        locations
          .filter((location) => !district || location.district === district)
          .map((location) => location.taluk),
      ),
    [locations, district],
  );
  const villageOptions = useMemo(
    () =>
      uniqueValues(
        locations
          .filter(
            (location) =>
              (!district || location.district === district) &&
              (!taluk || location.taluk === taluk),
          )
          .map((location) => location.village),
      ),
    [locations, district, taluk],
  );

  function choose(level: LocationLevel, value: string) {
    if (level === 'district') {
      onDistrictChange(value);
      onTalukChange('');
      onVillageChange('');
    } else if (level === 'taluk') {
      onTalukChange(value);
      onVillageChange('');
    } else {
      onVillageChange(value);
    }
    setOpenLevel(null);
  }

  function renderSelector(
    level: LocationLevel,
    value: string,
    options: string[],
    selectPlaceholder: string,
    allLabel: string,
    isDisabled: boolean,
  ) {
    const isOpen = openLevel === level;
    const choices = includeAllOptions ? ['', ...options] : options;
    const placeholder = includeAllOptions ? allLabel : selectPlaceholder;

    return (
      <View key={level} style={styles.field}>
        <Text style={styles.label}>{levelLabels[level]}{!includeAllOptions ? ' *' : ''}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${levelLabels[level]}: ${value || placeholder}`}
          accessibilityState={{ disabled: disabled || isDisabled, expanded: isOpen }}
          disabled={disabled || isDisabled}
          onPress={() => setOpenLevel(isOpen ? null : level)}
          style={({ pressed }) => [
            styles.select,
            (disabled || isDisabled) && styles.selectDisabled,
            pressed && styles.pressed,
          ]}>
          <Text numberOfLines={1} style={value ? styles.value : styles.placeholder}>
            {value || placeholder}
          </Text>
          <Text style={styles.chevron}>{isOpen ? '⌃' : '⌄'}</Text>
        </Pressable>
        {isOpen ? (
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.options}
            contentContainerStyle={styles.optionsContent}>
            {choices.length ? (
              choices.map((choice) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: value === choice }}
                  key={choice || `all-${level}`}
                  onPress={() => choose(level, choice)}
                  style={[styles.option, value === choice && styles.optionSelected]}>
                  <Text style={[styles.optionText, value === choice && styles.optionTextSelected]}>
                    {choice || allLabel}
                  </Text>
                </Pressable>
              ))
            ) : (
              <Text style={styles.emptyOption}>No locations available.</Text>
            )}
          </ScrollView>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.container, direction === 'row' && styles.containerRow]}>
      {renderSelector(
        'district',
        district,
        districtOptions,
        'Select district',
        'All Districts',
        false,
      )}
      {renderSelector(
        'taluk',
        taluk,
        talukOptions,
        'Select taluk',
        'All Taluks',
        !includeAllOptions && !district,
      )}
      {renderSelector(
        'village',
        village,
        villageOptions,
        'Select village',
        'All Villages',
        !includeAllOptions && (!district || !taluk),
      )}
    </View>
  );
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((first, second) =>
    first.localeCompare(second),
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 12,
  },
  containerRow: {
    flexDirection: 'row',
  },
  field: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    gap: 6,
  },
  label: {
    color: '#59685c',
    fontSize: 10,
    fontWeight: '700',
  },
  select: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#dce6dc',
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  selectDisabled: {
    backgroundColor: '#f5f7f5',
    opacity: 0.7,
  },
  value: {
    flex: 1,
    color: '#26392c',
    fontSize: 12,
    fontWeight: '600',
  },
  placeholder: {
    flex: 1,
    color: '#7c887e',
    fontSize: 12,
  },
  chevron: {
    color: '#647166',
    fontSize: 16,
  },
  options: {
    flexGrow: 0,
    maxHeight: 220,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e1e9e2',
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  optionsContent: {
    gap: 2,
    padding: 6,
  },
  option: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 7,
  },
  optionSelected: {
    backgroundColor: '#eaf5e9',
  },
  optionText: {
    color: '#526155',
    fontSize: 11,
  },
  optionTextSelected: {
    color: '#07552c',
    fontWeight: '700',
  },
  emptyOption: {
    padding: 8,
    color: '#68756b',
    fontSize: 10,
  },
  pressed: {
    opacity: 0.8,
  },
});
