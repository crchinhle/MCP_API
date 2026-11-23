import { useState } from 'react';

import {
  conversationContextLabels,
  useCreateSupportRequest,
  type SupportContextType,
} from '../../../application/assistance/useSupportRequests';
import { useUnsavedChangesGuard } from '../../../application/navigation/useUnsavedChangesGuard';
import { AppHeader } from '../../components/layout/AppHeader';
import { Screen } from '../../components/layout/Screen';
import { AppButton } from '../../components/ui/AppButton';
import { AppText } from '../../components/ui/AppText';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { FormField } from '../../components/ui/FormField';
import { InlineNotice } from '../../components/ui/InlineNotice';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

export interface CreateSupportRequestScreenProps {
  readonly contextType?: SupportContextType;
  readonly contextId?: string;
  readonly contextLabel?: string;
  readonly initialTitle?: string;
  readonly isFocused?: boolean;
  readonly onBack: () => void;
  readonly onCreated: (conversationId: string) => void;
}

export function CreateSupportRequestScreen({
  contextType = 'GENERAL',
  contextId,
  contextLabel,
  initialTitle = '',
  isFocused,
  onBack,
  onCreated,
}: CreateSupportRequestScreenProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState('');
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const { pending, error, submit } = useCreateSupportRequest();

  const dirty =
    title.trim() !== initialTitle.trim() || description.trim().length > 0;
  const descriptionError =
    descriptionTouched && !description.trim()
      ? 'Vui lòng nhập mô tả vấn đề cần hỗ trợ.'
      : null;

  const canSubmit =
    Boolean(description.trim()) && description.trim().length <= 8000 && !pending;

  const { cancelDiscard, confirmDiscard } = useUnsavedChangesGuard({
    enabled: Boolean(dirty),
    isFocused,
    onBack,
    onRequestDiscard: () => setConfirmDiscardOpen(true),
    onBlurReset: () => setConfirmDiscardOpen(false),
  });

  const handleBackPress = () => {
    if (dirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    onBack();
  };

  const handleSubmit = async () => {
    setDescriptionTouched(true);
    if (!canSubmit) return;
    const created = await submit({
      title,
      description,
      contextType,
      contextId,
    });
    if (created) {
      onCreated(created.id);
    }
  };

  return (
    <Screen
      edges={['bottom']}
      header={<AppHeader onBack={handleBackPress} title="Tạo yêu cầu hỗ trợ" />}
      keyboardAware
    >
      {contextType !== 'GENERAL' ? (
        <SurfaceCard>
          <AppText tone="muted" variant="secondarySemibold">
            Ngữ cảnh liên quan
          </AppText>
          <AppText variant="bodySemibold">
            {conversationContextLabels[contextType] ?? contextType}
            {contextLabel ? `: ${contextLabel}` : ''}
          </AppText>
        </SurfaceCard>
      ) : null}

      <SurfaceCard>
        <FormField
          editable={!pending}
          label="Chủ đề (không bắt buộc)"
          maxLength={255}
          onChangeText={setTitle}
          placeholder="Ví dụ: Cần hỗ trợ thanh toán hoặc kích hoạt"
          value={title}
        />

        <FormField
          editable={!pending}
          errorText={descriptionError}
          helperText={`${description.length}/8000 ký tự`}
          label="Mô tả vấn đề"
          maxLength={8000}
          multiline
          onBlur={() => setDescriptionTouched(true)}
          onChangeText={(next) => {
            setDescriptionTouched(true);
            setDescription(next);
          }}
          placeholder="Mô tả chi tiết vấn đề bạn đang gặp..."
          required
          value={description}
        />

        {error ? <InlineNotice message={error} tone="error" /> : null}

        <AppButton
          disabled={!canSubmit}
          fullWidth
          icon="send"
          label="Gửi yêu cầu hỗ trợ"
          loading={pending}
          onPress={() => void handleSubmit()}
          size="large"
        />
      </SurfaceCard>

      <ConfirmDialog
        body="Nội dung yêu cầu hỗ trợ chưa được gửi. Rời màn hình sẽ xóa nội dung đã nhập."
        cancelLabel="Tiếp tục nhập"
        confirmLabel="Rời màn hình"
        danger
        onCancel={() => {
          setConfirmDiscardOpen(false);
          cancelDiscard();
        }}
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          confirmDiscard();
        }}
        pending={pending}
        title="Bỏ nội dung chưa gửi?"
        visible={confirmDiscardOpen}
      />
    </Screen>
  );
}
