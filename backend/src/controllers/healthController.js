exports.index = (req, res) => {
  res.send("VoiceScript Studio API is running.");
};

exports.health = (req, res) => {
  res.json({ status: "ok" });
};
