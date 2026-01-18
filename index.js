import express from "express";
import cors from "cors";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- CORS (ALLOW MeDo) ---------- */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

/* ---------- Multer Upload ---------- */
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

/* ---------- Root ---------- */
app.get("/", (req, res) => {
  res.send("🎬 Video + Audio Merge Backend is running");
});

/* ---------- Merge Endpoint ---------- */
app.post(
  "/merge",
  upload.fields([
    { name: "video", maxCount: 1 },
    { name: "audio", maxCount: 1 }
  ]),
  async (req, res) => {
    if (!req.files?.video || !req.files?.audio) {
      return res.status(400).json({ error: "Video and audio required" });
    }

    const videoPath = req.files.video[0].path;
    const audioPath = req.files.audio[0].path;
    const outputPath = `merged-${Date.now()}.mp4`;

    try {
      ffmpeg(videoPath)
        .input(audioPath)
        .outputOptions([
          "-c:v copy",
          "-c:a aac",
          "-shortest"
        ])
        .save(outputPath)
        .on("end", () => {
          res.download(outputPath, () => {
            // cleanup
            [videoPath, audioPath, outputPath].forEach(f => {
              if (fs.existsSync(f)) fs.unlinkSync(f);
            });
          });
        })
        .on("error", err => {
          console.error(err);
          res.status(500).json({ error: "FFmpeg merge failed" });
        });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
