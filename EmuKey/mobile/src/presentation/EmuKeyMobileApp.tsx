import { GreatVibes_400Regular } from '@expo-google-fonts/great-vibes/400Regular';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { useFonts } from 'expo-font';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CustomerSessionProvider } from '../application/auth/useCustomerSession';
import { CartProvider } from '../application/cart/cartContext';
import { NotificationProvider } from '../application/notifications/notificationContext';
import { RootNavigator } from './navigation/RootNavigator';
import { colors } from './theme/tokens';

export { matchesPaymentReturn } from '../application/orders/sepayHelpers';
export { LoginScreen } from './screens/auth/LoginScreen';
export { RegisterScreen } from './screens/auth/RegisterScreen';
export { EmailVerificationScreen } from './screens/auth/EmailVerificationScreen';
export { ForgotPasswordScreen } from './screens/auth/ForgotPasswordScreen';
export { ResetPasswordScreen } from './screens/auth/ResetPasswordScreen';
export { HomeScreen } from './screens/home/HomeScreen';
export { CatalogScreen } from './screens/catalog/CatalogScreen';
export { ProductDetailScreen } from './screens/catalog/ProductDetailScreen';
export { ComparePlansScreen } from './screens/catalog/ComparePlansScreen';
export { CartScreen } from './screens/cart/CartScreen';
export { PurchaseConfigurationScreen } from './screens/commerce/PurchaseConfigurationScreen';
export { CheckoutReviewScreen, CheckoutScreen } from './screens/commerce/CheckoutReviewScreen';
export { ServiceTermsScreen } from './screens/commerce/ServiceTermsScreen';
export { PaymentGatewayScreen } from './screens/commerce/PaymentGatewayScreen';
export { PaymentScreen } from './screens/commerce/PaymentScreen';
export { OrdersScreen } from './screens/orders/OrdersScreen';
export { OrderDetailScreen } from './screens/orders/OrderDetailScreen';
export { AccountScreen } from './screens/account/AccountScreen';
export { ProfileScreen } from './screens/account/ProfileScreen';
export { ChangePasswordScreen } from './screens/account/ChangePasswordScreen';
export { LicensesScreen } from './screens/licenses/LicensesScreen';
export { LicenseDetailScreen } from './screens/licenses/LicenseDetailScreen';
export { ActivationKeyScreen } from './screens/licenses/ActivationKeyScreen';
export { DevicesScreen } from './screens/licenses/DevicesScreen';
export { RenewalScreen } from './screens/licenses/RenewalScreen';
export { VerifyLicenseScreen } from './screens/licenses/VerifyLicenseScreen';
export { NotificationsScreen } from './screens/notifications/NotificationsScreen';
export { AiAssistantScreen } from './screens/assistance/AiAssistantScreen';
export { SupportListScreen } from './screens/assistance/SupportListScreen';
export { CreateSupportRequestScreen } from './screens/assistance/CreateSupportRequestScreen';
export { ConversationThreadScreen } from './screens/assistance/ConversationThreadScreen';
export { HelpListScreen } from './screens/help/HelpListScreen';
export { HelpDetailScreen } from './screens/help/HelpDetailScreen';

export function EmuKeyMobileApp() {
  const [fontsLoaded, fontError] = useFonts({
    GreatVibes_400Regular,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });

  const fontsReady = Boolean(fontsLoaded || fontError);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.surface} />
      <CustomerSessionProvider>
        <NotificationProvider>
          <CartProvider>
            <RootNavigator fontsReady={fontsReady} />
          </CartProvider>
        </NotificationProvider>
      </CustomerSessionProvider>
    </SafeAreaProvider>
  );
}
