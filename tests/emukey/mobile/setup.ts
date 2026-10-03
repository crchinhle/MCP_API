jest.mock('react-native-webview', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    WebView: (props: Record<string, unknown>) =>
      React.createElement(View, { ...props, testID: 'payment-webview' }),
  };
});

jest.mock('@expo-google-fonts/great-vibes/400Regular', () => ({
  GreatVibes_400Regular: 1,
}));

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
}));
