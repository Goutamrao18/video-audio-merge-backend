import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.get("/background-music", async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: "video", // 🔥 REQUIRED for audio
      prefix: "background-music/", // 🔥 folder name
      max_results: 100,
    });

    const music = result.resources.map((file) => ({
      id: file.public_id,
      title: file.public_id.split("/").pop(),
      duration: file.duration || 0,
      url: file.secure_url, // ✅ use for preview + merge
    }));

    res.json(music);
  } catch (err) {
    console.error("Cloudinary error:", err);
    res.status(500).json({ error: "Failed to load music" });
  }
});
