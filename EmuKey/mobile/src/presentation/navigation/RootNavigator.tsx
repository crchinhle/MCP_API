import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';

import { useCustomerSession } from '../../application/auth/useCustomerSession';
import { useCart } from '../../application/cart/cartContext';
import {
  getNotification,
  observeDevicePushTokens,
  observeNotificationResponses,
  pendingLicensingAction,
} from '../../infrastructure/api/client';
import { AppText } from '../components/ui/AppText';
import { EmailVerificationScreen } from '../screens/auth/EmailVerificationScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { AiAssistantScreen } from '../screens/assistance/AiAssistantScreen';
import { ConversationThreadScreen } from '../screens/assistance/ConversationThreadScreen';
import { CatalogScreen } from '../screens/catalog/CatalogScreen';
import { ComparePlansScreen } from '../screens/catalog/ComparePlansScreen';
import { ProductDetailScreen } from '../screens/catalog/ProductDetailScreen';
import {
  CheckoutReviewScreen,
  CheckoutScreen,
} from '../screens/commerce/CheckoutReviewScreen';
import { PaymentScreen } from '../screens/commerce/PaymentScreen';
import { PurchaseConfigurationScreen } from '../screens/commerce/PurchaseConfigurationScreen';
import { ServiceTermsScreen } from '../screens/commerce/ServiceTermsScreen';
import { HelpDetailScreen } from '../screens/help/HelpDetailScreen';
import { HelpListScreen } from '../screens/help/HelpListScreen';
import { ActivationKeyScreen } from '../screens/licenses/ActivationKeyScreen';
import { DevicesScreen } from '../screens/licenses/DevicesScreen';
import { LicenseDetailScreen } from '../screens/licenses/LicenseDetailScreen';
import { LicensesScreen } from '../screens/licenses/LicensesScreen';
import { RenewalScreen } from '../screens/licenses/RenewalScreen';
import { VerifyLicenseScreen } from '../screens/licenses/VerifyLicenseScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { OrderDetailScreen } from '../screens/orders/OrderDetailScreen';
import { mobileNavigationTheme } from '../theme/navigationTheme';
import { colors, spacing } from '../theme/tokens';
import { CustomerTabs } from './CustomerTabs';
import { customerLinkingConfig, openNotificationTarget } from './linking';
import type { PublicStackParamList, RootStackParamList } from './navigationTypes';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const PublicStack = createNativeStackNavigator<PublicStackParamList>();
export const rootNavigationRef = createNavigationContainerRef<RootStackParamList>();

function PublicLoginRoute({ navigation }: NativeStackScreenProps<PublicStackParamList, 'Login'>) {
  const { setSession, roleError, clearRoleError } = useCustomerSession();
  const { pendingSelection } = useCart();
  return (
    <LoginScreen
      externalError={roleError}
      hasPendingPurchase={Boolean(pendingSelection)}
      onAuthenticated={setSession}
      onBrowseCatalog={() => navigation.navigate('PublicCatalog')}
      onDismissExternalError={clearRoleError}
      onForgotPassword={() => navigation.navigate('ForgotPassword')}
      onGuestAi={() => navigation.navigate('GuestAiAssistant')}
      onHelp={() => navigation.navigate('PublicHelpList')}
      onRegister={() => navigation.navigate('Register')}
      onVerify={() => navigation.navigate('PublicVerifyLicense')}
    />
  );
}

function PublicRegisterRoute({ navigation }: NativeStackScreenProps<PublicStackParamList, 'Register'>) {
  return (
    <RegisterScreen
      onBack={() => navigation.goBack()}
      onRegistered={(email) => navigation.replace('EmailVerification', { email })}
    />
  );
}

function PublicEmailVerificationRoute({ navigation, route }: NativeStackScreenProps<PublicStackParamList, 'EmailVerification'>) {
  return (
    <EmailVerificationScreen
      email={route.params?.email}
      onBackToLogin={() => navigation.navigate('Login')}
      token={route.params?.token}
    />
  );
}

function PublicForgotPasswordRoute({ navigation }: NativeStackScreenProps<PublicStackParamList, 'ForgotPassword'>) {
  return <ForgotPasswordScreen onBack={() => navigation.goBack()} />;
}

function PublicResetPasswordRoute({ navigation, route }: NativeStackScreenProps<PublicStackParamList, 'ResetPassword'>) {
  return (
    <ResetPasswordScreen
      onBackToLogin={() => navigation.navigate('Login')}
      onRequestNewLink={() => navigation.navigate('ForgotPassword')}
      token={route.params?.token}
    />
  );
}

