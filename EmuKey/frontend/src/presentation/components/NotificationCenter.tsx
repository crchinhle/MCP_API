import { Fragment } from 'react';
import { LoadingOverlay } from './WorkspacePrimitives';
import { BellOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Empty, List, Popover } from 'antd';
import { useMarkNotificationRead, useNotifications } from '../../application/notifications/notificationQueries';

export function NotificationCenter() {
  const notifications = useNotifications();
  const markRead = useMarkNotificationRead();
  const pages = notifications.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const unread = items.filter((item) => !item.isRead).length;

  const content = notifications.isLoading ? <LoadingOverlay /> : notifications.isError ? (
    <div className="notification-popover-error">
      <p>Không thể tải thông báo.</p>
      <Button size="small" onClick={() => void notifications.refetch()}>Thử lại</Button>
    </div>
  ) : items.length ? (
    <>
      <List
        className="notification-list"
        dataSource={items}
        locale={{ emptyText: <Empty description="Chưa có thông báo" /> }}
        renderItem={(item) => (
          <List.Item
            {...(!item.isRead ? { actions: [<Fragment key="read"><Button key="read" size="small" type="link" disabled={markRead.isPending && markRead.variables === item.id} onClick={() => markRead.mutate(item.id)}>Đã đọc</Button><LoadingOverlay active={markRead.isPending && markRead.variables === item.id} label="Đang xử lý yêu cầu: Đã đọc" /></Fragment>] } : {})}
          >
            <List.Item.Meta description={item.content} title={item.title} />
          </List.Item>
        )}
      />
      {markRead.isError ? <Alert role="alert" type="error" message="Không thể đánh dấu đã đọc. Vui lòng thử lại." /> : null}
      {notifications.hasNextPage ? <><Button disabled={notifications.isFetchingNextPage} type="link" onClick={() => void notifications.fetchNextPage()}>Xem thêm thông báo</Button><LoadingOverlay active={notifications.isFetchingNextPage} label="Đang xử lý yêu cầu: Xem thêm thông báo" /></> : null}
    </>
  ) : <Empty description="Chưa có thông báo" />;

  return (
    <div className="notification-wrapper">
      <Popover content={<div className="notification-popover">{content}</div>} placement="bottomRight" trigger="click">
        <Badge count={unread} overflowCount={99} size="small">
          <Button aria-label="Thông báo" icon={<BellOutlined />} type="default" />
        </Badge>
      </Popover>
    </div>
  );
}
