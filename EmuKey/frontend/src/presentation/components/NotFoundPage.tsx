import { Button, Result } from 'antd';

export function NotFoundPage() {
  return (
    <Result
      status="404"
      title="Không tìm thấy trang"
      subTitle="Đường dẫn này không tồn tại hoặc đã được thay đổi."
      extra={[
        <Button key="home" type="primary" href="/">Về trang chủ</Button>,
        <Button key="back" onClick={() => window.history.back()}>Quay lại</Button>,
      ]}
    />
  );
}
