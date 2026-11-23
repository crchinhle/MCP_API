import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { BackHandler } from 'react-native';

import { CustomerSessionProvider } from '../../../../EmuKey/mobile/src/application/auth/useCustomerSession';
import { NotificationProvider } from '../../../../EmuKey/mobile/src/application/notifications/notificationContext';
import { ChangePasswordScreen } from '../../../../EmuKey/mobile/src/presentation/screens/account/ChangePasswordScreen';
import { ProfileScreen } from '../../../../EmuKey/mobile/src/presentation/screens/account/ProfileScreen';
import { AiAssistantScreen } from '../../../../EmuKey/mobile/src/presentation/screens/assistance/AiAssistantScreen';
import { ConversationThreadScreen } from '../../../../EmuKey/mobile/src/presentation/screens/assistance/ConversationThreadScreen';
import { CreateSupportRequestScreen } from '../../../../EmuKey/mobile/src/presentation/screens/assistance/CreateSupportRequestScreen';
import { RegisterScreen } from '../../../../EmuKey/mobile/src/presentation/screens/auth/RegisterScreen';
import { HelpDetailScreen } from '../../../../EmuKey/mobile/src/presentation/screens/help/HelpDetailScreen';
import { HelpListScreen } from '../../../../EmuKey/mobile/src/presentation/screens/help/HelpListScreen';
import { NotificationsScreen } from '../../../../EmuKey/mobile/src/presentation/screens/notifications/NotificationsScreen';
import {
  askConversationAi,
  askPublicAi,
  changePassword,
  createConversation,
  getConversation,
  getProfile,
  getPublicKnowledgeDocument,
  listConversationMessages,
  listConversations,
  listNotifications,
  listPublicKnowledgeDocuments,
  logout,
  markNotificationRead,
  register,
  restoreSession,
  subscribeSession,
  updateProfile,
} from '../../../../EmuKey/mobile/src/infrastructure/api/client';

jest.mock('../../../../EmuKey/mobile/src/infrastructure/api/client', () => ({
  subscribeSession: jest.fn(() => () => {}),
  restoreSession: jest.fn().mockResolvedValue(null),
  logout: jest.fn().mockResolvedValue(undefined),
  register: jest.fn(),
  changePassword: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  listNotifications: jest.fn().mockResolvedValue([]),
  markNotificationRead: jest.fn(),
  listPublicKnowledgeDocuments: jest.fn(),
  getPublicKnowledgeDocument: jest.fn(),
  askPublicAi: jest.fn(),
  createConversation: jest.fn(),
  getConversation: jest.fn(),
  listConversationMessages: jest.fn(),
  listConversations: jest.fn().mockResolvedValue([]),
  askConversationAi: jest.fn(),
}));

const TestStack = createNativeStackNavigator();

function NavHarness({ element }: { readonly element: ReactElement }) {
  return (
    <NavigationContainer>
      <TestStack.Navigator screenOptions={{ headerShown: false }}>
        <TestStack.Screen name="TestScreen">{() => element}</TestStack.Screen>
      </TestStack.Navigator>
    </NavigationContainer>
  );
}

