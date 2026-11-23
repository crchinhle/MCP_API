import type { LinkingOptions } from '@react-navigation/native';

import type { MobileNotification } from '../../infrastructure/api/client';
import type { RootStackParamList } from './navigationTypes';

export const customerLinkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: ['emukey://'],
  config: {
    screens: {
      Licenses: 'licenses',
      Payment: 'payment/:orderId',
    },
  },
};

export interface NotificationNavigator {
  navigate<RouteName extends keyof RootStackParamList>(
    ...args: undefined extends RootStackParamList[RouteName]
      ? [screen: RouteName] | [screen: RouteName, params: RootStackParamList[RouteName]]
      : [screen: RouteName, params: RootStackParamList[RouteName]]
  ): void;
}

export function openNotificationTarget(
  target: MobileNotification['target'],
  navigation: NotificationNavigator,
): void {
  if (!target?.id) {
    navigation.navigate('Notifications');
    return;
  }
  if (target.kind === 'ORDER') {
    navigation.navigate('OrderDetail', { id: target.id });
    return;
  }
  if (target.kind === 'LICENSE') {
    navigation.navigate('LicenseDetail', { licenseId: target.id });
    return;
  }
  if (target.kind === 'CONVERSATION') {
    navigation.navigate('ConversationThread', { conversationId: target.id });
    return;
  }
  // PAYMENT and SYSTEM targets stay on Notifications rather than guessing a route.
  navigation.navigate('Notifications');
}
