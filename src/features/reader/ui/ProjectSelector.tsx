"use client";

import { useMemo, useState } from "react";
import { MoreHorizontal, PanelLeft, Pin, Plus, Trash2 } from "lucide-react";
import type { ProjectSummary } from "../domain/types";

function truncatePreview(value: string) {
  const normalized = value.trim();
  if (!normalized) return "Prázdný projekt";
  return normalized.length > 40 ? `${normalized.slice(0, 40)}…` : normalized;
}

export function ProjectSelector({
  currentProjectId,
  projects,
  onProjectOpen,
  onProjectCreate,
  onProjectRename,
  onProjectPin,
  onProjectDelete,
}: {
  currentProjectId: string | null;
  projects: ProjectSummary[];
  onProjectOpen: (projectId: string) => void | Promise<void>;
  onProjectCreate: () => void | Promise<void>;
  onProjectRename: (projectId: string, title: string) => void | Promise<void>;
  onProjectPin: (projectId: string, pinned: boolean) => void | Promise<void>;
  onProjectDelete: (projectId: string) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const orderedProjects = useMemo(
    () =>
      [...projects].sort((left, right) => {
        if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
        return right.updated_at - left.updated_at;
      }),
    [projects],
  );

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
            onClick={() => {
              setOpen(false);
              setMenuProjectId(null);
            }}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[18.5rem] flex-col bg-white px-2 py-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between px-2 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
              <span>Projekty</span>
              <button
                type="button"
                onClick={() => void onProjectCreate()}
                className="inline-flex items-center gap-1 text-inherit transition-colors hover:text-black"
              >
                <Plus className="h-3 w-3" />
                <span>Nový</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {orderedProjects.length ? (
                orderedProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`group relative flex items-center gap-2 rounded-sm px-2 py-2 transition-colors ${
                      project.id === currentProjectId ? "bg-black text-white" : "text-black hover:bg-gray-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void onProjectOpen(project.id);
                        setOpen(false);
                        setMenuProjectId(null);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-1 text-xs">
                        {project.pinned ? <Pin className="h-3 w-3 shrink-0" /> : null}
                        <span className="truncate">{project.title}</span>
                      </div>
                      <div className="truncate text-[11px] opacity-70">{truncatePreview(project.preview)}</div>
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenuProjectId((current) => (current === project.id ? null : project.id));
                      }}
                      className={`shrink-0 transition-opacity ${
                        menuProjectId === project.id || project.id === currentProjectId
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                      aria-label="Akce projektu"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {menuProjectId === project.id ? (
                      <div
                        className={`absolute right-2 top-9 z-10 min-w-[9rem] bg-white py-1 text-xs shadow-lg ${
                          project.id === currentProjectId ? "text-black" : "text-black"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const nextTitle = window.prompt("Přejmenovat projekt", project.title)?.trim();
                            if (nextTitle) void onProjectRename(project.id, nextTitle);
                            setMenuProjectId(null);
                          }}
                          className="block w-full px-3 py-2 text-left hover:bg-gray-100"
                        >
                          Přejmenovat
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onProjectPin(project.id, !project.pinned);
                            setMenuProjectId(null);
                          }}
                          className="block w-full px-3 py-2 text-left hover:bg-gray-100"
                        >
                          {project.pinned ? "Odepnout" : "Připnout"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Smazat projekt?")) void onProjectDelete(project.id);
                            setMenuProjectId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-500 hover:bg-gray-100"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Smazat</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="px-2 py-2 text-sm text-gray-500">Zatím bez uložených projektů.</div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
