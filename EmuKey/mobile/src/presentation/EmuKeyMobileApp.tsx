import { useEffect, useRef, useState } from 'react';
import {
  Button,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { GreatVibes_400Regular } from '@expo-google-fonts/great-vibes/400Regular';
import { useFonts } from 'expo-font';

import {
  acceptServiceTerms,
  forgotPassword,
  closeConversation,
  comparePlans,
  createCheckout,
  createOrder,
  getOrder,
  getOrderTerms,
  getProfile,
  getRenewalPreview,
  listConversationMessages,
  listConversations,
  listDevices,
  listLicenses,
  listOrders,
  listProducts,
  listNotifications,
  markNotificationRead,
  createConversation,
  appendConversationMessage,
  askConversationAi,
  login,
  logout,
  restoreSession,
  requestLicensingActionVerification,
  remoteRevokeDevice,
  type MobileDevice,
  type MobileCheckoutSession,
  verifyPublicLicense,
  type MobileLicense,
  type MobileLicenseVerification,
  type MobileOrderDetail,
  type MobileOrderSummary,
  type MobilePlanComparison,
  type MobileProduct,
  type MobileSession,
  type MobileNotification,
  type MobileConversation,
  type MobileConversationMessage,
  updateProfile,
} from '../infrastructure/api/client';

type RootStackParamList = {
  Assistance: undefined;
  Catalog: undefined;
  Checkout: { planId: string; planName: string; priceVnd: number; productName: string };
  ComparePlans: { ids: string[] };
  Licenses: undefined;
  Notifications: undefined;
  Orders: undefined;
  OrderDetail: { id: string };
  Payment: { orderId: string };
  Profile: undefined;
  Renewal: { licenseId: string; originOrderId: string; productName: string };
  VerifyLicense: undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();

export function LoginScreen({
  onAuthenticated,
  onVerify,
}: {
  readonly onAuthenticated: (session: MobileSession) => void;
  readonly onVerify: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotPending, setForgotPending] = useState(false);
  const submit = async () => {
    setError(null);
    try {
      onAuthenticated(await login(email, password));
    } catch {
      setError('Không thể đăng nhập. Vui lòng kiểm tra tài khoản và mật khẩu.');
    }
  };
  if (forgotMode) return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.brand}>Emukey</Text>
      <Text accessibilityRole="header" style={styles.heading}>Quên mật khẩu</Text>
      <Text style={styles.subtitle}>Nhập email tài khoản. Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu sẽ được gửi qua email.</Text>
      <TextInput accessibilityLabel="Email" autoCapitalize="none" onChangeText={setForgotEmail} style={styles.input} value={forgotEmail} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {forgotSent ? <Text accessibilityLiveRegion="polite" style={styles.success}>Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu đã được gửi.</Text> : null}
      <Button disabled={!forgotEmail.trim() || forgotPending} onPress={() => { void (async () => { setForgotPending(true); setError(null); try { await forgotPassword(forgotEmail); setForgotSent(true); } catch { setError('Không thể gửi yêu cầu. Vui lòng thử lại sau.'); } finally { setForgotPending(false); } })(); }} title={forgotPending ? 'Đang gửi...' : 'Gửi hướng dẫn'} />
      <Button onPress={() => { setForgotMode(false); setForgotSent(false); setError(null); }} title="Quay lại đăng nhập" />
    </ScrollView>
  );
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.brand}>Emukey</Text>
      <Text style={styles.subtitle}>Đăng nhập để quản lý đơn hàng và license của bạn</Text>
      <TextInput accessibilityLabel="Email" autoCapitalize="none" onChangeText={setEmail} style={styles.input} value={email} />
      <TextInput accessibilityLabel="Mật khẩu" onChangeText={setPassword} secureTextEntry style={styles.input} value={password} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button disabled={!email.trim() || password.length < 8} onPress={() => void submit()} title="Đăng nhập" />
      <Button onPress={() => { setForgotMode(true); setError(null); }} title="Quên mật khẩu" />
      <Button onPress={onVerify} title="Xác minh License công khai" />
    </ScrollView>
  );
}

function CustomerNavigation({ navigation }: { readonly navigation: Pick<NativeStackNavigationProp<RootStackParamList>, 'navigate'> }) {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () => {
      void listNotifications()
        .then((items) => {
          const page = Array.isArray(items) ? { items, nextCursor: null } : items;
          if (active) setUnread(page.items.filter((item) => !item.isRead).length);
        })
        .catch(() => undefined);
    };
    void load();
    const timer = setInterval(load, 15_000);
    return () => { active = false; clearInterval(timer); };
  }, []);
  return (
    <View style={styles.actions}>
      <Button onPress={() => navigation.navigate('Catalog')} title="Sản phẩm" />
      <Button onPress={() => navigation.navigate('Orders')} title="Đơn hàng" />
      <Button onPress={() => navigation.navigate('Licenses')} title="License" />
      <Button onPress={() => navigation.navigate('Profile')} title="Hồ sơ" />
      <Button onPress={() => navigation.navigate('Notifications')} title={unread > 0 ? `Thông báo (${unread})` : 'Thông báo'} />
      <Button onPress={() => navigation.navigate('Assistance')} title="Hỗ trợ" />
    </View>
  );
}

