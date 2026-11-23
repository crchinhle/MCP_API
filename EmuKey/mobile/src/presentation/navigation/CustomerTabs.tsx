import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCustomerSession } from '../../application/auth/useCustomerSession';
import { useCart } from '../../application/cart/cartContext';
import { AppIcon } from '../components/ui/AppIcon';
import { AccountScreen } from '../screens/account/AccountScreen';
import { ChangePasswordScreen } from '../screens/account/ChangePasswordScreen';
import { ProfileScreen } from '../screens/account/ProfileScreen';
import { CreateSupportRequestScreen } from '../screens/assistance/CreateSupportRequestScreen';
import { SupportListScreen } from '../screens/assistance/SupportListScreen';
import { CartScreen } from '../screens/cart/CartScreen';
import { CatalogScreen } from '../screens/catalog/CatalogScreen';
import { ComparePlansScreen } from '../screens/catalog/ComparePlansScreen';
import { ProductDetailScreen } from '../screens/catalog/ProductDetailScreen';
import { HelpListScreen } from '../screens/help/HelpListScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { LicensesScreen } from '../screens/licenses/LicensesScreen';
import { VerifyLicenseScreen } from '../screens/licenses/VerifyLicenseScreen';
import { OrderDetailScreen } from '../screens/orders/OrderDetailScreen';
import { OrdersScreen } from '../screens/orders/OrdersScreen';
import { PaymentHistoryScreen } from '../screens/orders/PaymentHistoryScreen';
import { colors, sizes, typography } from '../theme/tokens';
import type {
  AccountStackParamList,
  CartStackParamList,
  CustomerTabParamList,
  HomeStackParamList,
  OrdersStackParamList,
  RootStackParamList,
} from './navigationTypes';

const Tab = createBottomTabNavigator<CustomerTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const CartStack = createNativeStackNavigator<CartStackParamList>();
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();

function useRootNavigation() {
  return useNavigation<NativeStackNavigationProp<RootStackParamList>>();
}

function HomeScreenRoute({ navigation }: NativeStackScreenProps<HomeStackParamList, 'Home'>) {
  const rootNav = useRootNavigation();
  return (
    <HomeScreen
      onOpenAssistant={() => rootNav.navigate('AiAssistant')}
      onOpenCatalog={(initialQuery) =>
        navigation.navigate('Catalog', initialQuery ? { initialQuery } : undefined)
      }
      onOpenHelp={() =>
        rootNav.navigate('CustomerTabs', {
          screen: 'AccountTab',
          params: { screen: 'HelpList' },
        })
      }
      onOpenLicenses={(filter) =>
        rootNav.navigate('CustomerTabs', {
          screen: 'AccountTab',
          params: {
            screen: 'Licenses',
            params: { filter: filter ?? 'all' },
          },
        })
      }
      onOpenLicenseDetail={(licenseId) => rootNav.navigate('LicenseDetail', { licenseId })}
      onOpenNotifications={() => rootNav.navigate('Notifications')}
      onOpenOrder={(orderId) =>
        rootNav.navigate('CustomerTabs', {
          screen: 'OrdersTab',
          params: { screen: 'OrderDetail', params: { id: orderId } },
        })
      }
      onOpenOrdersTab={() =>
        rootNav.navigate('CustomerTabs', {
          screen: 'OrdersTab',
          params: { screen: 'Orders' },
        })
      }
      onOpenProduct={(productId) => navigation.navigate('ProductDetail', { productId })}
      onOpenSupport={() =>
        rootNav.navigate('CustomerTabs', {
          screen: 'AccountTab',
          params: { screen: 'SupportList' },
        })
      }
    />
  );
}

function HomeCatalogRoute({ navigation, route }: NativeStackScreenProps<HomeStackParamList, 'Catalog'>) {
  const rootNav = useRootNavigation();
  return (
    <CatalogScreen
      initialQuery={route.params?.initialQuery}
      onBack={() => navigation.goBack()}
      onNotifications={() => rootNav.navigate('Notifications')}
      onOpenCompare={(ids) => navigation.navigate('ComparePlans', { ids })}
      onOpenProduct={(productId) => navigation.navigate('ProductDetail', { productId })}
      showBell
    />
  );
}