function PublicCatalogRoute({ navigation }: NativeStackScreenProps<PublicStackParamList, 'PublicCatalog'>) {
  return (
    <CatalogScreen
      onBack={() => navigation.goBack()}
      onOpenCompare={(ids) => navigation.navigate('PublicComparePlans', { ids })}
      onOpenProduct={(productId) => navigation.navigate('PublicProductDetail', { productId })}
    />
  );
}

function PublicProductDetailRoute({ navigation, route }: NativeStackScreenProps<PublicStackParamList, 'PublicProductDetail'>) {
  const { setPendingSelection } = useCart();
  return (
    <ProductDetailScreen
      onAddToCart={(productId, planId) => {
        setPendingSelection({ productId, planId, action: 'cart' });
        navigation.navigate('Login');
      }}
      onBack={() => navigation.goBack()}
      onBuyNow={(productId, planId) => {
        setPendingSelection({ productId, planId, action: 'checkout' });
        navigation.navigate('Login');
      }}
      onOpenCompare={(ids) => navigation.navigate('PublicComparePlans', { ids })}
      onOpenHelpDocument={(documentId) => navigation.navigate('PublicHelpDetail', { documentId })}
      productId={route.params.productId}
    />
  );
}

function PublicComparePlansRoute({ navigation, route }: NativeStackScreenProps<PublicStackParamList, 'PublicComparePlans'>) {
  const { setPendingSelection } = useCart();
  return (
    <ComparePlansScreen
      initialIds={route.params.ids}
      onBack={() => navigation.goBack()}
      onSelectPlanForPurchase={(productId, planId) => {
        setPendingSelection({ productId, planId, action: 'checkout' });
        navigation.navigate('Login');
      }}
    />
  );
}

function PublicHelpListRoute({ navigation, route }: NativeStackScreenProps<PublicStackParamList, 'PublicHelpList'>) {
  return (
    <HelpListScreen
      initialProductId={route.params?.productId}
      onBack={() => navigation.goBack()}
      onOpenDocument={(documentId) => navigation.navigate('PublicHelpDetail', { documentId })}
    />
  );
}

function PublicHelpDetailRoute({ navigation, route }: NativeStackScreenProps<PublicStackParamList, 'PublicHelpDetail'>) {
  return (
    <HelpDetailScreen
      documentId={route.params.documentId}
      onBack={() => navigation.goBack()}
      onOpenDocument={(documentId) => navigation.push('PublicHelpDetail', { documentId })}
      onOpenProduct={(productId) => navigation.navigate('PublicProductDetail', { productId })}
      onOpenSupport={() => navigation.navigate('Login')}
    />
  );
}

function PublicVerifyLicenseRoute({ navigation }: NativeStackScreenProps<PublicStackParamList, 'PublicVerifyLicense'>) {
  return <VerifyLicenseScreen onBack={() => navigation.goBack()} />;
}

function GuestAiAssistantRoute({ navigation }: NativeStackScreenProps<PublicStackParamList, 'GuestAiAssistant'>) {
  return (
    <AiAssistantScreen
      onBack={() => navigation.goBack()}
      onOpenDocument={(documentId) => navigation.navigate('PublicHelpDetail', { documentId })}
      onOpenProduct={(productId) => navigation.navigate('PublicProductDetail', { productId })}
      onRequireLogin={() => navigation.navigate('Login')}
    />
  );
}

function PublicNavigator() {
  return (
    <NavigationContainer theme={mobileNavigationTheme}>
      <PublicStack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <PublicStack.Screen component={PublicLoginRoute} name="Login" />
        <PublicStack.Screen component={PublicRegisterRoute} name="Register" />
        <PublicStack.Screen component={PublicEmailVerificationRoute} name="EmailVerification" />
        <PublicStack.Screen component={PublicForgotPasswordRoute} name="ForgotPassword" />
        <PublicStack.Screen component={PublicResetPasswordRoute} name="ResetPassword" />
        <PublicStack.Screen component={PublicCatalogRoute} name="PublicCatalog" />
        <PublicStack.Screen component={PublicProductDetailRoute} name="PublicProductDetail" />
        <PublicStack.Screen component={PublicComparePlansRoute} name="PublicComparePlans" />
        <PublicStack.Screen component={PublicHelpListRoute} name="PublicHelpList" />
        <PublicStack.Screen component={PublicHelpDetailRoute} name="PublicHelpDetail" />
        <PublicStack.Screen component={PublicVerifyLicenseRoute} name="PublicVerifyLicense" />
        <PublicStack.Screen component={GuestAiAssistantRoute} name="GuestAiAssistant" />
      </PublicStack.Navigator>
    </NavigationContainer>
  );
}

function PurchaseConfigurationRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'PurchaseConfiguration'>) {
  return (
    <PurchaseConfigurationScreen
      draftId={route.params.draftId}
      initialAction={route.params.action}
      initialDeviceQuantity={route.params.deviceQuantity}
      initialDurationMonths={route.params.durationMonths}
      initialPlanId={route.params.planId}
      onBack={() => navigation.goBack()}
      onContinueReview={(params) => navigation.navigate('CheckoutReview', params)}
      onSavedToCart={() =>
        navigation.navigate('CustomerTabs', {
          screen: 'CartTab',
          params: { screen: 'Cart' },
        })
      }
      productId={route.params.productId}
    />
  );
}

function CheckoutReviewRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'CheckoutReview'>) {
  return (
    <CheckoutReviewScreen
      customized={Boolean(route.params.customized)}
      deviceQuantity={route.params.deviceQuantity}
      draftId={route.params.draftId}
      durationMonths={route.params.durationMonths}
      onBack={() => navigation.goBack()}
      onOpenPayment={(orderId) => navigation.replace('Payment', { orderId })}
      onOpenTerms={(orderId) => navigation.replace('ServiceTerms', { orderId })}
      orderId={route.params.orderId}
      planId={route.params.planId}
      planName={route.params.planName}
      priceVnd={route.params.priceVnd}
      productId={route.params.productId}
      productName={route.params.productName}
    />
  );
}

function ServiceTermsRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ServiceTerms'>) {
  return (
    <ServiceTermsScreen
      onAccepted={(orderId) => navigation.replace('Payment', { orderId })}
      onBack={() => navigation.goBack()}
      orderId={route.params.orderId}
    />
  );
}

function LicenseDetailRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'LicenseDetail'>) {
  return (
    <LicenseDetailScreen
      licenseId={route.params.licenseId}
      onBack={() => navigation.goBack()}
      onOpenDevices={(licenseId) => navigation.navigate('Devices', { licenseId })}
      onOpenKey={(licenseId) => navigation.navigate('ActivationKey', { licenseId })}
      onOpenRenewal={(params) => navigation.navigate('Renewal', params)}
      onOpenSupport={(licenseId, publicLicenseId) =>
        navigation.navigate('CustomerTabs', {
          screen: 'AccountTab',
          params: {
            screen: 'CreateSupportRequest',
            params: {
              contextType: 'LICENSE',
              contextId: licenseId,
              contextLabel: publicLicenseId,
              initialTitle: `Hỗ trợ bản quyền ${publicLicenseId}`,
            },
          },
        })
      }
    />
  );
}

function ActivationKeyRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ActivationKey'>) {
  return <ActivationKeyScreen licenseId={route.params.licenseId} onBack={() => navigation.goBack()} />;
}

function DevicesRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Devices'>) {
  return <DevicesScreen licenseId={route.params.licenseId} onBack={() => navigation.goBack()} />;
}

function NotificationsRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Notifications'>) {
  return (
    <NotificationsScreen
      onBack={() => navigation.goBack()}
      onOpenTarget={(target) => openNotificationTarget(target, navigation)}
    />
  );
}

function AiAssistantRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'AiAssistant'>) {
  return (
    <AiAssistantScreen
      onBack={() => navigation.goBack()}
      onOpenDocument={(documentId) => navigation.navigate('HelpDetail', { documentId })}
      onOpenProduct={(productId) =>
        navigation.navigate('CustomerTabs', {
          screen: 'HomeTab',
          params: { screen: 'ProductDetail', params: { productId } },
        })
      }
      onOpenThread={(conversationId) =>
        navigation.replace('ConversationThread', { conversationId })
      }
      productId={route.params?.productId}
      productName={route.params?.productName}
    />
  );
}

function ConversationThreadRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ConversationThread'>) {
  return (
    <ConversationThreadScreen
      conversationId={route.params.conversationId}
      onBack={() => navigation.goBack()}
      onCreateFollowUp={() =>
        navigation.navigate('CustomerTabs', {
          screen: 'AccountTab',
          params: { screen: 'CreateSupportRequest' },
        })
      }
      onOpenDocument={(documentId) => navigation.navigate('HelpDetail', { documentId })}
      onOpenProduct={(productId) =>
        navigation.navigate('CustomerTabs', {
          screen: 'HomeTab',
          params: { screen: 'ProductDetail', params: { productId } },
        })
      }
    />
  );
}

function HelpDetailRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'HelpDetail'>) {
  return (
    <HelpDetailScreen
      documentId={route.params.documentId}
      onBack={() => navigation.goBack()}
      onOpenDocument={(documentId) => navigation.push('HelpDetail', { documentId })}
      onOpenProduct={(productId) =>
        navigation.navigate('CustomerTabs', {
          screen: 'HomeTab',
          params: { screen: 'ProductDetail', params: { productId } },
        })
      }
      onOpenSupport={(productId, productName) =>
        navigation.navigate('CustomerTabs', {
          screen: 'AccountTab',
          params: {
            screen: 'CreateSupportRequest',
            params: {
              contextType: 'PRODUCT',
              contextId: productId,
              contextLabel: productName,
              initialTitle: `Hỗ trợ ${productName}`,
            },
          },
        })
      }
    />
  );
}

function RootLicensesRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Licenses'>) {
  return (
    <LicensesScreen
      initialFilter={route.params?.filter}
      onBack={() => navigation.goBack()}
      onOpenLicenseDetail={(licenseId) => navigation.navigate('LicenseDetail', { licenseId })}
      targetLicenseId={route.params?.licenseId}
    />
  );
}

function RootCatalogRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'Catalog'>) {
  return (
    <CatalogScreen
      onBack={() => navigation.goBack()}
      onNotifications={() => navigation.navigate('Notifications')}
      onOpenCompare={(ids) => navigation.navigate('ComparePlans', { ids })}
      onOpenProduct={(productId) =>
        navigation.navigate('CustomerTabs', {
          screen: 'HomeTab',
          params: { screen: 'ProductDetail', params: { productId } },
        })
      }
      showBell
    />
  );
}

function RootCompareRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'ComparePlans'>) {
  return (
    <ComparePlansScreen
      initialIds={route.params.ids}
      onBack={() => navigation.goBack()}
      onSelectPlanForPurchase={(productId, planId) =>
        navigation.navigate('PurchaseConfiguration', { productId, planId })
      }
    />
  );
}

function RootAssistanceRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Assistance'>) {
  if (route.params?.conversationId) {
    return (
      <ConversationThreadScreen
        conversationId={route.params.conversationId}
        onBack={() => navigation.goBack()}
        onCreateFollowUp={() =>
          navigation.navigate('CustomerTabs', {
            screen: 'AccountTab',
            params: { screen: 'CreateSupportRequest' },
          })
        }
        onOpenDocument={(documentId) => navigation.navigate('HelpDetail', { documentId })}
        onOpenProduct={(productId) =>
          navigation.navigate('CustomerTabs', {
            screen: 'HomeTab',
            params: { screen: 'ProductDetail', params: { productId } },
          })
        }
      />
    );
  }
  return (
    <AiAssistantScreen
      onBack={() => navigation.goBack()}
      onOpenDocument={(documentId) => navigation.navigate('HelpDetail', { documentId })}
      onOpenProduct={(productId) =>
        navigation.navigate('CustomerTabs', {
          screen: 'HomeTab',
          params: { screen: 'ProductDetail', params: { productId } },
        })
      }
      onOpenThread={(conversationId) =>
        navigation.replace('ConversationThread', { conversationId })
      }
    />
  );
}

function RootVerifyRoute({ navigation }: NativeStackScreenProps<RootStackParamList, 'VerifyLicense'>) {
  return <VerifyLicenseScreen onBack={() => navigation.goBack()} />;
}