export function AssistanceScreen() {
  const [conversations, setConversations] = useState<MobileConversation[]>([]);
  const [selected, setSelected] = useState<MobileConversation | null>(null);
  const [messages, setMessages] = useState<MobileConversationMessage[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [aiAnswer, setAiAnswer] = useState<{ answer: string; grounded: boolean; citedSourceIds: string[] } | null>(null);
  const requestGeneration = useRef(0);
  const outgoingIds = useRef<Record<string, string>>({});
  const draft = selected ? drafts[selected.id] ?? '' : '';
  const setDraft = (value: string) => { if (selected) setDrafts((current) => ({ ...current, [selected.id]: value })); };

  const loadMessages = async (conversationId: string, generation = requestGeneration.current) => {
    const items = await listConversationMessages(conversationId);
    if (generation === requestGeneration.current) setMessages(items);
  };
  useEffect(() => {
    let active = true;
    void listConversations().then((items) => {
      if (!active) return;
      setConversations(items);
      if (items[0]) {
        setSelected(items[0]);
        requestGeneration.current += 1;
        return listConversationMessages(items[0].id).then((loaded) => { if (active) setMessages(loaded); });
      }
      return undefined;
    }).catch(() => { if (active) setError('Không thể tải hội thoại hỗ trợ.'); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!selected) return;
    const conversationId = selected.id;
    const timer = setInterval(() => { void listConversationMessages(conversationId).then((items) => { if (selected?.id === conversationId) setMessages(items); }).catch(() => undefined); }, 5_000);
    return () => clearInterval(timer);
  }, [selected]);

  const selectConversation = async (conversation: MobileConversation) => {
    const generation = ++requestGeneration.current;
    setSelected(conversation);
    setAiAnswer(null);
    try { await loadMessages(conversation.id, generation); }
    catch { if (generation === requestGeneration.current) setError('Không thể tải nội dung hội thoại.'); }
  };
  const send = async () => {
    const content = draft.trim();
    const conversation = selected;
    if (!content || !conversation || conversation.status === 'CLOSED' || content.length > 8000) return;
    const clientMessageId = outgoingIds.current[conversation.id] ?? crypto.randomUUID();
    outgoingIds.current[conversation.id] = clientMessageId;
    try {
      await appendConversationMessage(conversation.id, clientMessageId, content);
      delete outgoingIds.current[conversation.id];
      setDrafts((current) => ({ ...current, [conversation.id]: '' }));
      await loadMessages(conversation.id);
    } catch { setError('Không thể gửi tin nhắn. Có thể thử lại.'); }
  };
  const ask = async () => {
    const question = draft.trim();
    const conversation = selected;
    if (!question || !conversation || conversation.status === 'CLOSED' || question.length > 4000) return;
    const clientMessageId = outgoingIds.current[conversation.id] ?? crypto.randomUUID();
    outgoingIds.current[conversation.id] = clientMessageId;
    try {
      const answer = await askConversationAi(conversation.id, question, clientMessageId);
      delete outgoingIds.current[conversation.id];
      if (selected?.id === conversation.id) setAiAnswer(answer);
      setDrafts((current) => ({ ...current, [conversation.id]: '' }));
      await loadMessages(conversation.id);
    } catch { setError('Không thể hỏi AI lúc này. Có thể thử lại.'); }
  };
  const close = async () => {
    if (!selected) return;
    try {
      const closed = await closeConversation(selected.id);
      setSelected(closed);
      setConversations((items) => items.map((item) => item.id === closed.id ? closed : item));
    } catch { setError('Không thể đóng hội thoại.'); }
  };
  const start = async () => {
    try { const conversation = await createConversation(); setConversations((items) => [conversation, ...items]); setSelected(conversation); setMessages([]); }
    catch { setError('Không thể tạo hội thoại mới.'); }
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Hỗ trợ</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button onPress={() => void start()} title="Hội thoại mới" />
      {conversations.map((conversation) => <Pressable accessibilityRole="button" accessibilityState={{ selected: selected?.id === conversation.id }} key={conversation.id} onPress={() => void selectConversation(conversation)} style={[styles.card, selected?.id === conversation.id ? styles.selectedCard : null]}><Text style={styles.cardTitle}>{conversation.title ?? 'Hội thoại hỗ trợ'}</Text><Text style={styles.muted}>{conversation.status}</Text></Pressable>)}
      {!selected ? <Text>Chưa có hội thoại hỗ trợ.</Text> : <View style={styles.card}>
        {messages.map((message) => <View key={message.id} style={styles.messageRow}><Text style={styles.muted}>{message.senderType === 'CUSTOMER' ? 'Bạn' : message.senderType === 'AI' ? 'AI' : 'Hỗ trợ'}</Text><Text>{message.content}</Text></View>)}
        {aiAnswer ? <View style={styles.aiNotice}><Text>{aiAnswer.answer}</Text><Text style={styles.muted}>{aiAnswer.grounded ? `Mã nguồn tham khảo: ${aiAnswer.citedSourceIds.join(', ')}` : 'AI không đủ nguồn chính thức.'}</Text></View> : null}
        {selected.status === 'CLOSED' ? <><Text style={styles.muted}>Hội thoại đã đóng.</Text><Button onPress={() => void start()} title="Tạo yêu cầu tiếp theo" /></> : <>
          <TextInput accessibilityLabel="Tin nhắn hỗ trợ" maxLength={8000} onChangeText={setDraft} placeholder="Nhập câu hỏi hoặc tin nhắn" style={styles.input} value={draft} />
          <Text style={styles.muted}>{draft.length}/8000 ký tự hỗ trợ · Hỏi AI tối đa 4000</Text>
          <View style={styles.actions}><Button disabled={!draft.trim() || draft.trim().length > 8000} onPress={() => void send()} title="Gửi tin nhắn" /><Button disabled={!draft.trim() || draft.trim().length > 4000} onPress={() => void ask()} title="Hỏi AI có nguồn" /><Button onPress={() => void close()} title="Đã giải quyết" /></View>
        </>}
      </View>}
    </ScrollView>
  );
}

export function NotificationsScreen() {
  const [notifications, setNotifications] = useState<MobileNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const result = await listNotifications();
      const page = Array.isArray(result) ? { items: result, nextCursor: null } : result;
      setNotifications(page.items);
      setNextCursor(page.nextCursor);
    } catch { setError('Không thể tải thông báo.'); }
    finally { setLoading(false); setRefreshing(false); }
  };
  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true); setError(null);
    try {
      const result = await listNotifications(nextCursor);
      const page = Array.isArray(result) ? { items: result, nextCursor: null } : result;
      setNotifications((items) => [...items, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch { setError('Không thể tải thêm thông báo. Vui lòng thử lại.'); }
    finally { setLoadingMore(false); }
  };
  useEffect(() => { void load(); }, []);
  return <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />} contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.heading}>Thông báo</Text>
     {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
     {readError ? <Text accessibilityRole="alert" style={styles.error}>{readError}</Text> : null}
     {!loading && notifications.length === 0 && !error ? <Text>Chưa có thông báo.</Text> : null}
     {notifications.map((notification) => <Pressable accessibilityRole="button" key={notification.id} onPress={() => {
       if (!notification.isRead) void markNotificationRead(notification.id)
         .then((updated) => { setReadError(null); setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, ...updated, isRead: true } : item)); })
         .catch(() => setReadError('Không thể đánh dấu thông báo đã đọc. Vui lòng thử lại.'));
     }} style={styles.card}>
       <Text style={styles.cardTitle}>{notification.title}</Text>
       <Text>{notification.content}</Text>
       {!notification.isRead ? <Text style={styles.muted}>Chưa đọc</Text> : null}
     </Pressable>)}
     {nextCursor ? <Button disabled={loadingMore} onPress={() => void loadMore()} title={loadingMore ? 'Đang tải...' : 'Tải thêm thông báo'} /> : null}
  </ScrollView>;
}

