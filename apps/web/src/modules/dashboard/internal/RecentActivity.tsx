export interface ActivityItem {
  id: string;
  user: string;
  action: string;
  time: string;
}

const ACTIVITIES: ActivityItem[] = [
  {
    id: 'activity-1',
    user: 'Jane Cooper',
    action: 'updated Item one',
    time: '2h ago',
  },
  {
    id: 'activity-2',
    user: 'Wade Warren',
    action: 'created Item two',
    time: '5h ago',
  },
  {
    id: 'activity-3',
    user: 'Esther Howard',
    action: 'commented on Item three',
    time: '1d ago',
  },
  {
    id: 'activity-4',
    user: 'Cody Fisher',
    action: 'closed Item four',
    time: '2d ago',
  },
];

export function RecentActivity() {
  return (
    <div className="bg-card border border-c rounded">
      <div className="px-4 py-3 border-b border-c flex items-center justify-between">
        <h2 className="font-medium text-sm">Recent activity</h2>
      </div>
      <ul className="text-sm divide-y divide-[var(--border)]">
        {ACTIVITIES.map((activity) => (
          <li key={activity.id} className="px-4 py-2.5 hover-bg">
            <span className="font-medium">{activity.user}</span>{' '}
            <span className="text-muted">{activity.action}</span>
            <div className="text-xs text-muted mt-0.5">{activity.time}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
