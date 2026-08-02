import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `/dashboard` was the app's only signed-in route until the shell landed and
   * split it into four. This covers what still points at the old name: browser
   * history, and Clerk's post-sign-in redirect on Vercel, which is an
   * environment variable that has to be changed by hand in the project settings
   * and so can lag a deploy.
   *
   * `permanent: false` sends a 307 rather than a 308, which browsers do not
   * cache. That matters because this entry is meant to be deleted once nothing
   * needs it — a cached 308 would outlive its own removal.
   */
  async redirects() {
    return [{ source: "/dashboard", destination: "/fixtures", permanent: false }];
  },
};

export default nextConfig;
