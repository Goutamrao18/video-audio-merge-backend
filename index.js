import express from "express";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- Upload Config ---------- */
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 30 * 1024 * 1024 } // 30MB limit
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
    { name: "videos", maxCount: 5 },
    { name: "audios", maxCount: 5 }
  ]),
  async (req, res) => {
    try {
      if (!req.files.videos || !req.files.audios) {
        return res.status(400).json({ error: "Videos and audios required" });
      }

      const videos = req.files.videos.map(f => f.path);
      const audios = req.files.audios.map(f => f.path);

      const videoListFile = "videos.txt";
      const mergedVideo = "merged_video.mp4";
      const mixedAudio = "mixed_audio.mp3";
      const outputFile = "final_output.mp4";

      /* ---------- Create video list ---------- */
      fs.writeFileSync(
        videoListFile,
        videos.map(v => `file '${path.resolve(v)}'`).join("\n")
      );

      /* ---------- Merge Videos ---------- */
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(videoListFile)
          .inputOptions(["-f concat", "-safe 0"])
          .outputOptions(["-c copy"])
          .save(mergedVideo)
          .on("end", resolve)
          .on("error", reject);
      });

      /* ---------- Mix Audios ---------- */
      await new Promise((resolve, reject) => {
        const cmd = ffmpeg();
        audios.forEach(a => cmd.input(a));

        cmd
          .complexFilter([`amix=inputs=${audios.length}`])
          .save(mixedAudio)
          .on("end", resolve)
          .on("error", reject);
      });

      /* ---------- Merge Video + Audio ---------- */
      ffmpeg(mergedVideo)
        .input(mixedAudio)
        .outputOptions(["-c:v copy", "-c:a aac"])
        .save(outputFile)
        .on("end", () => {
          res.download(outputFile, () => {
            // cleanup
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
