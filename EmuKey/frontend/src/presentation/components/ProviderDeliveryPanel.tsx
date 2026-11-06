import { Alert, Button, Empty, Input, Modal, Select, Space, Table } from 'antd';
import { PageLoading } from './WorkspacePrimitives';
import { useState } from 'react';
import type { ProviderDeliveryViewDto } from '../../infrastructure/api/generated';
import {
  useProviderDeliveries,
  useRetryProviderDelivery,
} from '../../application/operations/operationsQueries';

export const providerDeliveryLabels: Record<string, string> = {
  PENDING: 'Đang chờ bàn giao',
  SENDING: 'Đang bàn giao',
  RETRY_WAIT: 'Chờ gửi lại',
  DELIVERED: 'Đã bàn giao',
  FAILED: 'Bàn giao lỗi',
  SUPERSEDED: 'Đã có phiên bản mới',
};

export function ProviderDeliveryPanel({
  scope,
  canRetry = false,
}: {
  readonly scope: 'provider' | 'operations';
  readonly canRetry?: boolean;
}) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const deliveries = useProviderDeliveries(scope, status, page);
  const retry = useRetryProviderDelivery(scope);
  return (
    <section aria-label="Bàn giao bản quyền">
      <h2>Bàn giao bản quyền</h2>
      <Space wrap>
        <Select
          aria-label="Trạng thái bàn giao"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setPage(0);
          }}
          options={[
            { value: '', label: 'Tất cả trạng thái' },
            ...Object.entries(providerDeliveryLabels).map(([value, label]) => ({
              value,
              label,
            })),
          ]}
        />
        <Button onClick={() => void deliveries.refetch()}>
          Tải lại bàn giao
        </Button>
      </Space>
      {deliveries.isError ? (
        <Alert type="error" title="Không thể tải lịch sử bàn giao" />
      ) : null}
      {deliveries.isPending ? <PageLoading label="Đang tải lịch sử bàn giao" /> : !deliveries.isError && !deliveries.data?.length ? (
        <Empty description="Chưa có bản quyền bàn giao." />
      ) : !deliveries.isError ? <Table<ProviderDeliveryViewDto>
        rowKey="id"
        loading={deliveries.isPending}
        dataSource={deliveries.data ?? []}
        pagination={false}
        scroll={{ x: 720 }}
        locale={{ emptyText: 'Chưa có bản quyền bàn giao.' }}
        columns={[
          { title: 'Bản quyền', dataIndex: 'licenseId', ellipsis: true },
          { title: 'Phiên bản', dataIndex: 'revision' },
          {
            title: 'Trạng thái',
            dataIndex: 'status',
            render: (value: string) => providerDeliveryLabels[value] ?? value,
          },
          { title: 'Lần gửi', dataIndex: 'attemptCount' },
          {
            title: 'Nhà cung cấp đã nhận',
            dataIndex: 'acceptedAt',
            render: (value: string | null) =>
              value ? new Date(value).toLocaleString('vi-VN') : 'Chưa xác nhận',
          },
          {
            title: 'Thao tác',
            render: (_, row) =>
              canRetry && ['FAILED', 'RETRY_WAIT'].includes(row.status) ? (
                <Button
                  onClick={() => {
                    setSelected(row.id);
                    setReason('');
                    retry.reset();
                  }}
                >
                  Gửi lại
                </Button>
              ) : null,
          },
        ]}
      /> : null}
      {!deliveries.isError && (page > 0 || Boolean(deliveries.data?.length)) ? <Space>
        <Button disabled={page === 0} onClick={() => setPage(page - 1)}>
          Trang trước
        </Button>
        <span>Trang {page + 1}</span>
        <Button
          disabled={(deliveries.data?.length ?? 0) < 50}
          onClick={() => setPage(page + 1)}
        >
          Trang sau
        </Button>
      </Space> : null}
      <Modal
        title="Gửi lại bản quyền"
        open={!!selected}
        confirmLoading={retry.isPending}
        okText="Xác nhận gửi lại"
        cancelText="Hủy"
        okButtonProps={{ disabled: reason.trim().length < 3 }}
        onCancel={() => !retry.isPending && setSelected(null)}
        onOk={() =>
          selected &&
          retry.mutate(
            { id: selected, reason: reason.trim() },
            { onSuccess: () => setSelected(null) },
          )
        }
      >
        <p>
          Gửi lại cùng bản quyền và mã đã phát hành, dùng cấu hình kết nối đã
          được kiểm tra.
        </p>
        <label htmlFor="provider-retry-reason">Lý do gửi lại</label>
        <Input.TextArea
          id="provider-retry-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={1000}
        />
        {retry.isError ? (
          <Alert
            type="error"
            title="Không thể gửi lại. Kiểm tra cấu hình hoặc tải lại trạng thái."
          />
        ) : null}
      </Modal>
    </section>
  );
}