describe('mobile account, help knowledge base & assistance workflows', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(subscribeSession).mockImplementation(() => () => {});
    jest.mocked(restoreSession).mockResolvedValue(null);
    jest.mocked(logout).mockResolvedValue(undefined);
    jest.mocked(listConversations).mockResolvedValue([]);
  });

  it('registers only Customer accounts with valid customerType and strong password', async () => {
    jest.mocked(register).mockResolvedValue({ message: 'OK', verificationRequired: true });
    const onRegistered = jest.fn();

    await render(<RegisterScreen onBack={jest.fn()} onRegistered={onRegistered} />);

    await act(async () => fireEvent.changeText(screen.getByLabelText('Họ và tên'), 'Nguyễn Minh'));
    await act(async () => fireEvent.press(screen.getByText('Doanh nghiệp')));
    await act(async () => fireEvent.changeText(screen.getByLabelText('Email'), 'minh@emukey.app'));
    await act(async () => fireEvent.changeText(screen.getByLabelText('Mật khẩu'), 'StrongPass@1'));
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Xác nhận mật khẩu'), 'StrongPass@1'),
    );
    await act(async () => fireEvent.press(screen.getByRole('button', { name: 'Tạo tài khoản' })));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith({
        customerType: 'BUSINESS',
        displayName: 'Nguyễn Minh',
        email: 'minh@emukey.app',
        password: 'StrongPass@1',
      }),
    );
    expect(onRegistered).toHaveBeenCalledWith('minh@emukey.app');
  });

  it('enforces 12+ char strong password on ChangePasswordScreen and signs out after success', async () => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: {
        id: 'c1',
        email: 'c@emukey.app',
        displayName: 'C',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });
    jest.mocked(changePassword).mockResolvedValue(undefined);
    jest.mocked(logout).mockRejectedValueOnce(new Error('already invalidated'));

    await render(
      <CustomerSessionProvider>
        <ChangePasswordScreen onBack={jest.fn()} />
      </CustomerSessionProvider>,
    );

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Mật khẩu hiện tại'), 'OldPass@1234'),
    );
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Mật khẩu mới'), 'Short1!'),
    );
    expect(screen.getByText(/Mật khẩu mới cần 12–128 ký tự/)).toBeOnTheScreen();

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Mật khẩu mới'), 'NewStrongPass@123'),
    );
    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Xác nhận mật khẩu mới'), 'NewStrongPass@123'),
    );
    await act(async () =>
      fireEvent.press(screen.getByRole('button', { name: 'Đổi mật khẩu' })),
    );

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPass@1234',
        password: 'NewStrongPass@123',
      }),
    );
    expect(logout).toHaveBeenCalled();
    expect(
      await screen.findByText('Đã đổi mật khẩu thành công. Vui lòng đăng nhập lại.'),
    ).toBeOnTheScreen();
  });

  it('allows clearing existing optional phone and address on ProfileScreen', async () => {
    const profile = {
      id: 'c1',
      email: 'c@emukey.app',
      displayName: 'Buyer',
      phone: '0901234567',
      address: 'Hà Nội',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    };
    jest.mocked(getProfile).mockResolvedValue(profile);
    jest.mocked(updateProfile).mockResolvedValue({ ...profile, phone: null, address: null });

    await render(<NavHarness element={<ProfileScreen onProfileUpdated={jest.fn()} />} />);
    await act(async () => fireEvent.changeText(await screen.findByLabelText('Số điện thoại'), ''));
    await act(async () => fireEvent.changeText(screen.getByLabelText('Địa chỉ'), ''));
    await act(async () => fireEvent.press(screen.getByText('Lưu thay đổi')));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({
        displayName: 'Buyer',
        phone: '',
        address: '',
      }),
    );
  });

  it('lists help articles in HelpListScreen and opens selected article', async () => {
    jest.mocked(listPublicKnowledgeDocuments).mockResolvedValue({
      items: [
        {
          id: 'doc-1',
          title: 'Hướng dẫn kích hoạt offline',
          summary: 'Tóm tắt ngắn gọn',
          tags: ['Kích hoạt'],
          productId: 'prod-1',
          productName: 'Desktop Pro',
          updatedAt: '2026-10-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      availableTags: ['Kích hoạt'],
      products: [{ id: 'prod-1', name: 'Desktop Pro' }],
    });

    const onOpenDocument = jest.fn();
    await render(<HelpListScreen onOpenDocument={onOpenDocument} />);
    await act(async () => fireEvent.press(await screen.findByText('Hướng dẫn kích hoạt offline')));
    expect(onOpenDocument).toHaveBeenCalledWith('doc-1');
  });

  it('renders structured document chunks cleanly in HelpDetailScreen', async () => {
    jest.mocked(getPublicKnowledgeDocument).mockResolvedValue({
      id: 'doc-1',
      title: 'Hướng dẫn kích hoạt offline',
      summary: 'Tóm tắt ngắn gọn',
      content: 'Bước 1 mở ứng dụng.',
      chunks: [
        {
          id: 'chunk-1',
          heading: 'Bắt đầu nhanh',
          content: 'Bước 1 mở ứng dụng.\n\n- Nhập mã bản quyền\n- Nhấn xác nhận',
        },
        {
          id: 'chunk-2',
          heading: 'Khắc phục sự cố',
          content: 'Kiểm tra kết nối mạng.',
        },
      ],
      tags: ['Kích hoạt'],
      productId: 'prod-1',
      productName: 'Desktop Pro',
      updatedAt: '2026-10-01T00:00:00Z',
      relatedDocuments: [],
    });

    await render(
      <HelpDetailScreen
        documentId="doc-1"
        onBack={jest.fn()}
        onOpenDocument={jest.fn()}
        onOpenProduct={jest.fn()}
        onOpenSupport={jest.fn()}
      />,
    );
    expect(await screen.findByText('Bước 1 mở ứng dụng.')).toBeOnTheScreen();
    expect(screen.getByText('• Nhập mã bản quyền')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Mục lục')));
    expect(await screen.findByText('Mục lục bài viết')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('2. Khắc phục sự cố')));
    await waitFor(() => expect(screen.queryByText('Mục lục bài viết')).toBeNull());
  });

  it('reuses the same clientRequestId when retrying a failed CreateSupportRequest submission', async () => {
    jest
      .mocked(createConversation)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ id: 'conv-sup-1' } as never);
    const onCreated = jest.fn();

    await render(
      <NavHarness
        element={
          <CreateSupportRequestScreen
            contextId="order-1"
            contextLabel="ORD-1"
            contextType="ORDER"
            onBack={jest.fn()}
            onCreated={onCreated}
          />
        }
      />,
    );

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Mô tả vấn đề'), 'Cần kiểm tra đơn hàng'),
    );
    await act(async () => fireEvent.press(screen.getByText('Gửi yêu cầu hỗ trợ')));
    expect(await screen.findByText(/Không thể tạo yêu cầu hỗ trợ/)).toBeOnTheScreen();

    await act(async () => fireEvent.press(screen.getByText('Gửi yêu cầu hỗ trợ')));
    await waitFor(() => expect(createConversation).toHaveBeenCalledTimes(2));
    const firstArg = jest.mocked(createConversation).mock.calls[0][0] as { clientRequestId: string };
    const secondArg = jest.mocked(createConversation).mock.calls[1][0] as { clientRequestId: string };
    expect(firstArg.clientRequestId).toBe(secondArg.clientRequestId);
    expect(onCreated).toHaveBeenCalledWith('conv-sup-1');
  });

  it('routes Guest AI queries through askPublicAi with citations', async () => {
    jest.mocked(askPublicAi).mockResolvedValue({
      answer: 'Câu trả lời khách vãng lai',
      grounded: true,
      citationDetails: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          documentTitle: 'Tài liệu công khai',
          documentVersion: 1,
          excerpt: 'Tóm tắt',
        },
      ],
      recommendations: [],
    });

    const onOpenDocument = jest.fn();
    await render(
      <AiAssistantScreen
        onBack={jest.fn()}
        onOpenDocument={onOpenDocument}
        onOpenProduct={jest.fn()}
        onRequireLogin={jest.fn()}
      />,
    );

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Câu hỏi cho trợ lý AI'), 'Cách mua bản quyền?'),
    );
    await act(async () => fireEvent.press(screen.getByText('Hỏi AI')));
    expect(await screen.findByText('Câu trả lời khách vãng lai')).toBeOnTheScreen();
    expect(screen.getByText('Mở nguồn Tài liệu công khai')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Xem toàn bộ tài liệu')));
    expect(onOpenDocument).toHaveBeenCalledWith('doc-1');
  });

  it('routes authenticated Customer AI queries through conversation AI with persisted messages', async () => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: {
        id: 'c1',
        email: 'c@emukey.app',
        displayName: 'C',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });
    jest.mocked(createConversation).mockResolvedValue({
      id: 'ai-conv-1',
      title: 'Hỏi trợ lý AI',
      status: 'AI_ACTIVE',
      contextType: 'GENERAL',
    } as never);
    jest.mocked(getConversation).mockResolvedValue({
      id: 'ai-conv-1',
      title: 'Hỏi trợ lý AI',
      status: 'AI_ACTIVE',
      contextType: 'GENERAL',
    } as never);
    let answered = false;
    jest.mocked(listConversationMessages).mockImplementation(async () =>
      answered
        ? [
            {
              id: 'm1',
              conversationId: 'ai-conv-1',
              senderType: 'AI',
              content: 'Câu trả lời cho khách hàng',
              serverSequence: 1,
              createdAt: '2026-10-01T00:00:00Z',
            } as never,
          ]
        : [],
    );
    jest.mocked(askConversationAi).mockImplementation(async () => {
      answered = true;
      return {
        answer: 'Câu trả lời cho khách hàng',
        grounded: true,
        citedSourceIds: ['doc-2'],
      };
    });

    await render(
      <CustomerSessionProvider>
        <AiAssistantScreen
          onBack={jest.fn()}
          onOpenDocument={jest.fn()}
          onOpenProduct={jest.fn()}
        />
      </CustomerSessionProvider>,
    );

    await act(async () =>
      fireEvent.changeText(
        await screen.findByLabelText('Câu hỏi cho trợ lý AI'),
        'Hướng dẫn gia hạn?',
      ),
    );
    await act(async () => fireEvent.press(screen.getByText('Hỏi AI')));
    expect(await screen.findByText('Câu trả lời cho khách hàng')).toBeOnTheScreen();
    expect(askConversationAi).toHaveBeenCalledWith(
      'ai-conv-1',
      'Hướng dẫn gia hạn?',
      expect.any(String),
    );
  });

  it('offers one-tap resume for recent active AI conversation and guards auto-scroll when scrolled up', async () => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: {
        id: 'c1',
        email: 'c@emukey.app',
        displayName: 'C',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });
    jest.mocked(listConversations).mockResolvedValue([
      {
        id: 'ai-prev-1',
        customerUserId: 'c1',
        assignedSupportUserId: null,
        status: 'AI_ACTIVE',
        contextType: 'GENERAL',
        contextId: null,
        title: 'Hỏi về gói Pro',
      },
    ]);
    jest.mocked(getConversation).mockResolvedValue({
      id: 'ai-prev-1',
      customerUserId: 'c1',
      assignedSupportUserId: null,
      status: 'AI_ACTIVE',
      contextType: 'GENERAL',
      contextId: null,
      title: 'Hỏi về gói Pro',
    });
    jest.mocked(listConversationMessages).mockResolvedValue([
      {
        id: 'm-prev-1',
        conversationId: 'ai-prev-1',
        senderType: 'AI',
        content: 'Nội dung trả lời dài để đọc lại',
        serverSequence: 1,
        createdAt: '2026-10-01T00:00:00Z',
      } as never,
    ]);

    await render(
      <CustomerSessionProvider>
        <AiAssistantScreen
          onBack={jest.fn()}
          onOpenDocument={jest.fn()}
          onOpenProduct={jest.fn()}
        />
      </CustomerSessionProvider>,
    );

    expect(await screen.findByText('Tiếp tục hội thoại')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Tiếp tục hội thoại')));
    expect(await screen.findByText('Nội dung trả lời dài để đọc lại')).toBeOnTheScreen();
  });

  it('surfaces non-blocking reconnect banner when background thread refresh fails', async () => {
    jest.useFakeTimers();
    jest.mocked(getConversation).mockResolvedValue({
      id: 'sup-1',
      customerUserId: 'c1',
      assignedSupportUserId: 'sup-agent',
      status: 'SUPPORT_ACTIVE',
      contextType: 'ORDER',
      contextId: 'ord-1',
      title: 'Hỗ trợ đơn hàng',
    });
    jest.mocked(listConversationMessages).mockResolvedValue([
      {
        id: 'm1',
        conversationId: 'sup-1',
        senderType: 'SUPPORT',
        content: 'Nhân viên đang kiểm tra đơn cho bạn.',
        serverSequence: 1,
        createdAt: '2026-10-01T00:00:00Z',
      } as never,
    ]);

    await render(
      <ConversationThreadScreen
        conversationId="sup-1"
        onBack={jest.fn()}
        onCreateFollowUp={jest.fn()}
        onOpenDocument={jest.fn()}
        onOpenProduct={jest.fn()}
      />,
    );

    expect(await screen.findByText('Nhân viên đang kiểm tra đơn cho bạn.')).toBeOnTheScreen();

    jest.mocked(listConversationMessages).mockRejectedValueOnce(new Error('Network offline'));
    await act(async () => {
      jest.advanceTimersByTime(5_100);
    });

    expect(await screen.findByText('Mất kết nối tạm thời — đang tự động kết nối lại.')).toBeOnTheScreen();
    expect(screen.getByText('Nhân viên đang kiểm tra đơn cho bạn.')).toBeOnTheScreen();

    // Retrying via the banner keeps existing messages visible even if retry fails again.
    jest.mocked(listConversationMessages).mockRejectedValueOnce(new Error('Still offline'));
    await act(async () => fireEvent.press(screen.getByText('Thử lại')));
    expect(await screen.findByText('Nhân viên đang kiểm tra đơn cho bạn.')).toBeOnTheScreen();
    expect(screen.getByText('Mất kết nối tạm thời — đang tự động kết nối lại.')).toBeOnTheScreen();
    jest.useRealTimers();
  });

  it('does not pull user back down when reading older messages and shows Tin nhắn mới ↓ pill', async () => {
    jest.useFakeTimers();
    jest.mocked(getConversation).mockResolvedValue({
      id: 'sup-2',
      customerUserId: 'c1',
      assignedSupportUserId: 'sup-agent',
      status: 'SUPPORT_ACTIVE',
      contextType: 'ORDER',
      contextId: 'ord-2',
      title: 'Hội thoại dài',
    });
    jest.mocked(listConversationMessages).mockResolvedValue([
      {
        id: 'm1',
        conversationId: 'sup-2',
        senderType: 'SUPPORT',
        content: 'Tin nhắn cũ 1',
        serverSequence: 1,
        createdAt: '2026-10-01T00:00:00Z',
      } as never,
    ]);

    await render(
      <ConversationThreadScreen
        conversationId="sup-2"
        onBack={jest.fn()}
        onCreateFollowUp={jest.fn()}
        onOpenDocument={jest.fn()}
        onOpenProduct={jest.fn()}
      />,
    );

    const list = await screen.findByText('Tin nhắn cũ 1');
    expect(list).toBeOnTheScreen();

    // Simulate user scrolling up to read an earlier answer.
    const flatList = screen.getByTestId('thread-message-list');
    await act(async () => {
      fireEvent.scroll(flatList, {
        nativeEvent: {
          contentOffset: { y: 0, x: 0 },
          contentSize: { height: 1200, width: 360 },
          layoutMeasurement: { height: 400, width: 360 },
        },
      });
    });

    jest.mocked(listConversationMessages).mockResolvedValue([
      {
        id: 'm1',
        conversationId: 'sup-2',
        senderType: 'SUPPORT',
        content: 'Tin nhắn cũ 1',
        serverSequence: 1,
        createdAt: '2026-10-01T00:00:00Z',
      } as never,
      {
        id: 'm2',
        conversationId: 'sup-2',
        senderType: 'SUPPORT',
        content: 'Tin nhắn mới đến khi đang đọc phía trên',
        serverSequence: 2,
        createdAt: '2026-10-01T00:01:00Z',
      } as never,
    ]);

    await act(async () => {
      jest.advanceTimersByTime(5_100);
    });

    expect(await screen.findByText('Tin nhắn mới ↓')).toBeOnTheScreen();
    jest.useRealTimers();
  });

  it('retries the exact failed operation on NotificationsScreen (initial, refresh without cursor, and loadMore)', async () => {
    jest.mocked(restoreSession).mockResolvedValue({
      accessToken: 'tok',
      refreshToken: 'ref',
      user: {
        id: 'c-notif',
        email: 'c@emukey.app',
        displayName: 'C',
        role: 'CUSTOMER',
        status: 'ACTIVE',
      },
    });
    jest.mocked(markNotificationRead).mockResolvedValue({
      id: 'n1',
      title: 'Thông báo 1',
      content: 'Nội dung 1',
      isRead: true,
    });
    jest
      .mocked(listNotifications)
      // 1. Initial load fails
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      // 2. Retry initial succeeds with cursor
      .mockResolvedValueOnce({
        items: [{ id: 'n1', title: 'Thông báo 1', content: 'Nội dung 1', isRead: false }],
        nextCursor: 'cur-2',
        unreadCount: 1,
      })
      // 3. loadMore fails
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      // 4. Retry loadMore succeeds, nextCursor becomes null
      .mockResolvedValueOnce({
        items: [{ id: 'n2', title: 'Thông báo 2', content: 'Nội dung 2', isRead: true }],
        nextCursor: null,
        unreadCount: 1,
      })
      // 5. Refresh fails while nextCursor is null
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      // 6. Retry refresh succeeds (must call listNotifications() without cursor!)
      .mockResolvedValueOnce({
        items: [{ id: 'n1', title: 'Thông báo 1', content: 'Nội dung 1', isRead: false }],
        nextCursor: null,
        unreadCount: 1,
      });

    await render(
      <CustomerSessionProvider>
        <NotificationProvider>
          <NotificationsScreen onOpenTarget={jest.fn()} />
        </NotificationProvider>
      </CustomerSessionProvider>,
    );

    // 1 -> 2: Initial error retry
    await act(async () => fireEvent.press(await screen.findByText('Thử lại')));
    expect(await screen.findByText('Thông báo 1')).toBeOnTheScreen();

    // 3 -> 4: LoadMore error retry
    await act(async () => fireEvent.press(screen.getByText('Tải thêm thông báo')));
    expect(await screen.findByText(/Không thể tải thêm thông báo|Kiểm tra kết nối/)).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Thử lại')));
    expect(await screen.findByText('Thông báo 2')).toBeOnTheScreen();

    // 5 -> 6: Refresh fails when nextCursor is null -> retry calls listNotifications() without cursor
    const callsBeforeRefresh = jest.mocked(listNotifications).mock.calls.length;
    const flatList = screen.getByTestId('notifications-list');
    await act(async () => {
      await flatList.props.refreshControl.props.onRefresh();
    });
    expect(await screen.findByText('Thông báo 1')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Thử lại')));
    await waitFor(() =>
      expect(jest.mocked(listNotifications).mock.calls.length).toBeGreaterThan(
        callsBeforeRefresh + 1,
      ),
    );
    const lastCall = jest.mocked(listNotifications).mock.calls.at(-1);
    expect(lastCall).toEqual([]);
  });

  it('validates empty displayName and guards unsaved changes on ProfileScreen and CreateSupportRequestScreen', async () => {
    const profile = {
      id: 'c1',
      email: 'c@emukey.app',
      displayName: 'Buyer',
      phone: '',
      address: '',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    };
    jest.mocked(getProfile).mockResolvedValue(profile);
    const onBackProfile = jest.fn();

    await render(
      <NavHarness
        element={<ProfileScreen onBack={onBackProfile} onProfileUpdated={jest.fn()} />}
      />,
    );
    const nameInput = await screen.findByLabelText('Tên hiển thị');
    await act(async () => fireEvent.changeText(nameInput, ''));
    expect(screen.getByText('Tên hiển thị không được để trống.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();

    await act(async () => fireEvent.press(screen.getByLabelText('Quay lại')));
    expect(await screen.findByText('Bỏ thay đổi chưa lưu?')).toBeOnTheScreen();
    expect(onBackProfile).not.toHaveBeenCalled();

    // Cancel keeps edits & stays on screen
    await act(async () => fireEvent.press(screen.getByText('Tiếp tục chỉnh sửa')));
    expect(screen.queryByText('Bỏ thay đổi chưa lưu?')).toBeNull();
    expect(onBackProfile).not.toHaveBeenCalled();

    // Pressing back again prompts again, confirming calls onBack once
    await act(async () => fireEvent.press(screen.getByLabelText('Quay lại')));
    expect(await screen.findByText('Bỏ thay đổi chưa lưu?')).toBeOnTheScreen();
    await act(async () => fireEvent.press(screen.getByText('Bỏ thay đổi')));
    await waitFor(() => expect(onBackProfile).toHaveBeenCalledTimes(1));

    const onBackSupport = jest.fn();
    await render(
      <NavHarness
        element={<CreateSupportRequestScreen onBack={onBackSupport} onCreated={jest.fn()} />}
      />,
    );
    const descInput = screen.getByLabelText('Mô tả vấn đề');
    await act(async () => fireEvent(descInput, 'blur'));
    expect(screen.getByText('Vui lòng nhập mô tả vấn đề cần hỗ trợ.')).toBeOnTheScreen();

    await act(async () => fireEvent.changeText(descInput, 'Chưa nhận được mã'));
    await act(async () => fireEvent.press(screen.getByLabelText('Quay lại')));
    expect(await screen.findByText('Bỏ nội dung chưa gửi?')).toBeOnTheScreen();
    expect(onBackSupport).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText('Rời màn hình')));
    await waitFor(() => expect(onBackSupport).toHaveBeenCalledTimes(1));
  });

  it('does not attach BackHandler on ProfileScreen or CreateSupportRequestScreen when unfocused', async () => {
    const profile = {
      id: 'c1',
      email: 'c@emukey.app',
      displayName: 'Buyer',
      phone: '',
      address: '',
      role: 'CUSTOMER',
      status: 'ACTIVE',
    };
    jest.mocked(getProfile).mockResolvedValue(profile);
    const removeFn = jest.fn();
    const backSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove: removeFn } as never);

    const profileView = await render(
      <NavHarness
        element={<ProfileScreen isFocused onBack={jest.fn()} onProfileUpdated={jest.fn()} />}
      />,
    );
    const nameInput = await screen.findByLabelText('Tên hiển thị');
    backSpy.mockClear();
    removeFn.mockClear();

    await act(async () => fireEvent.changeText(nameInput, 'Buyer Edited'));
    expect(backSpy).toHaveBeenCalledTimes(1);

    await profileView.rerender(
      <NavHarness
        element={
          <ProfileScreen isFocused={false} onBack={jest.fn()} onProfileUpdated={jest.fn()} />
        }
      />,
    );
    expect(removeFn).toHaveBeenCalledTimes(1);

    const supportView = await render(
      <NavHarness
        element={
          <CreateSupportRequestScreen
            isFocused={false}
            onBack={jest.fn()}
            onCreated={jest.fn()}
          />
        }
      />,
    );
    backSpy.mockClear();
    removeFn.mockClear();

    await act(async () =>
      fireEvent.changeText(screen.getByLabelText('Mô tả vấn đề'), 'Nháp chưa gửi'),
    );
    expect(backSpy).not.toHaveBeenCalled();

    await supportView.rerender(
      <NavHarness
        element={<CreateSupportRequestScreen isFocused onBack={jest.fn()} onCreated={jest.fn()} />}
      />,
    );
    expect(backSpy).toHaveBeenCalledTimes(1);
    backSpy.mockRestore();
  });
});
