export function ErrorBanner({
  error,
  onDismiss,
}: {
  error: string | null;
  onDismiss: () => void;
}) {
  if (!error) return null;
  return (
    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="flex items-start gap-3">
        <div className="flex-1">{error}</div>
        <button onClick={onDismiss} className="text-red-400 hover:text-red-600">
          ✕
        </button>
      </div>
    </div>
  );
}
