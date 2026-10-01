"use client";

import { useEffect, useRef, useState } from "react";

export default function Article5Viewer({ code, legacyDoc }) {
  const frameRef = useRef(null);
  const viewportRef = useRef(null);
  const [frameReady, setFrameReady] = useState(false);
  const [status, setStatus] = useState(legacyDoc ? "legacy" : "loading");
  const [fullSize, setFullSize] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const fileUrl = `/belge/${encodeURIComponent(code)}/art-5-uygunluk-beyani`;

  useEffect(() => {
    if (!frameReady || legacyDoc) return;
    const controller = new AbortController();
    let disposed = false;
    let observer;
    const frame = frameRef.current;
    const doc = frame.contentDocument;
    const root = doc.getElementById("document");
    const styles = doc.getElementById("styles");
    setStatus("loading");
    async function load() {
      try {
        const [response, renderer] = await Promise.all([
          fetch(fileUrl, { signal: controller.signal, cache: "no-store" }),
          import("docx-preview"),
        ]);
        if (!response.ok) throw new Error("Document unavailable");
        const buffer = await response.arrayBuffer();
        if (disposed) return;
        await renderer.renderAsync(buffer, root, styles, {
          inWrapper: false, className: "ppwr-docx", useBase64URL: true,
          renderAltChunks: false, renderComments: false,
        });
        if (disposed) return;
        // Keep links inside the sandboxed document from navigating the viewer.
        root.querySelectorAll("a").forEach((link) => link.removeAttribute("href"));
        const resize = () => {
          if (disposed) return;
          root.style.transform = "none";
          const width = Math.max(816, root.scrollWidth);
          const available = viewportRef.current.clientWidth;
          const scale = fullSize ? 1 : Math.min(1, available / width);
          root.style.transform = `scale(${scale})`;
          frame.style.width = `${fullSize ? width : available}px`;
          frame.style.height = `${Math.ceil(root.scrollHeight * scale) + 24}px`;
        };
        observer = new ResizeObserver(resize);
        observer.observe(viewportRef.current);
        observer.observe(root);
        resize();
        setStatus("ready");
      } catch (error) {
        if (!disposed && error.name !== "AbortError") setStatus("error");
      }
    }
    load();
    return () => { disposed = true; controller.abort(); observer?.disconnect(); };
  }, [fileUrl, frameReady, fullSize, attempt, legacyDoc]);

  return <main className="art5-viewer">
    <header className="art5-toolbar">
      <a className="btn" href={`/${encodeURIComponent(code)}`}>← Kayda dön / Back</a>
      <div><h1>Art.5 PPWR Uygunluk Beyanı</h1><p>ART5_{code}.{legacyDoc ? "doc" : "docx"}</p></div>
      <a className="btn primary" href={`${fileUrl}?indir=1`}>Belgeyi indir / Download</a>
    </header>
    {!legacyDoc && <div className="art5-controls"><button className="btn" type="button" aria-pressed={fullSize} onClick={() => setFullSize((v) => !v)}>{fullSize ? "Ekrana sığdır / Fit" : "Büyüt / Zoom"}</button><span>Yakınlaştırmak için iki parmağınızı kullanabilirsiniz.</span></div>}
    {status === "loading" && <p role="status">Belge açılıyor… / Loading document…</p>}
    {status === "error" && <div role="alert"><p>Önizleme açılamadı. Tekrar deneyebilir veya belgeyi indirebilirsiniz.</p><button className="btn" onClick={() => setAttempt((v) => v + 1)}>Tekrar dene / Retry</button></div>}
    {legacyDoc && <p>Bu belge eski DOC biçimindedir. Görüntülemek için “Belgeyi indir” düğmesiyle Word uygulamasında açabilirsiniz. / Download this legacy DOC file to open it in Word.</p>}
    {!legacyDoc && <div ref={viewportRef} className="art5-viewport" aria-busy={status === "loading"}>
      <iframe ref={frameRef} title="Art.5 belge önizlemesi" sandbox="allow-same-origin" onLoad={() => setFrameReady(true)} style={{ visibility: status === "ready" ? "visible" : "hidden" }} srcDoc={'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:#fff;overflow:hidden}#document{width:816px;transform-origin:top left}#document>section{box-sizing:border-box;margin:0 auto 16px;max-width:none}#document img{max-width:100%}</style><div id="styles"></div></head><body><div id="document"></div></body></html>'} />
    </div>}
  </main>;
}
