import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();

/* ✅ ADD CORS HERE (THIS IS THE FIX) */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

const PORT = process.env.PORT || 3000;

/* ---------- Upload Config ---------- */
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

/* ---------- Root Route ---------- */
app.get("/", (req, res) => {
  res.send("🎬 Video + Audio Merge API is running 🚀");
});

/* ---------- Health Check ---------- */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* ---------- Merge Route ---------- */
app.post(
  "/merge",
  upload.fields([
    { name: "videos", maxCount: 10 },
    { name: "audios", maxCount: 2 }
  ]),
  async (req, res) => {
    try {
      if (!req.files?.videos || !req.files?.audios) {
        return res.status(400).json({ error: "Videos and audios required" });
      }

      const videos = req.files.videos.map(f => f.path);
      const audios = req.files.audios.map(f => f.path);

      const videoListFile = "videos.txt";
      const mergedVideo = "merged_video.mp4";
      const mixedAudio = "mixed_audio.mp3";
      const outputFile = "final_output.mp4";

      fs.writeFileSync(
        videoListFile,
        videos.map(v => `file '${path.resolve(v)}'`).join("\n")
      );

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(videoListFile)
          .inputOptions(["-f concat", "-safe 0"])
          .outputOptions(["-c copy"])
          .save(mergedVideo)
          .on("end", resolve)
          .on("error", reject);
      });

      await new Promise((resolve, reject) => {
        const cmd = ffmpeg();
        audios.forEach(a => cmd.input(a));

        cmd
          .complexFilter([`amix=inputs=${audios.length}`])
          .save(mixedAudio)
          .on("end", resolve)
          .on("error", reject);
      });

      ffmpeg(mergedVideo)
        .input(mixedAudio)
        .outputOptions(["-c:v copy", "-c:a aac"])
        .save(outputFile)
        .on("end", () => {
          res.download(outputFile, () => {
            [...videos, ...audios, videoListFile, mergedVideo, mixedAudio, outputFile]
              .forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
          });
        })
        .on("error", err => {
          res.status(500).json({ error: err.message });
        });

    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* ---------- Start Server ---------- */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
