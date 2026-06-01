"""
Patch for vibeserve/models.py
Replace the FileReadInput and FileWriteInput classes with these validated versions.

The original classes accepted any string up to 1000 chars, including
../../etc/passwd. These validators reject traversal attempts at the model layer,
before the path ever reaches the filesystem.
"""

from pathlib import Path, PurePosixPath
from pydantic import BaseModel, Field, field_validator


class FileReadInput(BaseModel):
    path: str = Field(min_length=1, max_length=1000)

    @field_validator("path")
    @classmethod
    def no_traversal(cls, v: str) -> str:
        # Reject obvious traversal sequences before any filesystem resolution.
        # The definitive check happens in _resolve_workspace_path(), but this
        # catches the most common patterns at validation time and produces a
        # clearer error message.
        normalized = PurePosixPath(v).as_posix()
        parts = normalized.split("/")
        if ".." in parts:
            raise ValueError(
                "Path traversal sequences ('..') are not allowed. "
                "Use a path relative to the workspace root."
            )
        # Reject absolute paths — all paths must be workspace-relative.
        if v.startswith("/") or (len(v) > 1 and v[1] == ":"):  # Unix abs or Windows drive
            raise ValueError(
                "Absolute paths are not allowed. "
                "Use a path relative to the workspace root."
            )
        return v


class FileWriteInput(BaseModel):
    path: str = Field(min_length=1, max_length=1000)
    content: str = Field(min_length=0, max_length=1_000_000)

    @field_validator("path")
    @classmethod
    def no_traversal(cls, v: str) -> str:
        normalized = PurePosixPath(v).as_posix()
        parts = normalized.split("/")
        if ".." in parts:
            raise ValueError(
                "Path traversal sequences ('..') are not allowed. "
                "Use a path relative to the workspace root."
            )
        if v.startswith("/") or (len(v) > 1 and v[1] == ":"):
            raise ValueError(
                "Absolute paths are not allowed. "
                "Use a path relative to the workspace root."
            )
        return v
