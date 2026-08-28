import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: IndexPage,
});

export function IndexPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-4">Public Landing Page</h1>
      <Link to="/login" className="text-primary underline">
        Go to Login
      </Link>
    </div>
  );
}
