"use client";

import { useState } from "react";
import { BookOpenText, PanelLeft } from "lucide-react";
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
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="fixed left-4 top-4 z-30 inline-flex h-9 w-9 items-center justify-center text-gray-400 transition-colors hover:text-black"
        aria-label="Otevřít projekty"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-20 bg-black/8">
          <button
            type="button"
            aria-label="Zavřít projekty"
            className="absolute inset-0"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[20rem] flex-col bg-white px-3 py-4 shadow-lg">
            <div className="mb-4 flex items-center gap-2 px-2 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
              <BookOpenText className="h-3 w-3" />
              <span>{activeProject?.title ?? "Projekty"}</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {projects.length ? (
                projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      void onProjectOpen(project.id);
                      setOpen(false);
                    }}
                    className={`block w-full px-3 py-3 text-left transition-colors ${
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
          </div>
        </div>
      ) : null}
    </>
  );
}
