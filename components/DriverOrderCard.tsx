import React, { useCallback, useState } from 'react';
import {
  LayoutAnimation,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';


if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface OrderData {
  id: string;
  customerName: string;
  phone: string;
  locationTag: string;
  totalAmount: number;
  items: OrderItem[];
  location?: {
    latitude: number;
    longitude: number;
    label?: string;
  };
}

interface DriverOrderCardProps {
  order: OrderData;
  onCall?: (order: OrderData) => void;
  onViewMap?: (order: OrderData) => void;
  onComplete?: (order: OrderData) => void;
  defaultOpen?: boolean;
  hideCallName?: boolean;
  actionButtonFlex?: [complete?: number, call?: number, map?: number];
}

const cedis = (amount: number) =>
  `¢${amount.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const firstName = (fullName: string) => fullName.trim().split(' ')[0];

const totalItems = (items: OrderItem[]) =>
  items.reduce((sum, i) => sum + i.quantity, 0);

const PhoneIcon = () => (
  <Text style={{ fontSize: 13, marginRight: 5 }}>📞</Text>
);

const PinIcon = () => (
  <Text style={{ fontSize: 13, marginRight: 5 }}>📍</Text>
);

const ClipboardIcon = () => (
  <Text style={{ fontSize: 11, marginRight: 4 }}>🗒</Text>
);

const BoxIcon = () => (
  <Text style={{ fontSize: 11, marginRight: 4 }}>📦</Text>
);

const Chevron = ({ open }: { open: boolean }) => (
  <Text
    style={[
      styles.chevron,
      { transform: [{ rotate: open ? '180deg' : '0deg' }] },
    ]}
  >
    ⌄
  </Text>
);

const DriverOrderCard: React.FC<DriverOrderCardProps> = ({
  order,
  onCall,
  onViewMap,
  onComplete,
  defaultOpen = false,
  hideCallName = false,
  actionButtonFlex,
}) => {
  const [expanded, setExpanded] = useState(defaultOpen);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  const handleCall = useCallback(() => {
    if (onCall) {
      onCall(order);
    } else {
      const url = `tel:${order.phone.replace(/\s/g, '')}`;
      Linking.openURL(url).catch(() => { });
    }
  }, [order, onCall]);

  const handleViewMap = useCallback(() => {
    if (onViewMap) {
      onViewMap(order);
    } else if (order.location) {
      const { latitude, longitude, label } = order.location;
      const query = label
        ? encodeURIComponent(label)
        : `${latitude},${longitude}`;
      const url =
        Platform.OS === 'ios'
          ? `maps://?q=${query}&ll=${latitude},${longitude}`
          : `geo:${latitude},${longitude}?q=${query}`;
      Linking.openURL(url).catch(() => { });
    }
  }, [order, onViewMap]);

  const handleComplete = useCallback(() => {
    onComplete?.(order);
  }, [order, onComplete]);

  const itemCount = totalItems(order.items);
  const orderCount = order.items.length;

  return (
    <View style={[styles.card,  !expanded && { paddingVertical: 12, alignItems: "center" , borderRadius: 16 }]}>

      <TouchableOpacity
        style={styles.headerRow}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.customerName} numberOfLines={1}>
            {order.customerName}
          </Text>
          <View style={styles.phonePillRow}>
            <Text style={styles.phoneText}>{order.phone}</Text>
            <View style={styles.separator} />
            <View style={styles.locationPill}>
              <Text style={styles.locationPillText}>{order.locationTag}</Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.totalAmount}>{cedis(order.totalAmount)}</Text>
          <Svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <Path d="M16.6004 7.45834L11.1671 12.8917C10.5254 13.5333 9.47539 13.5333 8.83372 12.8917L3.40039 7.45834" stroke="black" stroke-opacity="0.6" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
          </Svg>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.collapsibleContainer}>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <Path d="M8.37053 1.16666H5.62887C5.0222 1.16666 4.52637 1.65666 4.52637 2.26333V2.81166C4.52637 3.41833 5.01637 3.90833 5.62303 3.90833H8.37053C8.9772 3.90833 9.4672 3.41833 9.4672 2.81166V2.26333C9.47303 1.65666 8.9772 1.16666 8.37053 1.16666Z" fill="black" fill-opacity="0.4" />
                <Path d="M10.0564 2.81167C10.0564 3.73917 9.29811 4.4975 8.37061 4.4975H5.62895C4.70145 4.4975 3.94311 3.73917 3.94311 2.81167C3.94311 2.485 3.59311 2.28084 3.30145 2.4325C2.47895 2.87 1.91895 3.73917 1.91895 4.73667V10.2258C1.91895 11.6608 3.09145 12.8333 4.52645 12.8333H9.47311C10.9081 12.8333 12.0806 11.6608 12.0806 10.2258V4.73667C12.0806 3.73917 11.5206 2.87 10.6981 2.4325C10.4064 2.28084 10.0564 2.485 10.0564 2.81167ZM7.22145 9.8875H4.66645C4.42728 9.8875 4.22895 9.68917 4.22895 9.45C4.22895 9.21084 4.42728 9.0125 4.66645 9.0125H7.22145C7.46061 9.0125 7.65895 9.21084 7.65895 9.45C7.65895 9.68917 7.46061 9.8875 7.22145 9.8875ZM8.74978 7.55417H4.66645C4.42728 7.55417 4.22895 7.35584 4.22895 7.11667C4.22895 6.8775 4.42728 6.67917 4.66645 6.67917H8.74978C8.98895 6.67917 9.18728 6.8775 9.18728 7.11667C9.18728 7.35584 8.98895 7.55417 8.74978 7.55417Z" fill="black" fill-opacity="0.4" />
              </Svg>
              <Text style={styles.metaText}>Orders {orderCount}</Text>
            </View>
            <View style={styles.metaItem}>
              <Svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <Path d="M10.0502 3.47C10.0502 3.74 9.9052 3.985 9.6752 4.11L8.8052 4.58L8.0652 4.975L6.5302 5.805C6.3652 5.895 6.1852 5.94 6.0002 5.94C5.8152 5.94 5.6352 5.895 5.4702 5.805L2.3252 4.11C2.0952 3.985 1.9502 3.74 1.9502 3.47C1.9502 3.2 2.0952 2.955 2.3252 2.83L3.3102 2.3L4.0952 1.875L5.4702 1.135C5.8002 0.955 6.2002 0.955 6.5302 1.135L9.6752 2.83C9.9052 2.955 10.0502 3.2 10.0502 3.47Z" fill="black" fill-opacity="0.5" />
                <Path d="M4.95035 6.395L2.02535 4.935C1.80035 4.82 1.54035 4.835 1.32535 4.965C1.11035 5.095 0.985352 5.325 0.985352 5.575V8.34C0.985352 8.82 1.25035 9.25 1.68035 9.465L4.60535 10.925C4.70535 10.975 4.81535 11 4.92535 11C5.05535 11 5.18535 10.965 5.30035 10.89C5.51535 10.76 5.64035 10.53 5.64035 10.28V7.515C5.64535 7.04 5.38035 6.61 4.95035 6.395Z" fill="black" fill-opacity="0.5" />
                <Path d="M11.0155 5.575V8.34C11.0155 8.815 10.7505 9.245 10.3205 9.46L7.39547 10.925C7.29547 10.975 7.18547 11 7.07547 11C6.94547 11 6.81547 10.965 6.69547 10.89C6.48547 10.76 6.35547 10.53 6.35547 10.28V7.52C6.35547 7.04 6.62047 6.61 7.05047 6.395L8.12547 5.86L8.87547 5.485L9.97547 4.935C10.2005 4.82 10.4605 4.83 10.6755 4.965C10.8855 5.095 11.0155 5.325 11.0155 5.575Z" fill="black" fill-opacity="0.5" />
                <Path d="M8.80457 4.58L8.06457 4.975L3.30957 2.3L4.09457 1.875L8.68457 4.465C8.73457 4.495 8.77457 4.535 8.80457 4.58Z" fill="black" fill-opacity="0.5" />
                <Path d="M8.875 5.485V6.62C8.875 6.825 8.705 6.995 8.5 6.995C8.295 6.995 8.125 6.825 8.125 6.62V5.86L8.875 5.485Z" fill="black" fill-opacity="0.5" />
              </Svg>

              <Text style={styles.metaText}>{itemCount} Items</Text>
            </View>
          </View>

          <View style={styles.itemsSection}>
            {order.items.map((item, index) => (
              <React.Fragment key={`${item.name}-${index}`}>
                {index > 0 && <View style={styles.dashedDivider} />}
                <View style={styles.itemRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQty}>{item.quantity}</Text>
                  <Text style={styles.itemPrice}>{cedis(item.price)}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          <View style={styles.actionsRow}>
            {onComplete && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.completeBtn, actionButtonFlex?.[0] != null && { flex: actionButtonFlex[0] }]}
                  onPress={handleComplete}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.actionBtnText, styles.completeBtnText]}>
                    Complete
                  </Text>
                </TouchableOpacity>
                <View style={styles.actionBtnGap} />
              </>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, styles.callBtn, actionButtonFlex?.[1] != null && { flex: actionButtonFlex[1] }]}
              onPress={handleCall}
              activeOpacity={0.75}
            >
              <Text style={[styles.actionBtnText, styles.callBtnText]}>
                {hideCallName ? 'Call' : `Call ${firstName(order.customerName)}`}
              </Text>
            </TouchableOpacity>

            <View style={styles.actionBtnGap} />

            <TouchableOpacity
              style={[styles.actionBtn, styles.mapBtn, actionButtonFlex?.[2] != null && { flex: actionButtonFlex[2] }]}
              onPress={handleViewMap}
              activeOpacity={0.75}
            >
              <Text style={[styles.actionBtnText, styles.mapBtnText]}>
                View Direction
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </View>
  );
};

