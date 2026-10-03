import { Result, Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';

export function ForbiddenPage() {
  return (
    <Result
      status="403"
      icon={<LockOutlined />}
      title="Không có quyền truy cập"
      subTitle="Bạn không có quyền thực hiện thao tác này hoặc truy cập nội dung yêu cầu."
      extra={[
        <Button key="home" type="primary" href="/">Về trang chủ</Button>,
        <Button key="back" onClick={() => window.history.back()}>Quay lại</Button>,
      ]}
    />
  );
}
