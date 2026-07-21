import { readDiagnosisPhoto } from "@/lib/diagnosis";
import { withApiHandler } from "@/lib/api-handler";

export const GET = withApiHandler(async (
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) => {
  const { runId } = await context.params;
  const asset = await readDiagnosisPhoto(runId);

  if (!asset) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(Buffer.from(asset.image_blob), {
    headers: {
      "Content-Type": asset.image_content_type,
      "Content-Disposition": `inline; filename="${asset.image_name}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
});
