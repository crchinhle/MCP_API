import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result } from 'antd';

interface AppErrorBoundaryProps {
  readonly children: ReactNode;
}

interface AppErrorBoundaryState {
  readonly hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep render failures isolated without exposing stack traces to users.
    console.error('EmuKey render failure', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Result
        status="error"
        title="Không thể hiển thị trang"
        subTitle="Đã xảy ra lỗi giao diện. Bạn có thể tải lại hoặc quay về trang chủ."
        extra={[
          <Button key="reload" type="primary" onClick={() => window.location.reload()}>Tải lại trang</Button>,
          <Button key="retry" onClick={this.reset}>Thử hiển thị lại</Button>,
          <Button key="home" href="/">Về trang chủ</Button>,
        ]}
      />
    );
  }
}