function HomeProductDetailRoute({ navigation, route }: NativeStackScreenProps<HomeStackParamList, 'ProductDetail'>) {
  const rootNav = useRootNavigation();
  return (
    <ProductDetailScreen
      bottomInset={false}
      onAddToCart={(productId, planId) =>
        rootNav.navigate('PurchaseConfiguration', {
          productId,
          planId,
          action: 'cart',
        })
      }
      onBack={() => navigation.goBack()}
      onBuyNow={(productId, planId) =>
        rootNav.navigate('PurchaseConfiguration', {
          productId,
          planId,
          action: 'checkout',
        })
      }
      onOpenCompare={(ids) => navigation.navigate('ComparePlans', { ids })}
      onOpenHelpDocument={(documentId) => rootNav.navigate('HelpDetail', { documentId })}
      productId={route.params.productId}
    />
  );
}

function HomeCompareRoute({ navigation, route }: NativeStackScreenProps<HomeStackParamList, 'ComparePlans'>) {
  const rootNav = useRootNavigation();
  return (
    <ComparePlansScreen
      initialIds={route.params.ids}
      onBack={() => navigation.goBack()}
      onSelectPlanForPurchase={(productId, planId) =>
        rootNav.navigate('PurchaseConfiguration', { productId, planId })
      }
    />
  );
}

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen component={HomeScreenRoute} name="Home" />
      <HomeStack.Screen component={HomeCatalogRoute} name="Catalog" />
      <HomeStack.Screen component={HomeProductDetailRoute} name="ProductDetail" />
      <HomeStack.Screen component={HomeCompareRoute} name="ComparePlans" />
    </HomeStack.Navigator>
  );
}

function CartRoute() {
  const rootNav = useRootNavigation();
  return (
    <CartScreen
      onBrowseCatalog={() =>
        rootNav.navigate('CustomerTabs', {
          screen: 'HomeTab',
          params: { screen: 'Catalog' },
        })
      }
      onCheckoutDraft={(draft, customized) =>
        rootNav.navigate('CheckoutReview', {
          draftId: draft.id,
          productId: draft.productId,
          planId: draft.planId,
          productName: draft.productName,
          planName: draft.planName,
          priceVnd: draft.referencePriceVnd,
          deviceQuantity: draft.deviceQuantity,
          durationMonths: draft.durationMonths,
          customized,
        })
      }
      onEditDraft={(draft) =>
        rootNav.navigate('PurchaseConfiguration', {
          draftId: draft.id,
          productId: draft.productId,
          planId: draft.planId,
          deviceQuantity: draft.deviceQuantity,
          durationMonths: draft.durationMonths,
          action: 'cart',
        })
      }
      onOpenNotifications={() => rootNav.navigate('Notifications')}
      onResumeOrder={(orderId) =>
        rootNav.navigate('CustomerTabs', {
          screen: 'OrdersTab',
          params: { screen: 'OrderDetail', params: { id: orderId } },
        })
      }
    />
  );
}

function CartStackNavigator() {
  return (
    <CartStack.Navigator screenOptions={{ headerShown: false }}>
      <CartStack.Screen component={CartRoute} name="Cart" />
    </CartStack.Navigator>
  );
}

function OrdersListRoute({ navigation }: NativeStackScreenProps<OrdersStackParamList, 'Orders'>) {
  const rootNav = useRootNavigation();
  return (
    <OrdersScreen
      onBrowseCatalog={() =>
        rootNav.navigate('CustomerTabs', {
          screen: 'HomeTab',
          params: { screen: 'Catalog' },
        })
      }
      onOpenNotifications={() => rootNav.navigate('Notifications')}
      onOpenOrderDetail={(orderId) => navigation.navigate('OrderDetail', { id: orderId })}
      onOpenPayment={(orderId) => rootNav.navigate('Payment', { orderId })}
      onOpenPaymentHistory={() => navigation.navigate('PaymentHistory')}
      onOpenTerms={(orderId) => rootNav.navigate('ServiceTerms', { orderId })}
    />
  );
}

function OrdersDetailRoute({ navigation, route }: NativeStackScreenProps<OrdersStackParamList, 'OrderDetail'>) {
  const rootNav = useRootNavigation();
  return (
    <OrderDetailScreen
      navigation={{
        goBack: () => navigation.goBack(),
        navigate: rootNav.navigate,
      }}
      onOpenLicense={(licenseId) => rootNav.navigate('LicenseDetail', { licenseId })}
      onOpenPayment={(orderId) => rootNav.navigate('Payment', { orderId })}
      onOpenTerms={(orderId) => rootNav.navigate('ServiceTerms', { orderId })}
      onRequestSupport={(orderId, orderNumber) =>
        rootNav.navigate('CustomerTabs', {
          screen: 'AccountTab',
          params: {
            screen: 'CreateSupportRequest',
            params: {
              contextType: 'ORDER',
              contextId: orderId,
              contextLabel: orderNumber,
              initialTitle: `Hỗ trợ đơn ${orderNumber}`,
            },
          },
        })
      }
      route={route}
    />
  );
}

