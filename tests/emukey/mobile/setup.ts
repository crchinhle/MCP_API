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

jest.mock('@expo-google-fonts/ibm-plex-sans', () => ({
  IBMPlexSans_400Regular: 1,
  IBMPlexSans_500Medium: 1,
  IBMPlexSans_600SemiBold: 1,
  IBMPlexSans_700Bold: 1,
}));

jest.mock('expo-font', () => ({
  useFonts: () => [true, null],
}));

jest.mock('@expo/vector-icons/AntDesign', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return function MockAntDesign(props: { name?: string }) {
    return React.createElement(Text, { accessibilityElementsHidden: true }, props.name ?? 'icon');
  };
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
      removeItem: jest.fn(async (key: string) => {
        store.delete(key);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
    },
  };
});

jest.mock('expo-crypto', () => ({
  randomUUID: () => `test-uuid-${Math.random().toString(16).slice(2)}`,
  digestStringAsync: async (_alg: unknown, value: string) => value,
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock('expo-file-system', () => {
  class MockFile {
    uri: string;
    content = '';
    constructor(...parts: unknown[]) {
      this.uri = `file:///cache/${parts.map((p) => (typeof p === 'string' ? p : 'dir')).join('/')}`;
    }
    write(content: string) {
      this.content = content;
    }
  }
  return {
    Paths: { cache: { uri: 'file:///cache' } },
    File: MockFile,
  };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 393, height: 851 };
  const SafeAreaContext = React.createContext(insets);
  const SafeAreaInsetsContext = SafeAreaContext;
  const SafeAreaFrameContext = React.createContext(frame);
  return {
    SafeAreaContext,
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        SafeAreaFrameContext.Provider,
        { value: frame },
        React.createElement(
          SafeAreaInsetsContext.Provider,
          { value: insets },
          React.createElement(View, { style: { flex: 1 } }, children),
        ),
      ),
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: {
      frame,
      insets,
    },
  };
});
