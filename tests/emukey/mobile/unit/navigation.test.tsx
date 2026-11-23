import {
  getStateFromPath,
  NavigationContainer,
  NavigationContext,
  useNavigation,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';

import { useSafeFocusRefresh } from '../../../../EmuKey/mobile/src/application/navigation/useSafeFocusRefresh';
import { useUnsavedChangesGuard } from '../../../../EmuKey/mobile/src/application/navigation/useUnsavedChangesGuard';
import {
  customerLinkingConfig,
  openNotificationTarget,
  type NotificationNavigator,
} from '../../../../EmuKey/mobile/src/presentation/navigation/linking';

describe('mobile notification deep-link routing & linking config', () => {
  it('routes ORDER, LICENSE, CONVERSATION targets and falls back safely for PAYMENT/SYSTEM/missing id', () => {
    const navigate = jest.fn();
    const nav: NotificationNavigator = { navigate };

    openNotificationTarget({ kind: 'ORDER', id: 'order-1' }, nav);
    expect(navigate).toHaveBeenLastCalledWith('OrderDetail', { id: 'order-1' });

    openNotificationTarget({ kind: 'LICENSE', id: 'license-1' }, nav);
    expect(navigate).toHaveBeenLastCalledWith('LicenseDetail', { licenseId: 'license-1' });

    openNotificationTarget({ kind: 'CONVERSATION', id: 'conv-1' }, nav);
    expect(navigate).toHaveBeenLastCalledWith('ConversationThread', { conversationId: 'conv-1' });

    openNotificationTarget({ kind: 'PAYMENT', id: 'pay-1' }, nav);
    expect(navigate).toHaveBeenLastCalledWith('Notifications');

    openNotificationTarget({ kind: 'SYSTEM', id: 'sys-1' }, nav);
    expect(navigate).toHaveBeenLastCalledWith('Notifications');

    openNotificationTarget(null, nav);
    expect(navigate).toHaveBeenLastCalledWith('Notifications');

    openNotificationTarget({ kind: 'ORDER', id: '' }, nav);
    expect(navigate).toHaveBeenLastCalledWith('Notifications');
  });

  it('keeps emukey:// deep-link screens strictly aligned for payment return and licenses', () => {
    expect(customerLinkingConfig.prefixes).toContain('emukey://');
    expect(customerLinkingConfig.config?.screens).toEqual({
      Licenses: 'licenses',
      Payment: 'payment/:orderId',
    });
    const state = getStateFromPath('licenses?licenseId=lic-9', customerLinkingConfig.config);
    expect(state?.routes[0]).toEqual(
      expect.objectContaining({
        name: 'Licenses',
        params: { licenseId: 'lic-9' },
      }),
    );
  });

  it('triggers focus refresh after initial mount only when NavigationContext emits subsequent focus', async () => {
    const listeners = new Map<string, () => void>();
    const fakeNav = {
      addListener: jest.fn((event: string, cb: () => void) => {
        listeners.set(event, cb);
        return () => listeners.delete(event);
      }),
    };
    const onRefresh = jest.fn();

    function Probe() {
      useSafeFocusRefresh(onRefresh);
      return null;
    }

    await render(
      <NavigationContext.Provider value={fakeNav as never}>
        <Probe />
      </NavigationContext.Provider>,
    );

    const onFocus = listeners.get('focus');
    expect(onFocus).toBeDefined();
    onFocus?.();
    expect(onRefresh).not.toHaveBeenCalled();
    onFocus?.();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('protects unsaved edits via usePreventRemove inside a real NavigationContainer + NativeStackNavigator', async () => {
    const Stack = createNativeStackNavigator<{ Home: undefined; Edit: undefined }>();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const removeBack = jest.fn();
    const backSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove: removeBack } as never);

    function HomeScreen() {
      const nav = useNavigation<{ navigate: (name: 'Edit') => void }>();
      return (
        <View>
          <Text>Home Screen</Text>
          <Pressable onPress={() => nav.navigate('Edit')}>
            <Text>Open Edit</Text>
          </Pressable>
        </View>
      );
    }

    function EditScreen() {
      const nav = useNavigation<{ goBack: () => void }>();
      const [dirty, setDirty] = useState(true);
      const [dialogOpen, setDialogOpen] = useState(false);
      const { cancelDiscard, confirmDiscard } = useUnsavedChangesGuard({
        enabled: dirty,
        onBack: () => nav.goBack(),
        onRequestDiscard: () => setDialogOpen(true),
        onBlurReset: () => setDialogOpen(false),
      });

      return (
        <View>
          <Text>Edit Screen</Text>
          <Pressable onPress={() => setDirty(false)}>
            <Text>Mark Clean</Text>
          </Pressable>
          <Pressable onPress={() => nav.goBack()}>
            <Text>Trigger Nav GoBack</Text>
          </Pressable>
          {dialogOpen ? (
            <View>
              <Text>Discard Dialog Visible</Text>
              <Pressable
                onPress={() => {
                  setDialogOpen(false);
                  cancelDiscard();
                }}
              >
                <Text>Keep Editing</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setDialogOpen(false);
                  confirmDiscard();
                }}
              >
                <Text>Confirm Discard</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      );
    }

    await render(
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
          <Stack.Screen component={HomeScreen} name="Home" />
          <Stack.Screen component={EditScreen} name="Edit" />
        </Stack.Navigator>
      </NavigationContainer>,
    );

    expect(screen.getByText('Home Screen')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Open Edit')));
    expect(await screen.findByText('Edit Screen')).toBeOnTheScreen();
    expect(backSpy).toHaveBeenCalledWith('hardwareBackPress', expect.any(Function));

    // Attempt goBack while dirty -> usePreventRemove intercepts and opens dialog
    await act(async () => fireEvent.press(screen.getByText('Trigger Nav GoBack')));
    expect(await screen.findByText('Discard Dialog Visible')).toBeOnTheScreen();
    expect(screen.getByText('Edit Screen')).toBeOnTheScreen();

    // Cancel -> stays on Edit screen and guard remains active
    await act(async () => fireEvent.press(screen.getByText('Keep Editing')));
    expect(screen.queryByText('Discard Dialog Visible')).toBeNull();
    expect(screen.getByText('Edit Screen')).toBeOnTheScreen();

    // Attempt goBack again -> intercepts again
    await act(async () => fireEvent.press(screen.getByText('Trigger Nav GoBack')));
    expect(await screen.findByText('Discard Dialog Visible')).toBeOnTheScreen();

    // Confirm discard -> pops once cleanly back to Home Screen, no re-prompt
    await act(async () => fireEvent.press(screen.getByText('Confirm Discard')));
    await waitFor(() => expect(screen.queryByText('Edit Screen')).toBeNull());
    expect(screen.getByText('Home Screen')).toBeOnTheScreen();
    expect(screen.queryByText('Discard Dialog Visible')).toBeNull();

    // Re-open Edit, mark clean -> goBack pops immediately without dialog
    await act(async () => fireEvent.press(screen.getByText('Open Edit')));
    expect(await screen.findByText('Edit Screen')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Mark Clean')));
    await act(async () => fireEvent.press(screen.getByText('Trigger Nav GoBack')));
    await waitFor(() => expect(screen.queryByText('Edit Screen')).toBeNull());
    expect(screen.queryByText('Discard Dialog Visible')).toBeNull();

    expect(errorSpy).not.toHaveBeenCalled();
    backSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('routes LICENSE target (e.g. from LICENSE_PROVIDER_ACCEPTED) to LicenseDetail on mobile', () => {
    const navigate = jest.fn();
    openNotificationTarget({ kind: 'LICENSE', id: 'lic-handoff-99' }, { navigate } as never);
    expect(navigate).toHaveBeenCalledWith('LicenseDetail', { licenseId: 'lic-handoff-99' });
  });
});
