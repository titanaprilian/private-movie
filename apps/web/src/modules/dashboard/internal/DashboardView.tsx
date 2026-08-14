import { toast } from 'sonner';
import { MetricsGrid } from './MetricsGrid';
import { QuickActions } from './QuickActions';
import { RecentActivity } from './RecentActivity';
import { RecentItemsTable } from './RecentItemsTable';

export function DashboardView() {
  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-lg font-semibold">Dashboard</h1>
          <p className="text-xs text-muted">
            Overview of your data for this period.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            toast.success('item.create', {
              description: 'new item created successfully',
            })
          }
          className="px-3 py-1.5 rounded bg-primary text-primary-fg text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity"
        >
          + Add new
        </button>
      </div>

      {/* Metrics Grid */}
      <MetricsGrid />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Data Table */}
        <RecentItemsTable />

        {/* Right side panels */}
        <div className="space-y-4">
          <QuickActions />
          <RecentActivity />
        </div>
      </div>
    </>
  );
}