const CORAL = '#F26522';
const GREEN = '#22A45D';
const BORDER = '#F0F0F0';
const TEXT_DARK = '#111111';
const TEXT_MID = 'rgba(0,0,0,0.45)';
const TEXT_LIGHT = 'rgba(0,0,0,0.30)';

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FAFAFA',
    borderRadius: 24,
    paddingTop: 14,
    // paddingBottom:  0,
    // paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    overflowY: 'hidden',
    overflowX: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 12,
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
    
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_DARK,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  phonePillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phoneText: {
    fontSize: 13,
    color: TEXT_MID,
    fontWeight: '400',
  },
  separator: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginHorizontal: 2,
  },
  locationPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    // backgroundColor: 'rgba(0,0,0,0.05)',
  },
  locationPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MID,
    letterSpacing: 0.4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 1,
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_DARK,
    letterSpacing: -0.3,
  },
  chevron: {
    fontSize: 18,
    color: TEXT_MID,
    lineHeight: 20,
    marginTop: -2,
  },
  collapsibleContainer: {
    padding: 12,
    gap: 12,
    alignSelf: 'stretch',
    borderRadius: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    marginTop: 8
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: TEXT_LIGHT,
    fontWeight: '500',
  },
  itemsSection: {
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  itemName: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    color: TEXT_DARK,
    letterSpacing: -0.1,
  },
  itemQty: {
    width: 28,
    textAlign: 'center',
    fontSize: 13,
    color: TEXT_MID,
    fontWeight: '400',
  },
  itemPrice: {
    width: 72,
    textAlign: 'right',
    fontSize: 13.5,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  dashedDivider: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    borderStyle: 'dashed',
  },
  actionsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
  },
  actionBtnGap: {
    width: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 100,
    borderWidth: 1,
    gap: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  callBtn: {
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fafafa',
  },
  callBtnText: {
    color: CORAL,
  },
  mapBtn: {
    // borderColor: GREEN,
    backgroundColor: '#fafafa',
    borderColor: 'rgba(0,0,0,0.1)',
  },
  mapBtnText: {
    color: GREEN,
  },
  completeBtn: {
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: '#fafafa',
  },
  completeBtnText: {
    color: '#007AFF',
  },
});

export default DriverOrderCard;
