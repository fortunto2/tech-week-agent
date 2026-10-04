import { renderStatus } from "@/lib/render";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await renderStatus(Number(id));
  if (!s) return new Response("not found", { status: 404 });
  return Response.json(s, { headers: { "Cache-Control": "no-store" } });
}
