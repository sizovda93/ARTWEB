interface SectionCardProps {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export function SectionCard({ title, actions, children }: SectionCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
