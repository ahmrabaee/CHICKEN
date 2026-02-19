import { useState, useCallback, useRef } from 'react';
import {
  fetchPdfBlob,
  downloadPdfBlob,
  createPdfObjectUrl,
  revokePdfObjectUrl,
  getPdfFilename,
  type PdfQueryParams,
} from '@/services/pdf.service';

type PdfParams = PdfQueryParams & { id?: number; accountCode?: string };

export function usePdfDownload() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const previewUrlRef = useRef<string | null>(null);

  const fetchAndPreview = useCallback(
    async (type: string, params: PdfParams): Promise<string | null> => {
      setIsLoading(true);
      setError(null);
      if (previewUrlRef.current) {
        revokePdfObjectUrl(previewUrlRef.current);
        previewUrlRef.current = null;
        setPreviewUrl(null);
      }
      try {
        const blob = await fetchPdfBlob(type, params);
        const url = createPdfObjectUrl(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        return url;
      } catch (e: unknown) {
        let msg = 'فشل تحميل ملف PDF';
        if (e && typeof e === 'object' && 'response' in e) {
          const err = e as { response?: { status?: number }; message?: string };
          if (err.response?.status === 401) msg = 'انتهت الجلسة — سجّل الدخول مرة أخرى';
          else if (err.response?.status) msg = `خطأ من الخادم (${err.response.status})`;
        } else if (e instanceof Error) {
          if (e.message?.includes('Network') || e.message?.includes('CORS')) msg = 'خطأ في الاتصال — تحقق من الـ Backend و CORS';
          else msg = e.message;
        }
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const download = useCallback(
    async (type: string, params: PdfParams, filename?: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const blob = await fetchPdfBlob(type, params);
        const name = filename || getPdfFilename(type, params);
        downloadPdfBlob(blob, name);
      } catch (e: unknown) {
        let msg = 'فشل تحميل ملف PDF';
        if (e && typeof e === 'object' && 'response' in e) {
          const err = e as { response?: { status?: number } };
          if (err.response?.status === 401) msg = 'انتهت الجلسة — سجّل الدخول مرة أخرى';
        } else if (e instanceof Error) msg = e.message;
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      revokePdfObjectUrl(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(null);
    }
    setError(null);
  }, []);

  return {
    fetchAndPreview,
    download,
    clearPreview,
    previewUrl,
    isLoading,
    error,
  };
}
