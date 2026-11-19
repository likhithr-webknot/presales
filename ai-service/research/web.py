"""
Web evidence collection. Pages become citable evidence (URL + retrieval time) only after a
successful fetch; the model never "remembers" web facts. Search discovery is a pluggable
provider; none is bundled until one is chosen and keyed.
"""
from __future__ import annotations

import ipaddress
import socket
from html.parser import HTMLParser
from typing import Protocol
from urllib.parse import urlparse

import httpx

from grounding.evidence import EvidenceKind, EvidenceStore

MAX_BYTES = 2_000_000


class SearchProvider(Protocol):
    async def search(self, query: str, limit: int = 5) -> list[str]:
        """Return result URLs."""


class UnsafeURL(ValueError):
    pass


def assert_public_http_url(url: str) -> None:
    """SSRF guard: http(s) only, and the host must not resolve to a private/loopback address."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise UnsafeURL(f"unsupported URL: {url!r}")
    for info in socket.getaddrinfo(parsed.hostname, parsed.port or 443, proto=socket.IPPROTO_TCP):
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            raise UnsafeURL(f"refusing non-public address for {parsed.hostname}")


class _Text(HTMLParser):
    SKIP = {"script", "style", "noscript", "nav", "footer", "header", "svg"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.title = ""
        self._skip = 0
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip += 1
        self._in_title = tag == "title"

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip:
            self._skip -= 1
        if tag in ("p", "li", "h1", "h2", "h3", "br", "tr"):
            self.parts.append("\n\n")

    def handle_data(self, data):
        if self._in_title:
            self.title += data
        elif not self._skip and data.strip():
            self.parts.append(data.strip() + " ")


async def collect_web_evidence(urls: list[str], store: EvidenceStore, client: httpx.AsyncClient) -> list[str]:
    """Fetch each URL and add it to the store. Returns URLs that failed (reported, never hidden)."""
    failed: list[str] = []
    for url in urls:
        try:
            assert_public_http_url(url)
            resp = await client.get(url, follow_redirects=False, headers={"user-agent": "presales-research/0.1"})
            resp.raise_for_status()
            if "html" not in resp.headers.get("content-type", "") and "text" not in resp.headers.get("content-type", ""):
                raise ValueError("not a text page")
            parser = _Text()
            parser.feed(resp.text[:MAX_BYTES])
            text = "".join(parser.parts).strip()
            if not text:
                raise ValueError("no readable text")
            store.add_document(kind=EvidenceKind.WEB, title=parser.title.strip() or url, text=text, uri=url)
        except (httpx.HTTPError, UnsafeURL, ValueError, OSError):
            failed.append(url)
    return failed
