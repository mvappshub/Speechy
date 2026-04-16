"use client";

import { useState } from "react";
import { BookOpenText, ChevronDown } from "lucide-react";
import type { ProjectSummary } from "../domain/types";

export function ProjectSelector({
  currentProjectId,
  projects,
  onProjectOpen,
}: {
  currentProjectId: string | null;
  projects: ProjectSummary[];
  onProjectOpen: (projectId: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const activeProject = projects.find((project) => project.id === currentProjectId) ?? null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 border border-gray-300 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-600 transition-colors hover:border-black hover:text-black"
      >
        <BookOpenText className="h-3 w-3" />
        <span>{activeProject?.title ?? "Projekty"}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-10 mt-2 min-w-[18rem] border border-gray-200 bg-white p-1 shadow-lg">
          {projects.length ? (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  void onProjectOpen(project.id);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-2 text-left transition-colors ${
                  project.id === currentProjectId ? "bg-black text-white" : "text-black hover:bg-gray-100"
                }`}
              >
                <div className="text-xs font-medium uppercase tracking-[0.18em]">{project.title}</div>
                <div className="mt-1 text-sm normal-case tracking-normal opacity-75">{project.preview}</div>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">Zatím bez uložených projektů.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
