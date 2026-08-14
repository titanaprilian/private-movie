export function QuickActions() {
  return (
    <div className="bg-card border border-c rounded">
      <div className="px-4 py-3 border-b border-c">
        <h2 className="font-medium text-sm">Quick actions</h2>
      </div>
      <div className="p-3 space-y-2 text-sm">
        <button
          type="button"
          className="w-full text-left px-3 py-2 rounded hover-bg border border-c cursor-pointer transition-colors"
        >
          Create new item
        </button>
        <button
          type="button"
          className="w-full text-left px-3 py-2 rounded hover-bg border border-c cursor-pointer transition-colors"
        >
          Invite a member
        </button>
        <button
          type="button"
          className="w-full text-left px-3 py-2 rounded hover-bg border border-c cursor-pointer transition-colors"
        >
          View reports
        </button>
      </div>
    </div>
  );
}
