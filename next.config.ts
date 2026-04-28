import type { NextConfig } from "next";

// ビルド時は `--webpack` (next build --webpack) で webpack に opt-out している。
// 理由: WAF/セキュリティソフトが `~` を含む URL を 403 で遮断するケースへの対策。
// dev は Turbopack のまま（HMR 速度を維持）。
const nextConfig: NextConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack: (config: any) => {
    const splitChunks = config.optimization?.splitChunks;
    if (splitChunks && typeof splitChunks === "object") {
      splitChunks.automaticNameDelimiter = "-";
    }

    if (config.output) {
      const replaceTilde = (v: unknown) =>
        typeof v === "string" ? v.replace(/~/g, "-") : v;
      config.output.filename = replaceTilde(config.output.filename);
      config.output.chunkFilename = replaceTilde(config.output.chunkFilename);
      if (config.output.assetModuleFilename !== undefined) {
        config.output.assetModuleFilename = replaceTilde(
          config.output.assetModuleFilename
        );
      }
    }
    return config;
  },
};

export default nextConfig;