function OrdersPaymentHistoryRoute({ navigation }: NativeStackScreenProps<OrdersStackParamList, 'PaymentHistory'>) {
  return (
    <PaymentHistoryScreen
      onBack={() => navigation.goBack()}
      onOpenOrderDetail={(orderId) => navigation.navigate('OrderDetail', { id: orderId })}
    />
  );
}

function OrdersStackNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen component={OrdersListRoute} name="Orders" />
      <OrdersStack.Screen component={OrdersDetailRoute} name="OrderDetail" />
      <OrdersStack.Screen component={OrdersPaymentHistoryRoute} name="PaymentHistory" />
    </OrdersStack.Navigator>
  );
}

function AccountHubRoute({ navigation }: NativeStackScreenProps<AccountStackParamList, 'Account'>) {
  const rootNav = useRootNavigation();
  return (
    <AccountScreen
      onOpenAssistant={() => rootNav.navigate('AiAssistant')}
      onOpenChangePassword={() => navigation.navigate('ChangePassword')}
      onOpenHelp={() => navigation.navigate('HelpList')}
      onOpenLicenses={() => navigation.navigate('Licenses')}
      onOpenNotifications={() => rootNav.navigate('Notifications')}
      onOpenProfile={() => navigation.navigate('Profile')}
      onOpenSupport={() => navigation.navigate('SupportList')}
      onOpenVerify={() => navigation.navigate('VerifyLicense')}
    />
  );
}

function AccountLicensesRoute({ navigation, route }: NativeStackScreenProps<AccountStackParamList, 'Licenses'>) {
  const rootNav = useRootNavigation();
  return (
    <LicensesScreen
      initialFilter={route.params?.filter}
      onBack={() => navigation.goBack()}
      onBrowseCatalog={() =>
        rootNav.navigate('CustomerTabs', {
          screen: 'HomeTab',
          params: { screen: 'Catalog' },
        })
      }
      onOpenLicenseDetail={(licenseId) => rootNav.navigate('LicenseDetail', { licenseId })}
      targetLicenseId={route.params?.licenseId}
    />
  );
}

function AccountProfileRoute({ navigation }: NativeStackScreenProps<AccountStackParamList, 'Profile'>) {
  const { updateUser } = useCustomerSession();
  const isFocused = useIsFocused();
  return (
    <ProfileScreen
      isFocused={isFocused}
      onBack={() => navigation.goBack()}
      onProfileUpdated={updateUser}
    />
  );
}

function AccountChangePasswordRoute({ navigation }: NativeStackScreenProps<AccountStackParamList, 'ChangePassword'>) {
  return <ChangePasswordScreen onBack={() => navigation.goBack()} />;
}

function AccountSupportListRoute({ navigation }: NativeStackScreenProps<AccountStackParamList, 'SupportList'>) {
  const rootNav = useRootNavigation();
  return (
    <SupportListScreen
      onBack={() => navigation.goBack()}
      onCreateRequest={() => navigation.navigate('CreateSupportRequest')}
      onOpenThread={(conversationId) =>
        rootNav.navigate('ConversationThread', { conversationId })
      }
    />
  );
}

function AccountCreateSupportRoute({ navigation, route }: NativeStackScreenProps<AccountStackParamList, 'CreateSupportRequest'>) {
  const rootNav = useRootNavigation();
  const isFocused = useIsFocused();
  return (
    <CreateSupportRequestScreen
      contextId={route.params?.contextId}
      contextLabel={route.params?.contextLabel}
      contextType={route.params?.contextType}
      initialTitle={route.params?.initialTitle}
      isFocused={isFocused}
      onBack={() => navigation.goBack()}
      onCreated={(conversationId) => {
        navigation.goBack();
        rootNav.navigate('ConversationThread', { conversationId });
      }}
    />
  );
}

function AccountHelpListRoute({ navigation, route }: NativeStackScreenProps<AccountStackParamList, 'HelpList'>) {
  const rootNav = useRootNavigation();
  return (
    <HelpListScreen
      initialProductId={route.params?.productId}
      onBack={() => navigation.goBack()}
      onOpenDocument={(documentId) => rootNav.navigate('HelpDetail', { documentId })}
    />
  );
}

