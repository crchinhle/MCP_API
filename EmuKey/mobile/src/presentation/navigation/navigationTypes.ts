import type { NavigatorScreenParams } from '@react-navigation/native';

import type { SupportContextType } from '../../application/assistance/useSupportRequests';
import type { MobileCheckoutSession } from '../../infrastructure/api/client';

export type HomeStackParamList = {
  Home: undefined;
  Catalog: { initialQuery?: string } | undefined;
  ProductDetail: { productId: string };
  ComparePlans: { ids: string[] };
};

export type CartStackParamList = {
  Cart: undefined;
};

export type OrdersStackParamList = {
  Orders: undefined;
  OrderDetail: { id: string };
  PaymentHistory: undefined;
};

export type AccountStackParamList = {
  Account: undefined;
  Licenses: { licenseId?: string; filter?: string } | undefined;
  Profile: undefined;
  ChangePassword: undefined;
  SupportList: undefined;
  CreateSupportRequest:
    | {
        contextType?: SupportContextType;
        contextId?: string;
        contextLabel?: string;
        initialTitle?: string;
      }
    | undefined;
  HelpList: { productId?: string } | undefined;
  VerifyLicense: undefined;
};

export type CustomerTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  CartTab: NavigatorScreenParams<CartStackParamList>;
  OrdersTab: NavigatorScreenParams<OrdersStackParamList>;
  AccountTab: NavigatorScreenParams<AccountStackParamList>;
};

export type RootStackParamList = {
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  PurchaseConfiguration: {
    productId: string;
    planId?: string;
    draftId?: string;
    deviceQuantity?: number;
    durationMonths?: 1 | 2 | 3 | 6 | 12;
    action?: 'cart' | 'checkout';
  };
  CheckoutReview: {
    draftId?: string;
    orderId?: string;
    productId?: string;
    planId?: string;
    deviceQuantity?: number;
    durationMonths?: 1 | 2 | 3 | 6 | 12;
    customized?: boolean;
    planName?: string;
    productName?: string;
    priceVnd?: number;
  };
  ServiceTerms: { orderId: string };
  Payment: { orderId: string };
  PaymentGateway: { orderId: string; checkout: MobileCheckoutSession };
  LicenseDetail: { licenseId: string };
  ActivationKey: { licenseId: string };
  Devices: { licenseId: string };
  Renewal: {
    licenseId: string;
    originOrderId?: string;
    productName?: string;
  };
  Notifications: undefined;
  AiAssistant: { productId?: string; productName?: string } | undefined;
  ConversationThread: { conversationId: string };
  HelpDetail: { documentId: string };
  // Compatibility aliases for deep links & existing screen callers:
  Licenses: { licenseId?: string; filter?: string } | undefined;
  OrderDetail: { id: string };
  Catalog: undefined;
  ComparePlans: { ids: string[] };
  Checkout: {
    orderId?: string;
    planId: string;
    planName: string;
    priceVnd: number;
    productName: string;
  };
  Assistance: { conversationId?: string } | undefined;
  VerifyLicense: undefined;
};

export type PublicStackParamList = {
  Login: undefined;
  Register: undefined;
  EmailVerification: { email?: string; token?: string };
  ForgotPassword: undefined;
  ResetPassword: { token?: string };
  PublicCatalog: undefined;
  PublicProductDetail: { productId: string };
  PublicComparePlans: { ids: string[] };
  PublicHelpList: { productId?: string } | undefined;
  PublicHelpDetail: { documentId: string };
  PublicVerifyLicense: undefined;
  GuestAiAssistant: undefined;
};
