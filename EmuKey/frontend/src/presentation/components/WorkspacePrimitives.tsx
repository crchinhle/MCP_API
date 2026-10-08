import type { ReactNode } from 'react';
import { useEffect, useId, useSyncExternalStore } from 'react';
import { Modal, Spin } from 'antd';

import type { MetricRecord, StatusTone } from '../../domain/workspace';

const pendingOverlays = new Set<string>();
const overlayListeners = new Set<() => void>();
const subscribeToOverlays = (listener: () => void) => {
  overlayListeners.add(listener);
  return () => { overlayListeners.delete(listener); };
};
const firstOverlay = () => pendingOverlays.values().next().value ?? '';
const notifyOverlays = () => { overlayListeners.forEach((listener) => listener()); };

export function LoadingOverlay({ active = true, label = 'Đang xử lý yêu cầu' }: {
  readonly active?: boolean;
  readonly label?: string;
}) {
  const id = useId();
  const visibleId = useSyncExternalStore(subscribeToOverlays, firstOverlay, () => '');
  useEffect(() => {
    if (!active) return;
    // Avoid flashing a dialog for fast requests; concurrent requests share one dialog.
    const timer = window.setTimeout(() => { pendingOverlays.add(id); notifyOverlays(); }, 200);
    return () => {
      window.clearTimeout(timer);
      pendingOverlays.delete(id);
      notifyOverlays();
    };
  }, [active, id]);
  return <Modal centered open={active && visibleId === id} title={label} footer={null}
    closable={false} keyboard={false} mask={{ closable: false }} zIndex={2000} width={420}>
    <div className="payment-processing" role="status" aria-live="polite" aria-busy="true">
      <Spin size="large" />
      <p>Vui lòng chờ trong giây lát.</p>
    </div>
  </Modal>;
}

export function PageLoading({ label = 'Đang tải nội dung' }: { readonly label?: string }) {
  return (
    <div className="page-loading-state" role="status" aria-label={label} aria-busy="true">
      <div className="page-loading-indicator">
        <Spin size="large" />
        <p>{label}</p>
      </div>
    </div>
  );
}

export function formatMoney(value: number): string {
  return `${new Intl.NumberFormat('vi-VN').format(value)} ₫`;
}

interface PageHeaderProps {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="workspace-page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function StatusChip({
  children,
  tone = 'neutral',
}: {
  readonly children: ReactNode;
  readonly tone?: StatusTone;
}) {
  return <span className={`status-chip status-chip--${tone}`}>{children}</span>;
}

export function MetricCard({ metric }: { readonly metric: MetricRecord }) {
  return (
    <article className="metric-card">
      <StatusChip tone={metric.tone}>{metric.label}</StatusChip>
      <strong>{metric.value}</strong>
      {metric.helper ? <small>{metric.helper}</small> : null}
    </article>
  );
}

export function FactList({
  facts,
}: {
  readonly facts: readonly {
    readonly label: string;
    readonly value: ReactNode;
  }[];
}) {
  return (
    <dl className="fact-list">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProgressList({
  items,
}: {
  readonly items: readonly {
    readonly label: string;
    readonly status: string;
    readonly tone: StatusTone;
  }[];
}) {
  return (
    <ol className="progress-list">
      {items.map((item) => (
        <li key={item.label}>
          <StatusChip tone={item.tone}>{item.status}</StatusChip>
          <span>{item.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function EmptyState({ message }: { readonly message: string }) {
  return (
    <div className="empty-state" role="status">
      <strong>Không có dữ liệu</strong>
      <p>{message}</p>
    </div>
  );
}
