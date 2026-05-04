import asyncio
import contextlib
from collections.abc import Coroutine
from typing import Any


class TaskRegistry:
    def __init__(self, max_active_jobs: int):
        self.semaphore = asyncio.Semaphore(max_active_jobs if max_active_jobs > 0 else 1)
        self._legacy_tasks: dict[str, asyncio.Task[None]] = {}
        self._project_tasks: dict[str, asyncio.Task[None]] = {}
        self._project_job_ids: dict[str, str] = {}

    def active_job_count(self, jobs: dict[str, dict[str, Any]]) -> int:
        return sum(1 for job in jobs.values() if job["status"] in {"queued", "running"})

    def start_legacy_job(self, job_id: str, coroutine: Coroutine[Any, Any, None]):
        self._legacy_tasks[job_id] = asyncio.create_task(coroutine)

    def start_project_job(self, project_id: str, job_id: str, coroutine: Coroutine[Any, Any, None]):
        self._project_job_ids[project_id] = job_id
        self._project_tasks[project_id] = asyncio.create_task(coroutine)

    def project_job_id(self, project_id: str):
        return self._project_job_ids.get(project_id)

    def project_task(self, project_id: str):
        return self._project_tasks.get(project_id)

    def remove_legacy_job(self, job_id: str):
        self._legacy_tasks.pop(job_id, None)

    def cancel_project(self, project_id: str):
        active_task = self._project_tasks.pop(project_id, None)
        if active_task and not active_task.done():
            active_task.cancel()
        self._project_job_ids.pop(project_id, None)

    async def wait_for_legacy_job(self, job_id: str):
        task = self._legacy_tasks.get(job_id)
        if task:
            await task

    async def wait_for_project(self, project_id: str):
        task = self._project_tasks.get(project_id)
        if task:
            await task

    async def shutdown(self):
        for task in self._legacy_tasks.values():
            task.cancel()
        for task in self._project_tasks.values():
            task.cancel()
        for task in self._legacy_tasks.values():
            with contextlib.suppress(asyncio.CancelledError):
                await task
        for task in self._project_tasks.values():
            with contextlib.suppress(asyncio.CancelledError):
                await task
        self._legacy_tasks.clear()
        self._project_tasks.clear()
        self._project_job_ids.clear()
