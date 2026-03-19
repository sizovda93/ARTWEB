interface EmptyStateProps {
  message: string;
  description?: string;
}

export function EmptyState({ message, description }: EmptyStateProps) {
  return (
    <div className="text-center py-8">
      <p className="text-sm font-medium text-gray-500">{message}</p>
      {description && (
        <p className="mt-1 text-sm text-gray-400">{description}</p>
      )}
    </div>
  );
}
