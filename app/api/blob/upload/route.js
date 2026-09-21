import { handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!blobToken) {
    return NextResponse.json(
      {
        error:
          "Vercel Blob client upload için BLOB_READ_WRITE_TOKEN eksik. Blob store'u bu projeye Read/Write token ile bağlayın ve yeniden deploy edin.",
      },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const jsonResponse = await handleUpload({
      body,
      request,
      token: blobToken,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("ppwr/")) throw new Error("Geçersiz dosya yolu.");
        return {
          allowedContentTypes: [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
            "image/svg+xml",
          ],
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: error?.message || "Dosya yükleme hatası." }, { status: 400 });
  }
}