export function CatalogScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Catalog'>) {
  const [products, setProducts] = useState<MobileProduct[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    void listProducts().then(setProducts).catch(() => setError('Không thể tải danh mục sản phẩm.')).finally(() => setLoading(false));
  }, []);
  const toggleComparison = (planId: string) => setSelectedPlanIds((current) =>
    current.includes(planId)
      ? current.filter((id) => id !== planId)
      : current.length < 4
        ? [...current, planId]
        : current,
  );
  const needle = query.trim().toLocaleLowerCase('vi-VN');
  const visibleProducts = needle
    ? products.filter((product) => product.name.toLocaleLowerCase('vi-VN').includes(needle) || product.summary.toLocaleLowerCase('vi-VN').includes(needle) || product.plans.some((plan) => plan.name.toLocaleLowerCase('vi-VN').includes(needle)))
    : products;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Danh mục sản phẩm</Text>
      <Text style={styles.subtitle}>Chọn gói đã công bố hoặc so sánh từ hai đến bốn gói.</Text>
      <CustomerNavigation navigation={navigation} />
      <TextInput accessibilityLabel="Tìm sản phẩm hoặc gói" onChangeText={setQuery} placeholder="Tìm sản phẩm hoặc gói" style={styles.input} value={query} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {selectedPlanIds.length >= 4 ? <Text style={styles.muted}>Đã chọn 4/4 gói. Bỏ bớt một gói để chọn gói khác.</Text> : null}
      {!loading && needle && visibleProducts.length === 0 ? <Text>Không tìm thấy sản phẩm hoặc gói phù hợp.</Text> : null}
      {visibleProducts.map((product) => (
        <View key={product.slug} style={styles.card}>
          <Text style={styles.cardTitle}>{product.name}</Text>
          <Text style={styles.muted}>{product.summary}</Text>
          {product.plans.map((plan) => (
            <View key={plan.id} style={styles.planRow}>
              <View style={styles.flexOne}>
                <Text style={styles.planTitle}>{plan.name}</Text>
                <Text>{plan.priceVnd.toLocaleString('vi-VN')} ₫ · {plan.maxActiveDevices} thiết bị</Text>
              </View>
              <Button
                onPress={() => navigation.navigate('Checkout', {
                  planId: plan.id,
                  planName: plan.name,
                  priceVnd: plan.priceVnd,
                  productName: product.name,
                })}
                title="Mua"
              />
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={`${plan.name} - So sánh`}
                accessibilityState={{ checked: selectedPlanIds.includes(plan.id), disabled: selectedPlanIds.length >= 4 && !selectedPlanIds.includes(plan.id) }}
                disabled={selectedPlanIds.length >= 4 && !selectedPlanIds.includes(plan.id)}
                onPress={() => toggleComparison(plan.id)}
                style={[styles.compareToggle, selectedPlanIds.includes(plan.id) ? styles.compareToggleSelected : null]}
              >
                <Text>{selectedPlanIds.includes(plan.id) ? 'Đã chọn' : 'So sánh'}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ))}
      <Button
        disabled={selectedPlanIds.length < 2}
        onPress={() => navigation.navigate('ComparePlans', { ids: selectedPlanIds })}
        title={`So sánh ${selectedPlanIds.length} gói`}
      />
    </ScrollView>
  );
}

export function ComparePlansScreen({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, 'ComparePlans'>) {
  const [comparison, setComparison] = useState<MobilePlanComparison | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    void comparePlans(route.params.ids).then(setComparison).catch(() => setError('Không thể so sánh các gói đã chọn.'));
  }, [route.params.ids]);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>So sánh gói</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {comparison?.plans.map((plan) => (
        <View key={plan.id} style={styles.card}>
          <Text style={styles.cardTitle}>{plan.productName}</Text>
          <Text>{plan.name} · phiên bản {plan.version}</Text>
          {comparison.dimensions.map((dimension) => (
            <View key={dimension.key} style={styles.factRow}>
              <Text style={styles.muted}>{dimension.label}</Text>
              <Text>{formatComparisonValue(dimension.key, dimension.values[plan.id])}</Text>
            </View>
          ))}
          <Button onPress={() => navigation.navigate('Checkout', { planId: plan.id, planName: plan.name, priceVnd: comparisonPrice(comparison, plan.id), productName: plan.productName })} title="Mua gói này" />
        </View>
      ))}
    </ScrollView>
  );
}