function RootOrderDetailRoute({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'OrderDetail'>) {
  return (
    <OrderDetailScreen
      navigation={{
        goBack: () => navigation.goBack(),
        navigate: navigation.navigate,
      }}
      onOpenLicense={(licenseId) => navigation.navigate('LicenseDetail', { licenseId })}
      onOpenPayment={(orderId) => navigation.navigate('Payment', { orderId })}
      onOpenTerms={(orderId) => navigation.navigate('ServiceTerms', { orderId })}
      onRequestSupport={(orderId, orderNumber) =>
        navigation.navigate('CustomerTabs', {
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

export function RootNavigator({ fontsReady }: { readonly fontsReady: boolean }) {
  const { session, loading, isAuthenticated } = useCustomerSession();
  const { pendingSelection, setPendingSelection } = useCart();
  const pendingNotificationRef = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && session) {
      return observeDevicePushTokens();
    }
    return undefined;
  }, [isAuthenticated, session?.user.id]);

  const openPending = useCallback(async () => {
    if (!isAuthenticated || !rootNavigationRef.isReady()) return;

    if (pendingSelection) {
      const sel = pendingSelection;
      setPendingSelection(null);
      rootNavigationRef.navigate('PurchaseConfiguration', {
        productId: sel.productId,
        planId: sel.planId,
        deviceQuantity: sel.deviceQuantity,
        durationMonths: sel.durationMonths,
        action: sel.action,
      });
      return;
    }

    const notificationId = pendingNotificationRef.current;
    if (!notificationId) {
      try {
        const action = await pendingLicensingAction();
        if (action && rootNavigationRef.isReady()) {
          rootNavigationRef.navigate('LicenseDetail', { licenseId: action.licenseId });
        }
      } catch {
        // Retain intent for next foreground check.
      }
      return;
    }

    pendingNotificationRef.current = null;
    try {
      const notification = await getNotification(notificationId);
      if (rootNavigationRef.isReady()) {
        openNotificationTarget(notification.target, rootNavigationRef);
      }
    } catch {
      if (rootNavigationRef.isReady()) {
        rootNavigationRef.navigate('Notifications');
      }
    }
  }, [isAuthenticated, pendingSelection, setPendingSelection]);

  useEffect(() => {
    if (!isAuthenticated) {
      pendingNotificationRef.current = null;
      return undefined;
    }
    return observeNotificationResponses((id) => {
      pendingNotificationRef.current = id;
      void openPending();
    });
  }, [isAuthenticated, openPending, session?.user.id]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') void openPending();
    });
    return () => listener?.remove?.();
  }, [isAuthenticated, openPending]);

  if (!fontsReady || loading) {
    return (
      <View style={styles.bootstrap}>
        <AppText tone="primary" variant="brandWordmark">
          EmuKey
        </AppText>
        <ActivityIndicator color={colors.primary} size="large" />
        <AppText tone="secondary" variant="secondary">
          Đang khôi phục phiên đăng nhập...
        </AppText>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <PublicNavigator />;
  }

  return (
    <NavigationContainer
      linking={customerLinkingConfig}
      onReady={() => void openPending()}
      ref={rootNavigationRef}
      theme={mobileNavigationTheme}
    >
      <RootStack.Navigator initialRouteName="CustomerTabs" screenOptions={{ headerShown: false }}>
        <RootStack.Screen component={CustomerTabs} name="CustomerTabs" />
        <RootStack.Screen component={PurchaseConfigurationRoute} name="PurchaseConfiguration" />
        <RootStack.Screen component={CheckoutReviewRoute} name="CheckoutReview" />
        <RootStack.Screen component={ServiceTermsRoute} name="ServiceTerms" />
        <RootStack.Screen component={PaymentScreen} name="Payment" />
        <RootStack.Screen component={LicenseDetailRoute} name="LicenseDetail" />
        <RootStack.Screen component={ActivationKeyRoute} name="ActivationKey" />
        <RootStack.Screen component={DevicesRoute} name="Devices" />
        <RootStack.Screen component={RenewalScreen} name="Renewal" />
        <RootStack.Screen component={NotificationsRoute} name="Notifications" />
        <RootStack.Screen component={AiAssistantRoute} name="AiAssistant" />
        <RootStack.Screen component={ConversationThreadRoute} name="ConversationThread" />
        <RootStack.Screen component={HelpDetailRoute} name="HelpDetail" />
        <RootStack.Screen component={RootLicensesRoute} name="Licenses" />
        <RootStack.Screen component={RootOrderDetailRoute} name="OrderDetail" />
        <RootStack.Screen component={RootCatalogRoute} name="Catalog" />
        <RootStack.Screen component={RootCompareRoute} name="ComparePlans" />
        <RootStack.Screen component={CheckoutScreen} name="Checkout" />
        <RootStack.Screen component={RootAssistanceRoute} name="Assistance" />
        <RootStack.Screen component={RootVerifyRoute} name="VerifyLicense" />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  bootstrap: {
    alignItems: 'center',
    backgroundColor: colors.canvas,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
});
