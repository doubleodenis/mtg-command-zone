import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type ProfileInsert = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if profile exists, create if not
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!existingProfile) {
          // Create new profile
          const username =
            user.user_metadata?.preferred_username ||
            user.user_metadata?.user_name ||
            user.email?.split("@")[0] ||
            `user_${user.id.slice(0, 8)}`;

          // Use the user's full name from OAuth as display name
          const displayName =
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            null;

          const newProfile: ProfileInsert = {
            id: user.id,
            username: username.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
            display_name: displayName,
            avatar_url: user.user_metadata?.avatar_url || null,
          };

          await supabase.from("profiles").insert(newProfile as never);
        }
      }

      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