function comparisonPrice(comparison: MobilePlanComparison, planId: string): number {
  const value = comparison.dimensions.find((dimension) => dimension.key === 'priceVnd')?.values[planId];
  return typeof value === 'number' ? value : 0;
}

function licenseStatusLabel(status: MobileLicense['status']): string {
  switch (status) {
    case 'ACTIVE': return 'Đang hoạt động';
    case 'SUSPENDED': return 'Tạm ngưng';
    case 'EXPIRED': return 'Đã hết hạn';
    case 'REVOKED': return 'Đã thu hồi';
    default: return status;
  }
}

function finalityLabel(finality: string): string {
  switch (finality) {
    case 'CHAIN_CONFIRMED': return 'Xác nhận trên chuỗi';
    case 'PENDING_FINALITY': return 'Chờ finality';
    case 'UNTRUSTED_REORG': return 'Chưa tin cậy (reorg)';
    default: return finality;
  }
}

function formatComparisonValue(key: string, value: unknown): string {
  if (key === 'priceVnd' && typeof value === 'number') return `${value.toLocaleString('vi-VN')} ₫`;
  if (key === 'durationMonths' && typeof value === 'number') return `${value} tháng`;
  if (key === 'maxActiveDevices' && typeof value === 'number') return `${value} thiết bị`;
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (value && typeof value === 'object') return Object.entries(value).map(([name, item]) => `${name}: ${typeof item === 'boolean' ? (item ? 'Có' : 'Không') : String(item)}`).join(', ') || 'Không có';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '—';
}

export function ProfileScreen({
  onProfileUpdated,
}: {
  readonly onProfileUpdated: (user: MobileSession['user']) => void;
}) {
  const [profile, setProfile] = useState<MobileSession['user'] | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    void getProfile()
      .then((value) => {
        setProfile(value);
        setDisplayName(value.displayName);
        setPhone(value.phone ?? '');
        setAddress(value.address ?? '');
      })
      .catch(() => setMessage('Không thể tải hồ sơ.'));
  }, []);
  const save = async () => {
    setMessage(null);
    try {
      const updated = await updateProfile({
        displayName: displayName.trim(),
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(address.trim() ? { address: address.trim() } : {}),
      });
      setProfile(updated);
      onProfileUpdated(updated);
      setMessage('Đã cập nhật hồ sơ.');
    } catch {
      setMessage('Không thể cập nhật hồ sơ.');
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Hồ sơ tài khoản</Text>
      <Text style={styles.subtitle}>{profile?.email ?? 'Đang tải thông tin tài khoản...'}</Text>
      <TextInput accessibilityLabel="Tên hiển thị" onChangeText={setDisplayName} style={styles.input} value={displayName} />
      <TextInput accessibilityLabel="Số điện thoại" keyboardType="phone-pad" onChangeText={setPhone} style={styles.input} value={phone} />
      <TextInput accessibilityLabel="Địa chỉ" multiline onChangeText={setAddress} style={[styles.input, styles.multilineInput]} value={address} />
      {message ? <Text accessibilityRole="alert" style={message.startsWith('Đã') ? styles.success : styles.error}>{message}</Text> : null}
      <Button disabled={!displayName.trim()} onPress={() => void save()} title="Lưu thay đổi" />
    </ScrollView>
  );
}

function OrdersScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Orders'>) {
  const [orders, setOrders] = useState<MobileOrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => { setError(null); setLoading(true); try { setOrders(await listOrders()); } catch { setError('Không thể tải danh sách đơn hàng.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.brand}>Emukey</Text>
      <Text style={styles.subtitle}>Đơn hàng gắn với tài khoản Emukey đang đăng nhập</Text>
      <CustomerNavigation navigation={navigation} />
      <Button onPress={() => navigation.navigate('VerifyLicense')} title="Xác minh License công khai" />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {!loading && orders.length === 0 && !error ? <Text>Chưa có đơn hàng.</Text> : null}
      {orders.map((order) => (
        <Pressable key={order.id} onPress={() => navigation.navigate('OrderDetail', { id: order.id })} style={styles.card}>
          <Text style={styles.cardTitle}>{order.orderNumber}</Text>
          <Text>{order.orderStatus}</Text>
          <Text>{order.priceVndSnapshot.toLocaleString('vi-VN')} VND</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function CheckoutScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Checkout'>) {
  const [order, setOrder] = useState<MobileOrderDetail | null>(null);
  const [terms, setTerms] = useState<import('../infrastructure/api/client').MobileOrderTerms | null>(null);
  const [termsState, setTermsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadTerms = async (orderId: string) => {
    setTermsState('loading');
    try {
      const loaded = await getOrderTerms(orderId);
      setTerms(loaded);
      setAccepted(false);
      setTermsState('ready');
    } catch {
      setTermsState('error');
      setError('Không thể tải điều khoản. Vui lòng thử lại.');
    }
  };
  const startOrder = async () => {
    setError(null);
    try {
      const created = await createOrder({ planId: route.params.planId });
      setOrder(created);
      await loadTerms(created.id);
    } catch {
      setError('Không thể tạo đơn hàng.');
    }
  };
  const continueToPayment = async () => {
    if (!order || !accepted || !terms || termsState !== 'ready') return;
    setError(null);
    try {
      const updated = await acceptServiceTerms(order, terms);
      navigation.replace('Payment', { orderId: updated.id });
    } catch {
      setError('Không thể xác nhận điều khoản của đơn hàng.');
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Hoàn tất mua bản quyền</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{order ? order.productNameSnapshot : route.params.productName}</Text>
        <Text>{order ? order.planNameSnapshot : route.params.planName}</Text>
        <Text style={styles.price}>{(order ? order.priceVndSnapshot : route.params.priceVnd).toLocaleString('vi-VN')} ₫</Text>
        {order && order.priceVndSnapshot !== route.params.priceVnd ? <Text style={styles.error}>Giá server đã thay đổi so với danh mục: {order.priceVndSnapshot.toLocaleString('vi-VN')} ₫.</Text> : null}
      </View>
      {!order ? (
        <Button onPress={() => void startOrder()} title="Tạo đơn hàng" />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Điều khoản cấp phép</Text>
          {termsState === 'error' ? (
            <>
              <Text style={styles.terms}>Chưa tải được điều khoản cấp phép.</Text>
              <Button disabled title="Tiếp tục thanh toán" />
              <Button onPress={() => void loadTerms(order.id)} title="Tải lại điều khoản" />
            </>
          ) : (
            <>
              <Text style={styles.terms}>{terms?.content ?? 'Đang tải điều khoản...'}</Text>
              {termsState === 'ready' ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Tôi đã đọc và đồng ý với điều khoản cấp phép"
                  accessibilityState={{ checked: accepted }}
                  onPress={() => setAccepted((value) => !value)}
                  style={[styles.acceptance, accepted ? styles.acceptanceSelected : null]}
                >
                  <Text>{accepted ? '✓ ' : ''}Tôi đã đọc và đồng ý với điều khoản cấp phép</Text>
                </Pressable>
              ) : null}
              <Button disabled={termsState !== 'ready' || !accepted} onPress={() => void continueToPayment()} title="Tiếp tục thanh toán" />
            </>
          )}
        </View>
      )}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

function htmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function mobileOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    WAITING_SERVICE_TERMS_ACCEPTANCE: 'Chờ đồng ý điều khoản',
    WAITING_PAYMENT: 'Chờ thanh toán',
    PAYMENT_ACCEPTED: 'Đã nhận thanh toán',
    CANCELLED: 'Đã hủy',
    EXPIRED: 'Đã hết hạn',
  };
  return labels[status] ?? 'Đang xử lý';
}

function checkoutDocument(checkout: MobileCheckoutSession): string {
  const fields = Object.entries(checkout.checkoutFields)
    .map(([name, value]) => `<input type="hidden" name="${htmlAttribute(name)}" value="${htmlAttribute(value)}">`)
    .join('');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;background:#f3f0e9;padding:24px"><p>Đang chuyển đến cổng thanh toán SePay…</p><form id="checkout" method="post" action="${htmlAttribute(checkout.checkoutUrl)}">${fields}</form><script>document.getElementById('checkout').submit()</script></body></html>`;
}

export function PaymentScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Payment'>) {
  const [order, setOrder] = useState<MobileOrderDetail | null>(null);
  const [checkout, setCheckout] = useState<MobileCheckoutSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const handlePaymentReturn = (url: string) => {
    if (!url.startsWith('emukey://payment/')) return false;
    setCheckout(null);
    setError('Đã quay lại từ cổng thanh toán. Hệ thống đang kiểm tra trạng thái đơn từ backend.');
    void getOrder(route.params.orderId)
      .then(setOrder)
      .catch(() => setError('Không thể kiểm tra trạng thái thanh toán.'));
    return true;
  };
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => { handlePaymentReturn(url); };
    const subscription = Linking.addEventListener('url', handleDeepLink);
    void Linking.getInitialURL().then((url) => { if (url) handlePaymentReturn(url); }).catch(() => undefined);
    return () => subscription.remove();
  }, [route.params.orderId]);
  useEffect(() => {
    let active = true;
    const refresh = () => void getOrder(route.params.orderId)
      .then((value) => { if (active) setOrder(value); })
      .catch(() => { if (active) setError('Không thể cập nhật trạng thái đơn hàng.'); });
    void refresh();
    const timer = setInterval(refresh, 5_000);
    return () => { active = false; clearInterval(timer); };
  }, [route.params.orderId]);
  const openCheckout = async () => {
    setError(null);
    try {
      const session = await createCheckout(route.params.orderId);
      if (!session.checkoutUrl.startsWith('https://')) throw new Error('UNSAFE_CHECKOUT_URL');
      setCheckout(session);
    } catch {
      setError('Không thể tạo phiên thanh toán SePay.');
    }
  };
  if (checkout) {
    return (
      <View style={styles.webViewContainer}>
        <WebView
          javaScriptEnabled
          onShouldStartLoadWithRequest={(request) => {
            if (request.url.startsWith('emukey://payment/')) {
              handlePaymentReturn(request.url);
              return false;
            }
            return request.url === 'about:blank' || request.url.startsWith('https://');
          }}
          originWhitelist={['*']}
          source={{ html: checkoutDocument(checkout) }}
          style={styles.webView}
        />
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Thanh toán đơn hàng</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{order?.orderNumber ?? 'Đang tải đơn hàng...'}</Text>
        <Text>{order?.productNameSnapshot}</Text>
          <Text>{order ? mobileOrderStatusLabel(order.orderStatus) : 'Đang tải trạng thái'}</Text>
        {order ? <Text style={styles.price}>{order.priceVndSnapshot.toLocaleString('vi-VN')} ₫</Text> : null}
      </View>
      {order?.orderStatus === 'WAITING_PAYMENT' ? (
        <Button onPress={() => void openCheckout()} title="Thanh toán trên SePay" />
      ) : null}
      {order?.orderStatus === 'PAYMENT_ACCEPTED' ? (
        <>
          <Text accessibilityRole="alert" style={styles.success}>Thanh toán đã hoàn tất. License đang được xử lý trên blockchain.</Text>
          <Button onPress={() => navigation.navigate('Licenses')} title="Xem license của tôi" />
        </>
      ) : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

export function LicensesScreen({
  navigation,
}: {
  readonly navigation?: NativeStackScreenProps<RootStackParamList, 'Licenses'>['navigation'];
} = {}) {
  const [licenses, setLicenses] = useState<MobileLicense[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<Record<string, MobileDevice[]>>({});
  const [actionToken, setActionToken] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadLicenses = async (refresh = false) => { if (refresh) setRefreshing(true); setError(null); try { setLicenses(await listLicenses()); } catch { setError('Không thể tải danh sách License.'); } finally { setRefreshing(false); } };
  useEffect(() => { void loadLicenses(); }, []);
  const loadDevices = async (licenseId: string) => {
    try {
      const result = await listDevices(licenseId);
      setDevices((current) => ({ ...current, [licenseId]: result }));
    } catch {
      setError('Không thể tải danh sách thiết bị.');
    }
  };
  const remoteRevoke = async (licenseId: string, deviceId: string) => {
    setError(null);
    setMessage(null);
    if (!currentPassword.trim()) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!actionToken.trim()) {
      setError('Vui lòng nhập action token từ email.');
      return;
    }
    try {
      const revoked = await remoteRevokeDevice(licenseId, deviceId, {
        actionToken: actionToken.trim(),
        currentPassword: currentPassword.trim(),
      });
      setMessage(`Thiết bị ${revoked.status} ngay trong PostgreSQL.`);
      await loadDevices(licenseId);
      setActionToken('');
      setCurrentPassword('');
    } catch {
      setError('Không thể thu hồi thiết bị. Kiểm tra mật khẩu, action token và quyền sở hữu.');
    }
  };
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadLicenses(true)} />}
    >
      <Text accessibilityRole="header" style={styles.heading}>License doanh nghiệp</Text>
      {navigation ? <CustomerNavigation navigation={navigation} /> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
      {licenses.length === 0 ? <Text>Chưa có License nào.</Text> : null}
      {licenses.map((license) => (
        <View key={license.id} style={styles.card}>
          <Text style={styles.cardTitle}>{license.productName}</Text>
          <Text>{license.publicLicenseId}</Text>
          <Text>{licenseStatusLabel(license.status)} · {finalityLabel(license.finality)} ({license.confirmationCount}) · {license.activeDeviceCount}/{license.maxActiveDevices} thiết bị</Text>
          <Button onPress={() => void loadDevices(license.id)} title="Xem thiết bị" />
          {navigation && license.status === 'ACTIVE' ? (
            <Button
              onPress={() => navigation.navigate('Renewal', {
                licenseId: license.id,
                originOrderId: license.originOrderId,
                productName: license.productName,
              })}
              title="Gia hạn License"
            />
          ) : null}
          {(devices[license.id] ?? []).map((device) => (
            <View key={device.id} style={styles.card}>
              <Text>{device.deviceRef} · {device.status}</Text>
              {device.status === 'ACTIVE' ? (
                <>
                  <Button onPress={() => void requestLicensingActionVerification(license.id, 'REMOTE_REVOKE_DEVICE', device.id).then(() => setMessage('Đã gửi email xác nhận thu hồi.')).catch(() => setError('Không thể gửi email xác nhận.'))} title="Gửi email xác nhận thu hồi" />
                  <TextInput accessibilityLabel="Mật khẩu hiện tại" secureTextEntry onChangeText={setCurrentPassword} placeholder="Mật khẩu" style={styles.input} value={currentPassword} />
                  <TextInput accessibilityLabel="Action token" autoCapitalize="none" onChangeText={setActionToken} placeholder="Action token từ email" style={styles.input} value={actionToken} />
                  <Button disabled={!actionToken.trim() || !currentPassword.trim()} onPress={() => void remoteRevoke(license.id, device.id)} title="Thu hồi thiết bị" />
                </>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

export function RenewalScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'Renewal'>) {
  const [sourceOrder, setSourceOrder] = useState<MobileOrderDetail | null>(null);
  const [renewalOrder, setRenewalOrder] = useState<MobileOrderDetail | null>(null);
  const [preview, setPreview] = useState<import('../infrastructure/api/client').MobileRenewalPreview | null>(null);
  const [terms, setTerms] = useState<import('../infrastructure/api/client').MobileOrderTerms | null>(null);
  const [termsState, setTermsState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void Promise.all([getOrder(route.params.originOrderId), getRenewalPreview(route.params.licenseId)])
      .then(([orderValue, previewValue]) => { setSourceOrder(orderValue); setPreview(previewValue); })
      .catch(() => setError('Không thể tải thông tin gia hạn.'));
  }, [route.params.originOrderId, route.params.licenseId]);
  const loadTerms = async (orderId: string) => {
    setTermsState('loading');
    setTerms(null);
    setAccepted(false);
    setError(null);
    try {
      setTerms(await getOrderTerms(orderId));
      setTermsState('ready');
    } catch {
      setTermsState('error');
      setError('Không thể tải điều khoản gia hạn. Vui lòng thử lại.');
    }
  };
  const startRenewal = async () => {
    if (!preview?.canRenew || !sourceOrder || pending) return;
    setError(null);
    setPending(true);
    try {
      const created = preview.pendingOrder ?? await createOrder({ planId: preview.planId, targetLicenseId: route.params.licenseId });
      setRenewalOrder(created);
      if (created.orderStatus === 'WAITING_SERVICE_TERMS_ACCEPTANCE') await loadTerms(created.id);
    } catch {
      setError('Không thể tạo hoặc tiếp tục đơn gia hạn.');
    } finally {
      setPending(false);
    }
  };
  const continueToPayment = async () => {
    if (!renewalOrder || !accepted || !terms || termsState !== 'ready' || pending) return;
    setPending(true);
    setError(null);
    try {
      const updated = await acceptServiceTerms(renewalOrder, terms);
      navigation.replace('Payment', { orderId: updated.id });
    } catch {
      setError('Không thể xác nhận điều khoản gia hạn.');
    } finally {
      setPending(false);
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Gia hạn License</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{route.params.productName}</Text>
        <Text>{preview?.planName ?? sourceOrder?.planNameSnapshot ?? 'Đang tải gói hiện tại...'}</Text>
        {preview ? <Text style={styles.price}>{(renewalOrder?.priceVndSnapshot ?? preview.priceVnd).toLocaleString('vi-VN')} ₫</Text> : null}
        {renewalOrder && preview && renewalOrder.priceVndSnapshot !== preview.priceVnd ? <Text>Giá đơn gia hạn đã thay đổi so với dự kiến. Vui lòng xem lại trước khi đồng ý.</Text> : null}
        {preview ? <Text>Hạn hiện tại: {new Date(preview.currentExpiresAt).toLocaleDateString('vi-VN')} · dự kiến: {new Date(preview.estimatedExpiresAt).toLocaleDateString('vi-VN')}</Text> : null}
        {preview && !preview.canRenew ? <Text style={styles.error}>Gói này hiện chưa thể gia hạn.</Text> : null}
      </View>
      {!renewalOrder ? (
        <Button disabled={!preview?.canRenew || !sourceOrder || pending} onPress={() => void startRenewal()} title={preview?.pendingOrder ? 'Tiếp tục đơn gia hạn' : 'Tạo đơn gia hạn'} />
      ) : renewalOrder.orderStatus !== 'WAITING_SERVICE_TERMS_ACCEPTANCE' ? (
        ['WAITING_PAYMENT', 'PAYMENT_ACCEPTED'].includes(renewalOrder.orderStatus)
          ? <Button onPress={() => navigation.replace('Payment', { orderId: renewalOrder.id })} title="Tiếp tục thanh toán" />
          : <Text>Đơn gia hạn đã kết thúc. Vui lòng tải lại thông tin bản quyền.</Text>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Điều khoản gia hạn</Text>
          <Text style={styles.terms}>{terms?.content ?? (termsState === 'error' ? 'Chưa tải được điều khoản gia hạn.' : 'Đang tải điều khoản...')}</Text>
          {termsState === 'error' ? <Button onPress={() => void loadTerms(renewalOrder.id)} title="Tải lại điều khoản" /> : null}
          {termsState === 'ready' && terms ? <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            disabled={pending}
            onPress={() => setAccepted((value) => !value)}
            style={[styles.acceptance, accepted ? styles.acceptanceSelected : null]}
          >
            <Text>{accepted ? '✓ ' : ''}Tôi đồng ý với điều khoản gia hạn</Text>
          </Pressable> : null}
          <Button disabled={!accepted || !terms || termsState !== 'ready' || pending} onPress={() => void continueToPayment()} title="Tiếp tục thanh toán" />
        </View>
      )}
      <Text style={styles.muted}>Trạng thái thiết bị được lưu ngay trong PostgreSQL; blockchain chỉ đồng bộ số lượng tổng hợp bất đồng bộ.</Text>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

export function VerifyLicenseScreen() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<MobileLicenseVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const verify = async () => {
    setError(null);
    try { setResult(await verifyPublicLicense(code.trim())); }
    catch { setError('Không thể xác minh License lúc này.'); }
  };
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>Xác minh Blockchain</Text>
      <Text>Chỉ dùng mã License công khai; kết quả không chứa danh tính người mua.</Text>
      <TextInput accessibilityLabel="Mã License công khai" autoCapitalize="characters" onChangeText={setCode} placeholder="EMU-..." style={styles.input} value={code} />
      <Button disabled={!code.trim()} onPress={() => void verify()} title="Xác minh" />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {result ? <View style={styles.card}><Text style={styles.cardTitle}>{result.productName ?? result.licenseId}</Text><Text>{result.state}</Text><Text>{result.licenseId}</Text></View> : null}
    </ScrollView>
  );
}

function OrderDetailScreen({ route }: NativeStackScreenProps<RootStackParamList, 'OrderDetail'>) {
  const [order, setOrder] = useState<MobileOrderDetail | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { void getOrder(route.params.id).then(setOrder).catch(() => setError(true)); }, [route.params.id]);
  if (error) return <View style={styles.container}><Text accessibilityRole="alert">Không thể tải đơn hàng.</Text></View>;
  if (!order) return <View style={styles.container}><Text>Đang tải...</Text></View>;
  return <View style={styles.container}><Text style={styles.heading}>{order.orderNumber}</Text><Text style={styles.cardTitle}>{order.productNameSnapshot}</Text><Text>{order.planNameSnapshot}</Text><Text>{mobileOrderStatusLabel(order.orderStatus)}</Text><Text style={styles.price}>{order.priceVndSnapshot.toLocaleString('vi-VN')} ₫</Text><Text>{order.durationMonthsSnapshot} tháng · tối đa {order.maxActiveDevicesSnapshot} thiết bị</Text></View>;
}

export function EmuKeyMobileApp() {
  const [fontsLoaded, fontError] = useFonts({ GreatVibes_400Regular });
  const [session, setSession] = useState<MobileSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicVerify, setPublicVerify] = useState(false);
  useEffect(() => { void restoreSession().then(setSession).finally(() => setLoading(false)); }, []);
  if ((!fontsLoaded && !fontError) || loading) return <View style={styles.container}><Text>Đang khôi phục phiên đăng nhập...</Text></View>;
  if (!session) {
    if (publicVerify) return <View style={styles.publicContainer}><VerifyLicenseScreen /><Button onPress={() => setPublicVerify(false)} title="Quay lại đăng nhập" /></View>;
    return <LoginScreen onAuthenticated={setSession} onVerify={() => setPublicVerify(true)} />;
  }
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Catalog">
        <Stack.Screen component={CatalogScreen} name="Catalog" options={{ headerRight: () => <Button onPress={() => void logout().then(() => setSession(null))} title="Đăng xuất" />, title: 'Sản phẩm' }} />
        <Stack.Screen component={AssistanceScreen} name="Assistance" options={{ title: 'Hỗ trợ' }} />
        <Stack.Screen component={ComparePlansScreen} name="ComparePlans" options={{ title: 'So sánh gói' }} />
        <Stack.Screen component={CheckoutScreen} name="Checkout" options={{ title: 'Tạo đơn hàng' }} />
        <Stack.Screen component={OrdersScreen} name="Orders" options={{ headerRight: () => <Button onPress={() => void logout().then(() => setSession(null))} title="Đăng xuất" />, title: 'Đơn hàng' }} />
        <Stack.Screen component={OrderDetailScreen} name="OrderDetail" options={{ title: 'Chi tiết đơn hàng' }} />
        <Stack.Screen component={LicensesScreen} name="Licenses" options={{ title: 'License của tôi' }} />
        <Stack.Screen component={NotificationsScreen} name="Notifications" options={{ title: 'Thông báo' }} />
        <Stack.Screen component={PaymentScreen} name="Payment" options={{ title: 'Thanh toán' }} />
        <Stack.Screen name="Profile" options={{ title: 'Hồ sơ' }}>
          {() => <ProfileScreen onProfileUpdated={(user) => setSession((current) => current ? { ...current, user } : current)} />}
        </Stack.Screen>
        <Stack.Screen component={RenewalScreen} name="Renewal" options={{ title: 'Gia hạn License' }} />
        <Stack.Screen component={VerifyLicenseScreen} name="VerifyLicense" options={{ title: 'Xác minh License' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  aiNotice: { backgroundColor: '#e9f1f5', borderColor: '#b7cfda', borderRadius: 8, borderWidth: 1, gap: 6, padding: 12 },
  acceptance: { backgroundColor: '#fdfbf6', borderColor: '#a9977a', borderRadius: 8, borderWidth: 1, padding: 12 },
  acceptanceSelected: { backgroundColor: '#fbf0d6', borderColor: '#a8792e' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  brand: { color: '#7a2e3a', fontFamily: 'GreatVibes_400Regular', fontSize: 42, lineHeight: 52 },
  card: { backgroundColor: '#fdfbf6', borderColor: '#a9977a', borderRadius: 12, borderWidth: 1, gap: 8, padding: 16 },
  cardTitle: { color: '#1c1a17', fontSize: 17, fontWeight: '700' },
  compareToggle: { borderColor: '#a9977a', borderRadius: 6, borderWidth: 1, minWidth: 72, padding: 9 },
  compareToggleSelected: { backgroundColor: '#fbf0d6', borderColor: '#a8792e' },
  container: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 20 },
  content: { backgroundColor: '#f3f0e9', flexGrow: 1, gap: 14, padding: 20 },
  error: { color: '#9b2226' },
  factRow: { borderTopColor: '#e4dfd3', borderTopWidth: 1, gap: 4, paddingTop: 8 },
  flexOne: { flex: 1 },
  heading: { color: '#1c1a17', fontSize: 22, fontWeight: '700' },
  input: { backgroundColor: '#fdfbf6', borderColor: '#a9977a', borderRadius: 8, borderWidth: 1, padding: 12 },
  messageRow: { borderBottomColor: '#e4dfd3', borderBottomWidth: 1, gap: 4, paddingVertical: 8 },
  multilineInput: { minHeight: 88, textAlignVertical: 'top' },
  muted: { color: '#52493c' },
  planRow: { alignItems: 'center', borderTopColor: '#e4dfd3', borderTopWidth: 1, flexDirection: 'row', gap: 8, paddingTop: 10 },
  planTitle: { color: '#1c1a17', fontWeight: '700' },
  price: { color: '#8a611f', fontSize: 18, fontWeight: '700' },
  publicContainer: { flex: 1 },
  subtitle: { color: '#52493c', fontSize: 16 },
  selectedCard: { borderColor: '#7a2e3a', borderWidth: 2 },
  success: { color: '#1f6f46' },
  terms: { color: '#1c1a17', lineHeight: 22 },
  webView: { flex: 1 },
  webViewContainer: { backgroundColor: '#f3f0e9', flex: 1 },
});
