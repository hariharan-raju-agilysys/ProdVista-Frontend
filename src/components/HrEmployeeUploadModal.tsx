import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Download, Upload, Link, CheckCircle, AlertCircle, Loader2, Users, ChevronDown, ChevronUp } from 'lucide-react';
import {
  EmployeeField,
  EmployeeUploadResult,
  SyncAppUsersResult,
  getEmployeeFields,
  downloadExcelTemplate,
  uploadEmployeeExcel,
  uploadEmployeeExcelFromUrl,
  syncEmployeesFromAppUsers,
} from '../services/hrPortalService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  connectionId?: string;
  userRole?: string;
}

type UploadMode = 'file' | 'url';
type Step = 1 | 2 | 3;

const REQUIRED_FIELDS = ['EmployeeId', 'Name'];

export default function HrEmployeeUploadModal({ isOpen, onClose, connectionId, userRole }: Props) {
  const isAdmin = userRole === 'Admin';

  // Step state
  const [step, setStep] = useState<Step>(1);

  // Step 1 — Field selection
  const [fields, setFields] = useState<EmployeeField[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([...REQUIRED_FIELDS]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Step 2 — Upload
  const [uploadMode, setUploadMode] = useState<UploadMode>('file');
  const [file, setFile] = useState<File | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 — Results
  const [uploadResult, setUploadResult] = useState<EmployeeUploadResult | null>(null);
  const [errorsExpanded, setErrorsExpanded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncAppUsersResult | null>(null);

  // Load fields on open
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setSelectedFields([...REQUIRED_FIELDS]);
    setFile(null);
    setUrlInput('');
    setUploadError(null);
    setUploadResult(null);
    setSyncResult(null);
    setErrorsExpanded(false);

    setLoadingFields(true);
    getEmployeeFields()
      .then(setFields)
      .catch(() => setFields([]))
      .finally(() => setLoadingFields(false));
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Field selection helpers ──────────────────────────────────────────────

  const toggleField = (f: string) => {
    if (REQUIRED_FIELDS.includes(f)) return; // cannot deselect required
    setSelectedFields(prev =>
      prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]
    );
  };

  const selectAll = () => setSelectedFields(fields.map(f => f.field));
  const clearAll = () => setSelectedFields([...REQUIRED_FIELDS]);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await downloadExcelTemplate(selectedFields);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // ── File drop ────────────────────────────────────────────────────────────

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith('.xlsx')) {
      setFile(dropped);
      setUploadError(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  // ── Upload ───────────────────────────────────────────────────────────────

  const handleUpload = async () => {
    setUploadError(null);
    setUploading(true);
    try {
      let result: EmployeeUploadResult;
      if (uploadMode === 'file') {
        if (!file) { setUploadError('Please select an Excel file.'); return; }
        result = await uploadEmployeeExcel(file, connectionId);
      } else {
        if (!urlInput.trim()) { setUploadError('Please enter a URL.'); return; }
        result = await uploadEmployeeExcelFromUrl(urlInput.trim(), connectionId);
      }
      setUploadResult(result);
      setStep(3);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data ?? err?.message ?? 'Upload failed.';
      setUploadError(typeof msg === 'string' ? msg : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // ── Sync App Users ───────────────────────────────────────────────────────

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncEmployeesFromAppUsers();
      setSyncResult(res);
    } catch (err: any) {
      setSyncResult({ synced: 0, linked: 0, message: 'Sync failed.' });
    } finally {
      setSyncing(false);
    }
  };

  // ── Step indicator ───────────────────────────────────────────────────────

  const steps: { n: Step; label: string }[] = [
    { n: 1, label: 'Select Fields' },
    { n: 2, label: 'Upload' },
    { n: 3, label: 'Results' },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Upload className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Upload Employees</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 px-5 py-3 border-b border-gray-100 flex-shrink-0">
          {steps.map(({ n, label }, idx) => (
            <React.Fragment key={n}>
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                  ${step > n ? 'bg-green-500 text-white' : step === n ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {step > n ? '✓' : n}
                </div>
                <span className={`text-xs font-medium ${step === n ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`flex-1 h-px mx-3 ${step > n ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ──────── STEP 1: Select Fields ──────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-600 mb-3">
                  Choose which columns to include in your Excel template. <strong>Employee ID</strong> and <strong>Name</strong> are always required.
                </p>
                {loadingFields ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    <span className="ml-2 text-xs text-gray-500">Loading fields…</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] text-gray-500">{selectedFields.length} of {fields.length} selected</span>
                      <div className="flex gap-2">
                        <button onClick={selectAll} className="text-[11px] text-blue-600 hover:underline">Select All</button>
                        <span className="text-gray-300">|</span>
                        <button onClick={clearAll} className="text-[11px] text-gray-500 hover:underline">Clear</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
                      {fields.map(f => {
                        const isRequired = REQUIRED_FIELDS.includes(f.field);
                        const checked = selectedFields.includes(f.field);
                        return (
                          <label
                            key={f.field}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer transition-colors
                              ${isRequired ? 'bg-blue-50 border-blue-200 cursor-default' :
                                checked ? 'bg-blue-50 border-blue-300 hover:bg-blue-100' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isRequired}
                              onChange={() => toggleField(f.field)}
                              className="accent-blue-600 w-3 h-3"
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-gray-800 truncate">
                                {f.label}
                                {f.required && <span className="text-red-500 ml-0.5">*</span>}
                              </div>
                              <div className="text-[10px] text-gray-400 truncate">{f.description}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate || loadingFields}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {downloadingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Download Template (.xlsx)
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Next: Upload →
                </button>
              </div>
            </div>
          )}

          {/* ──────── STEP 2: Upload ──────── */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden w-fit">
                {(['file', 'url'] as UploadMode[]).map(mode => (
                  <button
                    key={mode}
                    onClick={() => { setUploadMode(mode); setUploadError(null); }}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors
                      ${uploadMode === mode ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    {mode === 'file' ? <Upload className="w-3.5 h-3.5" /> : <Link className="w-3.5 h-3.5" />}
                    {mode === 'file' ? 'Upload File' : 'From URL'}
                  </button>
                ))}
              </div>

              {/* File drop zone */}
              {uploadMode === 'file' && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors
                    ${isDragging ? 'border-blue-400 bg-blue-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-300 hover:bg-gray-50'}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) { setFile(f); setUploadError(null); }
                    }}
                  />
                  {file ? (
                    <>
                      <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                      <p className="text-sm font-medium text-gray-800">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB — click to change</p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400 mb-2" />
                      <p className="text-sm font-medium text-gray-600">Drop .xlsx file here or click to browse</p>
                      <p className="text-xs text-gray-400">Excel files only (.xlsx), max 20 MB</p>
                    </>
                  )}
                </div>
              )}

              {/* URL input */}
              {uploadMode === 'url' && (
                <div>
                  <label className="text-xs font-medium text-gray-700 block mb-1">Excel File URL</label>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={e => { setUrlInput(e.target.value); setUploadError(null); }}
                    placeholder="https://example.com/employees.xlsx"
                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">The server will download the file from this URL (http/https only).</p>
                </div>
              )}

              {uploadError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">{uploadError}</p>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || (uploadMode === 'file' ? !file : !urlInput.trim())}
                  className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploading ? 'Importing…' : 'Upload & Import'}
                </button>
              </div>
            </div>
          )}

          {/* ──────── STEP 3: Results ──────── */}
          {step === 3 && uploadResult && (
            <div className="space-y-4">
              {/* Result summary card */}
              <div className={`rounded-xl border p-4 ${
                uploadResult.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  {uploadResult.failed === 0
                    ? <CheckCircle className="w-5 h-5 text-green-600" />
                    : <AlertCircle className="w-5 h-5 text-amber-600" />}
                  <p className="text-sm font-semibold text-gray-800">{uploadResult.message || 'Import complete'}</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <StatBox label="Created" value={uploadResult.created} color="text-green-700" />
                  <StatBox label="Updated" value={uploadResult.updated} color="text-blue-700" />
                  <StatBox label="Failed" value={uploadResult.failed} color="text-red-700" />
                  <StatBox label="Total Rows" value={uploadResult.total} color="text-gray-700" />
                  <StatBox label="Manager Links" value={uploadResult.resolvedManagers} color="text-purple-700" />
                  <StatBox label="App User Links" value={uploadResult.linkedUsers} color="text-indigo-700" />
                </div>
              </div>

              {/* Errors */}
              {uploadResult.errors?.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-hidden">
                  <button
                    className="flex items-center justify-between w-full px-3 py-2 bg-red-50 text-xs font-medium text-red-700"
                    onClick={() => setErrorsExpanded(x => !x)}
                  >
                    <span>{uploadResult.errors.length} error{uploadResult.errors.length > 1 ? 's' : ''}</span>
                    {errorsExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {errorsExpanded && (
                    <ul className="divide-y divide-red-100 max-h-40 overflow-y-auto">
                      {uploadResult.errors.map((e, i) => (
                        <li key={i} className="px-3 py-1.5 text-xs text-red-700 bg-white">{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Admin: Sync App Users */}
              {isAdmin && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Users className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-700">Sync App Users</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Link employee records to ProdVista app accounts by matching email addresses.
                      </p>
                      {syncResult && (
                        <p className="text-[11px] text-emerald-700 mt-1">
                          ✓ {syncResult.message} ({syncResult.synced} synced, {syncResult.linked} linked)
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors flex-shrink-0"
                    >
                      {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Users className="w-3 h-3" />}
                      {syncing ? 'Syncing…' : 'Sync'}
                    </button>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => { setStep(2); setUploadResult(null); setFile(null); setUrlInput(''); }}
                  className="px-4 py-2 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Upload More
                </button>
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 px-3 py-2 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}
