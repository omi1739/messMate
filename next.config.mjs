/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    // Next only optimises qualities listed here. 75 is the default used across
    // the app; 90 is for the full-screen demo lightbox, where extra crispness
    // is worth the larger file.
    qualities: [75, 90],
  },
};

export default nextConfig;
