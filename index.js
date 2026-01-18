import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

/**
 * POST /merge
 * Body:
 * {
 *   "videoUrl": "https://...",
 *   "audioUrl": "https://..."
 * }
 */
app.post("/merge", async (req, res) => {
  const { videoUrl, audioUrl } = req.body;

  if (!videoUrl || !audioUrl) {
    return res.status(400).json({
      error: "Both videoUrl and audioUrl are required"
    });
  }

  try {
    /**
     * 🔧 FFmpeg merge logic goes here
     * Example (pseudo):
     *
     * ffmpeg
     *  -i video.mp4
     *  -i audio.mp3
     *  -c:v copy
     *  -c:a aac
     *  -shortest
     *  output.mp4
     */

    res.json({
      success: true,
      message: "Video and audio merge started",
      videoUrl,
      audioUrl
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Failed to merge video and audio"
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Merge API running on port ${PORT}`);
});
