import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // In development the shop owner opens this on the counter PC, and customers
  // open the QR link on their phones over the shop wifi. Those phones arrive on
  // the PC's LAN address, which Next blocks by default, and being blocked stops
  // hot reload and page interactivity rather than just the dev socket.
  // Patterns match one dot-segment per "*", so each private range is spelled out.
  allowedDevOrigins: ["127.0.0.1", "[::1]", "192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
};

export default nextConfig;
