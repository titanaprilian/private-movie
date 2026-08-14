import { useState } from 'react';

export interface RecentItem {
  id: string;
  name: string;
  status: 'Active' | 'Pending' | 'Inactive';
  assignee: string;
  date: string;
}

const ITEMS: RecentItem[] = [
  {
    id: '1',
    name: 'Item one',
    status: 'Active',
    assignee: 'Jane Cooper',
    date: '2h ago',
  },
  {
    id: '2',
    name: 'Item two',
    status: 'Pending',
    assignee: 'Wade Warren',
    date: '5h ago',
  },
  {
    id: '3',
    name: 'Item three',
    status: 'Active',
    assignee: 'Esther Howard',
    date: '1d ago',
  },
  {
    id: '4',
    name: 'Item four',
    status: 'Inactive',
    assignee: 'Cody Fisher',
    date: '2d ago',
  },
];

const statusStyles: Record<RecentItem['status'], string> = {
  Active:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  Pending:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Inactive: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function RecentItemsTable() {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const toggleMenu = (id: string) => {
    setOpenMenuId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="lg:col-span-2 bg-card border border-c rounded">
      <div className="px-4 py-3 border-b border-c flex items-center justify-between">
        <h2 className="font-medium text-sm">Recent items</h2>
        <span className="text-xs text-muted">24 total</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted border-b border-c text-xs">
              <th className="px-4 py-2 font-medium">Name ↕</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Assignee</th>
              <th className="px-4 py-2 font-medium">Date ↕</th>
              <th className="px-4 py-2 font-medium w-8"></th>
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((item, index) => {
              const isLast = index === ITEMS.length - 1;
              const isOpen = openMenuId === item.id;

              return (
                <tr
                  key={item.id}
                  className={`${isLast ? '' : 'border-b border-c'} hover-bg`}
                >
                  <td className="px-4 py-2.5 font-medium">{item.name}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${statusStyles[item.status]}`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{item.assignee}</td>
                  <td className="px-4 py-2.5 text-muted">{item.date}</td>
                  <td className="px-4 py-2.5 relative">
                    <button
                      type="button"
                      onClick={() => toggleMenu(item.id)}
                      className="text-muted hover:text-current cursor-pointer"
                      aria-label="Actions"
                    >
                      ⋯
                    </button>
                    {isOpen && (
                      <div className="absolute right-4 mt-1 bg-card border border-c rounded shadow-lg w-28 z-10 py-1 menu">
                        <a
                          href="#"
                          onClick={(e) => e.preventDefault()}
                          className="block px-3 py-1.5 hover-bg text-sm"
                        >
                          Edit
                        </a>
                        <a
                          href="#"
                          onClick={(e) => e.preventDefault()}
                          className="block px-3 py-1.5 hover-bg text-sm"
                        >
                          Duplicate
                        </a>
                        <a
                          href="#"
                          onClick={(e) => e.preventDefault()}
                          className="block px-3 py-1.5 hover-bg text-sm text-red-500"
                        >
                          Delete
                        </a>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t border-c flex items-center justify-between text-xs text-muted">
        <span>Page 1 of 6</span>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-2.5 py-1 rounded border border-c hover-bg cursor-pointer"
          >
            Previous
          </button>
          <button
            type="button"
            className="px-2.5 py-1 rounded border border-c hover-bg cursor-pointer"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
