import { Alert, Button, Checkbox, Form, Input, Space, Tag } from 'antd';
import { useState } from 'react';
import {
  useProviderIntegration,
  useUpdateProviderIntegration,
} from '../../application/operations/operationsQueries';
import { ProviderDeliveryPanel } from './ProviderDeliveryPanel';

export function ProviderIntegrationPanel() {
  const integration = useProviderIntegration();
  const update = useUpdateProviderIntegration();
  const [url, setUrl] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const config = integration.data;
  const busy = update.isPending;
  if (integration.isPending)
    return <p role="status">Đang tải cấu hình tích hợp…</p>;
  if (integration.isError)
    return (
      <Alert
        type="error"
        title="Không thể tải cấu hình tích hợp"
        action={
          <Button onClick={() => void integration.refetch()}>Thử lại</Button>
        }
      />
    );
  return (
    <section className="workspace-card" aria-label="Tích hợp nhà cung cấp">
      <h2>Kết nối hệ thống nhận bản quyền</h2>
      <p>
        EmuKey phát hành và tự động gửi mã bản quyền đến máy chủ của bạn sau
        thanh toán. Hệ thống của bạn lưu mã hợp lệ và kiểm tra khi khách sử dụng
        sản phẩm.
      </p>
      <Tag color={config?.status === 'ENABLED' ? 'green' : 'default'}>
        {config?.status === 'ENABLED' ? 'Đang bật' : 'Chưa bật tiếp nhận'}
      </Tag>
      {config?.verifiedAt ? (
        <p>
          Kết nối đã kiểm tra:{' '}
          {new Date(config.verifiedAt).toLocaleString('vi-VN')}
        </p>
      ) : (
        <p>Lưu cấu hình, kiểm tra kết nối rồi bật tiếp nhận để bắt đầu bán.</p>
      )}
      <Form
        layout="vertical"
        onFinish={() =>
          update.mutate(
            {
              action: 'save',
              input: {
                endpointUrl: url ?? config?.endpointUrl ?? '',
                ...(token ? { token } : {}),
                configVersion: config?.configVersion ?? 0,
                authorized,
              },
            },
            {
              onSuccess: () => {
                setToken('');
                setUrl(null);
                setAuthorized(false);
              },
            },
          )
        }
      >
        <Form.Item label="URL nhận bản quyền" htmlFor="provider-endpoint">
          <Input
            id="provider-endpoint"
            value={url ?? config?.endpointUrl ?? ''}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://your-service.example/emukey/receive"
            maxLength={2048}
          />
        </Form.Item>
        <Form.Item
          label="Token kết nối"
          htmlFor="provider-token"
          extra={
            config?.hasCredential
              ? 'Đã lưu token. Để trống nếu giữ nguyên; nhập token mới khi thay đổi.'
              : 'Token máy chủ của bạn chấp nhận khi EmuKey gửi dữ liệu.'
          }
        >
          <Input.Password
            id="provider-token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="new-password"
            maxLength={512}
          />
        </Form.Item>
        <Form.Item>
          <Checkbox
            checked={authorized}
            onChange={(event) => setAuthorized(event.target.checked)}
          >
            Tôi ủy quyền EmuKey phát hành và bàn giao bản quyền cho sản phẩm của
            mình.
          </Checkbox>
        </Form.Item>
        <Space wrap>
          <Button
            type="primary"
            htmlType="submit"
            loading={busy}
            disabled={
              !authorized ||
              !(url ?? config?.endpointUrl) ||
              (!config?.hasCredential && token.length < 24)
            }
          >
            Lưu cấu hình
          </Button>
          <Button
            disabled={!config?.configVersion || busy}
            onClick={() => update.mutate({ action: 'test' })}
          >
            Kiểm tra kết nối
          </Button>
          <Button
            disabled={
              !config?.configVersion ||
              busy ||
              (config.status !== 'ENABLED' && !config.verifiedAt)
            }
            onClick={() =>
              config &&
              update.mutate({
                action: config.status === 'ENABLED' ? 'DISABLE' : 'ENABLE',
                input: { configVersion: config.configVersion },
              })
            }
          >
            {config?.status === 'ENABLED' ? 'Tắt tiếp nhận' : 'Bật tiếp nhận'}
          </Button>
        </Space>
      </Form>
      {update.isError ? (
        <Alert
          type="error"
          title="Không thể cập nhật tích hợp"
          description="Kiểm tra URL, token và kết quả kết nối hiện tại. Nếu cấu hình đã thay đổi, tải lại trước khi thử lại."
        />
      ) : null}
      {update.isSuccess ? (
        <p role="status">Đã cập nhật trạng thái tích hợp.</p>
      ) : null}
      <ProviderDeliveryPanel scope="provider" canRetry />
    </section>
  );
}
