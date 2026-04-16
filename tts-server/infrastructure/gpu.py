from typing import Any

import torch


def ensure_gpu_ready() -> dict[str, Any]:
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA is not available. OmniVoice is configured to require GPU.")

    try:
        torch.zeros(1, device="cuda")
    except Exception as exc:
        raise RuntimeError(f"CUDA exists but cannot allocate tensors: {exc}") from exc

    return {
        "cuda_available": True,
        "device_count": torch.cuda.device_count(),
        "device_name": torch.cuda.get_device_name(0),
        "device_capability": ".".join(str(part) for part in torch.cuda.get_device_capability(0)),
    }
