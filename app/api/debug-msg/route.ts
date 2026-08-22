import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signMessengerMediaUrls } from "@/lib/messenger/signMedia";

export const dynamic = "force-dynamic";

export async function GET() {
  const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await svc.from("messenger_messages").select("*").not("media_url", "is", null).limit(1);
  const signed = await signMessengerMediaUrls(data || []);
  return NextResponse.json({ original: data, signed });
}
