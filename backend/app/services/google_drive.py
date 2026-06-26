from collections.abc import AsyncIterator, Callable

import httpx

CHUNK_SIZE = 8 * 1024 * 1024


async def create_resumable_session(access_token: str, filename: str, mime_type: str) -> str:
    async with httpx.AsyncClient() as client:
        res = await client.post(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
            },
            json={"name": filename, "mimeType": mime_type},
        )

    if not res.is_success:
        raise RuntimeError(f"Failed to start Drive upload: {res.text}")

    session_url = res.headers.get("Location")
    if not session_url:
        raise RuntimeError("Drive upload session URL missing")
    return session_url


async def put_chunk(
    session_url: str,
    chunk: bytes,
    start_byte: int,
    is_final: bool,
    total_bytes: int,
) -> dict:
    end_byte = start_byte + len(chunk) - 1
    content_range = (
        f"bytes {start_byte}-{end_byte}/{total_bytes}"
        if is_final
        else f"bytes {start_byte}-{end_byte}/*"
    )

    async with httpx.AsyncClient() as client:
        res = await client.put(
            session_url,
            headers={
                "Content-Length": str(len(chunk)),
                "Content-Range": content_range,
            },
            content=chunk,
        )

    if res.status_code == 308:
        return {"done": False}

    if not res.is_success:
        raise RuntimeError(f"Drive upload failed ({res.status_code}): {res.text}")

    return {"done": True, "data": res.json()}


async def upload_stream_resumable(
    session_url: str,
    byte_iter: AsyncIterator[bytes],
    *,
    on_progress: Callable[[dict], None] | None = None,
) -> dict:
    offset = 0
    buffer = b""

    async for value in byte_iter:
        if value:
            buffer += value

        while len(buffer) >= CHUNK_SIZE:
            chunk = buffer[:CHUNK_SIZE]
            buffer = buffer[CHUNK_SIZE:]
            result = await put_chunk(session_url, chunk, offset, False, 0)
            if result.get("done"):
                return result["data"]
            offset += len(chunk)
            on_progress and on_progress({"uploaded": offset, "total": 0})

    total_size = offset + len(buffer)
    if len(buffer) == 0 and offset == 0:
        raise RuntimeError("Empty stream — nothing to upload")

    if buffer:
        result = await put_chunk(session_url, buffer, offset, True, total_size)
        on_progress and on_progress({"uploaded": total_size, "total": total_size})
        return result["data"]

    async with httpx.AsyncClient() as client:
        res = await client.put(
            session_url,
            headers={
                "Content-Length": "0",
                "Content-Range": f"bytes */{offset}",
            },
        )
    if res.is_success:
        return res.json()

    on_progress and on_progress({"uploaded": offset, "total": offset})
    return {"id": None, "webViewLink": "https://drive.google.com/drive/my-drive"}
