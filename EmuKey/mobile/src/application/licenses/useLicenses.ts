import { NavigationContext } from '@react-navigation/native';
import { useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  getLicense,
  listDevices,
  listLicenses,
  loadActivationKey,
  requestLicensingActionVerification,
  retrieveActivationKey,
  updateDeviceMetadata,
  type MobileDevice,
  type MobileLicense,
} from '../../infrastructure/api/client';
import { describeRequestError } from '../requestError';
import { activationKeyErrorLabel } from './licensePresentation';

export function useLicensesList() {
  const [licenses, setLicenses] = useState<MobileLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const hasLoadedRef = useRef(false);

  const load = useCallback(async (isRefresh = false) => {
    const gen = ++generationRef.current;
    if (isRefresh) {
      setRefreshing(true);
      setRefreshError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    try {
      const items = await listLicenses();
      if (gen !== generationRef.current) return;
      hasLoadedRef.current = true;
      setLicenses(items);
      setError(null);
      setRefreshError(null);
    } catch (cause) {
      if (gen !== generationRef.current) return;
      const message = describeRequestError(cause, 'Không thể tải danh sách bản quyền.');
      if (isRefresh && hasLoadedRef.current) {
        setRefreshError(message);
      } else {
        setError(message);
      }
    } finally {
      if (gen === generationRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load(true);
    });
    return () => sub?.remove?.();
  }, [load]);

  return {
    licenses,
    loading,
    refreshing,
    error,
    refreshError,
    reload: () => load(false),
    refresh: () => load(true),
  };
}

export function useLicenseDetail(licenseId: string) {
  const [license, setLicense] = useState<MobileLicense | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [sendingAction, setSendingAction] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const licenseRef = useRef<MobileLicense | null>(null);

  useEffect(() => {
    licenseRef.current = null;
    setLicense(null);
    setError(null);
    setRefreshError(null);
  }, [licenseId]);

  const load = useCallback(
    async (isRefresh = false) => {
      const gen = ++generationRef.current;
      const hasExisting = Boolean(licenseRef.current);
      if (isRefresh && hasExisting) {
        setRefreshError(null);
      } else {
        setLoading(true);
        setError(null);
      }
      try {
        const data = await getLicense(licenseId);
        if (gen !== generationRef.current) return;
        licenseRef.current = data;
        setLicense(data);
        setError(null);
        setRefreshError(null);
      } catch (cause) {
        if (gen !== generationRef.current) return;
        const message = describeRequestError(
          cause,
          'Không thể tải thông tin bản quyền. Vui lòng thử lại.',
          {
            notFound: 'Không tìm thấy bản quyền.',
            forbidden: 'Bạn không có quyền truy cập bản quyền này.',
          },
        );
        if (hasExisting) {
          setRefreshError(message);
        } else {
          setError(message);
        }
      } finally {
        if (gen === generationRef.current) setLoading(false);
      }
    },
    [licenseId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load(true);
    });
    return () => sub?.remove?.();
  }, [load]);

  const sendEmailAction = useCallback(
    async (
      action: 'KEY_RECOVERY' | 'ROTATE_KEY' | 'REMOTE_REVOKE_DEVICE',
      deviceId?: string,
    ) => {
      if (sendingAction) return false;
      setSendingAction(true);
      setActionError(null);
      setActionMessage(null);
      try {
        await requestLicensingActionVerification(licenseId, action, deviceId);
        setActionMessage(
          'Mở liên kết trong email để xác nhận trên web. Không cần chép token. Sau khi hoàn tất, quay lại ứng dụng để cập nhật đúng bản quyền.',
        );
        return true;
      } catch {
        setActionError('Không thể gửi email xác nhận. Kiểm tra trạng thái trước khi gửi lại.');
        return false;
      } finally {
        setSendingAction(false);
      }
    },
    [licenseId, sendingAction],
  );

  return {
    license,
    loading,
    error,
    refreshError,
    sendingAction,
    actionMessage,
    actionError,
    reload: () => load(Boolean(licenseRef.current)),
    sendEmailAction,
  };
}

