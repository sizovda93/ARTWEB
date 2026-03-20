"use client";

import { useState } from "react";

interface ChecklistData {
  id: string;
  title: string;
  items: { id: string; text: string }[];
}

export function LessonChecklist({ checklists }: { checklists: ChecklistData[] }) {
  if (checklists.length === 0) return null;

  return (
    <div className="space-y-4">
      {checklists.map((cl) => (
        <div key={cl.id} className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">{cl.title}</h3>
          <div className="space-y-2">
            {cl.items.map((item) => (
              <CheckItem key={item.id} text={item.text} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CheckItem({ text }: { text: string }) {
  const [checked, setChecked] = useState(false);

  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => setChecked(!checked)}
        className="mt-0.5 rounded border-gray-300"
      />
      <span className={`text-sm ${checked ? "text-gray-400 line-through" : "text-gray-700"}`}>
        {text}
      </span>
    </label>
  );
}