function AccountVerifyLicenseRoute({ navigation }: NativeStackScreenProps<AccountStackParamList, 'VerifyLicense'>) {
  return <VerifyLicenseScreen onBack={() => navigation.goBack()} />;
}

function AccountStackNavigator() {
  return (
    <AccountStack.Navigator
      screenOptions={{ headerShown: false, headerBackButtonMenuEnabled: false }}
    >
      <AccountStack.Screen component={AccountHubRoute} name="Account" />
      <AccountStack.Screen component={AccountLicensesRoute} name="Licenses" />
      <AccountStack.Screen component={AccountProfileRoute} name="Profile" />
      <AccountStack.Screen component={AccountChangePasswordRoute} name="ChangePassword" />
      <AccountStack.Screen component={AccountSupportListRoute} name="SupportList" />
      <AccountStack.Screen component={AccountCreateSupportRoute} name="CreateSupportRequest" />
      <AccountStack.Screen component={AccountHelpListRoute} name="HelpList" />
      <AccountStack.Screen component={AccountVerifyLicenseRoute} name="VerifyLicense" />
    </AccountStack.Navigator>
  );
}

export function CustomerTabs() {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const { count } = useCart();
  const compactTabBar = width < 360 || fontScale > 1.15;
  const extraLabelHeight = compactTabBar ? Math.round(18 * Math.min(fontScale, 2)) : 0;

  const renderTabLabel =
    (label: string) =>
    ({ color }: { color: string }) => (
      <Text
        allowFontScaling
        numberOfLines={2}
        style={[
          typography.tabLabel,
          compactTabBar ? tabStyles.labelCompact : tabStyles.labelRegular,
          { color },
        ]}
      >
        {label}
      </Text>
    );

  return (
    <Tab.Navigator
      backBehavior="initialRoute"
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarActiveBackgroundColor: colors.infoSurface,
        tabBarLabelVisibilityMode: 'labeled',
        tabBarAllowFontScaling: true,
        tabBarLabelStyle: typography.tabLabel,
        tabBarItemStyle: {
          minHeight: sizes.minHitTarget,
          paddingHorizontal: 2,
          paddingVertical: 4,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: sizes.borderWidth,
          height: undefined,
          minHeight: sizes.tabBarContentHeight + extraLabelHeight + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 4,
        },
      }}
    >
      <Tab.Screen
        component={HomeStackNavigator}
        name="HomeTab"
        options={{
          tabBarAccessibilityLabel: 'Trang chủ',
          tabBarIcon: ({ color, size }) => (
            <AppIcon color={color} name="home" size={compactTabBar ? 20 : size} />
          ),
          tabBarLabel: renderTabLabel('Trang chủ'),
          title: 'Trang chủ',
        }}
      />
      <Tab.Screen
        component={CartStackNavigator}
        name="CartTab"
        options={{
          tabBarAccessibilityLabel: count > 0 ? `Giỏ hàng, ${count} gói đã lưu` : 'Giỏ hàng',
          tabBarBadge: count > 0 ? count : undefined,
          tabBarIcon: ({ color, size }) => (
            <AppIcon color={color} name="cart" size={compactTabBar ? 20 : size} />
          ),
          tabBarLabel: renderTabLabel('Giỏ hàng'),
          title: 'Giỏ hàng',
        }}
      />
      <Tab.Screen
        component={OrdersStackNavigator}
        name="OrdersTab"
        options={{
          tabBarAccessibilityLabel: 'Đơn hàng',
          tabBarIcon: ({ color, size }) => (
            <AppIcon color={color} name="orders" size={compactTabBar ? 20 : size} />
          ),
          tabBarLabel: renderTabLabel('Đơn hàng'),
          title: 'Đơn hàng',
        }}
      />
      <Tab.Screen
        component={AccountStackNavigator}
        name="AccountTab"
        options={{
          tabBarAccessibilityLabel: 'Tài khoản',
          tabBarIcon: ({ color, size }) => (
            <AppIcon color={color} name="account" size={compactTabBar ? 20 : size} />
          ),
          tabBarLabel: renderTabLabel('Tài khoản'),
          title: 'Tài khoản',
        }}
      />
    </Tab.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  labelRegular: {
    includeFontPadding: false,
    textAlign: 'center',
    width: '100%',
  },
  labelCompact: {
    fontSize: 11,
    includeFontPadding: false,
    lineHeight: 14,
    textAlign: 'center',
    width: '100%',
  },
});
