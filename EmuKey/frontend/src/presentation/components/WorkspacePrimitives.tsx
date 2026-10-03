import type { ReactNode } from 'react';

import type { MetricRecord, StatusTone } from '../../domain/workspace';

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