export function useActivationKeyAccess(license: MobileLicense | null) {
  const navigation = useContext(NavigationContext);
  const [keyState, setKeyState] = useState<{ licenseId: string; version: number; value: string } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequest = useRef<number | null>(null);
  const nextRequest = useRef(0);
  const licenseId = license?.id;
  const keyVersion = license?.keyVersion;
  const trusted = license?.activationKeyTrustStatus === 'TRUSTED';

  useLayoutEffect(() => {
    setKeyState(null);
    setRevealed(false);
    setBusy(false);
    setError(null);
    return () => {
      activeRequest.current = null;
    };
  }, [licenseId, keyVersion, trusted]);

  // Hide plaintext when the app goes to the background or the screen loses focus.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setRevealed(false);
    });
    const unsubBlur = navigation?.addListener?.('blur', () => {
      setRevealed(false);
    });
    return () => {
      sub?.remove?.();
      unsubBlur?.();
    };
  }, [navigation]);

  const fetchOrLoad = useCallback(async () => {
    if (!licenseId || keyVersion === undefined || !trusted || activeRequest.current !== null) {
      return null;
    }
    const request = ++nextRequest.current;
    activeRequest.current = request;
    setBusy(true);
    setError(null);
    try {
      const stored = await loadActivationKey(licenseId, keyVersion);
      if (activeRequest.current !== request) return null;
      const value = stored ?? (await retrieveActivationKey(licenseId, keyVersion)).activationKey;
      if (activeRequest.current !== request) return null;
      setKeyState({ licenseId, version: keyVersion, value });
      return value;
    } catch (cause) {
      if (activeRequest.current === request) setError(activationKeyErrorLabel(cause));
      return null;
    } finally {
      if (activeRequest.current === request) {
        activeRequest.current = null;
        setBusy(false);
      }
    }
  }, [keyVersion, licenseId, trusted]);

  const validKey =
    trusted && keyState && keyState.licenseId === licenseId && keyState.version === keyVersion
      ? keyState.value
      : null;

  return {
    activationKey: validKey,
    revealed: Boolean(validKey) && revealed,
    setRevealed,
    busy,
    error,
    fetchOrLoad,
    clearFromMemory: () => {
      activeRequest.current = null;
      setBusy(false);
      setKeyState(null);
      setRevealed(false);
    },
  };
}

export function useLicenseDevicesList(licenseId: string, enabled: boolean) {
  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [savingDeviceId, setSavingDeviceId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    const gen = ++generationRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listDevices(licenseId);
      if (gen !== generationRef.current) return;
      setDevices(result);
    } catch (cause) {
      if (gen !== generationRef.current) return;
      setError(describeRequestError(cause, 'Không thể tải danh sách thiết bị.'));
    } finally {
      if (gen === generationRef.current) setLoading(false);
    }
  }, [enabled, licenseId]);

  useEffect(() => {
    if (enabled) {
      void load();
    } else {
      setDevices([]);
      setLoading(false);
    }
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => sub?.remove?.();
  }, [enabled, load]);

  const renameDevice = useCallback(
    async (deviceId: string, displayName: string): Promise<boolean> => {
      if (savingDeviceId) return false;
      setSavingDeviceId(deviceId);
      setSaveError(null);
      try {
        await updateDeviceMetadata(licenseId, deviceId, displayName.trim());
        await load();
        return true;
      } catch {
        setSaveError('Không thể lưu tên thiết bị.');
        return false;
      } finally {
        setSavingDeviceId(null);
      }
    },
    [licenseId, load, savingDeviceId],
  );

  return {
    devices,
    loading,
    error,
    savingDeviceId,
    saveError,
    reload: load,
    renameDevice,
  };
}
