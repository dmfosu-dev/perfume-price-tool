import { ImageResponse } from "next/og";

/// Generated rather than committed as binaries, so there is one source of truth
/// for the mark and no stale PNGs to keep in step.
const ALLOWED = new Set([192, 512]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: raw } = await params;
  const size = Number(raw);
  if (!ALLOWED.has(size)) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f8fafc",
          fontSize: size * 0.42,
          fontWeight: 700,
          letterSpacing: -size * 0.02,
        }}
      >
        PPT
      </div>
    ),
    { width: size, height: size },
  );
}
