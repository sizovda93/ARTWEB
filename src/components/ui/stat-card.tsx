interface StatCardProps {
  label: string;
  value: string | number;
  description?: string;
}

export function StatCard({ label, value, description }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {description && (
        <p className="mt-1 text-xs text-gray-400">{description}</p>
      )}
    </div>
  );
}
