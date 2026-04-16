"use client";

import { useCallback, useEffect, useState, useRef } from 'react';
import { useLineageStore } from '@/stores/lineageStore';
import { useLocale } from '@/i18n/useLocale';
import styles from './FileDropZone.module.css';

/** プレースホルダ {key} を文字列で置換する小さなヘルパ */
function format(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`
  );
}

export interface FileContent {
  fileName: string;
  content: string;
}

export interface FileDropZoneProps {
  onFilesLoaded: (contents: FileContent[]) => void;
}

/**
 * ファイルドラッグ&ドロップによるSQL読み込みゾーン。
 *
 * 対応機能要件: F1-1 (SQL入力)
 * 設計参照: doc/design/component-design.md セクション2.3
 *
 * 責務:
 * - .sql ファイルのD&D受付
 * - 複数ファイルの同時読み込み
 * - ファイル拡張子バリデーション（.sql のみ受付）
 * - 読み込み済みファイルのリスト表示
 * - ファイル個別の削除
 */
export function FileDropZone({ onFilesLoaded }: FileDropZoneProps) {
  const [files, setFiles] = useState<FileContent[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resetCounter = useLineageStore((s) => s.resetCounter);
  const { t } = useLocale();

  // lineageStore.resetAll() が呼ばれたらファイルリストとエラーをクリア
  useEffect(() => {
    setFiles([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [resetCounter]);

  const readFiles = useCallback(async (fileList: FileList | File[]): Promise<FileContent[]> => {
    const sqlFiles: File[] = [];
    const invalidFiles: string[] = [];

    for (const file of Array.from(fileList)) {
      if (file.name.toLowerCase().endsWith('.sql')) {
        sqlFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    }

    if (invalidFiles.length > 0) {
      setError(format(t.error.invalidFileType, { files: invalidFiles.join(', ') }));
    } else {
      setError(null);
    }

    const contents = await Promise.all(
      sqlFiles.map(
        (file) =>
          new Promise<FileContent>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({ fileName: file.name, content: String(reader.result ?? '') });
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          })
      )
    );

    return contents;
  }, [t]);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      try {
        const contents = await readFiles(fileList);
        if (contents.length === 0) return;
        const updated = [...files, ...contents];
        setFiles(updated);
        // 現在のファイルリスト全体を親に通知
        onFilesLoaded(updated);
      } catch (e) {
        const message = e instanceof Error ? e.message : t.error.unknownError;
        setError(format(t.error.fileReadFailedDetail, { message }));
      }
    },
    [files, readFiles, onFilesLoaded, t]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
      // 同じファイルを再選択できるようにリセット
      e.target.value = '';
    },
    [handleFiles]
  );

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // 削除後の最新ファイルリストを親に通知。
      // setFiles コールバック内で親の setState を呼ぶと
      // "Cannot update a component while rendering" エラーになるため、
      // queueMicrotask で次のマイクロタスクに遅延する。
      queueMicrotask(() => onFilesLoaded(updated));
      return updated;
    });
  }, [onFilesLoaded]);

  const handleClickZone = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClickZone();
      }
    },
    [handleClickZone]
  );

  return (
    <div className={styles.container}>
      <div
        className={`${styles.dropZone} ${isDragging ? styles.dragging : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickZone}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={t.panel.fileDropAriaLabel}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".sql"
          multiple
          onChange={handleFileInputChange}
          className={styles.hiddenInput}
          aria-hidden="true"
        />
        <span className={styles.dropText}>
          {isDragging ? t.panel.fileDropDragging : t.panel.fileDropPlaceholder}
        </span>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}

      {files.length > 0 && (
        <ul className={styles.fileList}>
          {files.map((file, index) => (
            <li key={`${file.fileName}-${index}`} className={styles.fileItem}>
              <span className={styles.fileName} title={file.fileName}>
                {file.fileName}
              </span>
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => handleRemoveFile(index)}
                aria-label={format(t.panel.removeFileAriaLabel, { fileName: file.fileName })}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
