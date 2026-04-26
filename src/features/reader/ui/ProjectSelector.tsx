"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const orderedProjects = useMemo(
    () =>
      [...projects].sort((left, right) => {
        if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
        return right.updated_at - left.updated_at;
      }),
    [projects],
  );

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setMenuProjectId(null);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="fixed left-4 top-4 z-30">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="frameless-action frameless-focus inline-flex h-9 w-9 items-center justify-center"
        aria-label="Otevřít projekty"
      >
        <PanelLeft className="h-4 w-4" />
      </button>

      {open ? (
        <aside className="reader-sidebar absolute left-0 top-full mt-3 flex w-[18.5rem] flex-col">
            <div className="mb-4 flex items-center justify-between px-2 text-[10px] font-medium uppercase tracking-[0.2em] text-gray-400">
              <span>Projekty</span>
              <button
                type="button"
                onClick={() => void onProjectCreate()}
                className="frameless-action frameless-focus gap-1"
              >
                <Plus className="h-3 w-3" />
                <span>Nový</span>
              </button>
            </div>

            <div className="flex max-h-[calc(100vh-7rem)] flex-1 flex-col gap-3 overflow-y-auto">
              {orderedProjects.length ? (
                orderedProjects.map((project) => (
                  <div
                    key={project.id}
                    className={`group relative flex items-start gap-2 px-2 transition-[color,opacity,transform,letter-spacing] duration-200 ${
                      project.id === currentProjectId ? "text-black" : "text-gray-400 hover:text-black"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void onProjectOpen(project.id);
                        setOpen(false);
                        setMenuProjectId(null);
                      }}
                      className="frameless-focus min-w-0 flex-1 text-left"
                    >
                      <div
                        className={`flex items-center gap-1 text-xs transition-[letter-spacing,transform] duration-200 ${
                          project.id === currentProjectId ? "translate-x-1 tracking-[0.14em]" : ""
                        }`}
                      >
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
                      className={`frameless-focus shrink-0 p-0 transition-opacity ${
                        menuProjectId === project.id || project.id === currentProjectId
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                      aria-label="Akce projektu"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>

                    {menuProjectId === project.id ? (
                      <div className="reader-dropdown absolute right-2 top-7 z-10 min-w-[10rem] text-xs text-black">
                        <button
                          type="button"
                          onClick={() => {
                            const nextTitle = window.prompt("Přejmenovat projekt", project.title)?.trim();
                            if (nextTitle) void onProjectRename(project.id, nextTitle);
                            setMenuProjectId(null);
                          }}
                          className="reader-dropdown-item frameless-focus block w-full justify-start text-xs"
                        >
                          Přejmenovat
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void onProjectPin(project.id, !project.pinned);
                            setMenuProjectId(null);
                          }}
                          className="reader-dropdown-item frameless-focus block w-full justify-start text-xs"
                        >
                          {project.pinned ? "Odepnout" : "Připnout"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Smazat projekt?")) void onProjectDelete(project.id);
                            setMenuProjectId(null);
                          }}
                          className="reader-dropdown-item frameless-focus flex w-full items-center justify-start gap-2 text-xs text-red-500 hover:!bg-red-50 hover:!text-red-600 focus-visible:!bg-red-50 focus-visible:!text-red-600"
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
      ) : null}
    </div>
  );
}
