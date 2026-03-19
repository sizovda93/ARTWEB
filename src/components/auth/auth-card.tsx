interface AuthCardProps {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({ title, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-6">
          {title}
        </h1>
        {children}
      </div>
      {footer && (
        <div className="mt-4 text-center text-sm text-gray-600">{footer}</div>
      )}
    </div>
  );
}
